import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';
import axios from 'axios';
import { Buffer } from 'buffer';
import crypto from 'crypto';
import { ec as EC } from 'elliptic';
import { ethers } from 'ethers';


const ec = new EC("secp256k1");

const UploadFile = () => {
    const { wallet, token } = useWallet();
    const { contracts } = useContracts();
    const navigate = useNavigate();
    const [role, setRole] = useState(null);
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileHash, setFileHash] = useState('');
    const [aesKey, setAesKey] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState({});
    const [loading, setLoading] = useState(false);
    const [encryptedFile, setEncryptedFile] = useState(null);
    const [errorMessage, setErrorMessage] = useState(''); // New state for error messages

    useEffect(() => {
        const fetchRoleAndPatients = async () => {
            if (!token) return;
            setLoading(true);
            try {
                const res = await axios.get('http://localhost:5000/api/auth/role', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const userRole = res.data.role;
                setRole(userRole);

                if (userRole === 'hospital') {
                    const patientsRes = await axios.get('http://localhost:5000/api/file/hospital/patients-write-access', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setPatients(patientsRes.data);
                    if (patientsRes.data.length > 0) setSelectedPatient(patientsRes.data[0]);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setErrorMessage('Failed to load data.');
            } finally {
                setLoading(false);
            }
        };
        fetchRoleAndPatients();
    }, [token]);

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile || selectedFile.type.startsWith('video/')) {
            setErrorMessage('Please select a file (no videos allowed).');
            return;
        }

        setFile(selectedFile);
        setFileName(selectedFile.name);

        const arrayBuffer = await selectedFile.arrayBuffer();
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
        const hash = Buffer.from(hashBuffer).toString('hex');
        setFileHash(hash);

        const key = window.crypto.getRandomValues(new Uint8Array(32));
        setAesKey(Buffer.from(key).toString('hex'));
        setErrorMessage(''); // Clear error on successful file selection
    };

    const signHash = async (tokenHash) => {
        try {
            const signature = await wallet.signMessage(ethers.utils.arrayify(tokenHash));
            return signature;
        } catch (error) {
            console.error("Error signing hash:", error);
            throw error;
        }
    };

    function encryptAESKey(publicKeyHex) {
        publicKeyHex=publicKeyHex.substring(2);
        console.log("1.publickey:",publicKeyHex);
        console.log("2.aesKey:",aesKey);
        
        const userBPublicKey = ec.keyFromPublic(publicKeyHex, "hex").getPublic();

        const ephemeralKey = ec.genKeyPair();
        const ephemeralPublicKey = ephemeralKey.getPublic("hex");
        console.log("Ephemeral Public Key:", ephemeralPublicKey);

        const sharedSecret = ephemeralKey.derive(userBPublicKey);
        const encryptionKey = crypto.createHash("sha256")
            .update(Buffer.from(sharedSecret.toArray()))
            .digest(); 
        console.log("Derived Encryption Key:", encryptionKey.toString("hex"));

        const iv = crypto.randomBytes(12); 
        const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
        let encryptedAESKey = cipher.update(aesKey, null, "hex");
        encryptedAESKey += cipher.final("hex");
        const authTag = cipher.getAuthTag().toString("hex");

        const encryptedData = JSON.stringify({
            ephemeralPublicKey: ephemeralPublicKey,
            iv: iv.toString("hex"),
            encryptedAESKey: encryptedAESKey,
            authTag: authTag
        });
        
        return Buffer.from(encryptedData).toString("base64");
    }

    const handleUpload = async () => {
        console.log("---Initiating Upload---");
        if (!file || (role === 'hospital' && !selectedPatient)) {
            setErrorMessage('Please select a file and, for hospitals, a patient.');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        console.log("Retriving user details....")
        try {
            const res = await axios.get('http://localhost:5000/api/auth/user-details', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("user-details:",res.data);
            const uid = res.data.uniqueId;
            var publicKey=res.data.publicKey;
            if(role==='hospital'){
                console.log("selectedPatient:",selectedPatient);
                publicKey=selectedPatient.publicKey;
            }
            console.log("publicKey:",publicKey);
            console.log("---Encrypting file---");
            // Encrypt the file
            const rawKey = Buffer.from(aesKey, 'hex');
            const key = await window.crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );
            const fileContent = await file.arrayBuffer();
            const iv =  window.crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await  window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                fileContent
            );
            const encryptedHex = Buffer.from(encrypted).toString('hex');

            const fileData = {
                encryptedData: encryptedHex,
                iv: Buffer.from(iv).toString('hex'),
                fileName,
                fileHash,
                mimeType: file.type,
                encryptionAlgorithm: 'AES-GCM'
            };

            console.log('File to store in MinIO as JSON:', fileData);
            const jsonFileName = `${fileHash}.json`;
            console.log(`Would store as: ${jsonFileName}`);

            // If hospital, request write access
            console.log("---Requesting Write Access Token---")
            let tx;
            let receipt;
            if (role === 'hospital' && contracts?.validation) {
                const patientAddress = selectedPatient.publicAddress;

                try {
                    tx = await contracts.validation.requestFileWriteAccessToken(patientAddress, {
                        gasLimit: 300000 // Manual gas limit to avoid UNPREDICTABLE_GAS_LIMIT
                    });
                    receipt = await tx.wait();
                    console.log('Transaction Receipt:', receipt);
                } catch (err) {
                    const revertReason = err.error?.error?.data?.reason || err.reason || 'Unknown error';
                    setErrorMessage(`Failed to get write access: ${revertReason}`);
                    throw err; // Stop execution
                }
            }else{
                try{

                    tx = await contracts.validation.requestOwnFilesWriteToken({
                        gasLimit: 300000 // Manual gas limit to avoid UNPREDICTABLE_GAS_LIMIT
                    });
                    receipt = await tx.wait();
                    console.log('Transaction Receipt:', receipt);

                }catch(err){
                    const revertReason = err.error?.error?.data?.reason || err.reason || 'Unknown error';
                    setErrorMessage(`Failed to get write access: ${revertReason}`);
                    throw err; // Stop execution
                }
            }
            
            const event = receipt.events.find(e => e.event === 'WriteAccessTokenGenerated');
            const tokenHash = event.args.tokenHash;
            console.log('Write Access Token:', tokenHash);

            console.log("---Signing the Token---")
            let signature=await signHash(tokenHash);
            console.log("signature:",signature);

            console.log("---Encrypting the AES Key---")
            let encKey=encryptAESKey(publicKey);
            console.log("Encrypted AES Key:",encKey);
            
            console.log("---Uploading the Encrypted file---");
            console.log("Sending Token, Signature, Encrypted File and Encrypted Key to the server...");
            // Add file to database
            let fileHashList=[fileHash];
            let keyList=[encKey];
            let fileDataList=[fileData];
            let uploadData={
                uniqueId:role==='hospital'?selectedPatient.uniqueId:uid,
                tokenHash:tokenHash,
                signature:signature,
                isWrite:true,
                fileHashes:fileHashList,
                keyList:keyList,
                fileData:fileDataList
            }

            let response = await axios.post('http://localhost:5000/api/file/upload',uploadData,{
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log("Response From Server:",response);

            uploadData = {
                uniqueId: role === 'hospital' ? selectedPatient.uniqueId : uid,
                fileId: fileHash,
                fileName
            };
            await axios.post('http://localhost:5000/api/file/add', uploadData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setEncryptedFile(encryptedHex);
            console.log("File encrypted and added to database successfully! Check console for details.");
            alert('File encrypted and added to database successfully! Check console for details.');
            navigate('/dashboard');
        } catch (err) {
            console.error('Error processing file:', err);
            const revertReason = err.error?.error?.data?.reason || err.reason || err.message || 'Unknown error';
            setErrorMessage(`Error: ${revertReason}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            <h1>Upload File</h1>
            {loading && <p>Loading...</p>}
            {errorMessage && <p style={errorStyle}>{errorMessage}</p>}
            {role && (
                <div>
                    <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,image/*,text/*"
                        style={inputStyle}
                    />
                    {file && (
                        <div>
                            <p><strong>File Name:</strong> {fileName}</p>
                            <p><strong>File ID (Hash):</strong> {fileHash}</p>
                            <p><strong>AES Key:</strong> {aesKey}</p>
                            {encryptedFile && (
                                <p><strong>Encrypted File (hex):</strong> {encryptedFile.slice(0, 50)}...</p>
                            )}
                        </div>
                    )}
                    {role === 'hospital' && (
                        <div>
                            <label htmlFor="patientSelect">Upload for Patient:</label>
                            <select
                                id="patientSelect"
                                value={selectedPatient.uniqueId || ''}
                                onChange={(e) => {
                                    const patient = patients.find(p => p.uniqueId === e.target.value);
                                    setSelectedPatient(patient || {});
                                }}
                                style={selectStyle}
                            >
                                {patients.map(patient => (
                                    <option key={patient.uniqueId} value={patient.uniqueId}>
                                        {patient.name} ({patient.uniqueId})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button onClick={handleUpload} style={buttonStyle} disabled={loading}>
                        Upload File
                    </button>
                    <button onClick={() => navigate('/dashboard')} style={buttonStyle}>
                        Back to Dashboard
                    </button>
                </div>
            )}
        </div>
    );
};

const containerStyle = {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto'
};

const inputStyle = {
    display: 'block',
    margin: '10px 0'
};

const selectStyle = {
    padding: '8px',
    margin: '10px 0',
    width: '100%'
};

const buttonStyle = {
    padding: '10px',
    backgroundColor: '#007BFF',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    margin: '5px'
};

const errorStyle = {
    color: 'red',
    margin: '10px 0'
};

export default UploadFile;
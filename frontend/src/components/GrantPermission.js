import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';
import axios from 'axios';
import crypto from 'crypto';
import { ec as EC } from 'elliptic';

const ec = new EC("secp256k1");

const GrantPermission = () => {
    const { wallet, token } = useWallet();
    const { contracts } = useContracts();
    const navigate = useNavigate();
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState({});
    const [files, setFiles] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [accessType, setAccessType] = useState('read');
    const [deadline, setDeadline] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            setLoading(true);
            try {
                const hospitalsRes = await axios.get('http://localhost:5000/api/auth/hospitals', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(hospitalsRes.data);
                setHospitals(hospitalsRes.data);
                if (hospitalsRes.data.length > 0) setSelectedHospital(hospitalsRes.data[0]);

                const filesRes = await axios.get('http://localhost:5000/api/file/patient/files', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFiles(filesRes.data);
            } catch (err) {
                console.error('Error fetching data:', err);
                setErrorMessage('Failed to load hospitals or files.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    const handleFileToggle = (fileId) => {
        setSelectedFiles(prev =>
            prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
        );
    };

    const EthCrypto = require('eth-crypto');

    function encryptAESKey(aesKey,publicKeyHex) {
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

    const handleGrantPermission = async () => {
        if (!selectedHospital || !deadline) {
            setErrorMessage('Please select a hospital, and a deadline.');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        try {
            const deadlineSeconds = Math.floor(new Date(deadline).getTime() / 1000);
            if (deadlineSeconds <= Math.floor(Date.now() / 1000)) {
                setErrorMessage('Deadline must be in the future.');
                return;
            }

            // Step 1: Fetch keys from FileRegistry
            const patientAddress = wallet.address;
            const rawKeys = await contracts.fileRegistry.getKeys(patientAddress, selectedFiles);
            console.log('Raw Keys from FileRegistry:', rawKeys);

            // Step 2: Decrypt keys with patient's private key
            const decryptedKeys = await Promise.all(rawKeys.map(async (encryptedKey) => {
                const decodedData = JSON.parse(Buffer.from(encryptedKey, "base64").toString());
                console.log("decodeddata:",decodedData);
                console.log(wallet.privateKey);
                const userPrivateKey = ec.keyFromPrivate(wallet.privateKey.substring(2), "hex");
                const ephemeralPublicKey = ec.keyFromPublic(decodedData.ephemeralPublicKey, "hex").getPublic();
                const sharedSecret = userPrivateKey.derive(ephemeralPublicKey);
                    const decryptionKey = crypto.createHash("sha256")
                        .update(Buffer.from(sharedSecret.toArray()))
                        .digest(); 
                    console.log("Derived Decryption Key:", decryptionKey.toString("hex"));
                
                    const decipher = crypto.createDecipheriv(
                        "aes-256-gcm",
                        decryptionKey,
                        Buffer.from(decodedData.iv, "hex")
                    );
                    decipher.setAuthTag(Buffer.from(decodedData.authTag, "hex"));
                    let decryptedAESKey = decipher.update(decodedData.encryptedAESKey, "hex", "binary");
                    decryptedAESKey += decipher.final("binary");
                return decryptedAESKey; 
            }));
            console.log('Decrypted Keys:', decryptedKeys);

            // Step 3: Fetch hospital's public key and encrypt keys
            const hospitalAddress = selectedHospital.publicAddress;
            const res = await axios.get('http://localhost:5000/api/auth/user-details', {
                headers: { Authorization: `Bearer ${token}` },
                params: { address: hospitalAddress }
            });
            const hospitalPublicKey = res.data.publicKey;
            console.log('Hospital Public Key:', hospitalPublicKey);

            const encryptedKeys = await Promise.all(decryptedKeys.map(async (key) => {
                return encryptAESKey(key,hospitalPublicKey);
            }));
            console.log('Re-encrypted Keys for Hospital:', encryptedKeys);
            console.log(accessType);
            console.log("selectedfiles:",selectedFiles);
            // Step 4: Backend API call
            if(accessType==='read'){
                const grantData = {
                    hospitalUniqueId: selectedHospital.uniqueId,
                    fileIds: selectedFiles,
                    deadline: deadlineSeconds
                };
                await axios.post('http://localhost:5000/api/file/patient/grant-access', grantData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            else if(accessType==='write'){
                console.log("inside else if")
                const grantData = {
                    hospitalUniqueId: selectedHospital.uniqueId,
                    deadline: deadlineSeconds
                };
                await axios.post('http://localhost:5000/api/file/patient/grant-write-access', grantData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            else{
                const grantData = {
                    hospitalUniqueId: selectedHospital.uniqueId,
                    fileIds: selectedFiles,
                    deadline: deadlineSeconds
                };
                await axios.post('http://localhost:5000/api/file/patient/grant-access', grantData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                await axios.post('http://localhost:5000/api/file/patient/grant-write-access', grantData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            console.log("in1")
            // Step 5: Blockchain call to grantAccess
            const accessTypeEnum = accessType === 'read' ? 1 : accessType === 'write' ? 2 : 3;
            await contracts.accessControl.grantAccess(
                hospitalAddress,
                accessTypeEnum,
                selectedFiles,
                encryptedKeys,
                deadlineSeconds,
                { gasLimit: 5000000 }
            );
            alert('Permission granted successfully!');
            navigate('/dashboard');
        } catch (err) {
            console.error('Error granting permission:', err);
            const revertReason = err.error?.error?.data?.reason || err.reason || err.message || 'Unknown error';
            setErrorMessage(`Failed to grant permission: ${revertReason}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            <h1>Grant Permission</h1>
            {loading && <p>Loading...</p>}
            {errorMessage && <p style={errorStyle}>{errorMessage}</p>}
            <div>
                <label htmlFor="hospitalSelect">Select Hospital:</label>
                <select
                    id="hospitalSelect"
                    value={selectedHospital}
                    onChange={(e) => setSelectedHospital(e.target.value)}
                    style={selectStyle}
                >
                    {hospitals.map(hospital => (
                        <option key={hospital.uniqueId} value={hospital}>
                            {hospital.name} ({hospital.uniqueId})
                        </option>
                    ))}
                </select>

                <h3>Select Files:</h3>
                {files.map(file => (
                    <div key={file.fileId} style={checkboxStyle}>
                        <input
                            type="checkbox"
                            id={file.fileId}
                            checked={selectedFiles.includes(file.fileId)}
                            onChange={() => handleFileToggle(file.fileId)}
                        />
                        <label htmlFor={file.fileId}>{file.fileName}</label>
                    </div>
                ))}

                <label htmlFor="accessType">Access Type:</label>
                <select
                    id="accessType"
                    value={accessType}
                    onChange={(e) => setAccessType(e.target.value)}
                    style={selectStyle}
                >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="both">Both</option>
                </select>

                <label htmlFor="deadline">Deadline:</label>
                <input
                    type="date"
                    id="deadline"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    style={inputStyle}
                />

                <button onClick={handleGrantPermission} style={buttonStyle} disabled={loading}>
                    Grant Permission
                </button>
                <button onClick={() => navigate('/dashboard')} style={buttonStyle}>
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

const containerStyle = {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto'
};

const selectStyle = {
    padding: '8px',
    margin: '10px 0',
    width: '100%'
};

const inputStyle = {
    padding: '8px',
    margin: '10px 0',
    width: '100%'
};

const checkboxStyle = {
    margin: '5px 0'
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

export default GrantPermission;
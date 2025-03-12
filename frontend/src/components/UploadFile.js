import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';
import axios from 'axios';
import { Buffer } from 'buffer';

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
                    const patientsRes = await axios.get('http://localhost:5000/api/file/hospital/patients', {
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
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hash = Buffer.from(hashBuffer).toString('hex');
        setFileHash(hash);

        const key = crypto.getRandomValues(new Uint8Array(32));
        setAesKey(Buffer.from(key).toString('hex'));
        setErrorMessage(''); // Clear error on successful file selection
    };

    const handleUpload = async () => {
        if (!file || (role === 'hospital' && !selectedPatient)) {
            setErrorMessage('Please select a file and, for hospitals, a patient.');
            return;
        }

        setLoading(true);
        setErrorMessage(''); // Clear previous error
        try {
            const res = await axios.get('http://localhost:5000/api/auth/uid', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const uid = res.data.uniqueId;

            // Encrypt the file
            const rawKey = Buffer.from(aesKey, 'hex');
            const key = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );
            const fileContent = await file.arrayBuffer();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                fileContent
            );
            const encryptedHex = Buffer.from(encrypted).toString('hex');

            const fileData = {
                encryptedData: encryptedHex,
                iv: Buffer.from(iv).toString('hex'),
                fileName,
                mimeType: file.type,
                encryptionAlgorithm: 'AES-GCM'
            };

            console.log('File to store in MinIO as JSON:', fileData);
            const jsonFileName = `${fileHash}.json`;
            console.log(`Would store as: ${jsonFileName}`);

            // If hospital, request write access
            let tokenHash;
            if (role === 'hospital' && contracts?.validation) {
                const patientAddress = selectedPatient.publicAddress;

                try {
                    tokenHash = await contracts.validation.requestFileWriteAccess(patientAddress, {
                        gasLimit: 300000 // Manual gas limit to avoid UNPREDICTABLE_GAS_LIMIT
                    });
                    console.log('Write Access Token Hash:', tokenHash);
                } catch (err) {
                    const revertReason = err.error?.error?.data?.reason || err.reason || 'Unknown error';
                    setErrorMessage(`Failed to get write access: ${revertReason}`);
                    throw err; // Stop execution
                }
            }

            // Add file to database
            const uploadData = {
                uniqueId: role === 'hospital' ? selectedPatient.uniqueId : uid,
                fileId: fileHash,
                fileName
            };
            await axios.post('http://localhost:5000/api/file/add', uploadData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setEncryptedFile(encryptedHex);
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
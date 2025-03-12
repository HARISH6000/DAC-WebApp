import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import axios from 'axios';
import { Buffer } from 'buffer';

const UploadFile = () => {
    const { wallet, token } = useWallet();
    const navigate = useNavigate();
    const [role, setRole] = useState(null);
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileHash, setFileHash] = useState('');
    const [aesKey, setAesKey] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [loading, setLoading] = useState(false);
    const [encryptedFile, setEncryptedFile] = useState(null);

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
                    if (patientsRes.data.length > 0) setSelectedPatient(patientsRes.data[0].uniqueId);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                alert('Failed to load data.');
            } finally {
                setLoading(false);
            }
        };
        fetchRoleAndPatients();
    }, [token]);

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile || selectedFile.type.startsWith('video/')) {
            alert('Please select a file (no videos allowed).');
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
    };

    const handleUpload = async () => {
        if (!file || (role === 'hospital' && !selectedPatient)) {
            alert('Please select a file and, for hospitals, a patient.');
            return;
        }

        setLoading(true);
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

            // Prepare JSON for MinIO
            const fileData = {
                encryptedData: encryptedHex,
                iv: Buffer.from(iv).toString('hex'),
                fileName,
                mimeType: file.type,
                encryptionAlgorithm: 'AES-GCM'
            };

            // For now, log the JSON (later upload to MinIO)
            console.log('File to store in MinIO as JSON:', fileData);

            // Simulate MinIO storage by naming it with fileHash
            const jsonFileName = `${fileHash}.json`;
            console.log(`Would store as: ${jsonFileName}`);

            setEncryptedFile(encryptedHex);

            const uploadData = {
                uniqueId: role === 'hospital' ? selectedPatient : uid,
                fileId: fileHash,
                fileName
            };
            await axios.post('http://localhost:5000/api/file/add', uploadData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('File encrypted successfully! Check console for JSON data.');

            navigate('/dashboard');
        } catch (err) {
            console.error('Error encrypting file:', err);
            alert('Failed to encrypt file.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            <h1>Upload File</h1>
            {loading && <p>Loading...</p>}
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
                                value={selectedPatient}
                                onChange={(e) => setSelectedPatient(e.target.value)}
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

export default UploadFile;
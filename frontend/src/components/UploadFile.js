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

        // Calculate SHA-256 hash as fileId using SubtleCrypto
        const arrayBuffer = await selectedFile.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hash = Buffer.from(hashBuffer).toString('hex');
        setFileHash(hash);

        // Generate random AES key (32 bytes for AES-256)
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
            const uid=res.data.uniqueId;
            console.log(`Encrypting file with AES key: ${aesKey}`);
            const uploadData = {
                uniqueId: role === 'hospital' ? selectedPatient : uid, // Adjust if uniqueId is elsewhere
                fileId: fileHash,
                fileName
            };
            console.log(uploadData);
            await axios.post('http://localhost:5000/api/file/add', uploadData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('File theoretically uploaded successfully!');
            navigate('/dashboard');
        } catch (err) {
            console.error('Error uploading file:', err);
            alert('Failed to upload file.');
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
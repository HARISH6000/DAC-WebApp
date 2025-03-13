import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';
import axios from 'axios';

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
                const hospitalsRes = await axios.get('http://localhost:5000/api/file/patient/hospitals', {
                    headers: { Authorization: `Bearer ${token}` }
                });
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

            // Backend API call
            const grantData = {
                hospitalUniqueId: selectedHospital.uniqueId,
                fileIds: selectedFiles,
                accessType,
                deadline: deadlineSeconds
            };
            await axios.post('http://localhost:5000/api/file/patient/grant-access', grantData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            
            //console.log("\n\n in \n\n");
            await contracts.accessControl.grantAccess(
                selectedHospital.publicAddress,
                accessType === 'read' ? 1 : accessType === 'write' ? 2 : 3,
                false,
                selectedFiles,
                deadlineSeconds,
                { gasLimit: 500000 }
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
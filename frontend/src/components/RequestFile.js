import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';
import axios from 'axios';

const RequestFile = () => {
    const { wallet, token } = useWallet();
    const { contracts } = useContracts();
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [files, setFiles] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [accessType, setAccessType] = useState('Read');
    const [deadline, setDeadline] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Fetch patients on mount
    useEffect(() => {
        const fetchPatients = async () => {
            if (!token || !wallet) return;

            setLoading(true);
            try {
                const res = await axios.get('http://localhost:5000/api/auth/patients', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPatients(res.data);
            } catch (err) {
                console.error('Error fetching patients:', err);
                setErrorMessage('Failed to load patients.');
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
    }, [token, wallet]);

    // Fetch files when a patient is selected
    const handlePatientChange = async (e) => {
        const patientUniqueId = e.target.value;
        setSelectedPatient(patientUniqueId);
        setSelectedFiles([]); // Reset selected files
        setLoading(true);
        setErrorMessage('');

        try {
            const res = await axios.get(
                `http://localhost:5000/api/file/all-patient-files?uniqueId=${patientUniqueId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setFiles(res.data);
        } catch (err) {
            console.error('Error fetching patient files:', err);
            setErrorMessage('Failed to load patient files.');
        } finally {
            setLoading(false);
        }
    };

    // Handle checkbox changes
    const handleFileSelection = (fileId) => {
        setSelectedFiles((prev) =>
            prev.includes(fileId)
                ? prev.filter((id) => id !== fileId)
                : [...prev, fileId]
        );
    };

    // Handle request access
    const handleRequestAccess = async () => {
        console.log("---Requesting Access---");
        if (!selectedPatient || !deadline || !contracts?.validation) {
            setErrorMessage('Please select a patient, a deadline, and ensure contracts are loaded.');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        try {
            const patient = patients.find((p) => p.uniqueId === selectedPatient);
            const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000); // Convert to Unix timestamp
            const accessTypeEnum = accessType === 'Read' ? 0 :accessType==='Write'? 1: 2; 
            console.log("Making a Blockchain call...");
            const tx = await contracts.request.makeRequest(
                patient.publicAddress, 
                selectedFiles,        
                deadlineTimestamp,    
                accessTypeEnum,       
                { gasLimit: 500000 }
            );

            const receipt = await tx.wait();
            console.log('Request successful\nReceipt:', receipt);

            console.log('Access request submitted successfully!');
            alert('Access request submitted successfully!');
            navigate('/dashboard');
        } catch (err) {
            console.error('Error requesting access:', err);
            const revertReason = err.error?.error?.data?.reason || err.reason || err.message || 'Unknown error';
            setErrorMessage(`Failed to request access: ${revertReason}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            <h1>Request File Access</h1>
            {loading && <p>Loading...</p>}
            {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

            {/* Patient Dropdown */}
            <div style={formGroupStyle}>
                <label htmlFor="patientSelect">Select Patient:</label>
                <select
                    id="patientSelect"
                    value={selectedPatient}
                    onChange={handlePatientChange}
                    style={selectStyle}
                    disabled={loading}
                >
                    <option value="">-- Select a Patient --</option>
                    {patients.map((patient) => (
                        <option key={patient.uniqueId} value={patient.uniqueId}>
                            {patient.name} ({patient.uniqueId})
                        </option>
                    ))}
                </select>
            </div>

            {/* File List with Checkboxes */}
            {selectedPatient && (
                <div style={formGroupStyle}>
                    <h2>Patient Files</h2>
                    {files.length > 0 ? (
                        <ul style={listStyle}>
                            {files.map((file) => (
                                <li key={file.fileId} style={listItemStyle}>
                                    <label style={{ display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedFiles.includes(file.fileId)}
                                            onChange={() => handleFileSelection(file.fileId)}
                                            style={{ marginRight: '10px' }}
                                            disabled={loading}
                                        />
                                        {file.fileName}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No files found for this patient.</p>
                    )}
                </div>
            )}

            {/* Access Type Dropdown */}
            <div style={formGroupStyle}>
                <label htmlFor="accessTypeSelect">Access Type:</label>
                <select
                    id="accessTypeSelect"
                    value={accessType}
                    onChange={(e) => setAccessType(e.target.value)}
                    style={selectStyle}
                    disabled={loading}
                >
                    <option value="Read">Read</option>
                    <option value="Write">Write</option>
                    <option value="Both">Both</option>
                </select>
            </div>

            {/* Deadline Input */}
            <div style={formGroupStyle}>
                <label htmlFor="deadlineInput">Deadline:</label>
                <input
                    id="deadlineInput"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    style={inputStyle}
                    disabled={loading}
                />
            </div>

            {/* Request Access Button */}
            <button
                onClick={handleRequestAccess}
                style={buttonStyle}
                disabled={loading}
            >
                Request Access
            </button>
        </div>
    );
};

// Inline styles
const containerStyle = {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto'
};

const formGroupStyle = {
    marginBottom: '20px'
};

const selectStyle = {
    padding: '8px',
    width: '100%',
    maxWidth: '300px',
    borderRadius: '4px',
    border: '1px solid #ccc'
};

const inputStyle = {
    padding: '8px',
    width: '100%',
    maxWidth: '300px',
    borderRadius: '4px',
    border: '1px solid #ccc'
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

const listStyle = {
    listStyleType: 'none',
    padding: '0'
};

const listItemStyle = {
    padding: '10px',
    borderBottom: '1px solid #ccc'
};

export default RequestFile;
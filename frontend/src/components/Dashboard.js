import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';
import axios from 'axios';

const Dashboard = () => {
    const { wallet, logout, token } = useWallet();
    const { contracts } = useContracts();
    const navigate = useNavigate();
    const [role, setRole] = useState(null); // patient or hospital
    const [files, setFiles] = useState([]); // Patient files or hospital patient files
    const [hospitals, setHospitals] = useState([]); // Patient's shared hospitals
    const [patients, setPatients] = useState([]); // Hospital's patients
    const [selectedHospital, setSelectedHospital] = useState(null); // For patient: filter files by hospital
    const [selectedPatient, setSelectedPatient] = useState(null); // For hospital: show patient files
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchRoleAndData = async () => {
            if (!token || !wallet) return;

            setLoading(true);
            try {
                // Determine role from backend (assuming /api/auth/get-key returns role)
                const res = await axios.get('http://localhost:5000/api/auth/role', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const userRole = res.data.role; // Assume role is returned here
                setRole(userRole);

                if (userRole === 'patient') {
                    // Fetch patient files
                    const filesRes = await axios.get('http://localhost:5000/api/file/patient/files', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setFiles(filesRes.data);

                    // Fetch hospitals patient shares files with
                    const hospitalsRes = await axios.get('http://localhost:5000/api/file/patient/hospitals', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setHospitals(hospitalsRes.data);
                } else if (userRole === 'hospital') {
                    // Fetch patients hospital has access to
                    const patientsRes = await axios.get('http://localhost:5000/api/file/hospital/patients', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setPatients(patientsRes.data);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                alert('Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        };

        fetchRoleAndData();
    }, [token, wallet]);

    const handleHospitalClick = async (hospital) => {
        setSelectedHospital(hospital);
        setLoading(true);
        try {
            const filesRes = await axios.get(
                `http://localhost:5000/api/file/patient/hospital-files?hospitalUniqueId=${hospital.uniqueId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setFiles(filesRes.data);
        } catch (err) {
            console.error('Error fetching hospital files:', err);
            alert('Failed to load files for this hospital.');
        } finally {
            setLoading(false);
        }
    };

    const handlePatientClick = async (patient) => {
        setSelectedPatient(patient);
        console.log(patient);
        setLoading(true);
        try {
            const filesRes = await axios.get(
                `http://localhost:5000/api/file/hospital/files?uniqueId=${patient.uniqueId}`, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setFiles(filesRes.data);
        } catch (err) {
            console.error('Error fetching patient files:', err);
            alert('Failed to load files for this patient.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleGetParticipantDetails = async () => {
        if (!contracts || !wallet) {
            alert('Contracts or wallet not available yet.');
            return;
        }
        try {
            const details = await contracts.registration.getParticipantDetails(wallet.address);
            alert(`Unique ID: ${details[0]}, Name: ${details[1]}, Role: ${details[2]}, Public Key: ${details[3]}`);
        } catch (err) {
            console.error('Error fetching participant details:', err);
            alert('Failed to fetch participant details.');
        }
    };

    return (
        <div style={containerStyle}>
            <h1>Dashboard</h1>
            {loading && <p>Loading...</p>}
            {wallet && role ? (
                <div>
                    <p><strong>Wallet Address:</strong> {wallet.address}</p>
                    <button onClick={handleGetParticipantDetails} style={buttonStyle}>Get Participant Details</button>
                    <button onClick={handleLogout} style={buttonStyle}>Logout</button>

                    {role === 'patient' && (
                        <div>
                            <h2>Your Files</h2>
                            {files.length > 0 ? (
                                <ul style={listStyle}>
                                    {files.map(file => (
                                        <li key={file.fileId} style={listItemStyle}>
                                            {file.fileName} (Uploaded: {new Date(file.uploadDate).toLocaleDateString()})
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No files found.</p>
                            )}

                            <h2>Hospitals You Share Files With</h2>
                            {hospitals.length > 0 ? (
                                <ul style={listStyle}>
                                    {hospitals.map(hospital => (
                                        <li
                                            key={hospital.uniqueId}
                                            style={clickableListItemStyle}
                                            onClick={() => handleHospitalClick(hospital)}
                                        >
                                            {hospital.name} ({hospital.uniqueId})
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No hospitals found.</p>
                            )}

                            {selectedHospital && (
                                <div>
                                    <h3>Files Shared with {selectedHospital.name}</h3>
                                    {files.length > 0 ? (
                                        <ul style={listStyle}>
                                            {files.map(file => (
                                                <li key={file.fileId} style={listItemStyle}>
                                                    {file.fileName}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>No files shared with this hospital.</p>
                                    )}
                                    <button onClick={() => setSelectedHospital(null)} style={buttonStyle}>
                                        Clear Selection
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {role === 'hospital' && (
                        <div>
                            <h2>Your Patients</h2>
                            {patients.length > 0 ? (
                                <ul style={listStyle}>
                                    {patients.map(patient => (
                                        <li
                                            key={patient.uniqueId}
                                            style={clickableListItemStyle}
                                            onClick={() => handlePatientClick(patient)}
                                        >
                                            {patient.name} ({patient.uniqueId})
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No patients found.</p>
                            )}

                            {selectedPatient && (
                                <div>
                                    <h3>Files for {selectedPatient.name}</h3>
                                    {files.length > 0 ? (
                                        <ul style={listStyle}>
                                            {files.map(file => (
                                                <li key={file.fileId} style={listItemStyle}>
                                                    {file.fileName}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>No files found for this patient.</p>
                                    )}
                                    <button onClick={() => setSelectedPatient(null)} style={buttonStyle}>
                                        Clear Selection
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

// Inline styles
const containerStyle = {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto'
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

const clickableListItemStyle = {
    ...listItemStyle,
    cursor: 'pointer',
    backgroundColor: '#f0f0f0',
    transition: 'background-color 0.2s',
    ':hover': { backgroundColor: '#e0e0e0' } // Note: Hover doesn't work in inline styles, use CSS for this
};

export default Dashboard;
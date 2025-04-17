import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';
import axios from 'axios';
import { Buffer } from 'buffer';
import crypto from 'crypto';
import { ec as EC } from 'elliptic';
import { ethers } from 'ethers';
const ec = new EC("secp256k1");

const Dashboard = () => {
    const { wallet, logout, token } = useWallet();
    const { contracts } = useContracts();
    const navigate = useNavigate();
    const [role, setRole] = useState(null);
    const [files, setFiles] = useState([]);
    const [files1, setFiles1] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [patients, setPatients] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState(null);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refresh, setRefresh] = useState(false);

    useEffect(() => {
        const fetchRoleAndData = async () => {
            if (!token || !wallet) return;

            setLoading(true);
            try {
                const res = await axios.get('http://localhost:5000/api/auth/role', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const userRole = res.data.role;
                setRole(userRole);

                if (userRole === 'patient') {
                    const filesRes = await axios.get('http://localhost:5000/api/file/patient/files', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setFiles(filesRes.data);

                    const hospitalsRes = await axios.get('http://localhost:5000/api/file/patient/hospitals', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setHospitals(hospitalsRes.data);
                } else if (userRole === 'hospital') {
                    const patientsRes = await axios.get('http://localhost:5000/api/file/hospital/patients', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setPatients(patientsRes.data);
                }
                setSelectedHospital(null);
                setSelectedPatient(null);
            } catch (err) {
                console.error('Error fetching data:', err);
                alert('Failed to load dashboard data.');
            } finally {
                setLoading(false);
            }
        };

        fetchRoleAndData();
    }, [token, wallet, refresh]);

    const handleHospitalClick = async (hospital) => {
        setSelectedHospital(hospital);
        setLoading(true);
        try {
            const filesRes = await axios.get(
                `http://localhost:5000/api/file/patient/hospital-files?hospitalUniqueId=${hospital.uniqueId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setFiles1(filesRes.data);
        } catch (err) {
            console.error('Error fetching hospital files:', err);
            alert('Failed to load files for this hospital.');
        } finally {
            setLoading(false);
        }
    };

    const handlePatientClick = async (patient) => {
        setSelectedPatient(patient);
        setLoading(true);
        try {
            const filesRes = await axios.get(
                `http://localhost:5000/api/file/hospital/files?uniqueId=${patient.uniqueId}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                });
            setFiles1(filesRes.data);
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

    const handleAddFile = () => {
        navigate('/upload-file');
    };

    const handleRequestFile = () => {
        navigate('/request-file');
    };

    const handleGrantPermission = () => {
        navigate('/grant-permission');
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

    const handleDownload = async (file, patient) => {
        try {
            console.log("---Initiating download---");
            const fileList = [file.fileId];
            let tx;
            if (role === 'hospital') {
                tx = await contracts.validation.requestFileReadAccessToken(patient.publicAddress, fileList, {
                    gasLimit: 300000 // Manual gas limit to avoid UNPREDICTABLE_GAS_LIMIT
                });
            }
            else {
                tx = await contracts.validation.requestOwnFilesReadToken(fileList, {
                    gasLimit: 300000 // Manual gas limit to avoid UNPREDICTABLE_GAS_LIMIT
                });
            }
            const receipt = await tx.wait();
            console.log("---Transaction Receipt For Token Generation---");
            console.log(receipt);
            const event = receipt.events.find(e => e.event === 'ReadAccessTokenGenerated');
            const tokenHash = event.args.tokenHash;
            console.log("---Read Access Token---");
            console.log('Read Access Token Hash:', tokenHash);

            console.log("---Initiating signing algorithm---");
            let signature = await signHash(tokenHash);
            console.log("signature:", signature);
            const rawKeys = await contracts.fileRegistry.getKeys(wallet.address, fileList);
            console.log("---Fetching Keys From File Registry---");
            console.log('Encrypted Keys from FileRegistry:', rawKeys);

            console.log("---Initiating Decryption of keys---");
            const decryptedKeys = await Promise.all(rawKeys.map(async (encryptedKey) => {
                const decodedData = JSON.parse(Buffer.from(encryptedKey, "base64").toString());
                console.log("decoded key data:", decodedData);
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

            console.log("Decrypted key:", decryptedKeys);

            const fileHashes = [file.fileId];

            const details = await contracts.registration.getParticipantDetails(wallet.address);

            
            console.log("---Initiating File Download---");
            const response = await axios.post(
                'http://localhost:5000/api/file/download',
                {
                    uniqueId: role === 'hospital' ? patient.uniqueId : details[0],
                    hospital: wallet.address,
                    patient: role === 'hospital' ? patient.publicAddress : wallet.address,
                    fileHashes,
                    tokenHash,
                    signature,
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const fileData = response.data.file;
            console.log('File Data:', fileData);

            console.log("---Initiating File Decryption---");
            // Step 1: Import the key (assuming aesKey is the hex string used for encryption)
            const rawKey = Buffer.from(decryptedKeys[0], 'hex');
            const key = await window.crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            // Step 2: Convert iv and encryptedData from hex
            const ivBuffer = Buffer.from(fileData.iv, 'hex');
            const encryptedBuffer = Buffer.from(fileData.encryptedData, 'hex');

            // Step 3: Decrypt the data
            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: ivBuffer },
                key,
                encryptedBuffer
            );

            console.log("---Converting decrypted ArrayBuffer to Blob---");
            // Step 4: Convert decrypted ArrayBuffer to Blob and trigger download
            const blob = new Blob([decrypted], { type: fileData.mimeType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileData.fileName; // e.g., "pursuit_of_happyness_xlg.jpg"
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            console.log("---File saved to local device---");

        } catch (err) {
            console.log("error:", err);
        }
    };

    const handleRevokeAllAccess = async (hospital) => {
        try {
            console.log("---Revoking All Access---");
            console.log("Making a Blockchain call....");
            const tx = await contracts.accessControl.removeAllAcess(hospital.publicAddress);
            const receipt = await tx.wait();
            const details = await contracts.registration.getParticipantDetails(wallet.address);
            console.log("receipt:", receipt);

            console.log("Deleting All Access Permission data in the Backend....");
            const response = await axios.delete('http://localhost:5000/api/file/patient/revoke-all-access', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    hospitalId: hospital.uniqueId,
                    patientId: details[0]
                },
            });

            console.log("Response:",response);

            setRefresh(true);
            console.log("---Successfully Revoked All Access---");
        } catch (err) {
            console.log("error:", err);
        }
    };

    const handleRevokeFileAccess = async (hospital,file) => {
        try {
            console.log("---Revoking File Access---");
            const fileList=[file.fileId];
            console.log("Making a Blockchain call....");
            const tx = await contracts.accessControl.removeAccess(hospital.publicAddress,fileList);
            const receipt = await tx.wait();
            const details = await contracts.registration.getParticipantDetails(wallet.address);
            console.log("receipt:", receipt);

            console.log("Deleting File Access Permission data in the Backend....");
            const response = await axios.delete('http://localhost:5000/api/file/patient/revoke-file-access', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    hospitalId: hospital.uniqueId,
                    patientId: details[0],
                    fileId:file.fileId
                },
            });

            console.log("Response:",response);

            handleHospitalClick(hospital);
            console.log("---Successfully Revoked File Access---");

        } catch (err) {
            console.log("error:", err);
        }
    };

    const handleDelete = async (file, patient) => {
        if (window.confirm("Are you sure you want to delete this file?")) {
            try {
                console.log("---Initiating File Deletion---");
                const fileList = [file.fileId];
                let tx;
                let receipt;
                console.log("Making a Blockchain call To generate Write Access Token....");
                if (role === 'hospital') {
                    tx = await contracts.validation.requestFileWriteAccessToken(patient.publicAddress, { gasLimit: 300000 });
                    receipt = await tx.wait();
                } else {
                    tx = await contracts.validation.requestOwnFilesWriteToken({ gasLimit: 300000 });
                    receipt = await tx.wait();
                }
                console.log('Receipt:', receipt);

                const event = receipt.events.find(e => e.event === 'WriteAccessTokenGenerated');
                const tokenHash = event.args.tokenHash;
                console.log('Write Access Token:', tokenHash);

                console.log("---Signing the Token---");
                let signature = await signHash(tokenHash);
                console.log("signature:", signature);

                const details = await contracts.registration.getParticipantDetails(wallet.address);

                console.log("---Backend call---");
                console.log("Making a Backend call to delete the file by passing Token, signature and file Ids...");
                const response = await axios.delete('http://localhost:5000/api/file/delete', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    data: {
                        uniqueId: role === 'hospital' ? patient.uniqueId : details[0],
                        fileList,
                        tokenHash,
                        signature,
                        hospital: wallet.address,
                        patient: role === 'hospital' ? patient.publicAddress : wallet.address,
                    },
                });

                console.log('Success:', response.data);
                setFiles(files.filter(f => f.fileId !== file.fileId));
                console.log('---Successfully deleted the file---');
            } catch (err) {
                console.error('Error deleting file:', err);
                alert('Failed to delete file.');
            }
        }
    };

    const handleManageRequest = async (file, patient) => {
        navigate('/manage-requests');
    };

    return (
        <div style={containerStyle}>
            <h1>Dashboard</h1>
            {loading && <p>Loading...</p>}
            {wallet && role ? (
                <div>
                    <p><strong>Wallet Address:</strong> {wallet.address}</p>
                    <div style={buttonContainerStyle}>
                        <button onClick={handleGetParticipantDetails} style={buttonStyle}>
                            Get Participant Details
                        </button>
                        {role === 'hospital' && (
                            <>
                                <button onClick={handleAddFile} style={buttonStyle}>
                                    Add File
                                </button>
                                <button onClick={handleRequestFile} style={buttonStyle}>
                                    Request File
                                </button>
                            </>
                        )}
                        {role === 'patient' && (
                            <>
                                <button onClick={handleAddFile} style={buttonStyle}>
                                    Add File
                                </button>
                                <button onClick={handleGrantPermission} style={buttonStyle}>
                                    Grant Permission
                                </button>
                            </>
                        )}
                        <button onClick={handleManageRequest} style={buttonStyle}>
                            Manage Requests
                        </button>
                        <button onClick={handleLogout} style={buttonStyle}>
                            Logout
                        </button>
                    </div>

                    {role === 'patient' && (
                        <div>
                            <h2>Your Files</h2>
                            {files.length > 0 ? (
                                <ul style={listStyle}>
                                    {files.map(file => (
                                        <li key={file.fileId} style={listItemStyle}>
                                            <span>{file.fileName} (Uploaded: {new Date(file.uploadDate).toLocaleDateString()})</span>
                                            <div className='buttons'>
                                                <button
                                                    onClick={() => handleDownload(file)}
                                                    style={{ ...buttonStyle, marginLeft: '10px', padding: '5px 10px' }}
                                                >
                                                    Download
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(file)}
                                                    style={{ ...buttonStyle, marginLeft: '0px', padding: '5px 10px' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
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
                                            <button
                                                onClick={() => handleRevokeAllAccess(hospital)}
                                                style={{ ...buttonStyle, marginLeft: '0px', padding: '5px 10px' }}
                                            >
                                                Revoke All Access
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No hospitals found.</p>
                            )}

                            {selectedHospital && (
                                <div>
                                    <h3>Files Shared with {selectedHospital.name}</h3>
                                    {files1.length > 0 ? (
                                        <ul style={listStyle}>
                                            {files1.map(file => (
                                                <li key={file.fileId} style={listItemStyle}>
                                                    <span>{file.fileName}</span>
                                                    <div>
                                                        <button
                                                            onClick={() => handleDownload(file)}
                                                            style={{ ...buttonStyle, marginLeft: '10px', padding: '5px 10px' }}
                                                        >
                                                            Download
                                                        </button>
                                                        <button
                                                            onClick={() => handleRevokeFileAccess(selectedHospital,file)}
                                                            style={{ ...buttonStyle, marginLeft: '0px', padding: '5px 10px' }}
                                                        >
                                                            Revoke Access
                                                        </button>
                                                    </div>
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
                                    {files1.length > 0 ? (
                                        <ul style={listStyle}>
                                            {files1.map(file => (
                                                <li key={file.fileId} style={listItemStyle}>
                                                    <span>{file.fileName}</span>
                                                    <div className='buttons'>
                                                        <button
                                                            onClick={() => handleDownload(file, selectedPatient)}
                                                            style={{ ...buttonStyle, marginLeft: '10px', padding: '5px 10px' }}
                                                        >
                                                            Download
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(file, selectedPatient)}
                                                            style={{ ...buttonStyle, marginLeft: '0px', padding: '5px 10px' }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
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

const buttonContainerStyle = {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
};

const listStyle = {
    listStyleType: 'none',
    padding: '0'
};

const listItemStyle = {
    padding: '10px',
    borderBottom: '1px solid #ccc',
    display: 'flex', // Flexbox to align file info and button
    justifyContent: 'space-between', // Space between file info and button
    alignItems: 'center' // Center vertically
};

const clickableListItemStyle = {
    ...listItemStyle,
    cursor: 'pointer',
    backgroundColor: '#f0f0f0',
    transition: 'background-color 0.2s'
};

export default Dashboard;
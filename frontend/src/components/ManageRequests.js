import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';
import axios from 'axios';
import crypto from 'crypto';
import { ec as EC } from 'elliptic';

const ec = new EC("secp256k1");

const ManageRequests = () => {
    const { wallet, token } = useWallet();
    const { contracts } = useContracts();
    const navigate = useNavigate();
    const [role, setRole] = useState(null); // patient or hospital
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Fetch role and requests on mount
    useEffect(() => {
        const fetchRoleAndRequests = async () => {
            if (!token || !wallet || !contracts?.request) {
                setErrorMessage('Missing token, wallet, or contract instance.');
                return;
            }

            setLoading(true);
            setErrorMessage('');
            try {
                // Fetch user role
                const roleRes = await axios.get('http://localhost:5000/api/auth/role', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const userRole = roleRes.data.role;
                setRole(userRole);

                // Fetch requests based on role
                let fetchedRequests;
                if (userRole === 'patient') {
                    fetchedRequests = await contracts.request.getPatientRequests();
                } else if (userRole === 'hospital') {
                    fetchedRequests = await contracts.request.getHospitalRequests();
                } else {
                    throw new Error('Invalid role');
                }

                // Parse and set requests
                const parsedRequests = fetchedRequests.map((req) => ({
                    requestId: req.requestId.toString(),
                    hospital: req.hospital,
                    patient: req.patient,
                    fileList: req.fileList,
                    deadline: new Date(req.deadline.toNumber() * 1000).toLocaleString(), // Convert Unix timestamp to readable date
                    accessType: req.accessType === 0 ? 'Read' : req.accessType === 1 ? 'Write' : 'Both',
                    isProcessed: req.isProcessed
                }));
                setRequests(parsedRequests);
            } catch (err) {
                console.error('Error fetching requests:', err);
                setErrorMessage('Failed to load requests.');
            } finally {
                setLoading(false);
            }
        };

        fetchRoleAndRequests();
    }, [token, wallet, contracts]);


    function encryptAESKey(aesKey, publicKeyHex) {
        publicKeyHex = publicKeyHex.substring(2);
        //console.log("1.publickey:", publicKeyHex);
        //console.log("aesKey:", aesKey);

        const userBPublicKey = ec.keyFromPublic(publicKeyHex, "hex").getPublic();

        const ephemeralKey = ec.genKeyPair();
        const ephemeralPublicKey = ephemeralKey.getPublic("hex");
        //console.log("Ephemeral Public Key:", ephemeralPublicKey);

        const sharedSecret = ephemeralKey.derive(userBPublicKey);
        const encryptionKey = crypto.createHash("sha256")
            .update(Buffer.from(sharedSecret.toArray()))
            .digest();
        //console.log("Derived Encryption Key:", encryptionKey.toString("hex"));

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


    const handleAccept = async (request) => {
        setLoading(true);
        try {
            console.log('---Accepting request---');
            console.log('request:', request);
            const deadlineSeconds = Math.floor(new Date(request.deadline).getTime() / 1000);

            console.log('---Fetching Encrypted Keys from File Registry---');
            const rawKeys = await contracts.fileRegistry.getKeys(request.patient, request.fileList);
            console.log('Encrypted Keys from FileRegistry:', rawKeys);

            console.log('---Decrypting the Encrypted Keys---');
            const decryptedKeys = await Promise.all(rawKeys.map(async (encryptedKey) => {
                const decodedData = JSON.parse(Buffer.from(encryptedKey, "base64").toString());
                //console.log("decodeddata:", decodedData);
                const userPrivateKey = ec.keyFromPrivate(wallet.privateKey.substring(2), "hex");
                const ephemeralPublicKey = ec.keyFromPublic(decodedData.ephemeralPublicKey, "hex").getPublic();
                const sharedSecret = userPrivateKey.derive(ephemeralPublicKey);
                const decryptionKey = crypto.createHash("sha256")
                    .update(Buffer.from(sharedSecret.toArray()))
                    .digest();
                //console.log("Derived Decryption Key:", decryptionKey.toString("hex"));

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

            console.log("---Retrieving the Hospital's Public Key");
            const response = await axios.get('http://localhost:5000/api/auth/pub-details', {
                params: {
                    publicAddress: request.hospital,
                    role: 'hospital'
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            //console.log(response.data);
            const hospitalPublicKey = response.data.publicKey;
            console.log('Hospital Public Key:', hospitalPublicKey);

            console.log('---Encrypting the AES Keys with Hospital Public Key---');
            const encryptedKeys = await Promise.all(decryptedKeys.map(async (key) => {
                return encryptAESKey(key, hospitalPublicKey);
            }));
            console.log('Re-encrypted Keys for Hospital:', encryptedKeys);

            console.log('---Calling the processRequest Function in Blockchain---');
            await contracts.accessControl.processRequest(
                request.requestId,
                encryptedKeys
            );
            console.log('Blockchain Transaction successfull');

            console.log('---Making Backend call to save permission metadata---');
            if (request.accessType === 'Read') {
                const grantData = {
                    hospitalUniqueId: response.data.uniqueId,
                    fileIds: request.fileList,
                    deadline: deadlineSeconds
                };
                await axios.post('http://localhost:5000/api/file/patient/grant-access', grantData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            else if (request.accessType === 'Write') {
                const grantData = {
                    hospitalUniqueId: response.data.uniqueId,
                    deadline: deadlineSeconds
                };
                await axios.post('http://localhost:5000/api/file/patient/grant-write-access', grantData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            else {
                const grantData = {
                    hospitalUniqueId: response.data.uniqueId,
                    fileIds: request.fileList,
                    deadline: deadlineSeconds
                };
                await axios.post('http://localhost:5000/api/file/patient/grant-access', grantData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                await axios.post('http://localhost:5000/api/file/patient/grant-write-access', grantData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            console.log('Permission granted successfully!');
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
            <h1>Manage Requests</h1>
            {loading && <p>Loading...</p>}
            {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

            {role && (
                <div>
                    <h2>{role === 'patient' ? 'Requests Made for You' : 'Your Requests'}</h2>
                    {requests.length > 0 ? (
                        <ul style={listStyle}>
                            {requests.map((request) => (
                                <li key={request.requestId} style={requestItemStyle}>
                                    <div style={requestDetailStyle}>
                                        <p><strong>Request ID:</strong> {request.requestId}</p>
                                        <p><strong>Hospital Address:</strong> {request.hospital}</p>
                                        <p><strong>Patient Address:</strong> {request.patient}</p>
                                        <p><strong>Files Requested:</strong> {request.fileList.join(', ')}</p>
                                        <p><strong>Deadline:</strong> {request.deadline}</p>
                                        <p><strong>Access Type:</strong> {request.accessType}</p>
                                        <p><strong>Processed:</strong> {request.isProcessed ? 'Yes' : 'No'}</p>
                                    </div>
                                    {role === 'patient' && !request.isProcessed && (
                                        <button
                                            onClick={() => handleAccept(request)}
                                            style={buttonStyle}
                                            disabled={loading}
                                        >
                                            Accept
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No requests found.</p>
                    )}
                </div>
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

const listStyle = {
    listStyleType: 'none',
    padding: '0'
};

const requestItemStyle = {
    padding: '15px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9'
};

const requestDetailStyle = {
    flex: 1
};

const buttonStyle = {
    padding: '10px',
    backgroundColor: '#28a745', // Green for "Accept"
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '10px'
};

export default ManageRequests;
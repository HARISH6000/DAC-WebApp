import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import CryptoJS from 'crypto-js';
import { ethers } from 'ethers';
import { useWallet } from './WalletContext'; // Assuming WalletContext is in components folder


const contractABI = [
    {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "participantAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "uniqueId",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "role",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "publicKey",
            "type": "string"
          }
        ],
        "name": "ParticipantRegistered",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "participantAddress",
            "type": "address"
          }
        ],
        "name": "getParticipantDetails",
        "outputs": [
          {
            "internalType": "string",
            "name": "uniqueId",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "role",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "publicKey",
            "type": "string"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "participantAddress",
            "type": "address"
          }
        ],
        "name": "getPublicKey",
        "outputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "participantAddress",
            "type": "address"
          }
        ],
        "name": "isParticipantRegistered",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "requester",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "uid",
            "type": "string"
          }
        ],
        "name": "isValidUid",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "uniqueId",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "role",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "publicKey",
            "type": "string"
          }
        ],
        "name": "registerParticipant",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
];

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0xF2B07abd243DE8B1BBfDC044a5d087CfB3Ac63A7";

const Signup = () => {
    const [role, setRole] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        dateOfBirth: '',
        bloodGroup: '',
        licenseNumber: '',
        password: '',
        privateKey: '' // Temporary field, not sent to backend
    });

    const navigate = useNavigate();
    const { login } = useWallet(); // Access login function from WalletContext

    const handleRoleChange = (e) => {
        setRole(e.target.value);
        setFormData({
            name: '',
            email: '',
            phone: '',
            address: '',
            dateOfBirth: '',
            bloodGroup: '',
            licenseNumber: '',
            password: '',
            privateKey: ''
        });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generateUniqueId = (role, formData) => {
        const prefix = role === 'patient' ? 'PAT' : 'HOS';
    
        const dataString = `${formData.name}${formData.email}${formData.phone}${formData.address}${formData.password}${role}${
            role === 'patient' 
                ? `${formData.dateOfBirth}${formData.bloodGroup}` 
                : formData.licenseNumber
        }`;
    
        const hash = CryptoJS.SHA256(dataString).toString(CryptoJS.enc.Hex);
    
        // Take the first 8 characters of the hash and prepend the prefix
        const uniqueId = `${prefix}${hash.slice(0, 12)}`;
    
        return uniqueId;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Step 1: Create wallet from private key
            const wallet = new ethers.Wallet(formData.privateKey);
            const publicKey = wallet.publicKey;

            // Step 2: Encrypt the private key with AES using the password
            const encryptedPrivateKey = CryptoJS.AES.encrypt(
                formData.privateKey,
                formData.password
            ).toString();

            // Step 3: Generate uniqueId
            const uniqueId = generateUniqueId(role,formData);
            
            // Step 4: Prepare user data for backend
            const userData = {
                uniqueId,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                address: formData.address,
                publicKey,
                publicAddress:wallet.address,
                encryptedPrivateKey,
                password: formData.password,
                role
            };

            if (role === 'patient') {
                userData.dateOfBirth = formData.dateOfBirth;
                userData.bloodGroup = formData.bloodGroup;
            } else if (role === 'hospital') {
                userData.licenseNumber = formData.licenseNumber;
            }

            // Step 5: Register with backend
            const backendRes = await axios.post('http://localhost:5000/api/auth/signup', userData);
            const token = backendRes.data.token || null; // Token optional from backend

            // Step 6: Connect wallet to Ethereum provider
            const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545'); // Adjust provider URL
            const connectedWallet = wallet.connect(provider);

            // Step 7: Interact with smart contract
            const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, connectedWallet);
            const tx = await contract.registerParticipant(
                uniqueId,
                formData.name,
                role,
                publicKey
            );
            await tx.wait(); // Wait for transaction confirmation
            console.log('Transaction hash:', tx.hash);

            // Step 8: Store wallet and token in context
            login(connectedWallet, token);

            alert('Signup and blockchain registration successful!');
            navigate('/dashboard');
        } catch (err) {
            console.error('Signup error:', err);
            alert(`Signup failed! ${err.message || 'Try again.'}`);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <label>Role:</label>
            <select name="role" value={role} onChange={handleRoleChange} required>
                <option value="">Select Role</option>
                <option value="patient">Patient</option>
                <option value="hospital">Hospital</option>
            </select>

            {role && (
                <>
                    <input
                        type="text"
                        name="name"
                        placeholder="Name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="phone"
                        placeholder="Phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="address"
                        placeholder="Address"
                        value={formData.address}
                        onChange={handleChange}
                        required
                    />

                    {role === 'patient' && (
                        <>
                            <input
                                type="date"
                                name="dateOfBirth"
                                placeholder="Date of Birth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                required
                            />
                            <label>Blood Group:</label>
                            <select
                                name="bloodGroup"
                                value={formData.bloodGroup}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select Blood Group</option>
                                <option value="A+">A+</option>
                                <option value="A-">A-</option>
                                <option value="B+">B+</option>
                                <option value="B-">B-</option>
                                <option value="O+">O+</option>
                                <option value="O-">O-</option>
                                <option value="AB+">AB+</option>
                                <option value="AB-">AB-</option>
                            </select>
                        </>
                    )}

                    {role === 'hospital' && (
                        <input
                            type="text"
                            name="licenseNumber"
                            placeholder="License Number"
                            value={formData.licenseNumber}
                            onChange={handleChange}
                            required
                        />
                    )}

                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="privateKey"
                        placeholder="Private Key (Ethereum)"
                        value={formData.privateKey}
                        onChange={handleChange}
                        required
                    />

                    <button type="submit">Signup</button>
                </>
            )}
        </form>
    );
};

export default Signup;
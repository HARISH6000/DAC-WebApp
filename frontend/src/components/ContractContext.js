import { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Replace with your deployed contract addresses
const REGISTRATION_CONTRACT_ADDRESS = "0xe381Ee439EC6949C4c1bbEC9416F94379Ac1E076";
const REQUEST_CONTRACT_ADDRESS = "0xYourRequestContractAddress"; // Replace with actual address
const ACCESS_CONTROL_CONTRACT_ADDRESS = "0xYourAccessControlContractAddress"; // Replace with actual address
const VALIDATION_CONTRACT_ADDRESS = "0xYourValidationContractAddress"; // Replace with actual address
const FILE_REGISTRY_CONTRACT_ADDRESS = "0xYourFileRegistryContractAddress"; // Replace with actual address

// Registration contract ABI (unchanged from your provided code)
const registrationABI = [
    {
        "anonymous": false,
        "inputs": [
          {"indexed": true, "internalType": "address", "name": "participantAddress", "type": "address"},
          {"indexed": false, "internalType": "string", "name": "uniqueId", "type": "string"},
          {"indexed": false, "internalType": "string", "name": "name", "type": "string"},
          {"indexed": false, "internalType": "string", "name": "role", "type": "string"},
          {"indexed": false, "internalType": "string", "name": "publicKey", "type": "string"}
        ],
        "name": "ParticipantRegistered",
        "type": "event"
      },
      {"inputs": [{"internalType": "address", "name": "participantAddress", "type": "address"}],"name": "getParticipantDetails","outputs": [{"internalType": "string","name": "uniqueId","type": "string"},{"internalType": "string","name": "name","type": "string"},{"internalType": "string","name": "role","type": "string"},{"internalType": "string","name": "publicKey","type": "string"}],"stateMutability": "view","type": "function"},
      {"inputs": [{"internalType": "address","name": "participantAddress","type": "address"}],"name": "getPublicKey","outputs": [{"internalType": "string","name": "","type": "string"}],"stateMutability": "view","type": "function"},
      {"inputs": [{"internalType": "address","name": "participantAddress","type": "address"}],"name": "isParticipantRegistered","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "view","type": "function"},
      {"inputs": [{"internalType": "address","name": "requester","type": "address"},{"internalType": "string","name": "uid","type": "string"}],"name": "isValidUid","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "view","type": "function"},
      {"inputs": [{"internalType": "string","name": "uniqueId","type": "string"},{"internalType": "string","name": "name","type": "string"},{"internalType": "string","name": "role","type": "string"},{"internalType": "string","name": "publicKey","type": "string"}],"name": "registerParticipant","outputs": [],"stateMutability": "nonpayable","type": "function"}
];

// Placeholder ABIs (fill these with your actual ABIs)
const AccessControlABI = []; // Add your AccessControl ABI here
const RequestABI = []; // Add your Request ABI here
const ValidationABI = []; // Add your Validation ABI here
const FileRegistryABI = []; // Add your FileRegistry ABI here

const ContractContext = createContext();

export const ContractProvider = ({ children }) => {
    const [contracts, setContracts] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initializeContracts = async () => {
            try {
                // Set up provider (e.g., local Hardhat node)
                const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545'); // Adjust URL if needed

                // Initialize contracts with provider (read-only initially)
                const registrationContract = new ethers.Contract(
                    REGISTRATION_CONTRACT_ADDRESS,
                    registrationABI,
                    provider
                );

                const requestContract = new ethers.Contract(
                    REQUEST_CONTRACT_ADDRESS,
                    RequestABI,
                    provider
                );

                const accessControlContract = new ethers.Contract(
                    ACCESS_CONTROL_CONTRACT_ADDRESS,
                    AccessControlABI,
                    provider
                );

                const fileRegistryContract = new ethers.Contract(
                    FILE_REGISTRY_CONTRACT_ADDRESS,
                    FileRegistryABI,
                    provider
                );

                const validationContract = new ethers.Contract(
                    VALIDATION_CONTRACT_ADDRESS,
                    ValidationABI,
                    provider
                );

                // Store contracts in state
                setContracts({
                    registration: registrationContract,
                    request: requestContract,
                    accessControl: accessControlContract,
                    validation: validationContract,
                    fileRegistry: fileRegistryContract
                });
            } catch (err) {
                console.error('Failed to initialize contracts:', err);
            } finally {
                setLoading(false);
            }
        };

        initializeContracts();
    }, []);

    // Function to update contracts with a signer (wallet) when available
    const updateWithSigner = (wallet) => {
        if (!wallet || !contracts) return;

        const connectedWallet = wallet.connect(contracts.registration.provider);

        // Update all contracts with the signer
        const updatedRegistrationContract = contracts.registration.connect(connectedWallet);
        const updatedRequestContract = contracts.request.connect(connectedWallet);
        const updatedAccessControlContract = contracts.accessControl.connect(connectedWallet);
        const updatedValidationContract = contracts.validation.connect(connectedWallet);
        const updatedFileRegistryContract = contracts.fileRegistry.connect(connectedWallet);

        setContracts({
            registration: updatedRegistrationContract,
            request: updatedRequestContract,
            accessControl: updatedAccessControlContract,
            validation: updatedValidationContract,
            fileRegistry: updatedFileRegistryContract
        });
    };

    return (
        <ContractContext.Provider value={{ contracts, loading, updateWithSigner }}>
            {loading ? <div>Loading contracts...</div> : children}
        </ContractContext.Provider>
    );
};

export const useContracts = () => useContext(ContractContext);
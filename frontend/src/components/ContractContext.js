import { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Replace with your deployed contract address
const REGISTRATION_CONTRACT_ADDRESS = "0xe381Ee439EC6949C4c1bbEC9416F94379Ac1E076";

// Registration contract ABI (simplified; use full ABI from compilation)
const registrationABI = [
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

const ContractContext = createContext();

export const ContractProvider = ({ children }) => {
    const [contracts, setContracts] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initializeContracts = async () => {
            try {
                // Set up provider (e.g., local Hardhat node)
                const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545'); // Adjust URL

                // Initialize contracts with provider (read-only initially)
                const registrationContract = new ethers.Contract(
                    REGISTRATION_CONTRACT_ADDRESS,
                    registrationABI,
                    provider
                );

                // Store contracts in state
                setContracts({
                    registration: registrationContract
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
        const updatedRegistrationContract = contracts.registration.connect(connectedWallet);

        setContracts({
            ...contracts,
            registration: updatedRegistrationContract
        });
    };

    return (
        <ContractContext.Provider value={{ contracts, loading, updateWithSigner }}>
            {loading ? <div>Loading contracts...</div> : children}
        </ContractContext.Provider>
    );
};

export const useContracts = () => useContext(ContractContext);
import { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Replace with your deployed contract addresses
const REGISTRATION_CONTRACT_ADDRESS = "0xe381Ee439EC6949C4c1bbEC9416F94379Ac1E076";
const REQUEST_CONTRACT_ADDRESS = "0x6e6FAEd3deEe2FF5adBF6F0dCF1Df46e16B8d241";
const ACCESS_CONTROL_CONTRACT_ADDRESS = "0x0ACb2DB7420e14603D725C7ee453BB498e3743a4";
const VALIDATION_CONTRACT_ADDRESS = "0x81f58A343FeFf8FD1167D9FD98a70bb041be94FE";
const FILE_REGISTRY_CONTRACT_ADDRESS = "0x8BcB421F39E93aE5B3493A7165A3060aB098304f";

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


const AccessControlABI = [{
    "inputs": [
      {
        "internalType": "address",
        "name": "_requestContract",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "patient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "enum AccessControlContract.AccessType",
        "name": "accessType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "isAll",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "string[]",
        "name": "keys",
        "type": "string[]"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      }
    ],
    "name": "AccessGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "patient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string[]",
        "name": "keys",
        "type": "string[]"
      }
    ],
    "name": "AccessRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "patient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      }
    ],
    "name": "AllAccessRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "patient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "numKeysRemoved",
        "type": "uint256"
      }
    ],
    "name": "ExpiredKeysCleaned",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      }
    ],
    "name": "cleanupExpiredKeys",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      }
    ],
    "name": "getAccessList",
    "outputs": [
      {
        "internalType": "string[]",
        "name": "keys",
        "type": "string[]"
      },
      {
        "internalType": "uint256[]",
        "name": "deadlines",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      }
    ],
    "name": "getAccessType",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      },
      {
        "internalType": "enum AccessControlContract.AccessType",
        "name": "accessType",
        "type": "uint8"
      },
      {
        "internalType": "bool",
        "name": "isAll",
        "type": "bool"
      },
      {
        "internalType": "string[]",
        "name": "fileList",
        "type": "string[]"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      }
    ],
    "name": "grantAccess",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      }
    ],
    "name": "processRequest",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      },
      {
        "internalType": "string[]",
        "name": "list",
        "type": "string[]"
      }
    ],
    "name": "removeAccess",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "hospitalAddress",
        "type": "address"
      }
    ],
    "name": "removeAllAcess",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "requestContract",
    "outputs": [
      {
        "internalType": "contract IRequestContract",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "patient",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "hospital",
        "type": "address"
      },
      {
        "internalType": "string[]",
        "name": "fileHashes",
        "type": "string[]"
      }
    ],
    "name": "verifyFileAccess",
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
        "name": "patient",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "hospital",
        "type": "address"
      }
    ],
    "name": "verifyFileWriteAccess",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const RequestABI = [
    {
        "inputs": [
          {
            "internalType": "address",
            "name": "_registration",
            "type": "address"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "requestId",
            "type": "uint256"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "patient",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "hospital",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "string[]",
            "name": "fileList",
            "type": "string[]"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "enum RequestContract.AccessType",
            "name": "accessType",
            "type": "uint8"
          },
          {
            "indexed": false,
            "internalType": "bool",
            "name": "isAll",
            "type": "bool"
          },
          {
            "indexed": false,
            "internalType": "bool",
            "name": "isProcessed",
            "type": "bool"
          }
        ],
        "name": "RequestMade",
        "type": "event"
      },
      {
        "inputs": [],
        "name": "getHospitalRequests",
        "outputs": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "requestId",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "hospital",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "patient",
                "type": "address"
              },
              {
                "internalType": "string[]",
                "name": "fileList",
                "type": "string[]"
              },
              {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
              },
              {
                "internalType": "enum RequestContract.AccessType",
                "name": "accessType",
                "type": "uint8"
              },
              {
                "internalType": "bool",
                "name": "isAll",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "isProcessed",
                "type": "bool"
              }
            ],
            "internalType": "struct RequestContract.Request[]",
            "name": "",
            "type": "tuple[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "getPatientRequests",
        "outputs": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "requestId",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "hospital",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "patient",
                "type": "address"
              },
              {
                "internalType": "string[]",
                "name": "fileList",
                "type": "string[]"
              },
              {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
              },
              {
                "internalType": "enum RequestContract.AccessType",
                "name": "accessType",
                "type": "uint8"
              },
              {
                "internalType": "bool",
                "name": "isAll",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "isProcessed",
                "type": "bool"
              }
            ],
            "internalType": "struct RequestContract.Request[]",
            "name": "",
            "type": "tuple[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "requestId",
            "type": "uint256"
          }
        ],
        "name": "getRequest",
        "outputs": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "requestId",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "hospital",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "patient",
                "type": "address"
              },
              {
                "internalType": "string[]",
                "name": "fileList",
                "type": "string[]"
              },
              {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
              },
              {
                "internalType": "enum RequestContract.AccessType",
                "name": "accessType",
                "type": "uint8"
              },
              {
                "internalType": "bool",
                "name": "isAll",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "isProcessed",
                "type": "bool"
              }
            ],
            "internalType": "struct RequestContract.Request",
            "name": "",
            "type": "tuple"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "patient",
            "type": "address"
          },
          {
            "internalType": "string[]",
            "name": "fileList",
            "type": "string[]"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "enum RequestContract.AccessType",
            "name": "accessType",
            "type": "uint8"
          },
          {
            "internalType": "bool",
            "name": "isAll",
            "type": "bool"
          }
        ],
        "name": "makeRequest",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "registration",
        "outputs": [
          {
            "internalType": "contract IRegistration",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "requestCounter",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "requests",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "requestId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "hospital",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "patient",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "enum RequestContract.AccessType",
            "name": "accessType",
            "type": "uint8"
          },
          {
            "internalType": "bool",
            "name": "isAll",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "isProcessed",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "requestId",
            "type": "uint256"
          }
        ],
        "name": "setRequestProcessed",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
];

const ValidationABI = [
    {
        "inputs": [
          {
            "internalType": "address",
            "name": "_registration",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "_accessControl",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "_fileRegistry",
            "type": "address"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "bytes32",
            "name": "tokenHash",
            "type": "bytes32"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "hospital",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "patient",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "string[]",
            "name": "fileHashes",
            "type": "string[]"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "expiry",
            "type": "uint256"
          }
        ],
        "name": "ReadAccessTokenGenerated",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "bytes32",
            "name": "tokenHash",
            "type": "bytes32"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "hospital",
            "type": "address"
          }
        ],
        "name": "TokenValidated",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "bytes32",
            "name": "tokenHash",
            "type": "bytes32"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "hospital",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "patient",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "expiry",
            "type": "uint256"
          }
        ],
        "name": "WriteAccessTokenGenerated",
        "type": "event"
      },
      {
        "inputs": [],
        "name": "accessControl",
        "outputs": [
          {
            "internalType": "contract IAccessControl",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32[]",
            "name": "tokenHashes",
            "type": "bytes32[]"
          }
        ],
        "name": "cleanupExpiredTokens",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "fileRegistry",
        "outputs": [
          {
            "internalType": "contract IFileRegistry",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "registration",
        "outputs": [
          {
            "internalType": "contract IRegistration",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "patient",
            "type": "address"
          },
          {
            "internalType": "string[]",
            "name": "fileHashes",
            "type": "string[]"
          }
        ],
        "name": "requestFileAccess",
        "outputs": [
          {
            "internalType": "bytes32",
            "name": "",
            "type": "bytes32"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "patient",
            "type": "address"
          }
        ],
        "name": "requestFileWriteAccess",
        "outputs": [
          {
            "internalType": "bytes32",
            "name": "",
            "type": "bytes32"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "tokenHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          },
          {
            "internalType": "bool",
            "name": "isWrite",
            "type": "bool"
          },
          {
            "internalType": "string[]",
            "name": "fileHashes",
            "type": "string[]"
          },
          {
            "internalType": "string[]",
            "name": "keyList",
            "type": "string[]"
          }
        ],
        "name": "validateToken",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      }
]; 
const FileRegistryABI = [
    {
        "inputs": [
          {
            "internalType": "address",
            "name": "entity",
            "type": "address"
          },
          {
            "internalType": "string[]",
            "name": "fileHashes",
            "type": "string[]"
          }
        ],
        "name": "getKeys",
        "outputs": [
          {
            "internalType": "string[]",
            "name": "",
            "type": "string[]"
          }
        ],
        "stateMutability": "view",
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
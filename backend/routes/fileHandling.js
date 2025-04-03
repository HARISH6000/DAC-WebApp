const express = require('express');
const mongoose = require('mongoose');
const MedicalFile = require('../models/MedicalFile');
const AccessPermission = require('../models/AccessPermission');
const Patient = require('../models/Patient');
const Hospital = require('../models/Hospital');
const WritePermission = require('../models/WritePermission');
const { authenticateToken } = require('../middleware/auth');
const { ethers } = require('ethers');
const Minio = require('minio');

const router = express.Router();
require('dotenv').config();

const minioClient = new Minio.Client({
    endPoint: '192.168.143.162',
    port: 9000,
    useSSL: false, 
    accessKey: process.env.ACCESS_KEY, 
    secretKey: process.env.SECRET_KEY  
});

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const CONTRACT_ABI = [
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


const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);


router.get('/patient/files', authenticateToken, async (req, res) => {
    try {
        const files = await MedicalFile.find({ patientId: req.user.id });
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching files' });
    }
});

router.get('/patient/hospitals', authenticateToken, async (req, res) => {
    try {
        const patientId = req.user.id;
        if (!mongoose.isValidObjectId(patientId)) {
            return res.status(400).json({ error: 'Invalid patient ID' });
        }
        const hospitalIds = await AccessPermission.distinct("hospitalId", { patientId });
        const hospitals = await Hospital.find({ _id: { $in: hospitalIds } });
        res.json(hospitals);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching patients' });
    }
});

router.get('/hospital/patients', authenticateToken, async (req, res) => {
    try {
        const hospitalId = req.user.id;
        if (!mongoose.isValidObjectId(hospitalId)) {
            return res.status(400).json({ error: 'Invalid hospital ID' });
        }
        const patientIds = await AccessPermission.distinct("patientId", { hospitalId });
        const patients = await Patient.find({ _id: { $in: patientIds } });
        res.json(patients);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching patients' });
    }
});

router.get('/hospital/patients-write-access', authenticateToken, async (req, res) => {
    try {
        const hospitalId = req.user.id;
        if (!mongoose.isValidObjectId(hospitalId)) {
            return res.status(400).json({ error: 'Invalid hospital ID' });
        }
        const currentDate = new Date();
        const patientIds = await WritePermission.distinct('patientId', {
            hospitalId,
            deadline: { $gt: currentDate }
        });
        const patients = await Patient.find({ _id: { $in: patientIds } });
        res.json(patients);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching patients' });
    }
});

router.get('/hospital/files', authenticateToken, async (req, res) => {
    try {
        const { uniqueId } = req.query; // Changed from req.body
        const hospitalId = req.user.id;
        if (!uniqueId) return res.status(400).json({ error: 'Patient uniqueId is required' });

        const patient = await Patient.findOne({ uniqueId });
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const files = await AccessPermission.find({ hospitalId, patientId: patient._id }).populate('fileId');
        res.json(files.map(ap => ap.fileId));
    } catch (err) {
        res.status(500).json({ error: 'Error fetching files' });
    }
});

router.get('/patient/hospital-files', authenticateToken, async (req, res) => {
    try {
        const { hospitalUniqueId } = req.query; // Hospital uniqueId from query params
        const patientId = req.user.id;

        if (!hospitalUniqueId) {
            return res.status(400).json({ error: 'hospitalUniqueId is required' });
        }

        if (!mongoose.isValidObjectId(patientId)) {
            return res.status(400).json({ error: 'Invalid patient ID' });
        }

        // Find the hospital by uniqueId
        const hospital = await Hospital.findOne({ uniqueId: hospitalUniqueId });
        if (!hospital) {
            return res.status(404).json({ error: 'Hospital not found' });
        }

        // Fetch access permissions for this patient and hospital
        const permissions = await AccessPermission.find({
            patientId,
            hospitalId: hospital._id
        }).populate('fileId');

        // Extract files from permissions
        const files = permissions.map(permission => permission.fileId);

        res.json(files);
    } catch (err) {
        console.error('Error fetching hospital files for patient:', err);
        res.status(500).json({ error: 'Error fetching files' });
    }
});

router.post('/add', authenticateToken, async (req, res) => {
    try {
        const { uniqueId, fileId, fileName } = req.body;
        const patient = await Patient.findOne({ uniqueId });
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const newFile = new MedicalFile({ fileId, patientId: patient._id, fileName });
        await newFile.save();
        res.json({ message: 'File added successfully', file: newFile });
    } catch (err) {
        res.status(500).json({ error: 'Error adding file' });
    }
});

async function uploadToMinIO(uniqueId, fileHash, fileData) {
    try {
        // Bucket name is the user's uniqueId (lowercase to comply with MinIO naming rules)
        const bucketName = uniqueId.toLowerCase();
        const objectName = `${fileHash}.json`; // File stored as <fileHash>.json

        // Check if the bucket exists, create it if it doesn’t
        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
            await minioClient.makeBucket(bucketName, 'ap-south-1'); // Region can be adjusted
            console.log(`Bucket ${bucketName} created`);
        }

        // Convert fileData to a JSON string and then to a Buffer
        const fileContent = Buffer.from(JSON.stringify(fileData), 'utf8');

        // Upload the file to MinIO
        await minioClient.putObject(bucketName, objectName, fileContent, {
            'Content-Type': 'application/json'
        });
        console.log(`File ${objectName} uploaded to bucket ${bucketName} successfully`);
    } catch (error) {
        console.error('Error uploading to MinIO:', error);
        throw error; // Let the caller handle the error
    }
}

router.post('/upload', authenticateToken, async (req, res) => {
    try {
        const { uniqueId ,tokenHash, signature, isWrite, fileHashes, keyList, fileData } = req.body;

        if (!tokenHash || !signature || isWrite === undefined || !fileHashes || !keyList) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Convert data to expected Solidity types
        const bytes32TokenHash = ethers.utils.hexlify(ethers.utils.arrayify(tokenHash)); // Ensure it's bytes32
        const signatureBytes = ethers.utils.arrayify(signature); // Convert to bytes
        const fileHashesArray = fileHashes.map(String); // Convert each element to a string
        const keyListArray = keyList.map(String); // Convert each element to a string

        // Call the smart contract function
        const tx = await contract.validateToken(
            bytes32TokenHash,
            signatureBytes,
            isWrite,
            fileHashesArray,
            keyListArray
        );

        // Wait for the transaction to be confirmed
        await tx.wait();

        fileData.forEach(async file=>{
            await uploadToMinIO(uniqueId,file.fileHash,file);
        });

        res.json({ success: true, txHash: tx.hash });

    } catch (err) {
        console.error('Error calling validateToken:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});


router.post('/patient/grant-access', authenticateToken, async (req, res) => {
    try {
        console.log(req.body, "\n------\n", req.user.id);
        const { fileIds, hospitalUniqueId, deadline, blockchainTxHash } = req.body;

        // Validate required fields
        if (!fileIds || !Array.isArray(fileIds) || !hospitalUniqueId || !deadline) {
            return res.status(400).json({ error: 'hospitalUniqueId, and deadline are required' });
        }

        // Find the patient (caller) and hospital
        const patient = await Patient.findById(req.user.id);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const hospital = await Hospital.findOne({ uniqueId: hospitalUniqueId });
        if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

        // Verify all files exist and belong to the patient
        const files = await MedicalFile.find({
            fileId: { $in: fileIds },
            patientId: req.user.id
        });
        if (files.length !== fileIds.length) {
            return res.status(404).json({ error: 'One or more files not found or not owned by patient' });
        }

        // Convert deadline (in seconds) to a Date object
        const deadlineDate = new Date(deadline * 1000); // Assuming deadline is already in seconds from frontend

        // Create and save new AccessPermissions for each file
        const permissions = fileIds.map(fileId => (
            newPermission={
            fileId: files.find(f => f.fileId === fileId)._id,
            hospitalId: hospital._id,
            patientId: patient._id,
            grantedDate: new Date(),
            blockchainTxHash: blockchainTxHash || null,
            deadline: deadlineDate
            }
        ));

        permissions.forEach(async key=>{
            let permission = await AccessPermission.findOneAndUpdate(
                { patientId: key.patientId, hospitalId: key.hospitalId, fileId:key.fileId}, // Query to find existing doc
                { $set: key }, // Update fields
                { new: true, runValidators: true } // Return updated doc and run schema validators
            );
            if (!permission) {
                // If no existing permission, create a new one
                permission = new AccessPermission(key);
                await permission.save();
            }
        });

        res.status(201).json({ message: 'Access granted successfully'});
    } catch (err) {
        console.error('Error granting access:', err);
        res.status(500).json({ error: 'Error granting access' });
    }
});

router.post('/patient/grant-write-access', authenticateToken, async (req, res) => {
    try {
        console.log(req.body, "\n------\n", req.user.id);
        const { hospitalUniqueId, deadline, blockchainTxHash } = req.body;

        // Validate required fields
        if (!hospitalUniqueId || !deadline) {
            return res.status(400).json({ error: 'hospitalUniqueId and deadline are required' });
        }

        // Find the patient (caller) and hospital
        const patient = await Patient.findById(req.user.id);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const hospital = await Hospital.findOne({ uniqueId: hospitalUniqueId });
        if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

        // Convert deadline (in seconds) to a Date object
        const deadlineDate = new Date(deadline * 1000); // Assuming deadline is in seconds from frontend
        if (deadlineDate <= new Date()) {
            return res.status(400).json({ error: 'Deadline must be in the future' });
        }

        // Check for existing permission and update if found, otherwise create new
        const permissionData = {
            hospitalId: hospital._id,
            patientId: patient._id,
            grantedDate: new Date(),
            blockchainTxHash: blockchainTxHash || null,
            deadline: deadlineDate
        };

        let permission = await WritePermission.findOneAndUpdate(
            { patientId: patient._id, hospitalId: hospital._id }, // Query to find existing doc
            { $set: permissionData }, // Update fields
            { new: true, runValidators: true } // Return updated doc and run schema validators
        );

        if (!permission) {
            // If no existing permission, create a new one
            permission = new WritePermission(permissionData);
            await permission.save();
            return res.status(201).json({ message: 'Access granted successfully', permissions: permission });
        }

        res.status(200).json({ message: 'Access updated successfully', permissions: permission });
    } catch (err) {
        console.error('Error granting/updating access:', err);
        res.status(500).json({ error: 'Error granting or updating access' });
    }
});


router.delete('/delete', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.body;

        // Validate required field
        if (!fileId) {
            return res.status(400).json({ error: 'fileId is required' });
        }

        // Find the patient (caller)
        const patient = await Patient.findById(req.user.id);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        // Find and verify the file belongs to the patient
        const file = await MedicalFile.findOne({ fileId, patientId: patient._id });
        if (!file) return res.status(404).json({ error: 'File not found or not owned by patient' });

        // Delete all related AccessPermission documents
        await AccessPermission.deleteMany({ fileId: file._id });

        // Delete the MedicalFile document
        await MedicalFile.deleteOne({ _id: file._id });

        res.json({ message: 'File and all related access permissions deleted successfully' });
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).json({ error: 'Error deleting file' });
    }
});

module.exports = router;
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
  endPoint: '172.22.11.48',
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
    "name": "requestFileReadAccessToken",
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
    "name": "requestFileWriteAccessToken",
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
        "internalType": "string[]",
        "name": "fileHashes",
        "type": "string[]"
      }
    ],
    "name": "requestOwnFilesReadToken",
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
    "inputs": [],
    "name": "requestOwnFilesWriteToken",
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

router.get('/all-patient-files', async (req, res) => {
  try {
    console.log("query:",req.query );
    const { uniqueId } = req.query;
    const patient= await Patient.findOne({ uniqueId:uniqueId });
    const files = await MedicalFile.find({ patientId: patient._id });
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
    console.log("Checking if a bucket Exists....");
    const bucketExists = await minioClient.bucketExists(bucketName);
    console.log("doesBucketExists:",bucketExists);
    if (!bucketExists) {
      console.log("Creting a new bucket Exists....");
      await minioClient.makeBucket(bucketName, 'ap-south-1'); // Region can be adjusted
      console.log(`Bucket ${bucketName} created`);
    }

    // Convert fileData to a JSON string and then to a Buffer
    const fileContent = Buffer.from(JSON.stringify(fileData), 'utf8');

    // Upload the file to MinIO
    console.log("Saving File to the bucket.....");
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
    console.log("---Initiating Upload verifictaion process---");
    const { uniqueId, tokenHash, signature, isWrite, fileHashes, keyList, fileData } = req.body;

    if (!tokenHash || !signature || isWrite === undefined || !fileHashes || !keyList) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Convert data to expected Solidity types
    const bytes32TokenHash = ethers.utils.hexlify(ethers.utils.arrayify(tokenHash)); // Ensure it's bytes32
    const signatureBytes = ethers.utils.arrayify(signature); // Convert to bytes
    const fileHashesArray = fileHashes.map(String); // Convert each element to a string
    const keyListArray = keyList.map(String); // Convert each element to a string
    
    console.log("Calling the validateToken smart contract function to verify....");
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

    console.log("Transaction Reciept:", tx);

    console.log("Verification successfull.....\n Uploading to MinIO....");

    fileData.forEach(async file => {
      await uploadToMinIO(uniqueId, file.fileHash, file);
    });

    res.json({ success: true, txHash: tx.hash });

  } catch (err) {
    console.error('Error calling validateToken:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.post('/download', authenticateToken, async (req, res) => {
  try {
    console.log("-------Initiating Download verifictaion process--------");
    const { uniqueId, hospital, patient, fileHashes, tokenHash, signature } = req.body;
    if (!fileHashes || !tokenHash || !signature) {
      return res.status(400).json({ error: 'fileHashes, tokenHash, and signature are required' });
    }

    try {
      console.log("validating token......");
      const isValid = await contract.validateToken(
        tokenHash,
        signature,
        false,
        [],
        []
      );
      if (!isValid) {
        return res.status(403).json({ error: 'Invalid token or signature' });
      }
      console.log("Transaction Details:",isValid);
      console.log("-------Checking with the emitted block chain events--------");
      const filter = contract.filters.ReadAccessTokenGenerated(tokenHash, hospital, patient);
      const fromBlock = 0; // Start from genesis (or a specific block)
      const toBlock = 'latest'; // Up to the latest block

      // Query past events
      const events = await contract.queryFilter(filter, fromBlock, toBlock);

      console.log('Events:', events[0].args.fileHashes);
      console.log('File hashes:', fileHashes);

      if (events.length === 0) {
        console.log('No matching events found.');
        return res.status(403).json({ error: 'You have no access to the specified files' });
      }

      if (!(fileHashes.every(elem => events[0].args.fileHashes.includes(elem)))) {
        console.log('Some files are not matching.');
        return res.status(403).json({ error: 'You have no access to the specified files' });
      }

    } catch (contractError) {
      console.error('Contract validation error:', contractError);
      return res.status(403).json({ error: 'Token validation failed' });
    }

    const bucketName = uniqueId.toLowerCase();
    const objectName = `${fileHashes[0]}.json`;

    console.log("----Accessing minio---------");
    // Check if the bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      return res.status(404).json({ error: `Bucket ${bucketName} not found` });
    }

    console.log("bucketExists:",bucketExists);
    console.log("Reteriving file.........");
    // Download the file from MinIO
    const fileStream = await minioClient.getObject(bucketName, objectName);
    let fileData = '';

    // Collect the file data from the stream
    fileStream.on('data', (chunk) => {
      fileData += chunk.toString('utf8');
    });

    fileStream.on('end', () => {
      try {
        const parsedFileData = JSON.parse(fileData); // Parse JSON stored in MinIO
        res.status(200).json({
          message: 'File downloaded successfully',
          file: parsedFileData // Contains encryptedData, iv, fileName, mimeType, etc.
        });
      } catch (parseError) {
        console.error('Error parsing file data:', parseError);
        res.status(500).json({ error: 'Error processing file data' });
      }
    });

    fileStream.on('error', (err) => {
      console.error('MinIO stream error:', err);
      res.status(500).json({ error: 'Error retrieving file from MinIO' });
    });

    console.log("-----------------------------------------");

  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ error: 'Error downloading file' });
  }
});


router.post('/patient/grant-access', authenticateToken, async (req, res) => {
  try {
    console.log("---Saving Read Access permission---");
    console.log("req.body:",req.body, "\nuser._id:",req.user.id);
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
      newPermission = {
        fileId: files.find(f => f.fileId === fileId)._id,
        hospitalId: hospital._id,
        patientId: patient._id,
        grantedDate: new Date(),
        blockchainTxHash: blockchainTxHash || null,
        deadline: deadlineDate
      }
    ));

    permissions.forEach(async key => {
      let permission = await AccessPermission.findOneAndUpdate(
        { patientId: key.patientId, hospitalId: key.hospitalId, fileId: key.fileId }, // Query to find existing doc
        { $set: key }, // Update fields
        { new: true, runValidators: true } // Return updated doc and run schema validators
      );
      if (!permission) {
        // If no existing permission, create a new one
        permission = new AccessPermission(key);
        await permission.save();
      }
    });

    res.status(201).json({ message: 'Access granted successfully' });
    console.log("---Successfully saved the read permission---");
  } catch (err) {
    console.error('Error granting access:', err);
    res.status(500).json({ error: 'Error granting access' });
  }
});

router.post('/patient/grant-write-access', authenticateToken, async (req, res) => {
  try {
    console.log("---Saving Write Access permission---");
    console.log("req.body:",req.body, "\nuser._id:",req.user.id);
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
    // if (deadlineDate <= new Date()) {
    //   return res.status(400).json({ error: 'Deadline must be in the future' });
    // }

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
    console.log("---Successfully saved the write permission---");
  } catch (err) {
    console.error('Error granting/updating access:', err);
    res.status(500).json({ error: 'Error granting or updating access' });
  }
});


async function deleteFromMinIO(uniqueId, fileHash) {
  try {
    const bucketName = uniqueId.toLowerCase(); // Bucket name is the user's uniqueId
    const objectName = `${fileHash}.json`; // File stored as <fileHash>.json

    // Check if the file exists before deleting
    const fileStat = await minioClient.statObject(bucketName, objectName).catch(() => null);
    if (!fileStat) {
      console.log(`File ${objectName} not found in bucket ${bucketName}`);
      return { success: false, message: 'File not found' };
    }

    // Delete the file from MinIO
    await minioClient.removeObject(bucketName, objectName);
    console.log(`File ${objectName} deleted from bucket ${bucketName}`);

    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error('Error deleting from MinIO:', error);
    throw error; // Let the caller handle the error
  }
}



router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    console.log("---Initiating Deletion---");
    const { uniqueId, fileList, tokenHash, signature, patient, hospital } = req.body;

    // Validate required field
    if (fileList.length===0) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    const bytes32TokenHash = ethers.utils.hexlify(ethers.utils.arrayify(tokenHash)); 
    const signatureBytes = ethers.utils.arrayify(signature); 
    const fileHashesArray = fileList.map(String); 
    const keyListArray = [] 

    console.log("Validating the write access token and signature...");
    const tx = await contract.validateToken(
      bytes32TokenHash,
      signatureBytes,
      true,
      fileHashesArray,
      keyListArray
    );

    await tx.wait();
    console.log("Validated Token and signature!");
    console.log("Deleting the Files from MinIO and the file's metadata from mongoDB...");
    fileList.forEach(async fileHash => {
      const result = await deleteFromMinIO(uniqueId, fileHash);
      const file = await MedicalFile.findOne({ fileId: fileHash });
      await AccessPermission.deleteMany({ fileId: file._id });
      await MedicalFile.deleteOne({ _id: file._id });
    });

    res.json({ message: 'File and all related access permissions deleted successfully' });
    console.log("---File and all related access permissions deleted successfully---");
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Error deleting file' });
  }
});


router.delete('/patient/revoke-file-access', authenticateToken, async (req, res) => {
  try{
    const { patientId, hospitalId, fileId } = req.body;
    const patient=await Patient.findOne({uniqueId:patientId});
    const hospital=await Hospital.findOne({uniqueId:hospitalId});
    const file=await MedicalFile.findOne({fileId:fileId});
    await AccessPermission.deleteMany({fileId:file._id, patientId:patient._id, hospitalId:hospital._id});
    res.json({ message: 'Access permission deleted successfully' });
  }catch(err){
    console.error('Error deleting access:', err);
    res.status(500).json({ error: 'Error deleting accesss' });
  }
});

router.delete('/patient/revoke-all-access', authenticateToken, async (req, res) => {
  try{
    const { hospitalId, patientId } = req.body;
    console.log("patientId:",patientId);
    console.log("hospitalId:",hospitalId);
    const patient=await Patient.findOne({uniqueId:patientId});
    const hospital=await Hospital.findOne({uniqueId:hospitalId});
    await AccessPermission.deleteMany({patientId:patient._id, hospitalId:hospital._id});
    await WritePermission.deleteMany({patientId:patient._id, hospitalId:hospital._id});
    console.log(patient._id,hospital._id,"\ndeleted success fully");
    res.json({ message: 'Access permission deleted successfully' });
  }catch(err){
    console.error('Error deleting access:', err);
    res.status(500).json({ error: 'Error deleting accesss' });
  }
});


module.exports = router;
const express = require('express');
const mongoose = require('mongoose');
const MedicalFile = require('../models/MedicalFile');
const AccessPermission = require('../models/AccessPermission');
const Patient = require('../models/Patient');
const Hospital = require('../models/Hospital');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

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


router.post('/patient/grant-access', authenticateToken, async (req, res) => {
    try {
        console.log(req.body, "\n------\n", req.user.id);
        const { fileIds, hospitalUniqueId, deadline, blockchainTxHash } = req.body;
        if (fileIds.length===0){
            res.status(201).json({ message: 'Access granted successfully'});
        }

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
        const permissions = fileIds.map(fileId => ({
            fileId: files.find(f => f.fileId === fileId)._id,
            hospitalId: hospital._id,
            patientId: patient._id,
            grantedDate: new Date(),
            blockchainTxHash: blockchainTxHash || null,
            deadline: deadlineDate
        }));

        const savedPermissions = await AccessPermission.insertMany(permissions);

        res.status(201).json({ message: 'Access granted successfully', permissions: savedPermissions });
    } catch (err) {
        console.error('Error granting access:', err);
        res.status(500).json({ error: 'Error granting access' });
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
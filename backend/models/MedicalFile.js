const mongoose = require('mongoose');

const medicalFileSchema = new mongoose.Schema({
    fileId: { type: String, required: true, unique: true },  // Unique file hash
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    fileName: { type: String, required: true },  // e.g., "BloodTest_2023.pdf"
    uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MedicalFile', medicalFileSchema);

const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
    uniqueId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    bloodGroup: { type: String, required: true },
    publicKey: { type: String, required: true },
    publicAddress:{ type: String, required: true },
    privateKey: { type: String, required: true }, // Encrypted private key
    password: { type: String, required: true }
});

module.exports = mongoose.model('Patient', PatientSchema);

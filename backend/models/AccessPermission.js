const mongoose = require('mongoose');

const accessPermissionSchema = new mongoose.Schema({
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalFile', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    grantedDate: { type: Date, default: Date.now },
    blockchainTxHash: { type: String }, // Optional, stores transaction hash for audit
    deadline: { type: Date, required: true } // Expiry date of access
});

module.exports = mongoose.model('AccessPermission', accessPermissionSchema);

const mongoose = require('mongoose');

const writePermissionSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    grantedDate: { type: Date, default: Date.now },
    blockchainTxHash: { type: String },
    deadline: { type: Date, required: true }
});

module.exports = mongoose.model('WritePermission', writePermissionSchema);

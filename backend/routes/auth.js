const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const Patient = require('../models/Patient');
const Hospital = require('../models/Hospital');
require('dotenv').config();

const router = express.Router();

// Signup Route
router.post('/signup', [
  check('email', 'Valid email required').isEmail(),
  check('password', 'Password must be at least 6 chars').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { uniqueId, name, email, phone, address, publicKey, encryptedPrivateKey, password, role, dateOfBirth, bloodGroup, licenseNumber } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    if (role === "patient") {
      user = new Patient({ uniqueId, name, email, phone, address, dateOfBirth, bloodGroup, publicKey, password: hashedPassword, privateKey: encryptedPrivateKey });
    } else if (role === "hospital") {
      user = new Hospital({ uniqueId, name, email, phone, address, licenseNumber, publicKey, password: hashedPassword, privateKey: encryptedPrivateKey });
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    await user.save();
    res.status(201).json({ message: "User registered successfully" });
    console.log("sucessfully registered", req.body);

  } catch (error) {
    res.status(500).json({ error: "Error registering user" });
    console.log("error registering user",req.body);
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const user = role === "patient" ? await Patient.findOne({ email }) : await Hospital.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ token, encryptedPrivateKey: user.privateKey });

  } catch (error) {
    res.status(500).json({ error: "Error logging in" });
  }
});

router.get('/get-key', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Token missing' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id, role } = decoded;

        const user = role === "patient" 
            ? await Patient.findById(id) 
            : await Hospital.findById(id);

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ encryptedPrivateKey: user.privateKey });

    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});


module.exports = router;

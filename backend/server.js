const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { authenticateToken } = require('./middleware/auth');
const fileRoutes= require('./routes/fileHandling');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

app.get('/protected-route', authenticateToken, (req, res) => {
    res.json({ message: 'You have access!', user: req.user });
});


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

app.use('/api/auth', authRoutes);
app.use('/api/file', fileRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import CryptoJS from 'crypto-js';
import { ethers } from 'ethers';
import { useWallet } from './WalletContext';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        role: ''
    });
    const navigate = useNavigate();
    const { login } = useWallet();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Step 1: Login
            const loginRes = await axios.post('http://localhost:5000/api/auth/login', formData);
            const token = loginRes.data.token;

            // Step 2: Get encrypted private key
            const keyRes = await axios.get('http://localhost:5000/api/auth/get-key', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const encryptedPrivateKey = keyRes.data.encryptedPrivateKey;

            // Step 3: Decrypt the private key using the password
            const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, formData.password);
            const decryptedPrivateKey = bytes.toString(CryptoJS.enc.Utf8);

            if (!decryptedPrivateKey) {
                throw new Error('Decryption failed. Incorrect password or corrupted key.');
            }

            // Step 4: Create Ethereum wallet
            const wallet = new ethers.Wallet(decryptedPrivateKey);
            console.log('Wallet Address:', wallet.address); // For debugging

            // Step 5: Store wallet in context (in memory)
            login(wallet, token);

            alert('Login successful!');
            navigate('/dashboard');
        } catch (err) {
            console.error('Login error:', err);
            if (err.response && err.response.data && err.response.data.error) {
                alert(`Login failed! ${err.response.data.error}`);
            } else {
                alert(`Login failed! ${err.message || 'Check your credentials or try again later.'}`);
            }
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <label>Role:</label>
            <select name="role" value={formData.role} onChange={handleChange} required>
                <option value="">Select Role</option>
                <option value="patient">Patient</option>
                <option value="hospital">Hospital</option>
            </select>

            <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
            />
            <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
            />
            <button type="submit">Login</button>
        </form>
    );
};

export default Login;
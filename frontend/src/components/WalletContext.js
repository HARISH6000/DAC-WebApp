import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { ethers } from 'ethers';
import { useContracts } from './ContractContext';

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [wallet, setWallet] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [showPasswordPopup, setShowPasswordPopup] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { updateWithSigner } = useContracts();

    useEffect(() => {
        const initializeWallet = async () => {
            if (!token) return; // No token, wait for login/signup
            if (wallet) return; // Wallet already loaded

            // Token exists but no wallet, prompt for password
            setShowPasswordPopup(true);
        };

        initializeWallet();
    }, [token, wallet]);

    const login = (newWallet, newToken) => {
        setWallet(newWallet);
        setToken(newToken);
        localStorage.setItem('token', newToken);
        updateWithSigner(newWallet);
        setShowPasswordPopup(false); // Ensure popup closes after login
    };

    const logout = () => {
        setWallet(null);
        setToken(null);
        localStorage.removeItem('token');
        setShowPasswordPopup(false);
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const res = await axios.get('http://localhost:5000/api/auth/get-key', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const encryptedPrivateKey = res.data.encryptedPrivateKey;

            const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, password);
            const decryptedPrivateKey = bytes.toString(CryptoJS.enc.Utf8);

            if (!decryptedPrivateKey) {
                throw new Error('Incorrect password or corrupted key');
            }

            const newWallet = new ethers.Wallet(decryptedPrivateKey);
            login(newWallet, token);

            setPassword('');
        } catch (err) {
            setError(err.message || 'Failed to decrypt private key. Please try again.');
        }
    };

    return (
        <WalletContext.Provider value={{ wallet, token, login, logout }}>
            {children}
            {showPasswordPopup && (
                <div style={popupStyle}>
                    <form onSubmit={handlePasswordSubmit} style={formStyle}>
                        <h3>Enter Password to Unlock Wallet</h3>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                            style={inputStyle}
                        />
                        {error && <p style={errorStyle}>{error}</p>}
                        <button type="submit" style={buttonStyle}>Submit</button>
                    </form>
                </div>
            )}
        </WalletContext.Provider>
    );
};

// Inline styles
const popupStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(0,0,0,0.3)',
    zIndex: 1000
};

const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
};

const inputStyle = {
    padding: '8px',
    fontSize: '16px'
};

const buttonStyle = {
    padding: '10px',
    backgroundColor: '#007BFF',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
};

const errorStyle = {
    color: 'red',
    fontSize: '14px'
};

export const useWallet = () => useContext(WalletContext);
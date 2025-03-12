import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useWallet } from './WalletContext';
import { useContracts } from './ContractContext';

const Dashboard = () => {
    const { wallet, logout } = useWallet();
    const { contracts } = useContracts();
    const navigate = useNavigate();
    const [participantDetails, setParticipantDetails] = useState(null);

    const handleGetParticipantDetails = async () => {
        if (!contracts || !wallet) {
            alert('Contracts or wallet not available yet.');
            return;
        }

        try {
            const details = await contracts.registration.getParticipantDetails(wallet.address);
            setParticipantDetails({
                uniqueId: details[0],
                name: details[1],
                role: details[2],
                publicKey: details[3]
            });
        } catch (err) {
            console.error('Error fetching participant details:', err);
            alert('Failed to fetch participant details. Ensure you are registered on the blockchain.');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div>
            <h1>Dashboard</h1>
            {wallet ? (
                <div>
                    <p><strong>Wallet Address:</strong> {wallet.address}</p>
                    <p><strong>Public Key:</strong> {wallet.publicKey}</p>
                    <button onClick={handleGetParticipantDetails} style={buttonStyle}>
                        Get Participant Details
                    </button>
                    <button onClick={handleLogout} style={buttonStyle}>Logout</button>

                    {participantDetails && (
                        <div style={detailsStyle}>
                            <h3>Participant Details</h3>
                            <p><strong>Unique ID:</strong> {participantDetails.uniqueId}</p>
                            <p><strong>Name:</strong> {participantDetails.name}</p>
                            <p><strong>Role:</strong> {participantDetails.role}</p>
                            <p><strong>Public Key:</strong> {participantDetails.publicKey}</p>
                        </div>
                    )}
                </div>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

// Inline styles
const buttonStyle = {
    padding: '10px',
    backgroundColor: '#007BFF',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    margin: '5px'
};

const detailsStyle = {
    marginTop: '20px',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px'
};

export default Dashboard;
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';

const Home = () => {
    const navigate = useNavigate();
    const { token, logout } = useWallet();

    const handleNavigateToDashboard = () => {
        navigate('/dashboard');
    };

    const handleNavigateToSignup = () => {
        navigate('/signup');
    };

    const handleNavigateToLogin = () => {
        navigate('/login');
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div style={homeStyle}>
            <h1>Welcome to the Healthcare App</h1>
            <p>Your gateway to secure healthcare services on the blockchain.</p>
            {token ? (
                <div style={buttonContainerStyle}>
                    <button onClick={handleNavigateToDashboard} style={buttonStyle}>
                        Go to Dashboard
                    </button>
                    <button onClick={handleLogout} style={buttonStyle}>
                        Logout
                    </button>
                </div>
            ) : (
                <div style={buttonContainerStyle}>
                    <button onClick={handleNavigateToSignup} style={buttonStyle}>
                        Signup
                    </button>
                    <button onClick={handleNavigateToLogin} style={buttonStyle}>
                        Login
                    </button>
                </div>
            )}
        </div>
    );
};

// Inline styles
const homeStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    textAlign: 'center',
    backgroundColor: '#f5f5f5',
    padding: '20px'
};

const buttonStyle = {
    padding: '10px 20px',
    backgroundColor: '#007BFF',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    margin: '10px'
};

const buttonContainerStyle = {
    display: 'flex',
    gap: '20px',
    marginTop: '20px'
};

export default Home;
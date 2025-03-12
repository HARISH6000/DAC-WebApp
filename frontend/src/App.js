import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useWallet } from './components/WalletContext';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Home from './components/Home';

// ProtectedRoute component to restrict access
const ProtectedRoute = ({ children }) => {
    const { token } = useWallet();
    return token ? children : <Navigate to="/login" />;
};

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route
                    path="/dashboard"
                    element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
                />
                <Route path="/" element={<Home />} />
            </Routes>
        </Router>
    );
};

export default App;
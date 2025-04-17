import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useWallet } from './components/WalletContext';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import UploadFile from './components/UploadFile';
import GrantPermission from './components/GrantPermission';
import ValidationPage from './components/Validation';
import RequestFile from './components/RequestFile';
import ManageRequests from './components/ManageRequests';

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
                <Route path="/validation" element={<ValidationPage />} />
                <Route
                    path="/dashboard"
                    element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
                />
                <Route
                    path="/upload-file"
                    element={<ProtectedRoute><UploadFile /></ProtectedRoute>}
                />
                <Route
                    path="/grant-permission"
                    element={<ProtectedRoute><GrantPermission /></ProtectedRoute>}
                />
                <Route
                    path="/request-file"
                    element={<ProtectedRoute><RequestFile /></ProtectedRoute>}
                />
                <Route
                    path="/manage-requests"
                    element={<ProtectedRoute><ManageRequests /></ProtectedRoute>}
                />
                <Route path="/" element={<Home />} />
            </Routes>
        </Router>
    );
};

export default App;
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Register.css'; // Reusing Register.css for consistency

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    React.useEffect(() => {
        localStorage.removeItem('token');
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', formData);
            localStorage.setItem('token', res.data.token);
            navigate('/home'); // Direct landing on Home page
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        }
    };

    return (
        <div className="auth-container" style={{ background: 'var(--primary)' }}>
            <div className="neo-card auth-card">
                <h1>Welcome Back! 👋</h1>
                <p className="auth-subtitle">Login to find your meal partner.</p>
                
                {error && <div className="error-box">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input 
                            className="neo-input"
                            type="email"
                            placeholder="john@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input 
                            className="neo-input"
                            type="password"
                            placeholder="••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            required
                        />
                    </div>

                    <button type="submit" className="neo-btn neo-btn-accent w-full">
                        Login
                    </button>
                </form>

                <p className="auth-footer">
                    New to MessMate? <Link to="/register">Create Account</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;

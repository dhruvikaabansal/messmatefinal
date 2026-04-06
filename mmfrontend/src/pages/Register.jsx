import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import './Register.css';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        college: '',
        otherCollege: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const colleges = ["NIIT University", "IIT Delhi", "DTU", "NSUT", "SRCC", "Other"];

    React.useEffect(() => {
        localStorage.removeItem('token');
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address.');
            return;
        }

        // Password length validation
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        try {
            const finalCollege = formData.college === 'Other' ? formData.otherCollege : formData.college;
            const res = await api.post('/auth/register', {
                ...formData,
                college: finalCollege
            });
            localStorage.setItem('token', res.data.token);
            navigate('/profile'); // Onboarding flow step 1
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <div className="auth-container">
            <div className="neo-card auth-card">
                <h1>Join MessMate 🍽️</h1>
                <p className="auth-subtitle">Find your perfect meal companion.</p>
                
                {error && <div className="error-box">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Name</label>
                        <input 
                            className="neo-input"
                            type="text"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            required
                        />
                    </div>
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
                    <div className="form-group">
                        <label>College</label>
                        <select 
                            className="neo-input"
                            value={formData.college}
                            onChange={(e) => setFormData({...formData, college: e.target.value})}
                            required
                        >
                            <option value="">Select College</option>
                            {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {formData.college === 'Other' && (
                        <div className="form-group">
                            <label>Specify College</label>
                            <input 
                                className="neo-input"
                                type="text"
                                value={formData.otherCollege}
                                onChange={(e) => setFormData({...formData, otherCollege: e.target.value})}
                                required
                            />
                        </div>
                    )}

                    <button type="submit" className="neo-btn neo-btn-primary w-full">
                        Create Account
                    </button>
                </form>

                <p className="auth-footer">
                    Already have an account? <Link to="/login">Login</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;

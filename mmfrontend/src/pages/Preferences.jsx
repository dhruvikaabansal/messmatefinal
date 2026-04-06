import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import './Profile.css'; // Reusing Profile layout

const Preferences = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const [formData, setFormData] = useState({
        mealTime: 'lunch',
        preferredGender: 'any',
        groupSize: 2,
        mealDate: todayStr,
        isAvailable: true
    });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();
    const isEditMode = new URLSearchParams(location.search).get('mode') === 'edit';

    useEffect(() => {
        const fetchPrefs = async () => {
            try {
                const res = await api.get('/preferences');
                const data = res.data?.preferences || res.data;
                if (data) {
                    setFormData({
                        mealTime: data.mealTime || 'lunch',
                        preferredGender: data.preferredGender || 'any',
                        groupSize: data.groupSize || 2,
                        mealDate: data.mealDate || todayStr,
                        isAvailable: data.isAvailable ?? true
                    });
                }
                setLoading(false);
            } catch (err) {
                setLoading(false);
            }
        };
        fetchPrefs();
    }, []);

    const handleStepClick = (step) => {
        if (!isEditMode) return;
        if (step === 1) navigate('/profile?mode=edit');
        if (step === 2) return; // Already here
        if (step === 3) navigate('/discover');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.put('/preferences', formData);
            if (formData.groupSize >= 3) {
                navigate('/community');
            } else if (isEditMode) {
                navigate('/home');
            } else {
                navigate('/discover');
            }
        } catch (err) {
            alert('Error updating preferences');
        }
    };

    if (loading) return <div className="container">Loading Preferences...</div>;

    return (
        <div className="container preferences-setup">
            <div className="onboarding-steps">
                <span
                    className={`step done ${isEditMode ? 'clickable' : ''}`}
                    onClick={() => handleStepClick(1)}
                >
                    1. Profile
                </span>
                <span className="step active">
                    2. Preferences
                </span>
                <span
                    className={`step ${isEditMode ? 'done clickable' : ''}`}
                    onClick={() => handleStepClick(3)}
                >
                    3. Match
                </span>
            </div>

            {isEditMode && (
                <div className="edit-mode-banner">
                    ✏️ You're editing your preferences. Click Step 1 to go back to your profile.
                </div>
            )}

            <div className="neo-card preferences-card" style={{ background: 'var(--accent)' }}>
                <h1>{isEditMode ? 'Edit Preferences 🍱' : 'Your Meal Prefs 🍱'}</h1>
                <p>Help us find your perfect match for the next meal.</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Preferred Meal Time</label>
                        <select
                            className="neo-input"
                            value={formData.mealTime}
                            onChange={(e) => setFormData({...formData, mealTime: e.target.value})}
                        >
                            <option value="breakfast">Breakfast 🍳</option>
                            <option value="lunch">Lunch 🍱</option>
                            <option value="snacks">Snacks 🥟</option>
                            <option value="dinner">Dinner 🍛</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Preferred Date</label>
                        <select
                            className="neo-input"
                            value={formData.mealDate}
                            onChange={(e) => setFormData({...formData, mealDate: e.target.value})}
                        >
                            <option value={todayStr}>Today ({new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</option>
                            <option value={tomorrowStr}>Tomorrow ({tomorrowDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Searching for (Gender)</label>
                        <select
                            className="neo-input"
                            value={formData.preferredGender}
                            onChange={(e) => setFormData({...formData, preferredGender: e.target.value})}
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="non-binary">Non-binary</option>
                            <option value="any">Any (Better for friends!)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Ideal Group Size</label>
                        <select
                            className="neo-input"
                            value={formData.groupSize}
                            onChange={(e) => setFormData({...formData, groupSize: parseInt(e.target.value)})}
                        >
                            <option value={2}>Just us (2)</option>
                            <option value={3}>A small trio (3)</option>
                            <option value={4}>Double Date/Group (4+)</option>
                        </select>
                    </div>

                    <div className="form-group flex-row">
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                checked={formData.isAvailable}
                                onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})}
                            />
                            Available for matching now
                        </label>
                    </div>

                    <div className="profile-action-btns">
                        <button type="submit" className="neo-btn neo-btn-primary">
                            {isEditMode ? '💾 Save Preferences' : 'Start Swiping! 🚀'}
                        </button>
                        {isEditMode && (
                            <button type="button" className="neo-btn neo-btn-outline" onClick={() => navigate('/home')}>
                                ← Back to Dashboard
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Preferences;

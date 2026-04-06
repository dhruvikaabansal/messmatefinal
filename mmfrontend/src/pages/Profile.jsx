import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import './Profile.css';

const PREDEFINED_INTERESTS = [
    '🎮 Gaming', '🎵 Music', '💪 Gym', '📚 Reading', '✈️ Travel',
    '🎨 Art', '💃 Dance', '📸 Photography', '🍳 Cooking', '🎬 Movies',
    '⚽ Sports', '🤖 AI / Tech', '🧘 Yoga', '🎸 Guitar', '✍️ Writing',
    '🌿 Sustainability', '☕ Coffee', '🏕️ Trekking', '🎤 Singing', '🧩 Chess'
];

const Profile = () => {
    const [formData, setFormData] = useState({
        age: '',
        gender: 'male',
        bio: '',
        interests: [],
        profilePic: '',
        college: '',
        otherCollege: ''
    });
    const [loading, setLoading] = useState(true);
    const [uploadingImage, setUploadingImage] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const isEditMode = new URLSearchParams(location.search).get('mode') === 'edit';

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/user/profile');
                const data = res.data?.profile || res.data;
                if (data) {
                    const COLLEGE_OPTIONS = ["NIIT University", "IIT Delhi", "DTU", "NSUT", "SRCC"];
                    const matchedCollege = COLLEGE_OPTIONS.find(
                        c => c.toLowerCase() === (data.college || '').toLowerCase()
                    ) || data.college || '';

                    setFormData({
                        age: data.age || '',
                        gender: data.gender || 'male',
                        bio: data.bio || '',
                        interests: data.interests || [],
                        profilePic: data.profilePic || '',
                        college: matchedCollege,
                        otherCollege: ''
                    });
                }
                setLoading(false);
            } catch (err) {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const toggleInterest = (interest) => {
        if (formData.interests.includes(interest)) {
            setFormData({ ...formData, interests: formData.interests.filter(i => i !== interest) });
        } else if (formData.interests.length < 10) {
            setFormData({ ...formData, interests: [...formData.interests, interest] });
        }
    };

    const removeInterest = (interest) => {
        setFormData({ ...formData, interests: formData.interests.filter(i => i !== interest) });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('profilePic', file);

        try {
            setUploadingImage(true);
            const res = await api.post('/upload', uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFormData({ ...formData, profilePic: res.data.imageUrl });
        } catch (err) {
            alert(err.response?.data?.message || 'Error uploading image');
        } finally {
            setUploadingImage(false);
        }
    };

    const isProfileFilled = () => formData.age && formData.college && formData.interests.length > 0;

    const handleStepClick = (step) => {
        if (!isEditMode) return; // During first-time onboarding, steps are not clickable
        if (step === 1) return; // Already on profile
        if (step === 2) {
            if (!isProfileFilled()) {
                alert('Please fill in your age, college, and at least one interest before continuing.');
                return;
            }
            navigate('/preferences?mode=edit');
        }
        if (step === 3) {
            if (!isProfileFilled()) {
                alert('Please complete your profile first.');
                return;
            }
            navigate('/discover');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const finalCollege = formData.college === 'Other' ? formData.otherCollege : formData.college;
            await api.put('/user/profile', { ...formData, college: finalCollege });
            if (isEditMode) {
                navigate('/home'); // Return to dashboard after editing
            } else {
                navigate('/preferences'); // Continue onboarding
            }
        } catch (err) {
            alert('Error updating profile');
        }
    };

    if (loading) return <div className="container">Loading Profile...</div>;

    return (
        <div className="container profile-setup">
            <div className="onboarding-steps">
                <span
                    className={`step active ${isEditMode ? 'clickable' : ''}`}
                    onClick={() => handleStepClick(1)}
                    title={isEditMode ? 'Step 1: Profile' : ''}
                >
                    1. Profile
                </span>
                <span
                    className={`step ${isEditMode ? 'done clickable' : ''}`}
                    onClick={() => handleStepClick(2)}
                    title={isEditMode ? 'Go to Preferences' : 'Complete profile first'}
                >
                    2. Preferences
                </span>
                <span
                    className={`step ${isEditMode ? 'done clickable' : ''}`}
                    onClick={() => handleStepClick(3)}
                    title={isEditMode ? 'Go to Discover' : 'Complete profile first'}
                >
                    3. Match
                </span>
            </div>

            {isEditMode && (
                <div className="edit-mode-banner">
                    ✏️ You're editing your profile. Changes are saved when you click "Save Profile".
                </div>
            )}

            <div className="neo-card profile-card">
                <h1>{isEditMode ? 'Edit Your Profile ✏️' : 'Set Up Your Profile ✨'}</h1>
                <p>Tell us more about yourself to find better matches.</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                            <label>Age</label>
                            <input
                                className="neo-input"
                                type="number"
                                value={formData.age}
                                onChange={(e) => setFormData({...formData, age: e.target.value})}
                                required
                                min="18"
                            />
                        </div>

                    <div className="form-grid">
                        <div className="form-group">
                            <label>Gender</label>
                            <select
                                className="neo-input"
                                value={formData.gender}
                                onChange={(e) => setFormData({...formData, gender: e.target.value})}
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="non-binary">Non-binary</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Profile Picture</label>
                            <input
                                className="neo-input"
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                            {uploadingImage && <small className="hint-text">Uploading image... ⏳</small>}
                        </div>
                    </div>

                    {formData.profilePic && (
                        <div className="form-group pic-preview-container">
                            <img src={formData.profilePic} alt="Preview" className="pic-preview" />
                            <p className="pic-preview-label">Profile Picture Preview</p>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Bio (Short & Sweet)</label>
                        <textarea
                            className="neo-input"
                            value={formData.bio}
                            onChange={(e) => setFormData({...formData, bio: e.target.value})}
                            rows="2"
                            placeholder="I love chai and coding..."
                        />
                    </div>

                    <div className="form-group">
                        <label className="interests-label">
                            Interests <span className="interest-count">({formData.interests.length}/10 selected)</span>
                        </label>

                        {formData.interests.length > 0 && (
                            <div className="selected-interests-row">
                                {formData.interests.map(i => (
                                    <span key={i} className="interest-chip selected" onClick={() => removeInterest(i)}>
                                        {i} ✕
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="interests-chips-grid">
                            {PREDEFINED_INTERESTS.map(interest => {
                                const isSelected = formData.interests.includes(interest);
                                return (
                                    <button
                                        key={interest}
                                        type="button"
                                        className={`interest-chip-btn ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleInterest(interest)}
                                    >
                                        {interest}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="hint-text">Tap to select up to 10 interests</p>
                    </div>

                    <div className="profile-action-btns">
                        <button type="submit" className="neo-btn neo-btn-secondary">
                            {isEditMode ? '💾 Save Changes' : 'Save Profile & Continue →'}
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

export default Profile;

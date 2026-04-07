import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { getProfilePic } from '../utils/imgUtils';
import './Profile.css';

const PREDEFINED_INTERESTS = [
    '🎮 Gaming', '🎵 Music', '💪 Gym', '📚 Reading', '✈️ Travel',
    '🎨 Art', '💃 Dance', '📸 Photography', '🍳 Cooking', '🎬 Movies',
    '⚽ Sports', '🤖 AI / Tech', '🧘 Yoga', '🎸 Guitar', '✍️ Writing',
    '🌿 Sustainability', '☕ Coffee', '🏕️ Trekking', '🎤 Singing', '🧩 Chess'
];

const Profile = () => {
    const [formData, setFormData] = useState({
        name: '', 
        birthday: '', // 🔥 Replaced age with birthday
        gender: 'male',
        bio: '',
        interests: [],
        profilePic: '',
        college: '',
        otherCollege: '',
        prompts: [{ question: 'My favorite food is...', answer: '' }]
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isBirthdayLocked, setIsBirthdayLocked] = useState(false); // 🔥 Rename lock state
    const navigate = useNavigate();
    const location = useLocation();
    const isEditMode = new URLSearchParams(location.search).get('mode') === 'edit';

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get(`/user/profile?t=${new Date().getTime()}`);
                const data = res.data.profile;
                if (data) {
                    const COLLEGE_OPTIONS = ["NIIT University", "IIT Delhi", "DTU", "NSUT", "SRCC"];
                    const matchedCollege = COLLEGE_OPTIONS.find(
                        c => c.toLowerCase() === (data.college || '').toLowerCase()
                    ) || data.college || '';

                    setFormData({
                        name: data.name || '',
                        birthday: data.birthday ? data.birthday.split('T')[0] : '', // Format for date input
                        gender: data.gender || 'male',
                        bio: data.bio || '',
                        interests: data.interests || [],
                        profilePic: data.profilePic || '',
                        college: matchedCollege,
                        otherCollege: '',
                        prompts: data.prompts?.length > 0 ? data.prompts : [{ question: 'My favorite food is...', answer: '' }]
                    });

                    // 🚨 Lock Birthday if it's already set
                    if (data.birthday) {
                        setIsBirthdayLocked(true);
                    }
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

    const isProfileFilled = () => formData.birthday && formData.college && formData.interests.length > 0 && formData.profilePic;

    const saveProfileData = async () => {
        const finalCollege = formData.college === 'Other' ? formData.otherCollege : formData.college;
        
        // 1. Client-side validation
        if (!formData.birthday) {
            alert('Please select your birthday.');
            return false;
        }

        // Validate birthday (min 16 yrs)
        const birthDate = new Date(formData.birthday);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        if (age < 16 || age > 60) {
            alert('Wait! You must be at least 16 to use MessMate.');
            return false;
        }

        if (!formData.name.trim()) {
            alert('Please enter your name.');
            return false;
        }

        if (!finalCollege) {
            alert('Please select or specify your college.');
            return false;
        }

        try {
            setSaving(true);
            const res = await api.put('/user/profile', { 
                ...formData, 
                college: finalCollege,
                birthday: formData.birthday
            });
            
            // Sync local state with server response (important for formatting/ID consistency)
            const updatedProfile = res.data.profile;
            if (updatedProfile) {
                setFormData(prev => ({
                    ...prev,
                    birthday: updatedProfile.birthday ? updatedProfile.birthday.split('T')[0] : prev.birthday,
                    college: updatedProfile.college // Keep raw but state logic handles matching
                }));
                if (updatedProfile.birthday) setIsBirthdayLocked(true);
            }

            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 2000);
            return true;
        } catch (err) {
            console.error('Save failed:', err);
            const msg = err.response?.data?.message || 'Wait! We couldn\'t save your changes. Please retry.';
            alert(msg);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleStepClick = async (step) => {
        if (step === 1) return; // Already on profile
        
        // Auto-save before navigating
        const success = await saveProfileData();
        if (!success) return; // 🛑 BLOCK NAVIGATION if save/validation fails

        if (step === 2 || step === 3) {
            if (!isProfileFilled()) {
                alert('Please fill in all required fields (age, college, interests, and profile picture) before moving forward.');
                return;
            }
            navigate(isEditMode ? '/preferences?mode=edit' : '/preferences');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await saveProfileData();
        if (!success) return;

        if (isEditMode) {
            navigate('/home'); 
        } else {
            navigate('/preferences'); 
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

            {saving && (
                <div className="saved-toast">⏳ Saving your profile...</div>
            )}
            {showSaved && (
                <div className="saved-toast">✅ Changes Saved!</div>
            )}

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
                        <label>Display Name</label>
                        <input
                            className="neo-input"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            required
                        />
                    </div>

                    <div className="form-group">
                            <label>Birthday {formData.birthday && `(Age: ${new Date().getFullYear() - new Date(formData.birthday).getFullYear()})`}</label>
                            <input
                                className="neo-input"
                                type="date"
                                value={formData.birthday}
                                onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                                required
                                disabled={isBirthdayLocked}
                                style={isBirthdayLocked ? { backgroundColor: 'var(--bg)', cursor: 'not-allowed', opacity: 0.7 } : {}}
                            />
                            {isBirthdayLocked && (
                                <small className="hint-text" style={{marginTop: '0.5rem', color: 'var(--text-dim)', fontStyle: 'italic', display: 'block'}}>
                                    🔒 Your birthday is locked. Contact support to change it.
                                </small>
                            )}
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
                            <img src={getProfilePic(formData.profilePic, formData.name)} alt="Preview" className="pic-preview" />
                            <p className="pic-preview-label">Profile Picture Preview</p>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Profile Prompt (Tell people a bit more!)</label>
                        {formData.prompts && formData.prompts.map((prompt, index) => (
                            <div key={index} className="prompt-editor neo-card" style={{padding: '1rem', background: 'var(--bg)', marginBottom: '1rem'}}>
                                <select 
                                    className="neo-input" 
                                    style={{marginBottom: '0.5rem'}}
                                    value={prompt.question}
                                    onChange={(e) => {
                                        const newPrompts = [...formData.prompts];
                                        newPrompts[index].question = e.target.value;
                                        setFormData({...formData, prompts: newPrompts});
                                    }}
                                >
                                    <option value="My favorite food is...">My favorite food is...</option>
                                    <option value="One thing I can't live without is...">One thing I can't live without is...</option>
                                    <option value="Typical weekend for me is...">Typical weekend for me is...</option>
                                    <option value="I'm looking for someone who...">I'm looking for someone who...</option>
                                </select>
                                <input 
                                    className="neo-input"
                                    placeholder="Your answer..."
                                    value={prompt.answer}
                                    onChange={(e) => {
                                        const newPrompts = [...formData.prompts];
                                        newPrompts[index].answer = e.target.value;
                                        setFormData({...formData, prompts: newPrompts});
                                    }}
                                />
                                {formData.prompts.length > 1 && (
                                    <button 
                                        type="button" 
                                        className="neo-btn-link" 
                                        style={{marginTop: '0.5rem', color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem'}}
                                        onClick={() => setFormData({...formData, prompts: formData.prompts.filter((_, i) => i !== index)})}
                                    >
                                        Remove Prompt
                                    </button>
                                )}
                            </div>
                        ))}
                        <button 
                            type="button" 
                            className="neo-btn neo-btn-outline" 
                            style={{width: '100%', marginBottom: '1rem', fontSize: '0.86rem'}}
                            onClick={() => setFormData({...formData, prompts: [...formData.prompts, { question: "One thing I can't live without is...", answer: "" }]})}
                            disabled={formData.prompts && formData.prompts.length >= 3}
                        >
                            + Add another prompt {formData.prompts && formData.prompts.length >= 3 ? '(Max 3)' : ''}
                        </button>
                    </div>

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

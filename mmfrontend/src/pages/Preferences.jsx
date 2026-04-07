import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { isMealTimePassed, MEAL_ORDER, getFirstAvailableMeal, getLocalDateStr } from '../utils/mealTimeUtils';
import './Profile.css'; // Reusing Profile layout

const Preferences = () => {
    // ✅ Use local date (IST), NOT toISOString() which returns UTC
    const todayStr = getLocalDateStr();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = getLocalDateStr(tomorrowDate);

    const [formData, setFormData] = useState({
        mealTime: 'lunch',
        preferredGender: 'any',
        groupSize: 2,
        mealDate: todayStr,
        isAvailable: true
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [profileFilled, setProfileFilled] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const isEditMode = new URLSearchParams(location.search).get('mode') === 'edit';

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Profile Status
                const profRes = await api.get(`/user/profile?t=${new Date().getTime()}`);
                const pData = profRes.data.profile;
                if (pData && pData.age && pData.college && pData.interests?.length > 0 && pData.profilePic) {
                    setProfileFilled(true);
                }

                // Fetch Preferences
                const res = await api.get('/preferences');
                const data = res.data?.preferences || res.data;
                if (data && data.mealTime) {
                    // ✅ USER HAS PREFS: Respect them!
                    setFormData({
                        mealTime: data.mealTime,
                        preferredGender: data.preferredGender || 'any',
                        groupSize: data.groupSize || 2,
                        mealDate: data.mealDate || todayStr,
                        isAvailable: data.isAvailable ?? true
                    });
                } else {
                    // ✅ NEW USER: Default to first available meal
                    setFormData(prev => ({
                        ...prev,
                        mealTime: getFirstAvailableMeal(prev.mealDate)
                    }));
                }
                setLoading(false);
            } catch (err) {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleStepClick = async (step) => {
        // Auto-save before navigating
        try {
            setSaving(true);
            await api.put('/preferences', formData);
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 2000);
        } catch (err) {
            console.error('Auto-save preferences failed', err);
            alert('Wait! We couldn\'t save your preferences. Please check your internet or retry.');
            setSaving(false);
            return; // 🛑 BLOCK NAVIGATION
        } finally {
            setSaving(false);
        }

        if (step === 1) navigate(isEditMode ? '/profile?mode=edit' : '/profile');
        if (step === 2) return; // Already here
        if (step === 3) {
            if (!profileFilled) {
                alert('Wait! You must complete your profile and add a photo before starting to match.');
                navigate(isEditMode ? '/profile?mode=edit' : '/profile');
                return;
            }
            // Navigate based on group size
            if (formData.groupSize >= 3) navigate('/community');
            else navigate('/discover');
        }
    };

    // Auto-fix if current selection is passed (e.g. user selected Lunch, but time is now 4 PM)
    useEffect(() => {
        if (isMealTimePassed(formData.mealTime, formData.mealDate)) {
            const nextAvailable = MEAL_ORDER.find(m => !isMealTimePassed(m, formData.mealDate));
            if (nextAvailable) {
                setFormData(prev => ({ ...prev, mealTime: nextAvailable }));
            }
        }
    }, [formData.mealDate, formData.mealTime]); // ✅ Include mealTime so it runs on initial load too

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!profileFilled) {
            alert('Wait! You must complete your profile (Step 1) including a photo before you can start matching.');
            navigate('/profile?mode=edit');
            return;
        }
        try {
            setSaving(true);
            await api.put('/preferences', formData);
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 2000);

            if (formData.groupSize >= 3) {
                navigate('/community');
            } else if (isEditMode) {
                navigate('/home');
            } else {
                navigate('/discover');
            }
        } catch (err) {
            alert('Error updating preferences');
        } finally {
            setSaving(false);
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

            {saving && (
                <div className="saved-toast">⏳ Saving preferences...</div>
            )}
            {showSaved && (
                <div className="saved-toast">✅ Changes Saved!</div>
            )}

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
                            <option value="breakfast" disabled={isMealTimePassed('breakfast', formData.mealDate)}>
                                Breakfast 🍳 {isMealTimePassed('breakfast', formData.mealDate) ? '(Passed)' : ''}
                            </option>
                            <option value="lunch" disabled={isMealTimePassed('lunch', formData.mealDate)}>
                                Lunch 🍱 {isMealTimePassed('lunch', formData.mealDate) ? '(Passed)' : ''}
                            </option>
                            <option value="snacks" disabled={isMealTimePassed('snacks', formData.mealDate)}>
                                Snacks 🥟 {isMealTimePassed('snacks', formData.mealDate) ? '(Passed)' : ''}
                            </option>
                            <option value="dinner" disabled={isMealTimePassed('dinner', formData.mealDate)}>
                                Dinner 🍛 {isMealTimePassed('dinner', formData.mealDate) ? '(Passed)' : ''}
                            </option>
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

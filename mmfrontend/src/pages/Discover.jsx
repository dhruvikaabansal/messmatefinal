import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Discover.css';

const Discover = () => {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [actionFeedback, setActionFeedback] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [activeMatch, setActiveMatch] = useState(null);
    const [activeCommunity, setActiveCommunity] = useState(null); // 🔥 Added for community lock

    useEffect(() => {
        fetchCandidates();
    }, []);

    const fetchCandidates = async () => {
        try {
            setLoading(true);
            const prefRes = await api.get('/preferences');
            const gSize = prefRes.data?.preferences?.groupSize || 2;
            if (gSize >= 3) {
                navigate('/community');
                return;
            }
            const res = await api.get('/match/candidates');
            if (res.data.candidates) {
                setCandidates(res.data.candidates);
            }
            if (res.data.isLocked) {
                setIsLocked(true);
                setActiveMatch(res.data.activeMatch || null);
                setActiveCommunity(res.data.activeCommunity || null);
            } else {
                setIsLocked(false);
                setActiveMatch(null);
                setActiveCommunity(null);
            }
            if (res.data.message) {
                setMessage(res.data.message);
            }
            setLoading(false);
        } catch (err) {
            console.error(err);
            setMessage("Unable to load candidates.");
            setLoading(false);
        }
    };

    const handleUnmatch = async () => {
        if (!window.confirm("Are you sure you want to unmatch?")) return;
        try {
            await api.post('/match/unmatch', { matchId: activeMatch._id });
            fetchCandidates();
        } catch (err) {
            alert("Error unmatching.");
        }
    };

    const handleComplete = async () => {
        try {
            await api.post('/match/complete', { matchId: activeMatch._id });
            fetchCandidates();
        } catch (err) {
            alert("Error completing match.");
        }
    };

    const handleAction = async (action) => {
        if (currentIndex >= candidates.length) return;
        const user = candidates[currentIndex];
        
        setActionFeedback(action);
        
        try {
            if (action === 'like') {
                const res = await api.post('/match/like', { targetUserId: user._id });
                if (res.data?.isMatch) {
                    navigate('/matches');
                    return;
                }
            } else {
                await api.post('/match/skip', { targetUserId: user._id });
            }
            
            // Short delay to show feedback animation before moving to next
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setActionFeedback(null);
                window.scrollTo(0, 0); // Scroll to top for next persona
            }, 600);
        } catch (err) {
            console.error(err);
            setActionFeedback(null);
        }
    };

    if (loading) return <div className="container loader-container">Finding your MessMate... 🍽️</div>;

    const currentUser = candidates[currentIndex];

    if (isLocked && activeMatch) {
        return (
            <div className="container discover-page-v3 match-locked">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neo-card active-match-card"
                >
                    <div className="match-header">
                        <h1>🎉 You're Matched!</h1>
                        <p>You have an active meal with {activeMatch.user.name}.</p>
                    </div>

                    <div className="match-profile-preview">
                        {activeMatch.user.profilePic && <img src={activeMatch.user.profilePic} alt={activeMatch.user.name} />}
                        <div className="preview-info">
                            <h3>{activeMatch.user.name}, {activeMatch.user.age}</h3>
                            <p>{activeMatch.user.college}</p>
                            <span className="match-tag tag-primary">Matching for {activeMatch.mealTime}</span>
                        </div>
                    </div>

                    <div className="match-actions-v3">
                        <button className="neo-btn neo-btn-primary w-full" onClick={handleComplete}>
                            ✅ Meal Successful!
                        </button>
                        <button className="neo-btn neo-btn-outline w-full mt-2" onClick={handleUnmatch}>
                            💔 Unmatch
                        </button>
                    </div>

                    <p className="match-footer-hint">
                        Complete or unmatch this deal to find new MessMates.
                    </p>
                </motion.div>
            </div>
        );
    }

    if (isLocked && activeCommunity) {
        return (
            <div className="container discover-page-v3 match-locked">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neo-card active-match-card community-lock"
                >
                    <div className="match-header">
                        <h1>👥 Group Meal Active!</h1>
                        <p>You are currently part of the group: <strong>{activeCommunity.name}</strong></p>
                    </div>

                    <div className="match-profile-preview community-preview">
                        <div className="preview-info">
                            <span className="match-tag tag-secondary">Meal: {activeCommunity.mealTime}</span>
                            <span className="match-tag tag-primary">Date: {activeCommunity.mealDate}</span>
                        </div>
                    </div>

                    <div className="match-actions-v3">
                        <button className="neo-btn neo-btn-primary w-full" onClick={() => navigate('/community')}>
                            📂 Go to Community
                        </button>
                    </div>

                    <p className="match-footer-hint">
                        You can't swipe on individuals while participating in a group meal.
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="container discover-page-v3">
            <AnimatePresence mode="wait">
                {!currentUser ? (
                    <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="neo-card empty-state-v3"
                    >
                        <h2>{message || "That's everyone for now!"} 🍱</h2>
                        <p>Try refreshing or expanding your search in preferences.</p>
                        <div className="mt-2">
                            <button className="neo-btn" onClick={() => window.location.href='/preferences'}>
                                Reset My Prefs
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div 
                        key={currentUser._id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: actionFeedback === 'like' ? 100 : -100 }}
                        className="profile-feed-item"
                    >
                        {/* 🖼️ Profile Section 1: LARGE IMAGE */}
                        <section className="profile-hero neo-card">
                            <div className="image-wrapper">
                                <img src={currentUser.profilePic} alt={currentUser.name} />
                                <div className="hero-overlay">
                                    <h1>{currentUser.name}, {currentUser.age}</h1>
                                    <p className="college-tag">{currentUser.college}</p>
                                </div>
                            </div>
                        </section>

                        {/* ✍️ Prompt Section 1 */}
                        {currentUser.prompts?.[0] && (
                            <section className="profile-prompt neo-card">
                                <span className="prompt-q">{currentUser.prompts[0].question}</span>
                                <h2 className="prompt-a">{currentUser.prompts[0].answer}</h2>
                            </section>
                        )}

                        {/* 📝 BIO & INTERESTS */}
                        <section className="profile-details neo-card">
                            <p className="bio-v3">"{currentUser.bio}"</p>
                            <div className="interests-grid">
                                {currentUser.interests?.map(i => (
                                    <span key={i} className="interest-tag">#{i}</span>
                                ))}
                            </div>
                            <div className="match-indicator">📍 {currentUser.college?.toUpperCase()}</div>
                        </section>

                        {/* ✍️ Prompt Section 2 */}
                        {currentUser.prompts?.[1] && (
                            <section className="profile-prompt neo-card highlight">
                                <span className="prompt-q">{currentUser.prompts[1].question}</span>
                                <h2 className="prompt-a">{currentUser.prompts[1].answer}</h2>
                            </section>
                        )}

                        {/* 🎮 FIXED ACTIONS */}
                        <div className="floating-actions">
                            <button 
                                className={`action-btn skip ${actionFeedback === 'skip' ? 'active' : ''}`}
                                onClick={() => handleAction('skip')}
                            >
                                ❌
                            </button>
                            <button 
                                className={`action-btn like ${actionFeedback === 'like' ? 'active' : ''}`}
                                onClick={() => handleAction('like')}
                            >
                                ❤️
                            </button>
                        </div>

                        {/* Feedback Overlays */}
                        {actionFeedback && (
                            <div className={`feedback-overlay ${actionFeedback}`}>
                                {actionFeedback === 'like' ? 'LIKED!' : 'PASS'}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Discover;

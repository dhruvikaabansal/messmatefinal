import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getProfilePic } from '../utils/imgUtils';
import './Discover.css';

/**
 * Discover.jsx — Slot-State-First architecture
 *
 * This component calls GET /api/slot/status (the unified endpoint) once
 * and renders ENTIRELY based on the returned `state` field.
 *
 * State → UI mapping:
 *   matched      → show locked match screen (chat button)
 *   in_community → show redirect to community
 *   idle/liked   → show discovery swipe cards
 *   closed       → show slot-closed banner
 */
const Discover = () => {
    const navigate = useNavigate();
    const [slotData, setSlotData] = useState(null); // full /api/slot/status response
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [actionFeedback, setActionFeedback] = useState(null);

    useEffect(() => {
        fetchSlotStatus();
    }, []);

    const fetchSlotStatus = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/slot/status?t=${Date.now()}`);
            setSlotData(res.data);
            setCurrentIndex(0);
            setLoading(false);
        } catch (err) {
            console.error('[Discover] fetchSlotStatus error:', err);
            setLoading(false);
        }
    };

    const handleAction = async (action) => {
        if (!slotData || currentIndex >= slotData.availableUsers.length) return;
        const user = slotData.availableUsers[currentIndex];

        setActionFeedback(action);
        try {
            if (action === 'like') {
                const res = await api.post('/match/like', { targetUserId: user._id });
                if (res.data?.isMatch) {
                    // Re-fetch slot status — state is now "matched"
                    await fetchSlotStatus();
                    setActionFeedback(null);
                    return;
                }
            } else {
                await api.post('/match/skip', { targetUserId: user._id });
            }
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setActionFeedback(null);
                window.scrollTo(0, 0);
            }, 600);
        } catch (err) {
            console.error('[Discover] action error:', err);
            setActionFeedback(null);
        }
    };

    const handleUnmatch = async () => {
        if (!window.confirm('Are you sure you want to unmatch?')) return;
        try {
            await api.post('/match/unmatch', { matchId: slotData.matchData._id });
            fetchSlotStatus();
        } catch (err) { alert('Error unmatching.'); }
    };

    const handleComplete = async () => {
        try {
            await api.post('/match/complete', { matchId: slotData.matchData._id });
            fetchSlotStatus();
        } catch (err) { alert('Error completing match.'); }
    };

    // ── LOADING ──────────────────────────────────────────────────────────────
    if (loading) return <div className="container loader-container">Finding your MessMate... 🍽️</div>;

    if (!slotData) return <div className="container loader-container">Something went wrong. Try refreshing.</div>;

    const { state, slotStatus, availableUsers, matchData, communityData } = slotData;

    // ── SLOT CLOSED ───────────────────────────────────────────────────────────
    if (slotStatus === 'closed') {
        return (
            <div className="container discover-page-v3">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neo-card active-match-card"
                >
                    <div className="match-header">
                        <h1>⏰ Meal Slot Closed</h1>
                        <p>This meal slot has ended. Update your preferences to keep discovering!</p>
                    </div>
                    <div className="match-actions-v3">
                        <button className="neo-btn neo-btn-primary w-full" onClick={() => navigate('/preferences?mode=edit')}>
                            Update My Preferences →
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ── STATE: COMMUNITY MODE GUARD (Group Size >= 3) ────────────────────────
    if (slotData.groupSize >= 3) {
        return (
            <div className="container discover-page-v3">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neo-card active-match-card community-mode-guard"
                    style={{ textAlign: 'center', border: '3px solid var(--secondary)' }}
                >
                    <div className="match-header">
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👥</div>
                        <h1>Community Mode Active</h1>
                        <p style={{ fontSize: '1.1rem' }}>
                            You're currently looking for <strong>group meals ({slotData.groupSize} people)</strong>.<br/>
                            1-on-1 matching is only available in Solo Mode.
                        </p>
                    </div>
                    <div className="match-actions-v3">
                        <button className="neo-btn neo-btn-primary w-full" onClick={() => navigate('/preferences?mode=edit')}>
                            Switch to Solo Mode (2) →
                        </button>
                        <button className="neo-btn neo-btn-outline w-full mt-2" onClick={() => navigate('/community')}>
                            Go to Communities 👥
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ── STATE: MATCHED ────────────────────────────────────────────────────────
    if (state === 'matched' && matchData) {
        const partner = matchData.user;
        return (
            <div className="container discover-page-v3 match-locked">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neo-card active-match-card"
                >
                    <div className="match-header">
                        <h1>🎉 You're Matched!</h1>
                        <p>You have an active meal with {partner?.name}.</p>
                    </div>
                    {partner && (
                        <div className="match-profile-preview">
                            <img
                                src={getProfilePic(partner.profilePic, partner.name)}
                                alt={partner.name}
                            />
                            <div className="preview-info">
                                <h3>{partner.name}, {partner.age}</h3>
                                <p>{partner.college}</p>
                                <span className="match-tag tag-primary">Matching for {matchData.mealTime}</span>
                            </div>
                        </div>
                    )}
                    <div className="match-actions-v3">
                        <button className="neo-btn neo-btn-primary w-full" onClick={() => navigate('/matches')}>
                            💬 Chat Now
                        </button>
                        <button className="neo-btn neo-btn-outline w-full mt-2" onClick={handleComplete}>
                            ✅ Meal Successful!
                        </button>
                        <button className="neo-btn neo-btn-outline w-full mt-2" onClick={handleUnmatch}>
                            💔 Unmatch
                        </button>
                    </div>
                    <p className="match-footer-hint">Complete or unmatch to discover again.</p>
                </motion.div>
            </div>
        );
    }

    // ── STATE: IN_COMMUNITY ───────────────────────────────────────────────────
    if (state === 'in_community') {
        return (
            <div className="container discover-page-v3 match-locked">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neo-card active-match-card community-lock"
                >
                    <div className="match-header">
                        <h1>👥 Group Meal Active!</h1>
                        <p>You're part of: <strong>{communityData?.name || 'a group meal'}</strong></p>
                    </div>
                    <div className="match-profile-preview community-preview">
                        <div className="preview-info">
                            <span className="match-tag tag-secondary">Meal: {communityData?.mealTime}</span>
                            <span className="match-tag tag-primary">Date: {communityData?.mealDate}</span>
                        </div>
                    </div>
                    <div className="match-actions-v3">
                        <button className="neo-btn neo-btn-primary w-full" onClick={() => navigate('/community')}>
                            📂 Go to My Group
                        </button>
                    </div>
                    <p className="match-footer-hint">Leave your group to discover 1-on-1 matches.</p>
                </motion.div>
            </div>
        );
    }

    // ── STATE: IDLE / LIKED — DISCOVERY MODE ──────────────────────────────────
    const currentUser = availableUsers[currentIndex];

    return (
        <div className="container discover-page-v3">
            <div className="community-header-premium" style={{ marginBottom: '2rem' }}>
                <div className="header-main-info">
                    <h1>Discover 👋</h1>
                    <div className="community-context-bar">
                        <span className="slot-context-pill" style={{ background: 'var(--accent)', padding: '0.4rem 0.8rem', border: '3px solid #000', fontWeight: '800', marginRight: '0.5rem' }}>
                            {slotData.mealTime} · {slotData.mealDate === todayStr ? 'Today' : slotData.mealDate}
                        </span>
                        <button className="neo-btn change-slot-btn-minimal" onClick={() => navigate('/preferences?mode=edit')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                             ⚙️ Change
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {!currentUser ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="neo-card empty-state-v3"
                    >
                        <h2>That's everyone for now! 🍱</h2>
                        <p>Try refreshing or expanding your preferences.</p>
                        <div className="mt-2">
                            <button className="neo-btn" onClick={() => navigate('/preferences?mode=edit')}>
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
                        {/* Hero Image */}
                        <section className="profile-hero neo-card">
                            <div className="image-wrapper">
                                <img
                                    src={getProfilePic(currentUser.profilePic, currentUser.name)}
                                    alt={currentUser.name}
                                />
                                <div className="hero-overlay">
                                    <h1>{currentUser.name}, {currentUser.age}</h1>
                                    <p className="college-tag">{currentUser.college}</p>
                                </div>
                            </div>
                        </section>

                        {/* Prompt 1 */}
                        {currentUser.prompts?.[0] && (
                            <section className="profile-prompt neo-card">
                                <span className="prompt-q">{currentUser.prompts[0].question}</span>
                                <h2 className="prompt-a">{currentUser.prompts[0].answer}</h2>
                            </section>
                        )}

                        {/* Bio & Interests */}
                        <section className="profile-details neo-card">
                            <p className="bio-v3">"{currentUser.bio}"</p>
                            <div className="interests-grid">
                                {currentUser.interests?.map(i => (
                                    <span key={i} className="interest-tag">#{i}</span>
                                ))}
                            </div>
                            <div className="match-indicator">📍 {currentUser.college?.toUpperCase()}</div>
                        </section>

                        {/* Prompt 2 */}
                        {currentUser.prompts?.[1] && (
                            <section className="profile-prompt neo-card highlight">
                                <span className="prompt-q">{currentUser.prompts[1].question}</span>
                                <h2 className="prompt-a">{currentUser.prompts[1].answer}</h2>
                            </section>
                        )}

                        {/* Action Buttons */}
                        <div className="floating-actions">
                            <button
                                className={`action-btn skip ${actionFeedback === 'skip' ? 'active' : ''}`}
                                onClick={() => handleAction('skip')}
                            >❌</button>
                            <button
                                className={`action-btn like ${actionFeedback === 'like' ? 'active' : ''}`}
                                onClick={() => handleAction('like')}
                            >❤️</button>
                        </div>

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

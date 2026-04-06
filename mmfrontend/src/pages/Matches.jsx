import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import './Matches.css';

const Matches = () => {
    const [activeMatch, setActiveMatch] = useState(null);
    const [pastMatches, setPastMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionFeedback, setActionFeedback] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            // Fetch candidates will tell us if there is a locked/active match
            const candidateRes = await api.get('/match/candidates');
            if (candidateRes.data.isLocked && candidateRes.data.activeMatch) {
                setActiveMatch(candidateRes.data.activeMatch);
            } else {
                setActiveMatch(null);
            }

            // Also fetch match history
            const listRes = await api.get('/match/list');
            const allMatches = listRes.data.matches || [];
            // Past = completed or unmatched (not the current active)
            const past = activeMatch
                ? allMatches.filter(m => m._id !== activeMatch._id && m.status !== 'active')
                : allMatches.filter(m => m.status !== 'active');
            setPastMatches(past);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleUnmatch = async () => {
        if (!window.confirm('Are you sure you want to unmatch?')) return;
        try {
            await api.post('/match/unmatch', { matchId: activeMatch._id });
            setActionFeedback('unmatched');
            setTimeout(() => {
                setActionFeedback('');
                fetchMatches();
            }, 1200);
        } catch (err) {
            alert('Error unmatching');
        }
    };

    const handleComplete = async () => {
        try {
            await api.post('/match/complete', { matchId: activeMatch._id });
            setActionFeedback('completed');
            setTimeout(() => {
                setActionFeedback('');
                fetchMatches();
            }, 1200);
        } catch (err) {
            alert('Error completing match');
        }
    };

    if (loading) return <div className="container loader-container">Loading your matches... 💬</div>;

    const matchUser = activeMatch?.user;
    const avatarUrl = matchUser?.profilePic || `https://i.pravatar.cc/400?u=${matchUser?.email}`;

    return (
        <div className="container matches-page">
            <div className="matches-header">
                <h1>Your Matches 💬</h1>
                <p>Your active meal partner and past connections.</p>
            </div>

            {/* ===== ACTIVE MATCH — RICH CARD ===== */}
            <AnimatePresence>
                {activeMatch && matchUser && (
                    <motion.div
                        key="active-match"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="active-match-section"
                    >
                        <div className="section-label active-label">🔒 Active Match</div>

                        {/* ACTION FEEDBACK OVERLAY */}
                        <AnimatePresence>
                            {actionFeedback && (
                                <motion.div
                                    className={`match-feedback-overlay ${actionFeedback}`}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    {actionFeedback === 'completed' ? '🎉 Meal marked as successful!' : '💔 Unmatched.'}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* MATCH PROFILE CARD — same aesthetic as Discover */}
                        <div className="active-match-card-wrap">
                            {/* Hero Image */}
                            <div className="match-hero-img">
                                <img src={avatarUrl} alt={matchUser.name} />
                                <div className="match-hero-overlay">
                                    <h2>{matchUser.name}, {matchUser.age}</h2>
                                    <span className="match-college-chip">📍 {matchUser.college?.toUpperCase()}</span>
                                </div>
                                <div className="active-badge">🔒 ACTIVE MATCH</div>
                            </div>

                            {/* Meal Info */}
                            <div className="match-meal-info neo-card">
                                <span className="meal-info-icon">🍱</span>
                                <div>
                                    <p className="meal-info-label">Matching for</p>
                                    <p className="meal-info-value">{activeMatch.mealTime?.charAt(0).toUpperCase() + activeMatch.mealTime?.slice(1)} · {activeMatch.mealDate?.charAt(0).toUpperCase() + activeMatch.mealDate?.slice(1)}</p>
                                </div>
                            </div>

                            {/* Bio */}
                            {matchUser.bio && (
                                <div className="match-bio-card neo-card">
                                    <p className="match-bio-text">"{matchUser.bio}"</p>
                                </div>
                            )}

                            {/* Interests */}
                            {matchUser.interests?.length > 0 && (
                                <div className="match-interests neo-card">
                                    <p className="match-section-title">Interests</p>
                                    <div className="interests-row">
                                        {matchUser.interests.map(i => (
                                            <span key={i} className="interest-tag">#{i.replace(/^[\S]+ /, '')}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Prompts */}
                            {matchUser.prompts?.[0] && (
                                <div className="match-prompt-card neo-card">
                                    <p className="prompt-q-sm">{matchUser.prompts[0].question}</p>
                                    <p className="prompt-a-sm">{matchUser.prompts[0].answer}</p>
                                </div>
                            )}

                            {/* ACTION BUTTONS */}
                            <div className="match-action-btns">
                                <button className="neo-btn neo-btn-secondary match-btn-success" onClick={handleComplete}>
                                    ✅ Meal Successful!
                                </button>
                                <button className="neo-btn neo-btn-outline match-btn-unmatch" onClick={handleUnmatch}>
                                    💔 Unmatch
                                </button>
                            </div>

                            <p className="match-action-hint">
                                Mark the meal as successful or unmatch to find new MessMates.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* No active match state */}
            {!activeMatch && !loading && (
                <div className="neo-card no-active-match">
                    <p className="no-match-emoji">🍽️</p>
                    <h2>No active match right now</h2>
                    <p>Start swiping in Discover to find your MessMate!</p>
                    <button className="neo-btn neo-btn-accent" onClick={() => navigate('/discover')}>
                        Go to Discover 🚀
                    </button>
                </div>
            )}

            {/* ===== PAST MATCHES HISTORY ===== */}
            {pastMatches.length > 0 && (
                <div className="past-matches-section">
                    <div className="section-label">📖 Past Meals</div>
                    <div className="past-matches-grid">
                        {pastMatches.map(m => {
                            const u = m.user;
                            if (!u) return null;
                            return (
                                <div key={m._id} className="past-match-card neo-card">
                                    <img
                                        src={u.profilePic || `https://i.pravatar.cc/200?u=${u.email}`}
                                        alt={u.name}
                                        className="past-match-img"
                                    />
                                    <div className="past-match-info">
                                        <h3>{u.name}, {u.age}</h3>
                                        <p className="past-college">{u.college}</p>
                                        <span className={`past-status-badge ${m.status}`}>
                                            {m.status === 'completed' ? '✅ Meal done' : '💔 Unmatched'}
                                        </span>
                                        <p className="past-meal-detail">{m.mealTime} · {m.mealDate}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Matches;

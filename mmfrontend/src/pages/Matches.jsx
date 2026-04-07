import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getProfilePic } from '../utils/imgUtils';
import './Matches.css';

const Matches = () => {
    const [activeMatches, setActiveMatches] = useState([]);
    const [pastMatches, setPastMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionFeedback, setActionFeedback] = useState('');
    const [slotInfo, setSlotInfo] = useState({ mealTime: 'your slot', mealDate: '' });
    const navigate = useNavigate();

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            const listRes = await api.get('/match/list');
            setSlotInfo({ mealTime: listRes.data.mealTime, mealDate: listRes.data.mealDate });
            const allMatches = listRes.data.matches || [];
            
            const active = allMatches.filter(m => m.status === 'active');
            const past = allMatches.filter(m => m.status !== 'active');
            
            setActiveMatches(active);
            setPastMatches(past);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleUnmatch = async (matchId) => {
        if (!window.confirm('Are you sure you want to unmatch?')) return;
        try {
            await api.post('/match/unmatch', { matchId });
            setActionFeedback('unmatched');
            setTimeout(() => {
                setActionFeedback('');
                fetchMatches();
            }, 1200);
        } catch (err) {
            alert('Error unmatching');
        }
    };

    const handleComplete = async (matchId) => {
        try {
            await api.post('/match/complete', { matchId });
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

    return (
        <div className="container matches-page">
            <div className="matches-header">
                <div className="page-header-context">
                    <h1>Your Matches 💬</h1>
                    <div className="current-slot-indicator">
                        🍱 Viewing for: <strong className="capitalize">{slotInfo.mealTime}</strong> · {slotInfo.mealDate}
                    </div>
                </div>
                <p>Your active meal partner and past connections.</p>
            </div>

            {/* ===== ACTIVE MATCHES ===== */}
            <AnimatePresence>
                {activeMatches.map(match => {
                    const matchUser = match.user;
                    const avatarUrl = getProfilePic(matchUser?.profilePic, matchUser?.name);
                    
                    return (
                        <motion.div
                            key={match._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="active-match-section"
                            style={{ marginBottom: '3rem' }}
                        >
                            <div className="section-label active-label">🔒 Active Match - {match.mealTime}</div>

                            <div className="active-match-card-wrap">
                                <div className="match-hero-img">
                                    <img src={avatarUrl} alt={matchUser.name} />
                                    <div className="match-hero-overlay">
                                        <h2>{matchUser.name}, {matchUser.age}</h2>
                                        <span className="match-college-chip">📍 {matchUser.college?.toUpperCase()}</span>
                                    </div>
                                    <div className="active-badge">🔒 {match.mealTime?.toUpperCase()} · {match.mealDate}</div>
                                </div>

                                <div className="match-meal-info neo-card">
                                    <span className="meal-info-icon">🍱</span>
                                    <div>
                                        <p className="meal-info-label">Matching for</p>
                                        <p className="meal-info-value">{match.mealTime?.charAt(0).toUpperCase() + match.mealTime?.slice(1)} · {match.mealDate}</p>
                                    </div>
                                </div>

                                {matchUser.bio && (
                                    <div className="match-bio-card neo-card">
                                        <p className="match-bio-text">"{matchUser.bio}"</p>
                                    </div>
                                )}

                                <div className="match-action-btns">
                                    <button className="neo-btn neo-btn-secondary match-btn-success" onClick={() => handleComplete(match._id)}>
                                        ✅ Meal Successful!
                                    </button>
                                    <button className="neo-btn neo-btn-outline match-btn-unmatch" onClick={() => handleUnmatch(match._id)}>
                                        💔 Unmatch
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {/* No active matches state */}
            {activeMatches.length === 0 && !loading && (
                <div className="neo-card empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
                    <h2>No active matches yet</h2>
                    <p>Keep swiping in <strong>Discover</strong> to find your next meal partner!</p>
                    <button className="neo-btn neo-btn-accent" style={{ marginTop: '1rem' }} onClick={() => navigate('/discover')}>
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
                                        src={getProfilePic(u.profilePic, u.name)}
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
            {/* Feedback Animation Overlay */}
            {actionFeedback && (
                <div className={`match-feedback-overlay ${actionFeedback}`}>
                    {actionFeedback === 'completed' ? '🎉 COMPLETED!' : '💔 UNMATCHED'}
                </div>
            )}
        </div>
    );
};

export default Matches;

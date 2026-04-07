import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getProfilePic } from '../utils/imgUtils';
import './LikesReceived.css';

const LikesReceived = () => {
    const navigate = useNavigate();
    const [likes, setLikes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [lockType, setLockType] = useState('match'); // 'match' or 'community'
    const [slotInfo, setSlotInfo] = useState({ mealTime: 'your slot', mealDate: '' });

    useEffect(() => {
        fetchLikes();
    }, []);

    const fetchLikes = async () => {
        try {
            const res = await api.get(`/match/likes-received?t=${Date.now()}`);
            setSlotInfo({ mealTime: res.data.mealTime, mealDate: res.data.mealDate });
            if (res.data.isLocked) {
                setIsLocked(true);
                setLockType(res.data.lockType || 'match');
            } else {
                setLikes(res.data.likes);
            }
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleAction = async (action, targetUserId, likeId) => {
        try {
            if (action === 'accept') {
                const res = await api.post('/match/like', { targetUserId });
                if (res.data?.isMatch) {
                    navigate('/matches');
                    return;
                }
            } else {
                await api.post('/match/ignore', { likeId });
            }
            fetchLikes();
        } catch (err) {
            alert(err.response?.data?.message || 'Error processing like');
            fetchLikes(); // refresh likes just in case unlocking is needed
        }
    };

    if (loading) return <div className="container">Loading your admirers...</div>;

    if (isLocked) {
        return (
            <div className="container discover-page-v3 match-locked">
                <div className="neo-card active-match-card">
                    <div className="match-header">
                        <h1>🔒 {lockType === 'group_mode' ? 'Group Mode Active' : (lockType === 'community' ? 'Group Mode Active' : 'Match Locked')}</h1>
                        <p>
                            {lockType === 'group_mode'
                              ? "You're searching for group tables (size 3-4). Individual matching is disabled in this mode. 🍱"
                              : (lockType === 'community' 
                                ? "You're already in a group meal for this slot! You cannot accept individual matches right now. 👥"
                                : "You already have an active 1-1 match! You cannot accept new likes for this slot. 🔒")}
                        </p>
                        <button 
                            className="neo-btn neo-btn-primary" 
                            onClick={() => navigate(lockType === 'group_mode' ? '/preferences' : (lockType === 'community' ? '/community' : '/matches'))}
                        >
                            {lockType === 'group_mode' ? '🍱 Switch to Solo Mode' : (lockType === 'community' ? 'View Active Group' : 'View Active Match')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container likes-received-page">
            <div className="community-header-premium" style={{ marginBottom: '2rem' }}>
                <div className="header-main-info">
                    <h1>Likes Received ❤️</h1>
                    <div className="community-context-bar">
                        <span className="slot-context-pill" style={{ background: 'var(--accent)', padding: '0.4rem 0.8rem', border: '3px solid #000', fontWeight: '800', marginRight: '0.5rem' }}>
                            <span className="capitalize">{slotInfo.mealTime}</span> · {slotInfo.mealDate}
                        </span>
                        <button className="neo-btn change-slot-btn-minimal" onClick={() => navigate('/preferences?mode=edit')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                             ⚙️ Change
                        </button>
                    </div>
                </div>
            </div>
            
            <p className="page-subtitle">These people want to grab a meal with you in your current slot.</p>
            
            {likes.length === 0 ? (
                <div className="neo-card empty-state">
                    <h2>No likes yet!</h2>
                    <p>Keep swiping to find your MessMate.</p>
                </div>
            ) : (
                <div className="likes-grid">
                    {likes.map(like => (
                        <div key={like._id || like.likeId} className="neo-card like-card">
                            <div className="like-card-header">
                                <img src={getProfilePic(like.profilePic, like.name)} alt={like.name} />
                                <div>
                                    <h3>{like.name}, {like.age}</h3>
                                    <p className="college-tag-sm">{like.college}</p>
                                </div>
                            </div>
                            <div className="like-card-body">
                                <p>"{like.bio}"</p>
                                <div className="interests-flex">
                                    {like.interests?.map(i => (
                                        <span key={i} className="interest-chip-sm">#{i}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="like-card-actions flex">
                                <button 
                                    className="neo-btn neo-btn-secondary" 
                                    onClick={() => handleAction('accept', like._id, like.likeId)}
                                >
                                    ✅ Match
                                </button>
                                <button 
                                    className="neo-btn" 
                                    onClick={() => handleAction('ignore', like._id, like.likeId)}
                                >
                                    ❌ Ignore
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LikesReceived;

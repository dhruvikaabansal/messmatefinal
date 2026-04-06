import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './LikesReceived.css';

const LikesReceived = () => {
    const navigate = useNavigate();
    const [likes, setLikes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        fetchLikes();
    }, []);

    const fetchLikes = async () => {
        try {
            const res = await api.get('/match/likes-received');
            if (res.data.isLocked) {
                setIsLocked(true);
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
                        <h1>🔒 Page Locked</h1>
                        <p>You have an active match! You cannot accept new likes right now.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <h1>People who liked you ❤️</h1>
            
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
                                <img src={like.profilePic || `https://ui-avatars.com/api/?background=eeafad&color=fff&name=${like.name}`} alt={like.name} />
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

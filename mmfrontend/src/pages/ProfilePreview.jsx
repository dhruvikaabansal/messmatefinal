import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import './Profile.css';
import './Discover.css'; // reuse discover card styles

const ProfilePreview = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/user/profile');
                const data = res.data?.profile || res.data;
                setProfile(data);
                setLoading(false);
            } catch (err) {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    if (loading) return <div className="container loader-container">Loading your deck... 🃏</div>;

    if (!profile) return (
        <div className="container profile-preview-page">
            <div className="preview-header">
                <h2>No Profile Found</h2>
                <p>Set up your profile first before previewing.</p>
                <button className="neo-btn neo-btn-secondary" onClick={() => navigate('/profile')}>
                    Set Up Profile
                </button>
            </div>
        </div>
    );

    const avatarUrl = profile.profilePic || `https://i.pravatar.cc/400?u=${profile.email}`;

    return (
        <div className="container profile-preview-page">
            <div className="preview-header">
                <h2>👁️ Your Profile Deck</h2>
                <p>This is exactly how others see you on MessMate.</p>
                <span className="preview-badge">✨ PREVIEW MODE</span>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="profile-feed-item"
            >
                {/* 🖼️ Hero Image */}
                <section className="profile-hero neo-card">
                    <div className="image-wrapper">
                        <img src={avatarUrl} alt={profile.name} />
                        <div className="hero-overlay">
                            <h1>{profile.name}, {profile.age || '?'}</h1>
                            <p className="college-tag">{profile.college}</p>
                        </div>
                    </div>
                </section>

                {/* ✍️ Prompt 1 */}
                {profile.prompts?.[0] && (
                    <section className="profile-prompt neo-card">
                        <span className="prompt-q">{profile.prompts[0].question}</span>
                        <h2 className="prompt-a">{profile.prompts[0].answer}</h2>
                    </section>
                )}

                {/* 📝 Bio & Interests */}
                <section className="profile-details neo-card">
                    <p className="bio-v3">"{profile.bio || 'No bio yet.'}"</p>
                    {profile.interests?.length > 0 && (
                        <div className="interests-grid">
                            {profile.interests.map(i => (
                                <span key={i} className="interest-tag">#{i.replace(/^[\S]+ /, '')}</span>
                            ))}
                        </div>
                    )}
                    <div className="match-indicator">📍 {profile.college?.toUpperCase()}</div>
                </section>

                {/* ✍️ Prompt 2 */}
                {profile.prompts?.[1] && (
                    <section className="profile-prompt neo-card highlight">
                        <span className="prompt-q">{profile.prompts[1].question}</span>
                        <h2 className="prompt-a">{profile.prompts[1].answer}</h2>
                    </section>
                )}
            </motion.div>

            {/* Back Buttons */}
            <div className="profile-action-btns preview-back-btn">
                <button className="neo-btn neo-btn-secondary" onClick={() => navigate('/profile')}>
                    ← Edit Profile
                </button>
                <button className="neo-btn" onClick={() => navigate('/discover')}>
                    Start Swiping! →
                </button>
            </div>
        </div>
    );
};

export default ProfilePreview;

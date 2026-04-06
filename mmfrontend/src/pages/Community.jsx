import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Community.css';
import './Profile.css'; // Reusing profile chip styles if needed

const PREDEFINED_INTERESTS = [
    '🎮 Gaming', '🎵 Music', '💪 Gym', '📚 Reading', '✈️ Travel',
    '🎨 Art', '💃 Dance', '📸 Photography', '🍳 Cooking', '🎬 Movies',
    '⚽ Sports', '🤖 AI / Tech', '🧘 Yoga', '🎸 Guitar', '✍️ Writing',
    '🌿 Sustainability', '☕ Coffee', '🏕️ Trekking', '🎤 Singing', '🧩 Chess'
];

const Community = () => {
    const navigate = useNavigate();
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCommunity, setNewCommunity] = useState({ name: '', mealTime: 'lunch', mealDate: todayStr, description: '', interests: [] });
    const [userHasCommunity, setUserHasCommunity] = useState(false);
    const [activeMatch, setActiveMatch] = useState(null); // 🔥 Added for cross-exclusivity lock

    const toggleInterest = (interest) => {
        if (newCommunity.interests.includes(interest)) {
            setNewCommunity({ ...newCommunity, interests: newCommunity.interests.filter(i => i !== interest) });
        } else if (newCommunity.interests.length < 5) {
            setNewCommunity({ ...newCommunity, interests: [...newCommunity.interests, interest] });
        }
    };

    useEffect(() => {
        fetchCommunities();
    }, []);

    const fetchCommunities = async () => {
        try {
            // 1. Get user profile to check for active 1-on-1 match
            const userRes = await api.get('/user/profile');
            const userData = userRes.data?.profile || userRes.data;
            setActiveMatch(userData.activeMatch || null);

            // 2. Get user preferences for filtering
            const prefData = userData.preferences || (await api.get('/preferences')).data;
            const mealTime = prefData?.mealTime || 'lunch';
            const mealDate = prefData?.mealDate || todayStr;
            
            // Set defaults for create modal based on preferences
            setNewCommunity(prev => ({ ...prev, mealTime, mealDate }));
            
            // 2. Get filtered communities
            const res = await api.get(`/community?mealTime=${mealTime}&mealDate=${mealDate}`);
            setCommunities(res.data.communities);
            
            // Check if user is already in any community returned
            const inCommunity = res.data.communities.some(c => c.isMember || c.isCreator);
            setUserHasCommunity(inCommunity);
            
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleJoin = async (id) => {
        try {
            await api.post('/community/join', { communityId: id });
            fetchCommunities();
        } catch (err) {
            alert(err.response?.data?.message || 'Error joining community');
        }
    };

    const handleLeave = async (id) => {
        if (!window.confirm("Leave this community?")) return;
        try {
            await api.post('/community/leave', { communityId: id });
            fetchCommunities();
        } catch (err) {
            alert(err.response?.data?.message || 'Error leaving community');
        }
    };

    const handleDissolve = async (id) => {
        if (!window.confirm("Dissolve this community? It cannot be undone.")) return;
        try {
            await api.delete('/community/dissolve', { data: { communityId: id } });
            fetchCommunities();
        } catch (err) {
            alert(err.response?.data?.message || 'Error dissolving community');
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/community/create', newCommunity);
            setShowCreateModal(false);
            setNewCommunity({ name: '', mealTime: 'lunch', mealDate: todayStr, description: '', interests: [] });
            fetchCommunities();
        } catch (err) {
            alert(err.response?.data?.message || 'Error creating community');
        }
    };

    if (loading) return <div className="container">Loading Communities...</div>;

    if (activeMatch) {
        return (
            <div className="container community-locked">
                <div className="neo-card active-match-card">
                    <h1>🔒 Community Locked</h1>
                    <p>You have an active 1-on-1 match! Complete or unmatch your current partner to join group meals.</p>
                    <div className="mt-2">
                         <button className="neo-btn neo-btn-primary" onClick={() => navigate('/discover')}>
                            View My Match
                         </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="community-header">
                <h1>Community Meals 👥</h1>
                <button 
                    className="neo-btn neo-btn-secondary" 
                    onClick={() => setShowCreateModal(true)}
                    disabled={userHasCommunity}
                >
                    {userHasCommunity ? "+ Already in Group" : "+ Create Group"}
                </button>
            </div>

            <div className="community-grid">
                {communities.length === 0 ? (
                    <div className="neo-card empty-state" style={{flex: 1, textAlign: 'center'}}>
                        <h2>No Matching Communities 🍱</h2>
                        <p>We only show groups that share your interests and match your current meal preferences.</p>
                        <ul style={{textAlign: 'left', display: 'inline-block', marginTop: '1rem'}}>
                            <li>✅ Ensure your profile has interests</li>
                            <li>✅ Check if your meal time/date are correct</li>
                            <li>✅ Or be the first to start a group!</li>
                        </ul>
                    </div>
                ) : (
                    communities.map(c => (
                        <div key={c._id} className={`neo-card community-card ${c.isMember || c.isCreator ? 'highlight-joined' : ''}`}>
                            {(c.isMember || c.isCreator) && (
                                <div className="member-badge">✅ Joined</div>
                            )}
                            <span className={`meal-tag ${c.mealTime}`}>{c.mealTime}</span>
                            <h3>{c.name}</h3>

                            <p>{c.description || 'No description provided.'}</p>
                            {c.interests && c.interests.length > 0 && (
                                <div className="selected-interests-row" style={{marginBottom: '1rem'}}>
                                    {c.interests.map((i, idx) => <span key={idx} className="interest-chip" style={{fontSize: '0.7rem', padding: '0.2rem 0.5rem'}}>{i}</span>)}
                                </div>
                            )}
                            <div className="members-count">
                                👥 {c.members.length} members
                            </div>
                            <div className="created-by">
                                Created by: {c.createdBy?.name || 'Anonymous'}
                            </div>

                            <div className="community-actions mt-2">
                                {c.isCreator ? (
                                    <button className="neo-btn neo-btn-outline" onClick={() => handleDissolve(c._id)}>
                                        Dissolve Group
                                    </button>
                                ) : c.isMember ? (
                                    <button className="neo-btn neo-btn-outline" onClick={() => handleLeave(c._id)}>
                                        Leave Group
                                    </button>
                                ) : (
                                    <button 
                                        className="neo-btn neo-btn-primary" 
                                        onClick={() => handleJoin(c._id)}
                                        disabled={userHasCommunity}
                                    >
                                        {userHasCommunity ? 'Cannot Join' : 'Join Group'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="neo-card modal-content">
                        <h2>Start a Meal Group</h2>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Group Name</label>
                                <input 
                                    className="neo-input"
                                    value={newCommunity.name}
                                    onChange={(e) => setNewCommunity({...newCommunity, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group flex-group">
                                <div>
                                    <label>Meal Time</label>
                                    <select 
                                        className="neo-input"
                                        value={newCommunity.mealTime}
                                        onChange={(e) => setNewCommunity({...newCommunity, mealTime: e.target.value})}
                                    >
                                        <option value="breakfast">Breakfast</option>
                                        <option value="lunch">Lunch</option>
                                        <option value="snacks">Snacks</option>
                                        <option value="dinner">Dinner</option>
                                    </select>
                                </div>
                                <div style={{marginLeft: '1rem', flex: 1}}>
                                    <label>Meal Date</label>
                                    <select 
                                        className="neo-input"
                                        value={newCommunity.mealDate}
                                        onChange={(e) => setNewCommunity({...newCommunity, mealDate: e.target.value})}
                                    >
                                        <option value={todayStr}>Today ({new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</option>
                                        <option value={tomorrowStr}>Tomorrow ({tomorrowDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea 
                                    className="neo-input"
                                    value={newCommunity.description}
                                    onChange={(e) => setNewCommunity({...newCommunity, description: e.target.value})}
                                    rows="2"
                                />
                            </div>
                            <div className="form-group">
                                <label>Interests (Up to 5)</label>
                                <div className="interests-chips-grid" style={{maxHeight: '120px', overflowY: 'auto'}}>
                                    {PREDEFINED_INTERESTS.map(interest => {
                                        const isSelected = newCommunity.interests.includes(interest);
                                        return (
                                            <button
                                                key={interest}
                                                type="button"
                                                style={{fontSize: '0.8rem', padding: '0.4rem'}}
                                                className={`interest-chip-btn ${isSelected ? 'selected' : ''}`}
                                                onClick={() => toggleInterest(interest)}
                                            >
                                                {interest}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="neo-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="neo-btn neo-btn-secondary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Community;

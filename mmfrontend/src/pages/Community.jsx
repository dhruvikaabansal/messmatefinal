import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { isMealTimePassed, MEAL_ORDER } from '../utils/mealTimeUtils';
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
    const [newCommunity, setNewCommunity] = useState({ 
        name: '', 
        mealTime: 'lunch', 
        mealDate: todayStr, 
        description: '', 
        interests: [],
        maxMembers: 4
    });
    const [userHasCommunityInSlot, setUserHasCommunityInSlot] = useState(false);
    const [activeMatches, setActiveMatches] = useState([]); // 🔥 Changed to plural for date-time check

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
            // 1. Get user profile and matches for exclusivity logic
            const userRes = await api.get('/user/profile');
            const userData = userRes.data?.profile || userRes.data;
            
            const matchListRes = await api.get('/match/list');
            const activeMatchList = (matchListRes.data.matches || []).filter(m => m.status === 'active');
            setActiveMatches(activeMatchList);

            // 2. Get user preferences for filtering
            const prefRes = await api.get('/preferences');
            const prefData = prefRes.data?.preferences || prefRes.data;
            const mealTimeParam = prefData?.mealTime || 'lunch';
            const mealDateParam = prefData?.mealDate || todayStr;
            
            // Set defaults for create modal based on preferences
            setNewCommunity(prev => ({ 
                ...prev, 
                mealTime: isMealTimePassed(mealTimeParam, mealDateParam) ? (MEAL_ORDER.find(m => !isMealTimePassed(m, mealDateParam)) || 'dinner') : mealTimeParam, 
                mealDate: mealDateParam 
            }));
            
            // 3. Get filtered communities
            const res = await api.get(`/community?mealTime=${mealTimeParam}&mealDate=${mealDateParam}`);
            setCommunities(res.data.communities);
            
            // Check if user is already in any community for this SPECIFIC slot
            const inCommunityInSlot = res.data.communities.some(c => c.isMember || c.isCreator);
            setUserHasCommunityInSlot(inCommunityInSlot);
            
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
            await api.post('/community/create', newCommunity);
            setShowCreateModal(false);
            setNewCommunity({ name: '', mealTime: 'lunch', mealDate: todayStr, description: '', interests: [], maxMembers: 4 });
            fetchCommunities();
        } catch (err) {
            alert(err.response?.data?.message || 'Error creating community');
        }
    };

    if (loading) return <div className="container">Loading Communities...</div>;

    const isSlotLockedByMatch = (time, date) => {
        return activeMatches.some(m => m.mealTime === time && m.mealDate === date);
    };

    return (
        <div className="container">
            <div className="community-header">
                <div className="header-info">
                    <h1>Community Meals 👥</h1>
                    <p className="header-subtitle">Join or create a group table for your next meal.</p>
                </div>
                <button 
                    className="neo-btn neo-btn-secondary" 
                    onClick={() => setShowCreateModal(true)}
                    disabled={userHasCommunityInSlot || isSlotLockedByMatch(newCommunity.mealTime, newCommunity.mealDate)}
                >
                    {userHasCommunityInSlot ? "✓ Already in Group" : 
                     isSlotLockedByMatch(newCommunity.mealTime, newCommunity.mealDate) ? "🔒 Timeslot Matched" :
                     "+ Create Group"}
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
                                👥 {c.members.length} / {c.maxMembers || 4} members 
                                {c.members.length >= (c.maxMembers || 4) && <span className="full-label"> (FULL)</span>}
                            </div>
                            <div className="created-by">
                                Organizer: {c.createdBy?.name || 'Anonymous'}
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
                                        disabled={userHasCommunityInSlot || isSlotLockedByMatch(c.mealTime, c.mealDate) || (c.members.length >= (c.maxMembers || 4))}
                                    >
                                        {userHasCommunityInSlot ? 'Already in Group' : 
                                         isSlotLockedByMatch(c.mealTime, c.mealDate) ? 'Timeslot Matched' :
                                         (c.members.length >= (c.maxMembers || 4)) ? 'Group Full' : 'Join Group'}
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
                                    <select 
                                        className="neo-input"
                                        value={newCommunity.mealTime}
                                        onChange={(e) => setNewCommunity({...newCommunity, mealTime: e.target.value})}
                                    >
                                        <option value="breakfast" disabled={isMealTimePassed('breakfast', newCommunity.mealDate)}>Breakfast {isMealTimePassed('breakfast', newCommunity.mealDate) ? '(Passed)' : ''}</option>
                                        <option value="lunch" disabled={isMealTimePassed('lunch', newCommunity.mealDate)}>Lunch {isMealTimePassed('lunch', newCommunity.mealDate) ? '(Passed)' : ''}</option>
                                        <option value="snacks" disabled={isMealTimePassed('snacks', newCommunity.mealDate)}>Snacks {isMealTimePassed('snacks', newCommunity.mealDate) ? '(Passed)' : ''}</option>
                                        <option value="dinner" disabled={isMealTimePassed('dinner', newCommunity.mealDate)}>Dinner {isMealTimePassed('dinner', newCommunity.mealDate) ? '(Passed)' : ''}</option>
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
                                <label>Max Members (2-10)</label>
                                <input 
                                    type="number"
                                    className="neo-input"
                                    value={newCommunity.maxMembers}
                                    onChange={(e) => setNewCommunity({...newCommunity, maxMembers: parseInt(e.target.value)})}
                                    min="2"
                                    max="10"
                                    required
                                />
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

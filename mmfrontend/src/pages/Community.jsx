import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { isMealTimePassed, MEAL_ORDER, getFirstAvailableMeal, getLocalDateStr } from '../utils/mealTimeUtils';
import { getProfilePic } from '../utils/imgUtils';
import './Community.css';
import './Profile.css';

/**
 * Community.jsx — Slot-State-First architecture
 *
 * Renders based on the user's current state for the selected slot.
 * State is fetched from /api/slot/status (the unified endpoint).
 *
 * State → UI mapping:
 *   matched      → show locked (user cannot join groups while matched)
 *   in_community → show "You're in a group" screen with leave option
 *   idle/liked   → show community browser + create button
 *   closed       → show slot-closed banner
 */

const PREDEFINED_INTERESTS = [
    '🎮 Gaming', '🎵 Music', '💪 Gym', '📚 Reading', '✈️ Travel',
    '🎨 Art', '💃 Dance', '📸 Photography', '🍳 Cooking', '🎬 Movies',
    '⚽ Sports', '🤖 AI / Tech', '🧘 Yoga', '🎸 Guitar', '✍️ Writing',
    '🌿 Sustainability', '☕ Coffee', '🏕️ Trekking', '🎤 Singing', '🧩 Chess'
];

const Community = () => {
    const navigate = useNavigate();
    // ✅ Use local IST date — toISOString() gives UTC which is wrong at early AM hours
    const todayStr = getLocalDateStr();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = getLocalDateStr(tomorrowDate);

    const [slotData, setSlotData] = useState(null);
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [wrongMode, setWrongMode] = useState(false); // 🔥 NEW: user is in solo mode
    const [fetchError, setFetchError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCommunity, setNewCommunity] = useState({
        name: '',
        mealTime: getFirstAvailableMeal(todayStr),
        mealDate: todayStr,
        description: '',
        interests: [],
        maxMembers: 4
    });

    const toggleInterest = (interest) => {
        if (newCommunity.interests.includes(interest)) {
            setNewCommunity({ ...newCommunity, interests: newCommunity.interests.filter(i => i !== interest) });
        } else if (newCommunity.interests.length < 5) {
            setNewCommunity({ ...newCommunity, interests: [...newCommunity.interests, interest] });
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            setLoading(true);

            // 1. Get preferences to know which slot to query
            const prefRes = await api.get(`/preferences?t=${Date.now()}`);
            // ✅ Fix: preference API returns raw object, not { preferences: ... }
            const prefData = prefRes.data?.preferences || prefRes.data;
            const gSize = prefData?.groupSize || 2;

            // If user is in "Swiping Mode" (< 3), show wrong-mode screen (don't silently redirect)
            if (gSize < 3) {
                setWrongMode(true);
                setLoading(false);
                return;
            }

            const mealTimeParam = prefData?.mealTime || 'dinner';
            // ✅ If stored mealDate is in the past, fall back to today (IST)
            const storedDate = prefData?.mealDate;
            const mealDateParam = (storedDate && storedDate >= todayStr) ? storedDate : todayStr;

            // 2. Get unified slot status
            const slotRes = await api.get(`/slot/status?date=${mealDateParam}&mealType=${mealTimeParam}&t=${Date.now()}`);
            setSlotData(slotRes.data);

            // 3. Set defaults for create modal
            setNewCommunity(prev => ({
                ...prev,
                mealTime: isMealTimePassed(mealTimeParam, mealDateParam)
                    ? (MEAL_ORDER.find(m => !isMealTimePassed(m, mealDateParam)) || 'dinner')
                    : mealTimeParam,
                mealDate: mealDateParam
            }));

            // 4. Get communities for this slot
            const commRes = await api.get(`/community?mealTime=${mealTimeParam}&mealDate=${mealDateParam}&t=${Date.now()}`);
            setCommunities(commRes.data.communities || []);

            setLoading(false);
        } catch (err) {
            console.error('[Community] fetchAll error:', err);
            setFetchError(err.response?.data?.message || err.message || 'Something went wrong loading communities.');
            setLoading(false);
        }
    };

    const handleJoin = async (id) => {
        try {
            await api.post('/community/join', { communityId: id });
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.message || 'Error joining community');
        }
    };

    const handleLeave = async (id) => {
        if (!window.confirm('Leave this community?')) return;
        try {
            await api.post('/community/leave', { communityId: id });
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.message || 'Error leaving community');
        }
    };

    const handleDissolve = async (id) => {
        if (!window.confirm('Dissolve this community? This cannot be undone.')) return;
        try {
            await api.delete('/community/dissolve', { data: { communityId: id } });
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.message || 'Error dissolving community');
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/community/create', newCommunity);
            
            // 🔥 CRITICAL: Automatically sync user preference to the newly created slot!
            // This ensures they "land" on the correct community and see it immediately.
            await api.post('/preferences', {
                mealTime: newCommunity.mealTime,
                mealDate: newCommunity.mealDate,
                groupSize: 3 // ensure they stay in group mode
            });

            setShowCreateModal(false);
            setNewCommunity({ name: '', mealTime: 'lunch', mealDate: todayStr, description: '', interests: [], maxMembers: 4 });
            
            // Refresh state
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.message || 'Error creating community');
        }
    };

    if (loading) return <div className="container">Loading Communities... 👥</div>;

    // ── ERROR STATE ──────────────────────────────────────────────────────────
    if (fetchError) {
        return (
            <div className="container">
                <div className="neo-card error-card" style={{ textAlign: 'center', padding: '2rem', background: '#ffe4e4' }}>
                    <h1>⚠️ Technical Hiccup</h1>
                    <p>{fetchError}</p>
                    <button className="neo-btn neo-btn-primary" style={{ marginTop: '1rem' }} onClick={() => fetchAll()}>
                        Try Again 🔄
                    </button>
                </div>
            </div>
        );
    }

    // ── WRONG MODE: Group Size < 3 (Solo Mode) ───────────────────────────────
    if (wrongMode) {
        return (
            <div className="container">
                <div className="neo-card solo-mode-card" style={{ textAlign: 'center', padding: '3rem', maxWidth: '600px', margin: '2rem auto', border: '3px solid var(--primary)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🍱</div>
                    <h1>Solo Mode Active</h1>
                    <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                        Your preferences are currently set to <strong>"Just us (2)"</strong>.<br/>
                        Community groups are for parties of 3 or more!
                    </p>
                    <div className="flex-row" style={{ gap: '1rem', justifyContent: 'center' }}>
                        <button className="neo-btn neo-btn-primary" onClick={() => navigate('/preferences?mode=edit')}>
                            Change to Group Mode 👥
                        </button>
                        <button className="neo-btn neo-btn-outline" onClick={() => navigate('/discover')}>
                            Go to Discover 🔍
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const state = slotData?.state;
    const slotStatus = slotData?.slotStatus;
    const activeCommunity = slotData?.communityData;

    // ── SLOT CLOSED ───────────────────────────────────────────────────────────
    if (slotStatus === 'closed') {
        return (
            <div className="container">
                <div className="neo-card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <h1>⏰ Meal Slot Closed</h1>
                    <p>This slot has ended. Update your preferences to find new groups!</p>
                    <button className="neo-btn neo-btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/preferences?mode=edit')}>
                        Update Preferences →
                    </button>
                </div>
            </div>
        );
    }

    // ── STATE: MATCHED — Cannot join groups ───────────────────────────────────
    if (state === 'matched') {
        return (
            <div className="container">
                <div className="neo-card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <h1>🔒 You Have an Active Match</h1>
                    <p>You're matched 1-on-1 for this meal slot. You cannot join groups while matched.</p>
                    <button className="neo-btn neo-btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/discover')}>
                        Go to My Match →
                    </button>
                </div>
            </div>
        );
    }

    // ── STATE: IN_COMMUNITY — Show current group ──────────────────────────────
    if (state === 'in_community' && activeCommunity) {
        const currentUserId = slotData?.userId || localStorage.getItem('userId');
        const isCreator = activeCommunity.createdBy?._id === currentUserId;
        return (
            <div className="container">
                <div className="community-header">
                    <div className="header-info">
                        <h1>Your Group Meal 👥</h1>
                        <p className="header-subtitle">You're part of: <strong>{activeCommunity.name}</strong></p>
                    </div>
                </div>
                <div className="neo-card community-card highlight-joined" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div className="member-badge">✅ Joined</div>
                    <span className={`meal-tag ${activeCommunity.mealTime}`}>{activeCommunity.mealTime}</span>
                    <h3>{activeCommunity.name}</h3>
                    <p>{activeCommunity.description || 'No description provided.'}</p>
                    {activeCommunity.interests?.length > 0 && (
                        <div className="selected-interests-row" style={{ marginBottom: '1rem' }}>
                            {activeCommunity.interests.map((i, idx) => (
                                <span key={idx} className="interest-chip" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>{i}</span>
                            ))}
                        </div>
                    )}
                    <div className="members-count" style={{ marginBottom: '1rem' }}>
                        👥 {activeCommunity.members?.length} / {activeCommunity.maxMembers || 4} members
                    </div>
                    
                    <div className="community-members-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        {activeCommunity.members?.map((member, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: '#f5f5f5', padding: '0.6rem 1rem', borderRadius: '12px', border: '2px solid #000' }}>
                                <img 
                                    src={getProfilePic(member.profilePic, member.name)} 
                                    alt={member.name} 
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #000', objectFit: 'cover' }} 
                                />
                                <div>
                                    <div style={{ fontWeight: '800', fontSize: '1rem' }}>{member.name}{member.age ? `, ${member.age}` : ''}</div>
                                    {activeCommunity.createdBy?._id === member._id && <div style={{ fontSize: '0.7rem', color: '#ff6b6b', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '2px' }}>Organizer</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="created-by">Organizer: {activeCommunity.createdBy?.name || 'Anonymous'}</div>
                    <div className="community-actions mt-2">
                        {isCreator ? (
                            <button className="neo-btn neo-btn-outline" onClick={() => handleDissolve(activeCommunity._id)}>
                                Dissolve Group
                            </button>
                        ) : (
                            <button className="neo-btn neo-btn-outline" onClick={() => handleLeave(activeCommunity._id)}>
                                Leave Group
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── STATE: IDLE / LIKED — Browse & Create ─────────────────────────────────
    return (
        <div className="container community-page pb-5">
            <div className="community-header-premium">
                <div className="header-main-info">
                    <h1>Community Tables 👥</h1>
                    <div className="community-context-bar">
                        <button className="neo-btn change-slot-btn-minimal" onClick={() => navigate('/preferences?mode=edit')}>
                             ⚙️ Change
                        </button>
                    </div>
                </div>
                <button
                    className="neo-btn neo-btn-secondary create-table-btn"
                    onClick={() => setShowCreateModal(true)}
                >
                    + Create Table
                </button>
            </div>

            <div className="community-grid">
                {communities.length === 0 ? (
                    <div className="neo-card empty-state" style={{ flex: 1, textAlign: 'center' }}>
                        <h2>No Matching Communities 🍱</h2>
                        <p>We only show groups that share your interests and meal slot.</p>
                        <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>
                            <li>✅ Make sure your profile has interests</li>
                            <li>✅ Check your meal time and date preferences</li>
                            <li>✅ Or be the first to start a group!</li>
                        </ul>
                    </div>
                ) : (
                    communities.map(c => (
                        <div key={c._id} className={`neo-card community-card ${c.isMember || c.isCreator ? 'highlight-joined' : ''}`}>
                            {(c.isMember || c.isCreator) && <div className="member-badge">✅ Joined</div>}
                            <span className={`meal-tag ${c.mealTime}`}>{c.mealTime}</span>
                            <h3>{c.name}</h3>
                            <p>{c.description || 'No description provided.'}</p>
                            {c.interests?.length > 0 && (
                                <div className="selected-interests-row" style={{ marginBottom: '1rem' }}>
                                    {c.interests.map((i, idx) => (
                                        <span key={idx} className="interest-chip" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>{i}</span>
                                    ))}
                                </div>
                            )}
                            <div className="members-count" style={{ marginBottom: '0.5rem' }}>
                                👥 {c.members.length} / {c.maxMembers || 4} members
                                {c.members.length >= (c.maxMembers || 4) && <span className="full-label"> (FULL)</span>}
                            </div>
                            <div className="community-members-avatars" style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                {c.members.map((member, idx) => (
                                     <img 
                                         key={idx} 
                                         src={getProfilePic(member.profilePic, member.name)} 
                                         title={member.name} 
                                         alt={member.name} 
                                         style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #000', objectFit: 'cover' }} 
                                     />
                                ))}
                            </div>
                            <div className="created-by">Organizer: {c.createdBy?.name || 'Anonymous'}</div>
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
                                        disabled={c.members.length >= (c.maxMembers || 4)}
                                    >
                                        {c.members.length >= (c.maxMembers || 4) ? 'Group Full' : 'Join Group'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="neo-card modal-content premium-modal">
                        <div className="modal-header">
                            <h2>Start a Group Table 🍱</h2>
                            <button className="close-modal-btn" onClick={() => setShowCreateModal(false)}>✕</button>
                        </div>
                        
                        <form onSubmit={handleCreate} className="premium-form">
                            <div className="form-group">
                                <label className="neo-label">What's the vibe? (Group Name)</label>
                                <input 
                                    className="neo-input" 
                                    placeholder="e.g. Pizza & Politics, Gym Rats Lunch..." 
                                    value={newCommunity.name} 
                                    onChange={(e) => setNewCommunity({ ...newCommunity, name: e.target.value })} 
                                    required 
                                />
                            </div>

                            <div className="form-row flex">
                                <div className="form-group flex-1 mr-2">
                                    <label className="neo-label">Category</label>
                                    <select className="neo-input" value={newCommunity.mealTime} onChange={(e) => setNewCommunity({ ...newCommunity, mealTime: e.target.value })}>
                                        <option value="breakfast">Breakfast</option>
                                        <option value="lunch">Lunch</option>
                                        <option value="snacks">Snacks</option>
                                        <option value="dinner">Dinner</option>
                                    </select>
                                </div>
                                <div className="form-group flex-1">
                                    <label className="neo-label">When?</label>
                                    <select className="neo-input" value={newCommunity.mealDate} onChange={(e) => setNewCommunity({ ...newCommunity, mealDate: e.target.value })}>
                                        <option value={todayStr}>Today ({new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</option>
                                        <option value={tomorrowStr}>Tomorrow ({tomorrowDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="neo-label">Group Size (Max {newCommunity.maxMembers})</label>
                                <div className="range-container">
                                    <input type="range" min="2" max="10" step="1" value={newCommunity.maxMembers} onChange={(e) => setNewCommunity({ ...newCommunity, maxMembers: parseInt(e.target.value) })} />
                                    <span className="range-value">{newCommunity.maxMembers} members</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="neo-label">Brief Description</label>
                                <textarea 
                                    className="neo-input" 
                                    placeholder="Tell them what to expect..." 
                                    value={newCommunity.description} 
                                    onChange={(e) => setNewCommunity({ ...newCommunity, description: e.target.value })} 
                                    rows="1" 
                                />
                            </div>

                            <div className="form-group">
                                <label className="neo-label">Select Tags (Up to 5)</label>
                                <div className="interests-scroll-container">
                                    {PREDEFINED_INTERESTS.map(interest => {
                                        const isSelected = newCommunity.interests.includes(interest);
                                        return (
                                            <button key={interest} type="button" className={`interest-pill ${isSelected ? 'active' : ''}`} onClick={() => toggleInterest(interest)}>
                                                {interest}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="modal-footer pt-3">
                                <button type="submit" className="neo-btn neo-btn-primary w-full py-3" style={{ fontSize: '1.1rem' }}>
                                    🚀 Launch Group
                                </button>
                                <p className="text-center text-xs text-muted mt-2">The group will dissolve automatically after the slot ends.</p>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Community;

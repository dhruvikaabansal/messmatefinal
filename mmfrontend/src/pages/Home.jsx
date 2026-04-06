import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './Home.css';

const Home = () => {
    const [user, setUser] = useState(null);
    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const userRes = await api.get('/user/profile');
                const userData = userRes.data?.profile || userRes.data;
                setUser(userData);

                if (userData.activeMatch) {
                    const matchRes = await api.get('/match/list'); // Reuse list to find current
                    const currentMatch = matchRes.data.matches.find(m => m._id === userData.activeMatch);
                    setMatch(currentMatch);
                }
                setLoading(false);
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    const handleCompleteMatch = async () => {
        if (!match) return;
        try {
            await api.post('/match/complete', { matchId: match._id });
            window.location.reload(); // Refresh to clear status
        } catch (err) {
            alert('Error completing match');
        }
    };

    if (loading) return <div className="container">Loading Dashboard...</div>;

    return (
        <div className="container home-dashboard">
            <div className="neo-card welcome-card">
                <h1>Hello, {user?.name}! 👋</h1>
                <p>Welcome to your MessMate command center.</p>
                
                <div className="status-section">
                    {match ? (
                        <div className="active-match-info neo-card">
                            <span className="badge">Active Match 🔒</span>
                            <h2>You are matched with {match.user?.name}!</h2>
                            <p>For {match.mealTime} ({match.mealDate})</p>
                            <div className="flex mt-2">
                                <Link to="/matches" className="neo-btn neo-btn-secondary">Chat Now</Link>
                                <button onClick={handleCompleteMatch} className="neo-btn neo-btn-primary">
                                    Meal Successful! ✅
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="no-match-info">
                            <h2>No active match right now.</h2>
                            <p>Ready to find a meal partner?</p>
                            <Link 
                                to={user?.preferences?.groupSize >= 3 ? "/community" : "/discover"} 
                                className="neo-btn neo-btn-accent"
                            >
                                {user?.preferences?.groupSize >= 3 ? "Find Groups 👥" : "Start Swiping 🚀"}
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <div className="home-grid grid mt-2">
                <div className="neo-card home-option" onClick={() => navigate('/preferences?mode=edit')}>
                    <h3>Reset Prefs 🍱</h3>
                    <p>Change your meal time or date.</p>
                </div>
                <div className="neo-card home-option" onClick={() => navigate('/community')}>
                    <h3>Groups 👥</h3>
                    <p>Join a community meal.</p>
                </div>
                <div className="neo-card home-option" onClick={() => navigate('/profile?mode=edit')}>
                    <h3>My Profile 👤</h3>
                    <p>Update your bio and photos.</p>
                </div>
            </div>
        </div>
    );
};

export default Home;

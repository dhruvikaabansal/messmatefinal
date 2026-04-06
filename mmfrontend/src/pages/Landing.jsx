import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
    const navigate = useNavigate();

    const handleLogin = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const handleSignup = () => {
        localStorage.removeItem('token');
        navigate('/register');
    };

    return (
        <div className="landing-container">
            {/* Top Bar */}
            <nav className="landing-nav">
                <div className="landing-logo">MessMate 🍽️</div>
                <div className="landing-nav-btns">
                    <button className="landing-btn-ghost" onClick={handleLogin}>Log In</button>
                    <button className="landing-btn-primary" onClick={handleSignup}>Sign Up Free</button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="landing-hero">
                <div className="hero-pill">🍱 Campus-Exclusive Matching</div>
                <h1 className="hero-headline">
                    No more eating<br />
                    <span className="hero-highlight">alone.</span>
                </h1>
                <p className="hero-subtext">
                    MessMate finds your perfect dining companion from your own college —<br />
                    breakfast, lunch, or dinner. Real people. Real meals. Real connections.
                </p>
                <div className="hero-ctas">
                    <button className="landing-btn-primary large" onClick={handleSignup}>
                        Find My MessMate 🚀
                    </button>
                    <button className="landing-btn-ghost" onClick={handleLogin}>
                        Already a member? Log in
                    </button>
                </div>

                {/* Stats Row */}
                <div className="stats-row">
                    <div className="stat-chip">🎓 Campus-only</div>
                    <div className="stat-chip">⚡ Instant matching</div>
                    <div className="stat-chip">🔒 Verified students</div>
                    <div className="stat-chip">🍜 Any meal, any time</div>
                </div>
            </section>

            {/* Feature Cards */}
            <section className="landing-features">
                <div className="feature-card accent-pink">
                    <div className="feature-icon">🛡️</div>
                    <h3>College-Verified Only</h3>
                    <p>Only students from your campus. Safe, local, and trustworthy.</p>
                </div>
                <div className="feature-card accent-yellow">
                    <div className="feature-icon">🍱</div>
                    <h3>One Match at a Time</h3>
                    <p>Focused exclusivity — one meal partner at a time for genuine vibes.</p>
                </div>
                <div className="feature-card accent-green">
                    <div className="feature-icon">👥</div>
                    <h3>Solo or Group</h3>
                    <p>Match 1-on-1 or join a community table. You decide how you dine.</p>
                </div>
            </section>

            {/* Bottom CTA Banner */}
            <section className="cta-banner">
                <h2>Ready to ditch solo mess sessions?</h2>
                <button className="landing-btn-primary large" onClick={handleSignup}>
                    Get Started — It's Free 🎉
                </button>
            </section>

            <footer className="landing-footer">
                © 2026 MessMate · Built for students, by students.
            </footer>
        </div>
    );
};

export default Landing;

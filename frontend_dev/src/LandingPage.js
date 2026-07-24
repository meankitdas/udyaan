import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <div className="landing-page">
            {/* Header */}
            <header className="landing-header">
                <Link to="/" className="brand" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    <img src="https://udyaan-assets.s3.ap-south-1.amazonaws.com/Udyaan.svg" alt="Udyaan" style={{ height: '50px', width: 'auto' }} />
                </Link>

                {/* Mobile Menu Button */}
                <button
                    className={`mobile-menu-btn ${isMenuOpen ? 'active' : ''}`}
                    onClick={toggleMenu}
                    aria-label="Toggle Navigation"
                >
                    <span className="hamburger-line"></span>
                    <span className="hamburger-line"></span>
                    <span className="hamburger-line"></span>
                </button>

                <nav className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
                    <Link to="/login" className="nav-link" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
                    <Link to="/signup" className="btn-primary" onClick={() => setIsMenuOpen(false)}>Get Started</Link>
                </nav>
            </header>

            {/* Hero */}
            <section className="hero-section">
                <span className="badge">JGI's Premier Internship Program</span>
                <h1 className="hero-title">Cultivating Future Leaders Through Udyaan</h1>
                <p className="hero-subtitle">
                    Join our immersive 1000-acre farmland internship program. Experience hands-on learning, cross-disciplinary collaboration, and real-world impact across agriculture, technology, and sustainability.
                </p>
                <div className="hero-buttons">
                    <Link to="/signup" className="btn-primary">Join Udyaan</Link>
                    <a href="#features" className="btn-outline">Learn More</a>
                </div>
            </section>

            {/* Stats */}
            <section className="stats-section">
                <div className="stat-item">
                    <h3>1000+</h3>
                    <p>Students Impacted</p>
                </div>
                <div className="stat-item">
                    <h3>500+</h3>
                    <p>Projects Completed</p>
                </div>
                <div className="stat-item">
                    <h3>10+</h3>
                    <p>Departments Involved</p>
                </div>
                <div className="stat-item">
                    <h3>20+</h3>
                    <p>Industry Partners</p>
                </div>
            </section>

            {/* Benefits / Features */}
            <section id="features" className="features-section">
                <h2 className="section-title">What is Udyaan?</h2>
                <div className="feature-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🌱</div>
                        <h3>Sustainable Farming</h3>
                        <p>Learn engaging farming techniques and sustainable practices firsthand.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🚀</div>
                        <h3>Industry Projects</h3>
                        <p>Work on real-world projects guided by industry experts and faculty.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🤝</div>
                        <h3>Community Impact</h3>
                        <p>Create meaningful change in local agricultural communities.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">👥</div>
                        <h3>Team Collaboration</h3>
                        <p>Collaborate across disciplines to solve complex challenges.</p>
                    </div>
                </div>
            </section>

            {/* Value Proposition */}
            <section className="features-section" style={{ backgroundColor: 'white' }}>
                <h2 className="section-title">How JGI Takes Udyaan to New Heights</h2>
                <div className="feature-grid">
                    <div className="feature-card" style={{ backgroundColor: 'var(--bg-cream)' }}>
                        <h3>Hands-On Experience</h3>
                        <p>Direct exposure to farm management and agricultural technologies.</p>
                    </div>
                    <div className="feature-card" style={{ backgroundColor: 'var(--bg-cream)' }}>
                        <h3>Cross-Departmental Learning</h3>
                        <p>Students from Engineering, MBA, and Sciences working together.</p>
                    </div>
                    <div className="feature-card" style={{ backgroundColor: 'var(--bg-cream)' }}>
                        <h3>Industry Mentorship</h3>
                        <p>Guidance from professionals in leading agri-tech companies.</p>
                    </div>
                    <div className="feature-card" style={{ backgroundColor: 'var(--bg-cream)' }}>
                        <h3>Skill Development</h3>
                        <p>Enhancing technical and soft skills for future careers.</p>
                    </div>
                </div>
            </section>

            {/* Departments */}
            <section className="departments-section">
                <h2 className="section-title">Internship Departments</h2>
                <div className="tags-container">
                    <span className="department-tag">Agriculture & Farming</span>
                    <span className="department-tag">Biotechnology</span>
                    <span className="department-tag">Environmental Science</span>
                    <span className="department-tag">Business & Marketing</span>
                    <span className="department-tag">Engineering</span>
                    <span className="department-tag">Food Technology</span>
                    <span className="department-tag">Data Analytics</span>
                    <span className="department-tag">Sustainability Studies</span>
                </div>
            </section>

            {/* CTA */}
            <section className="cta-section">
                <h2 className="cta-title">Ready to Begin Your Udyaan Journey?</h2>
                <Link to="/signup" className="btn-secondary">Get Started Today</Link>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="footer-content">
                    <div className="brand">
                        <img src="https://udyaan-assets.s3.ap-south-1.amazonaws.com/Udyaan.svg" alt="Udyaan" style={{ height: '40px', width: 'auto' }} />
                    </div>
                    <div className="footer-copyright">
                        © 2024 Jain Group of Institutions. All rights reserved.
                    </div>
                    <div className="footer-links">
                        <a href="#" className="footer-link">About</a>
                        <a href="#" className="footer-link">Contact</a>
                        <a href="#" className="footer-link">Privacy</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;

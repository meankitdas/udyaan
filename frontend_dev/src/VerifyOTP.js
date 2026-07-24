import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Auth.css';
import { API_BASE_URL } from './config';

function VerifyOTP() {
    const location = useLocation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (location.state && location.state.email) {
            setEmail(location.state.email);
        }
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, otp }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Verification failed');
            }

            setMessage('Verification successful! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            let message = err.message;
            if (message === 'Failed to fetch') {
                message = 'Unable to connect to the server. Please check your internet connection or try again later.';
            } else if (message.includes('Unexpected token')) {
                message = 'Server encountered an error. Please try again.';
            }
            setError(message);
        }
    };

    return (
        <div className="auth-wrapper">
            <Link to="/" className="auth-logo-link">
                <span style={{ fontSize: '1.8rem' }}>🍃</span> Udyaan
            </Link>

            <div className="auth-card">
                <div className="auth-header">
                    <h2>Verify Your Email</h2>
                    <p>Enter the 6-digit code sent to<br /><strong>{email || 'your email'}</strong></p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}
                {message && <div className="alert alert-success">{message}</div>}

                <form onSubmit={handleSubmit}>
                    {!location.state?.email && (
                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                className="form-control"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="name@example.com"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>One-Time Password (OTP)</label>
                        <input
                            type="text"
                            className="form-control"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                            placeholder="123456"
                            maxLength="6"
                            style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '1.25rem', fontWeight: '600' }}
                        />
                    </div>
                    <button type="submit" className="auth-btn">Verify Account</button>
                </form>

                <div className="auth-footer">
                    <p>Didn't receive code? <button style={{ background: 'none', border: 'none', color: 'var(--primary-green)', fontWeight: '600', cursor: 'pointer' }} onClick={() => alert('Resend feature not implemented yet')}>Resend</button></p>
                </div>
            </div>
        </div>
    );
}

export default VerifyOTP;

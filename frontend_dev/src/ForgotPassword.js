import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';
import { API_BASE_URL } from './config';

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (response.ok) {
                setMessage(data.message);
            } else {
                setError(data.detail || 'Failed to send reset link');
            }
        } catch (err) {
            let message = err.message;
            if (message === 'Failed to fetch') {
                message = 'Unable to connect to the server. Please check your internet connection or try again later.';
            } else if (message.includes('Unexpected token')) {
                message = 'Server encountered an error. Please try again.';
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <Link to="/" className="auth-logo-link">
                <span style={{ fontSize: '1.8rem' }}>🍃</span> Udyaan
            </Link>

            <div className="auth-card">
                <div className="auth-header">
                    <h2>Forgot Password</h2>
                    <p>Enter your email to receive a reset link</p>
                </div>

                {message && <div className="alert alert-success">{message}</div>}
                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
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
                    <button type="submit" disabled={loading} className="auth-btn">
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Remembered your password? <Link to="/login" className="auth-link">Log In</Link></p>
                </div>
            </div>
        </div>
    );
}

export default ForgotPassword;

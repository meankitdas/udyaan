import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import './Auth.css';
import { API_BASE_URL } from './config';

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!token) {
            setError("Missing reset token");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, new_password: password }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                setError(data.detail || 'Failed to reset password');
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

    if (!token) {
        return (
            <div className="auth-wrapper">
                <Link to="/" className="auth-logo-link">
                    <span style={{ fontSize: '1.8rem' }}>🍃</span> Udyaan
                </Link>
                <div className="auth-card">
                    <div className="auth-header">
                        <h2>Invalid Link</h2>
                        <p style={{ color: 'var(--error-red)' }}>No reset token provided. Please use the verification link from your email.</p>
                    </div>
                    <div className="auth-footer">
                        <Link to="/login" className="auth-link">Return to Login</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-wrapper">
            <Link to="/" className="auth-logo-link">
                <span style={{ fontSize: '1.8rem' }}>🍃</span> Udyaan
            </Link>

            <div className="auth-card">
                <div className="auth-header">
                    <h2>Reset Password</h2>
                    <p>Create a secure new password</p>
                </div>

                {message && <div className="alert alert-success">{message}</div>}
                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>New Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Enter new password"
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="Confirm new password"
                        />
                    </div>
                    <button type="submit" disabled={loading} className="auth-btn">
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Back to <Link to="/login" className="auth-link">Login</Link></p>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;

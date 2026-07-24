import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css'; // Import the new styles
import { API_BASE_URL } from './config';

function Login() {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            // Backend expects application/x-www-form-urlencoded for OAuth2 form
            const params = new URLSearchParams();
            params.append('username', formData.email); // Map email to username
            params.append('password', formData.password);

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Login failed');
            }

            // Store tokens
            sessionStorage.setItem('access_token', data.access_token);
            sessionStorage.setItem('refresh_token', data.refresh_token);
            if (data.role_key) {
                sessionStorage.setItem('role_key', data.role_key);
            }

            // Simple notification (or toast) could go here instead of alert
            // alert('Login successful!'); 

            if (data.role_key === 'SUPERADMIN') {
                navigate('/superadmin');
            } else if (data.role_key === 'ADMIN') {
                navigate('/admin');
            } else if (data.role_key === 'STUDENT') {
                navigate('/student');
            } else if (data.role_key === 'FACULTY') {
                navigate('/faculty');
            } else if (data.role_key === 'PROJECT_HEAD') {
                navigate('/project-head');
            } else {
                navigate('/');
            }
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
                    <h2>Welcome Back</h2>
                    <p>Sign in to continue to your dashboard</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            name="email"
                            className="form-control"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder="name@example.com"
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            className="form-control"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Enter your password"
                        />
                    </div>

                    <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                        <Link to="/forgot-password" style={{ fontSize: '0.9em', color: 'var(--primary-green)', textDecoration: 'none', fontWeight: '500' }}>
                            Forgot Password?
                        </Link>
                    </div>

                    <button type="submit" className="auth-btn">Sign In</button>
                </form>

                <div className="auth-footer">
                    <p>Don't have an account? <Link to="/signup" className="auth-link">Sign Up</Link></p>
                </div>
            </div>
        </div>
    );
}

export default Login;

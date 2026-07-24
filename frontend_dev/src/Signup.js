import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';
import { API_BASE_URL } from './config';

function Signup() {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role_key: 'STUDENT',
        organization_id: ''
    });

    const [organizations, setOrganizations] = useState([]);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Fetch Orgs on mount
    React.useEffect(() => {
        fetch(`${API_BASE_URL}/organizations/public`)
            .then(res => res.json())
            .then(data => setOrganizations(data))
            .catch(err => console.error("Failed to fetch orgs", err));
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Signup failed');
            }

            // Redirect to Verify OTP
            navigate('/verify-otp', { state: { email: formData.email } });

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
                    <h2>Create Account</h2>
                    <p>Join the Udyaan community today</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input
                            name="full_name"
                            className="form-control"
                            value={formData.full_name}
                            onChange={handleChange}
                            required
                            placeholder="John Doe"
                        />
                    </div>
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
                            placeholder="Create a password"
                        />
                    </div>
                    <div className="form-group">
                        <label>I am a</label>
                        <select
                            name="role_key"
                            className="form-control"
                            value={formData.role_key}
                            onChange={handleChange}
                        >
                            <option value="STUDENT">Student</option>
                            <option value="FACULTY">Faculty</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Organization</label>
                        <select
                            name="organization_id"
                            className="form-control"
                            value={formData.organization_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select Organization</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className="auth-btn">Sign Up</button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login" className="auth-link">Log In</Link></p>
                </div>
            </div>
        </div>
    );
}

export default Signup;

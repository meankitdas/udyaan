import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config';

function CreateProjectHead() {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        organization_id: ''
    });
    const [organizations, setOrganizations] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Fetch organizations for dropdown
        const fetchOrgs = async () => {
            const token = sessionStorage.getItem('access_token');
            try {
                const response = await fetch(`${API_BASE_URL}/organizations`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setOrganizations(data);
                }
            } catch (err) {
                console.error("Failed to fetch organizations", err);
            }
        };
        fetchOrgs();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        const token = sessionStorage.getItem('access_token');

        try {
            const response = await fetch(`${API_BASE_URL}/project-heads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to create Project Head');
            }

            setMessage('Project Head created successfully!');
            setFormData({ full_name: '', email: '', password: '', phone: '', organization_id: '' });
        } catch (err) {
            let errorMsg = err.message;
            if (errorMsg === 'Failed to fetch') {
                errorMsg = 'Unable to connect to the server. Please check your internet connection or try again later.';
            } else if (errorMsg.includes('Unexpected token')) {
                errorMsg = 'Server encountered an error. Please try again.';
            }
            setMessage(`Error: ${errorMsg}`);
        }
    };

    return (
        <div>
            <h3>Create Project Head</h3>
            {message && <p>{message}</p>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Full Name</label>
                    <input name="full_name" value={formData.full_name} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label>Email</label>
                    <input name="email" value={formData.email} onChange={handleChange} type="email" required />
                </div>
                <div className="form-group">
                    <label>Password</label>
                    <input name="password" value={formData.password} onChange={handleChange} type="password" required />
                </div>
                <div className="form-group">
                    <label>Phone</label>
                    <input name="phone" value={formData.phone} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label>Organization</label>
                    <select name="organization_id" value={formData.organization_id} onChange={handleChange} required>
                        <option value="">Select Organization</option>
                        {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                </div>

                <button type="submit">Create Project Head</button>
            </form>
        </div>
    );
}

export default CreateProjectHead;

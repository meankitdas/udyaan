import React, { useState } from 'react';
import { API_BASE_URL } from './config';

function CreateOrganization() {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        email: '', // Org email
        phone: '' // Org phone
    });

    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        const token = sessionStorage.getItem('access_token');

        try {
            const response = await fetch(`${API_BASE_URL}/organizations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to create organization');
            }

            setMessage('Organization created successfully!');
            setFormData({
                name: '', address: '', email: '', phone: ''
            }); // Reset
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
            <h3>Create New Organization</h3>
            {message && <p>{message}</p>}
            <form onSubmit={handleSubmit}>
                <h4>Organization Details</h4>
                <div className="form-group">
                    <label>Name</label>
                    <input name="name" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label>Address</label>
                    <input name="address" value={formData.address} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label>Org Email (Optional)</label>
                    <input name="email" value={formData.email} onChange={handleChange} type="email" />
                </div>
                <div className="form-group">
                    <label>Org Phone</label>
                    <input name="phone" value={formData.phone} onChange={handleChange} />
                </div>

                <button type="submit">Create Organization</button>
            </form>
        </div>
    );
}

export default CreateOrganization;

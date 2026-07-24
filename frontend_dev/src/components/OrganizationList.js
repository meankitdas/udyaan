import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

function OrganizationList({ onCreateNew, onCreateAdmin }) {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        try {
            const token = sessionStorage.getItem('access_token');
            // Assuming the proxy is set up in package.json to forward /organizations to backend
            const response = await fetch(`${API_BASE_URL}/organizations`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch organizations');
            }

            const data = await response.json();
            setOrganizations(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (orgId) => {
        if (!window.confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
            return;
        }

        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/organizations/${orgId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete organization');
            }

            setOrganizations(organizations.filter(org => org.id !== orgId));
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    if (loading) return <div>Loading organizations...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className="table-card">
            <div className="list-header">
                <div>
                    <h3>Organizations</h3>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: '4px' }}>Manage all registered organizations</p>
                </div>
                <button onClick={onCreateNew} className="btn-primary">
                    <span>+</span> New Organization
                </button>
            </div>

            {organizations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No organizations found.</p>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Location</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {organizations.map(org => (
                                <tr key={org.id}>
                                    <td>
                                        <div style={{ fontWeight: '600', color: 'var(--dark-green)' }}>{org.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#999' }}>ID: {org.id.substring(0, 8)}...</div>
                                    </td>
                                    <td>{org.email}</td>
                                    <td>{org.phone || <span style={{ color: '#ccc' }}>-</span>}</td>
                                    <td>{org.address || <span style={{ color: '#ccc' }}>-</span>}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            className="btn-link"
                                            onClick={() => onCreateAdmin && onCreateAdmin(org)}
                                            style={{ marginRight: '10px', fontSize: '0.85rem' }}
                                        >
                                            + Manage Admins
                                        </button>
                                        <button className="icon-btn" title="Edit">
                                            ✏️
                                        </button>
                                        <button
                                            className="icon-btn delete"
                                            title="Delete"
                                            onClick={() => handleDelete(org.id)}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default OrganizationList;

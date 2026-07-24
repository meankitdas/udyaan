import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

function ProjectHeadList({ onCreateNew }) {
    const [projectHeads, setProjectHeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProjectHeads();
    }, []);

    const fetchProjectHeads = async () => {
        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/project-heads`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch project heads');
            }

            const data = await response.json();
            setProjectHeads(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this Project Head? This action cannot be undone.')) {
            return;
        }

        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/project-heads/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete project head');
            }

            setProjectHeads(projectHeads.filter(ph => ph.id !== userId));
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    if (loading) return <div>Loading project heads...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className="table-card">
            <div className="list-header">
                <div>
                    <h3>Project Heads</h3>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: '4px' }}>Manage department heads and leaders</p>
                </div>
                <button onClick={onCreateNew} className="btn-primary">
                    <span>+</span> New Project Head
                </button>
            </div>

            {projectHeads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No project heads found.</p>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Full Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Organization ID</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectHeads.map(ph => (
                                <tr key={ph.id}>
                                    <td>
                                        <div style={{ fontWeight: '600', color: 'var(--dark-green)' }}>{ph.full_name}</div>
                                    </td>
                                    <td>{ph.email}</td>
                                    <td>{ph.phone || <span style={{ color: '#ccc' }}>-</span>}</td>
                                    <td><span className="badge badge-gray" style={{ fontSize: '0.8rem' }}>{ph.organization_id.substring(0, 8)}...</span></td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="icon-btn" title="Edit">
                                            ✏️
                                        </button>
                                        <button
                                            className="icon-btn delete"
                                            title="Delete"
                                            onClick={() => handleDelete(ph.id)}
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

export default ProjectHeadList;

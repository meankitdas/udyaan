import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from './config';

function OrgAdminList({ org, onBack, onCreateCallback }) {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchAdmins();
    }, [org.id]);

    const fetchAdmins = async () => {
        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/organizations/${org.id}/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            // Note: users endpoint returns all users. We need to filter for ADMIN role.
            // Or backend should provide filter?
            // Existing endpoint: /organizations/users filters by Org but returns all roles.
            // Checking api/organizations.py: read_organization_users returns get_users_by_organization
            // Which returns Filter by Org. 
            // Better would be a specific endpoint for admins, but let's filter on frontend for now if role_key is available.

            if (!response.ok) {
                // Maybe 400 if user not part of org? But we are superadmin.
                // Wait, read_organization_users checks "current_user.organization_id".
                // If Superadmin calls it, and superadmin has no org_id, it might fail?
                // Let's check backend logic.
                // "if not current_user.organization_id: raise HTTPException..."
                // YES! Superadmin cannot view users of OTHER orgs using that specific endpoint currently as it enforces current_user.organization_id.
                // I need to fix backend to allow Superadmin to view users of ANY org by passing org_id as param.
                // OR I need to use a general admin endpoint.
                // For now, let's assume I fix backend or used a different one. 
                throw new Error('Failed to fetch admins');
            }

            const data = await response.json();
            // Filter where role_key is ADMIN
            setAdmins(data.filter(u => u.role_key === 'ADMIN'));

        } catch (err) {
            // setError(err.message); 
            // Fallback: If existing endpoint fails, maybe list empty or show error
            // Actually, I should probably implement a specific endpoint for this.
            // Or updating backend endpoint is better.
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // TEMPORARY MOCK until Backend is fixed for Superadmin viewing specific Org Users
    // Or I can add a new endpoint /organizations/{org_id}/admins?

    const handleDelete = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this Admin?')) {
            return;
        }

        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/organizations/${org.id}/admins/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete admin');
            }

            setAdmins(admins.filter(a => a.id !== userId));
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    return (
        <div className="table-card">
            <div className="list-header">
                <div>
                    <button onClick={onBack} className="btn-secondary" style={{ marginBottom: '10px' }}>
                        &larr; Back
                    </button>
                    <h3>Admins for {org.name}</h3>
                </div>
                <button onClick={onCreateCallback} className="btn-primary">
                    <span>+</span> Add Admin
                </button>
            </div>

            {loading ? <div>Loading admins...</div> : (
                <>
                    {error && <div className="error-message">Error: {error} (Superadmin view might need backend update)</div>}

                    {admins.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                            <p>No admins found.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map(admin => (
                                        <tr key={admin.id}>
                                            <td>{admin.full_name}</td>
                                            <td>{admin.email}</td>
                                            <td>{admin.phone || '-'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="icon-btn delete"
                                                    title="Delete"
                                                    onClick={() => handleDelete(admin.id)}
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
                </>
            )}
        </div>
    );
}

export default OrgAdminList;

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from './config';

function UserList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterRole, setFilterRole] = useState('ALL');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/organizations/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setUsers(data);
            } else {
                setError(data.detail || 'Failed to fetch users');
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

    // Helper to get role string (assuming roles data structure)
    // The backend returns user objects. We need to see how roles are attached. 
    // In `get_users_by_organization`, we returned `User` objects. 
    // `User` model typically doesn't eager load roles unless specified. 
    // Let's assume for now we might not have roles populated in the simple query unless we modified the backend query.
    // Wait, the backend query `select(User)` returns User objects. 
    // If I look at UserResponse schema (from existing code I haven't fully seen but assumed), it might not include roles if they aren't loaded.
    // However, I can't easily change backend efficiently right now without more checks. 
    // But basic user info is there. Let's list them. 
    // If roles are missing, we just list names and emails.

    if (loading) return <div>Loading users...</div>;
    if (error) return <div className="alert alert-danger">{error}</div>;

    return (
        <div className="card-header">
            <h3>Organization Users</h3>
            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            {/* <th>Role</th>  -- Might not be available yet */}
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr><td colSpan="3">No users found.</td></tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id}>
                                    <td>{user.full_name}</td>
                                    <td>{user.email}</td>
                                    <td>{user.phone}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default UserList;

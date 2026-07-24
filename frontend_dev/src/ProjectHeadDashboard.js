import React, { useState, useEffect } from 'react';
import DashboardLayout from './components/DashboardLayout';
import CreateProject from './CreateProject';
import ProjectList from './ProjectList';
import { API_BASE_URL } from './config';

function ProjectHeadDashboard() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [organizations, setOrganizations] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState({
        full_name: '',
        phone: '',
        organization_id: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchOrganizations = async () => {
        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/organizations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setOrganizations(await response.json());
            }
        } catch (err) {
            console.error("Failed to fetch organizations", err);
        }
    };

    const startEditing = () => {
        setEditFormData({
            full_name: profile.full_name || '',
            phone: profile.phone || '',
            organization_id: profile.organization_id || ''
        });
        setIsEditing(true);
        if (organizations.length === 0) fetchOrganizations();
    };

    const handleEditChange = (e) => {
        setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = sessionStorage.getItem('access_token');
            // Sanitize payload: convert empty strings to null
            const payload = {
                ...editFormData,
                phone: editFormData.phone === '' ? null : editFormData.phone,
                organization_id: editFormData.organization_id === '' ? null : editFormData.organization_id
            };

            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const updatedProfile = await response.json();
                setProfile(updatedProfile);
                setIsEditing(false);
                alert('Profile updated successfully!');
            } else {
                let errorMsg = 'Failed to update profile';
                try {
                    const data = await response.json();
                    errorMsg = data.detail || errorMsg;
                } catch (jsonError) {
                    console.error("Failed to parse error response", jsonError);
                    errorMsg += " (Server returned non-JSON response)";
                }
                alert(errorMsg);
            }
        } catch (err) {
            console.error("Network or parsing error", err);
            alert('Network error or server unavailable.');
        }
    };

    // Auto-init logic
    useEffect(() => {
        if (profile && !profile.organization_id) {
            setEditFormData({
                full_name: profile.full_name || '',
                phone: profile.phone || '',
                organization_id: ''
            });
            fetchOrganizations();
        }
    }, [profile]);

    const fetchProfile = async () => {
        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setProfile(data);
            } else {
                setError(data.detail || 'Failed to fetch profile');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const [activeTab, setActiveTab] = useState('profile');

    const renderContent = () => {
        if (loading) return <div>Loading profile...</div>;
        if (error) return <div className="alert alert-danger">{error}</div>;
        if (!profile) return <div>No profile data found.</div>;

        // Check if editing or needs onboarding
        if (isEditing) {
            return (
                <div className="card-header">
                    <h3>Edit Profile</h3>
                    <form onSubmit={handleEditSubmit}>
                        <div className="form-group">
                            <label>Full Name</label>
                            <input name="full_name" value={editFormData.full_name || profile.full_name} onChange={handleEditChange} required style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
                        </div>
                        <div className="form-group" style={{ marginTop: '10px' }}>
                            <label>Phone</label>
                            <input name="phone" value={editFormData.phone} onChange={handleEditChange} placeholder="Enter phone number" style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
                        </div>
                        <div className="form-group" style={{ marginTop: '10px' }}>
                            <label>Organization</label>
                            <input value={profile.organization_id || 'N/A'} disabled style={{ width: '100%', padding: '8px', marginTop: '5px', backgroundColor: '#e9ecef' }} />
                            <small className="text-muted">Organization cannot be changed.</small>
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <button type="submit" className="btn-primary">Save Changes</button>
                            <button type="button" onClick={() => setIsEditing(false)} style={{ marginLeft: '10px', backgroundColor: '#6c757d' }}>Cancel</button>
                        </div>
                    </form>
                </div>
            )
        }

        switch (activeTab) {
            case 'create-project':
                return <CreateProject />;
            case 'view-projects':
                return <ProjectList />;
            case 'profile':
            default:
                return (
                    <div className="card-header">
                        <h3>Project Head Profile</h3>
                        <div className="profile-details">
                            <p><strong>Name:</strong> {profile.full_name}</p>
                            <p><strong>Email:</strong> {profile.email}</p>
                            <p><strong>Phone:</strong> {profile.phone || 'N/A'}</p>
                            <p><strong>Organization ID:</strong> {profile.organization_id || 'N/A'}</p>
                            <p><strong>Role:</strong> Project Head</p>
                        </div>
                        <button onClick={startEditing} style={{ marginTop: '15px' }}>Edit Profile</button>
                    </div>
                );
        }
    };

    const navItems = [
        { id: 'profile', label: 'My Profile' },
        { id: 'create-project', label: 'Create Project' },
        { id: 'view-projects', label: 'View Projects' }
    ];

    return (
        <DashboardLayout
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title="Project Head Dashboard"
            navItems={navItems}
            sidebarTitle="Project Portal"
            userRole="Project Head"
        >
            {renderContent()}
        </DashboardLayout>
    );
}

export default ProjectHeadDashboard;

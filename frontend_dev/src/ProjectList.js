import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from './config';

function ProjectList() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showMyProjects, setShowMyProjects] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, [showMyProjects]);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('access_token');
            const url = `${API_BASE_URL}/projects${showMyProjects ? '?created_by_me=true' : ''}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setProjects(data);
            } else {
                setError(data.detail || 'Failed to fetch projects');
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

    const handleDelete = async (projectId) => {
        if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            return;
        }

        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to delete project');
            }

            setProjects(projects.filter(p => p.id !== projectId));
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    if (loading && projects.length === 0) return <div>Loading projects...</div>;
    // Don't show error immediately if just switching filter? Or keep as is.
    if (error) return <div className="alert alert-danger">{error}</div>;

    return (
        <div className="table-card">
            <div className="list-header">
                <div>
                    <h3>Projects</h3>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginTop: '4px' }}>Overview of all ongoing and completed projects</p>
                </div>

                {/* Modern Filter Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-dark)', fontWeight: '500', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={showMyProjects}
                            onChange={(e) => setShowMyProjects(e.target.checked)}
                            style={{ marginRight: '8px', accentColor: 'var(--primary-green)' }}
                        />
                        Show Assigned by Me
                    </label>
                </div>
            </div>

            {projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No projects found.</p>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Project Title</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Deadline</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(project => (
                                <tr key={project.id}>
                                    <td>
                                        <Link
                                            to={`/projects/${project.id}`}
                                            style={{
                                                fontWeight: '600',
                                                color: 'var(--primary-green)',
                                                textDecoration: 'none',
                                                display: 'block'
                                            }}
                                            onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                                            onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                                        >
                                            {project.title}
                                        </Link>
                                        <span style={{ fontSize: '0.8rem', color: '#999' }}>ID: {project.id.substring(0, 8)}...</span>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '4px 10px',
                                            backgroundColor: '#f3f4f6',
                                            borderRadius: '6px',
                                            fontSize: '0.85rem',
                                            color: '#374151'
                                        }}>
                                            {project.category}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${project.status === 'Completed' ? 'badge-success' :
                                            project.status === 'In Progress' ? 'badge-warning' : 'badge-gray'
                                            }`}>
                                            {project.status}
                                        </span>
                                    </td>
                                    <td>{new Date(project.deadline).toLocaleDateString()}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <Link to={`/projects/${project.id}`} className="icon-btn" style={{ textDecoration: 'none', display: 'inline-block', marginRight: '5px' }} title="View">
                                            👁️
                                        </Link>
                                        <button
                                            className="icon-btn delete"
                                            title="Delete"
                                            onClick={() => handleDelete(project.id)}
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

export default ProjectList;

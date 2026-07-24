import React, { useState } from 'react';
import { API_BASE_URL } from './config';

function CreateReport({ role }) { // role: 'student' or 'faculty'
    const [reportData, setReportData] = useState({
        title: '',
        content: '',
        project_id: '', // Ideally dropdown
        target_id: '' // faculty_id or project_head_id
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleChange = (e) => {
        setReportData({
            ...reportData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        const endpoint = role === 'student' ? `${API_BASE_URL}/reports/student` : `${API_BASE_URL}/reports/faculty`;

        // Transform data for backend expectations
        const payload = {
            title: reportData.title,
            content: reportData.content,
            project_id: reportData.project_id
        };

        if (role === 'student') {
            payload.faculty_id = reportData.target_id;
        } else {
            payload.project_head_id = reportData.target_id;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: 'Report submitted successfully!' });
                setReportData({ title: '', content: '', project_id: '', target_id: '' });
            } else {
                setMessage({ type: 'error', text: data.detail || 'Failed to submit report' });
            }
        } catch (error) {
            let message = error.message;
            if (message === 'Failed to fetch') {
                message = 'Unable to connect to the server. Please check your internet connection or try again later.';
            } else if (message.includes('Unexpected token')) {
                message = 'Server encountered an error. Please try again.';
            }
            setMessage({ type: 'error', text: message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card-header">
            <h3>Submit {role === 'student' ? 'Student' : 'Faculty'} Report</h3>
            {message.text && (
                <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'}`}>
                    {message.text}
                </div>
            )}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Report Title</label>
                    <input type="text" name="title" value={reportData.title} onChange={handleChange} required className="form-control" />
                </div>

                <div className="form-group">
                    <label>Content</label>
                    <textarea name="content" value={reportData.content} onChange={handleChange} required className="form-control" rows="4" />
                </div>

                <div className="form-group">
                    <label>Project ID (UUID)</label>
                    <input type="text" name="project_id" value={reportData.project_id} onChange={handleChange} required className="form-control" placeholder="Enter Project UUID" />
                </div>

                <div className="form-group">
                    <label>{role === 'student' ? 'Faculty ID (UUID)' : 'Project Head ID (UUID)'}</label>
                    <input type="text" name="target_id" value={reportData.target_id} onChange={handleChange} required className="form-control" placeholder={`Enter ${role === 'student' ? 'Faculty' : 'Project Head'} UUID`} />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Report'}
                </button>
            </form>
        </div>
    );
}

export default CreateReport;

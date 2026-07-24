import React from 'react';
import { useNavigate } from 'react-router-dom';

function LogoutButton() {
    const navigate = useNavigate();

    const handleLogout = () => {
        // Clear all auth data
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        sessionStorage.removeItem('role_key');

        // Redirect to login
        navigate('/login');
    };

    return (
        <button
            onClick={handleLogout}
            className="logout-btn"
            style={{
                marginTop: 'auto',
                padding: '10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
            }}
        >
            Logout
        </button>
    );
}

export default LogoutButton;

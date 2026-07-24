import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const token = sessionStorage.getItem('access_token');

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && allowedRoles.length > 0) {
        // Decode token to check role (simplified, ideally use a library or store role in localStorage on login)
        // Since we don't have a library installed yet, let's rely on what we stored or fetch /me.
        // For now, let's assume we store 'user_role' in localStorage for quick checks, 
        // though it's easily manipulatable by user.
        // Better approach: Since backend validates every request, frontend check is UI only.
        // Let's modify Login.js to store role_key too.

        const userRole = sessionStorage.getItem('role_key');
        if (!allowedRoles.includes(userRole)) {
            return <Navigate to="/" replace />; // Unauthorized, go home
        }
    }

    return children;
};

export default ProtectedRoute;

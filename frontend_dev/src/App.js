import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import ProtectedRoute from './components/ProtectedRoute';

// Lazy load components
const Login = lazy(() => import('./Login'));
const Signup = lazy(() => import('./Signup'));
const VerifyOTP = lazy(() => import('./VerifyOTP'));
const ForgotPassword = lazy(() => import('./ForgotPassword'));
const ResetPassword = lazy(() => import('./ResetPassword'));
const SuperAdminDashboard = lazy(() => import('./SuperAdminDashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const StudentDashboard = lazy(() => import('./StudentDashboard'));
const FacultyDashboard = lazy(() => import('./FacultyDashboard'));
const ProjectHeadDashboard = lazy(() => import('./ProjectHeadDashboard'));
const LandingPage = lazy(() => import('./LandingPage'));
const ProjectDetails = lazy(() => import('./ProjectDetails'));

// Loading component
const Loading = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    color: 'var(--primary-green)'
  }}>
    Loading...
  </div>
);

function App() {
  return (
    <Router>
      <div className="App">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/superadmin"
              element={
                <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faculty"
              element={
                <ProtectedRoute allowedRoles={['FACULTY']}>
                  <FacultyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project-head"
              element={
                <ProtectedRoute allowedRoles={['PROJECT_HEAD']}>
                  <ProjectHeadDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;

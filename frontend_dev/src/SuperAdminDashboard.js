import React, { useState } from 'react';
import DashboardLayout from './components/DashboardLayout';
import CreateOrganization from './CreateOrganization';
import CreateOrgAdmin from './CreateOrgAdmin';
import OrgAdminList from './OrgAdminList';
import CreateProjectHead from './CreateProjectHead';

import OrganizationList from './components/OrganizationList';
import ProjectHeadList from './components/ProjectHeadList';
import ProjectList from './ProjectList';

function SuperAdminDashboard() {
    const [activeTab, setActiveTab] = useState('orgs');
    // viewMode: 'list' or 'create' or 'create-admin'
    const [viewMode, setViewMode] = useState('list');
    const [selectedOrg, setSelectedOrg] = useState(null);

    // Reset view mode when tab changes
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setViewMode('list');
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'orgs':
                if (viewMode === 'list') {
                    return (
                        <OrganizationList
                            onCreateNew={() => setViewMode('create')}
                            onCreateAdmin={(org) => {
                                setSelectedOrg(org);
                                setViewMode('manage-admins');
                            }}
                        />
                    );
                } else if (viewMode === 'manage-admins') {
                    return (
                        <OrgAdminList
                            org={selectedOrg}
                            onBack={() => setViewMode('list')}
                            onCreateCallback={() => setViewMode('create-admin')}
                        />
                    );
                } else if (viewMode === 'create-admin') {
                    return (
                        <div className="form-card">
                            <CreateOrgAdmin
                                org={selectedOrg}
                                onBack={() => setViewMode('manage-admins')}
                            />
                        </div>
                    );
                } else {
                    return (
                        <div className="form-card">
                            <div style={{ marginBottom: '20px' }}>
                                <button onClick={() => setViewMode('list')} className="btn-secondary">
                                    &larr; Back to List
                                </button>
                            </div>
                            <CreateOrganization />
                        </div>
                    );
                }
            case 'project-heads':
                if (viewMode === 'list') {
                    return (
                        <ProjectHeadList onCreateNew={() => setViewMode('create')} />
                    );
                } else {
                    return (
                        <div className="form-card">
                            <div style={{ marginBottom: '20px' }}>
                                <button onClick={() => setViewMode('list')} className="btn-secondary">
                                    &larr; Back to List
                                </button>
                            </div>
                            <CreateProjectHead />
                        </div>
                    );
                }
            case 'projects':
                return <ProjectList />;
            default:
                return <div className="form-card"><h3>Coming Soon</h3><p>This module is under development.</p></div>;
        }
    };

    const getTitle = () => {
        switch (activeTab) {
            case 'orgs': return viewMode === 'list' ? 'Organizations' : 'Create Organization';
            case 'project-heads': return viewMode === 'list' ? 'Project Heads' : 'Create Project Head';
            case 'projects': return 'All Projects';
            default: return 'Dashboard';
        }
    }

    const navItems = [
        { id: 'orgs', label: 'Organizations' },
        { id: 'project-heads', label: 'Project Heads' },
        { id: 'projects', label: 'View All Projects' },
        { id: 'reports', label: 'Reports (Coming Soon)' },
        { id: 'settings', label: 'Settings' }
    ];

    return (
        <DashboardLayout
            activeTab={activeTab}
            onTabChange={handleTabChange}
            title={getTitle()}
            navItems={navItems}
            sidebarTitle="Super Admin"
            userRole="Super Admin"
        >
            {renderContent()}
        </DashboardLayout>
    );
}

export default SuperAdminDashboard;

import React from 'react';
import LogoutButton from './LogoutButton';

function Sidebar({ activeTab, onTabChange, isOpen, onClose, navItems, title = "Udyaan Admin", themeColor = "#4f46e5" }) {
    return (
        <>
            <div className={`overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
            <div className={`dashboard-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header" onClick={() => navItems.length > 0 && onTabChange(navItems[0].id)} style={{ cursor: 'pointer' }}>
                    <img src="https://udyaan-assets.s3.ap-south-1.amazonaws.com/Udyaan.svg" alt="Udyaan Logo" style={{ height: '40px', width: 'auto' }} />
                </div>
                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <div
                            key={item.id}
                            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => {
                                onTabChange(item.id);
                                if (window.innerWidth <= 768) onClose();
                            }}
                            style={activeTab === item.id ? { borderLeftColor: themeColor, color: '#fff', backgroundColor: '#252830' } : {}}
                        >
                            <span style={activeTab === item.id ? { color: themeColor } : {}}>
                                {item.label}
                            </span>
                        </div>
                    ))}
                </nav>
                <div style={{ padding: '0 20px 20px', marginTop: 'auto' }}>
                    <LogoutButton />
                </div>
            </div>
        </>
    );
}

export default Sidebar;

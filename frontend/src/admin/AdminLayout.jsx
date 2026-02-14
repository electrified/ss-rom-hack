import React from 'react';
import { useAdminAuth } from './AdminAuthContext';
import AdminLogin from './AdminLogin';
import './AdminDashboard.css';

function AdminLayout({ children }) {
  const { isAuthenticated, logout } = useAdminAuth();

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <h1>SS MD Hack Admin</h1>
        <nav className="admin-nav">
          <a href="#/admin">Dashboard</a>
          <a href="#/admin/sessions">Sessions</a>
          <a href="#/admin/requests">Requests</a>
          <a href="#/admin/roms">ROMs</a>
          <button 
            onClick={logout}
            className="secondary"
            style={{ marginLeft: '1rem' }}
          >
            Logout
          </button>
        </nav>
      </header>
      
      <main className="admin-content">
        {children}
      </main>
    </div>
  );
}

export default AdminLayout;

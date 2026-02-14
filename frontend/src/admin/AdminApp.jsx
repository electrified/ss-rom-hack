import React from 'react';
import { AdminAuthProvider } from './AdminAuthContext';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import SessionsList from './SessionsList';

function AdminApp({ page }) {
  const renderContent = () => {
    switch (page) {
      case 'sessions':
        return <SessionsList />;
      case 'requests':
        return <div className="card"><h3>Request Log</h3><p>Coming soon...</p></div>;
      case 'roms':
        return <div className="card"><h3>ROM Management</h3><p>Coming soon...</p></div>;
      case 'dashboard':
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <AdminAuthProvider>
      <AdminLayout>
        {renderContent()}
      </AdminLayout>
    </AdminAuthProvider>
  );
}

export default AdminApp;

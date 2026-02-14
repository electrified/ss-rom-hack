import React, { useState } from 'react';
import { useAdminAuth } from './AdminAuthContext';
import './AdminDashboard.css';

function AdminLayout({ children }) {
  const { isAuthenticated, login, logout, error } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(username, password);
    setLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#0a0e27',
      }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>
            Admin Login
          </h2>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
            
            {error && (
              <div className="error-message" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
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

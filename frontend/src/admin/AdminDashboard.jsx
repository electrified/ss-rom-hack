import React, { useState, useEffect } from 'react';
import { getAdminStats } from './api';
import './AdminDashboard.css';

function StatCard({ title, value, subtitle, color = 'blue' }) {
  const colors = {
    blue: { bg: '#0f3460', text: '#00d4ff' },
    green: { bg: '#064e3b', text: '#34d399' },
    yellow: { bg: '#713f12', text: '#facc15' },
    red: { bg: '#7f1d1d', text: '#f87171' },
  };
  
  const theme = colors[color] || colors.blue;
  
  return (
    <div className="stat-card" style={{
      background: theme.bg,
      padding: '1.5rem',
      borderRadius: '8px',
      border: `1px solid ${theme.text}30`,
    }}>
      <h3 style={{ margin: 0, color: theme.text, fontSize: '2rem' }}>
        {value}
      </h3>
      <p style={{ margin: '0.5rem 0 0 0', color: '#fff', opacity: 0.8 }}>
        {title}
      </p>
      {subtitle && (
        <small style={{ color: '#fff', opacity: 0.6 }}>
          {subtitle}
        </small>
      )}
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
      setError(null);
    } catch (err) {
      if (err.message === 'Unauthorized') {
        // Handled by auth context
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="error-message">
        Failed to load dashboard: {error}
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <h2>Dashboard</h2>
      
      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <StatCard
          title="Sessions (24h)"
          value={stats?.sessions?.['24h'] || 0}
          subtitle={`${stats?.sessions?.['7d'] || 0} this week`}
          color="blue"
        />
        <StatCard
          title="Uploads (24h)"
          value={stats?.uploads?.['24h'] || 0}
          subtitle={`${stats?.uploads?.['7d'] || 0} this week`}
          color="green"
        />
        <StatCard
          title="Validation Failures"
          value={stats?.validations?.failures_24h || 0}
          subtitle="Last 24 hours"
          color="yellow"
        />
        <StatCard
          title="Unique ROMs"
          value={stats?.roms?.unique || 0}
          subtitle="Total stored"
          color="blue"
        />
        <StatCard
          title="Requests (24h)"
          value={stats?.requests?.total_24h || 0}
          subtitle={`${stats?.requests?.errors_24h || 0} errors`}
          color={stats?.requests?.errors_24h > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="quick-links" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
      }}>
        <div className="card">
          <h3>Sessions</h3>
          <p>View all active and recent sessions</p>
          <a href="#/admin/sessions" className="button">View Sessions</a>
        </div>
        
        <div className="card">
          <h3>Request Log</h3>
          <p>View HTTP request history and errors</p>
          <a href="#/admin/requests" className="button">View Requests</a>
        </div>
        
        <div className="card">
          <h3>ROMs</h3>
          <p>Manage stored ROM files</p>
          <a href="#/admin/roms" className="button">View ROMs</a>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

import React, { useState, useEffect } from 'react';
import { getAdminStats, listUploads } from './api';
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
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, uploadsData] = await Promise.all([
          getAdminStats(),
          listUploads(1, 10),
        ]);
        setStats(statsData);
        setUploads(uploadsData.uploads || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
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
          title="Uploads (24h)"
          value={stats?.uploads?.['24h'] || 0}
          subtitle={`${stats?.uploads?.['7d'] || 0} this week`}
          color="blue"
        />
        <StatCard
          title="Uploads (30d)"
          value={stats?.uploads?.['30d'] || 0}
          subtitle="Last 30 days"
          color="green"
        />
        <StatCard
          title="Validation Failures"
          value={stats?.validations?.failures_24h || 0}
          subtitle="Last 24 hours"
          color="yellow"
        />
      </div>

      <h3>Recent Uploads</h3>
      {uploads.length === 0 ? (
        <p>No uploads yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Session</th>
              <th>Filename</th>
              <th>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <tr key={upload.id}>
                <td>{upload.id}</td>
                <td>{upload.session_id?.substring(0, 8)}...</td>
                <td>{upload.filename || '-'}</td>
                <td>{upload.uploaded_at ? new Date(upload.uploaded_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminDashboard;

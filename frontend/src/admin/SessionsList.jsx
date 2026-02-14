import React, { useState, useEffect } from 'react';
import { listSessions } from './api';

function SessionsList() {
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = async (page = 1) => {
    try {
      setLoading(true);
      const data = await listSessions(page);
      setSessions(data.sessions);
      setPagination({
        page: data.page,
        pages: data.pages,
        total: data.total,
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => fetchSessions(pagination.page), 30000);
    return () => clearInterval(interval);
  }, [pagination.page]);

  if (loading && sessions.length === 0) {
    return <div className="loading">Loading sessions...</div>;
  }

  return (
    <div className="sessions-list">
      <h2>Sessions</h2>
      
      {error && (
        <div className="error-message">{error}</div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Edition</th>
            <th>Size</th>
            <th>Uploads</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>{session.id.substring(0, 8)}...</td>
              <td>{session.edition}</td>
              <td>{(session.size_bytes / 1024).toFixed(0)} KB</td>
              <td>{session.upload_count}</td>
              <td>{new Date(session.created_at).toLocaleString()}</td>
              <td>
                <a href={`#/admin/sessions/${session.id}`} className="button small">
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination" style={{ marginTop: '1rem' }}>
        <button
          onClick={() => fetchSessions(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          Previous
        </button>
        <span style={{ margin: '0 1rem' }}>
          Page {pagination.page} of {pagination.pages} ({pagination.total} total)
        </span>
        <button
          onClick={() => fetchSessions(pagination.page + 1)}
          disabled={pagination.page >= pagination.pages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default SessionsList;

import { useState } from 'react';

export default function DownloadButton({ sessionId, teamsJson, onDownload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await onDownload();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="download-section">
      <button 
        className="btn-primary" 
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Generating ROM...' : 'Download Modified ROM'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

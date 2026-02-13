import React from 'react';

function TeamsSummary({ romInfo, teamsJson, onDownloadJson }) {
  const handleDownload = () => {
    // Convert teams JSON to string with nice formatting
    const jsonStr = JSON.stringify(teamsJson, null, 2);
    
    // Create a blob and download
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    if (onDownloadJson) {
      onDownloadJson();
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const totalTeams = Object.values(romInfo.teams_count).reduce((a, b) => a + b, 0);

  return (
    <div className="card">
      <h2>Step 2: ROM Information</h2>
      
      <div className="info-grid">
        <div className="info-item">
          <div className="label">Edition</div>
          <div className="value" style={{ textTransform: 'capitalize' }}>
            {romInfo.edition}
          </div>
        </div>
        <div className="info-item">
          <div className="label">File Size</div>
          <div className="value">{formatFileSize(romInfo.size)}</div>
        </div>
        <div className="info-item">
          <div className="label">Total Teams</div>
          <div className="value">{totalTeams}</div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem', color: '#888' }}>Team Counts</h3>
      <div className="info-grid">
        <div className="info-item">
          <div className="label">National Teams</div>
          <div className="value">{romInfo.teams_count.national}</div>
        </div>
        <div className="info-item">
          <div className="label">Club Teams</div>
          <div className="value">{romInfo.teams_count.club}</div>
        </div>
        <div className="info-item">
          <div className="label">Custom Teams</div>
          <div className="value">{romInfo.teams_count.custom}</div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem', color: '#888' }}>
          Download the decoded teams JSON, edit it with your changes, then upload the modified file.
        </p>
        <button onClick={handleDownload}>
          Download teams.json
        </button>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#0f3460', borderRadius: '8px', fontSize: '0.9rem' }}>
        <strong style={{ color: '#00d4ff' }}>Tip:</strong> Use any text editor or JSON editor to modify team names, 
        player names, tactics, and colors. Make sure to keep the JSON structure intact!
      </div>
    </div>
  );
}

export default TeamsSummary;

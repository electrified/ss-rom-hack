import React from 'react';

function TeamsSummary({ romInfo, teamsJson }) {
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const totalTeams = Object.values(romInfo.teams_count).reduce((a, b) => a + b, 0);

  return (
    <div className="card">
      <h2>ROM Information</h2>

      <div className="info-grid">
        <div className="info-item">
          <div className="label">Edition</div>
          <div className="value text-value">{romInfo.edition}</div>
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
    </div>
  );
}

export default TeamsSummary;

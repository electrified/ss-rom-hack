export default function TeamsSummary({ romInfo, teamsJson, onDownloadJson }) {
  const total = romInfo.teams_count.national + romInfo.teams_count.club + romInfo.teams_count.custom;

  const downloadJson = () => {
    const data = { $schema: './teams.schema.json', ...teamsJson };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="summary-section">
      <h2>ROM Info</h2>
      <div className="info-grid">
        <div className="info-item">
          <span className="label">Edition:</span>
          <span className="value">{romInfo.edition}</span>
        </div>
        <div className="info-item">
          <span className="label">Size:</span>
          <span className="value">{(romInfo.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div className="info-item">
          <span className="label">Total Teams:</span>
          <span className="value">{total}</span>
        </div>
        <div className="info-item">
          <span className="label">National:</span>
          <span className="value">{romInfo.teams_count.national}</span>
        </div>
        <div className="info-item">
          <span className="label">Club:</span>
          <span className="value">{romInfo.teams_count.club}</span>
        </div>
        <div className="info-item">
          <span className="label">Custom:</span>
          <span className="value">{romInfo.teams_count.custom}</span>
        </div>
      </div>
      <button className="btn-secondary" onClick={downloadJson}>
        Download JSON
      </button>
    </div>
  );
}

import React from 'react';

export default function DownloadButton({ sessionId, teamsJson, onGenerate, disabled, loading }) {
  const handleClick = () => {
    onGenerate();
  };

  return (
    <div className="step">
      <h2>5. Download Modified ROM</h2>
      <button 
        onClick={handleClick} 
        disabled={disabled || loading}
        className="download-btn"
      >
        {loading ? 'Generating ROM...' : 'Download Modified ROM'}
      </button>
    </div>
  );
}

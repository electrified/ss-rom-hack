import React, { useState, useEffect } from 'react';
import { updateRom } from '../lib/sslib/index';

function DownloadButton({ romBytes, teamsJson, jsonFileName, disabled, onSuccess }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [downloadedFileName, setDownloadedFileName] = useState(null);

  useEffect(() => {
    setSuccess(false);
    setDownloadedFileName(null);
    setError(null);
  }, [teamsJson]);

  const generateFileName = () => {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    
    if (jsonFileName) {
      // Remove .json extension and add timestamp
      const baseName = jsonFileName.replace(/\.json$/i, '');
      return `${baseName}_${timestamp}.md`;
    }
    
    return `modified_rom_${timestamp}.md`;
  };

  const handleDownload = async () => {
    if (disabled || !romBytes || !teamsJson) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(false);
    setDownloadedFileName(null);

    try {
      const fileName = generateFileName();
      const modifiedRom = updateRom(romBytes, teamsJson);
      const blob = new Blob([modifiedRom], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setDownloadedFileName(fileName);
      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="card">
      <h2>Step 4: Generate ROM</h2>
      <p>Download your modified ROM file with all the changes applied.</p>

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button 
          onClick={handleDownload}
          disabled={disabled || isGenerating}
          style={{ minWidth: '250px' }}
        >
          {isGenerating ? (
            <>
              <span className="spinner" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}></span>
              Building ROM...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download Modified ROM
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && downloadedFileName && (
        <div className="success-message">
          <strong>Success!</strong> Your modified ROM has been downloaded as <code>{downloadedFileName}</code>
          <br />
          <small>You can now upload another JSON file to make additional changes.</small>
        </div>
      )}

      <div className="tip-box">
        <strong>Next Steps:</strong>
        <ul>
          <li>Use an emulator to test your modified ROM</li>
          <li>If you encounter issues, check the validation warnings above</li>
          <li>Upload another JSON file to make additional changes without re-uploading the ROM</li>
        </ul>
      </div>
    </div>
  );
}

export default DownloadButton;

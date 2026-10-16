import React, { useState, useEffect } from 'react';
import ui from './ui';

const styles = {
  download: 'mt-6',
  action: 'text-center',
  button: 'min-w-[250px]',
  spinner: 'mr-2 align-middle',
  icon: 'mr-2 align-middle',
};
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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.download}>
      <div className={styles.action}>
        <button
          onClick={handleDownload}
          disabled={disabled || isGenerating}
          className={`${ui.button} ${styles.button}`}
        >
          {isGenerating ? (
            <>
              <span className={`${ui.spinner} ${styles.spinner}`}></span>
              Building ROM...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.icon}>
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
        <div className={ui.errorMessage}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && downloadedFileName && (
        <div className={ui.successMessage}>
          <strong>Success!</strong> Your modified ROM has been downloaded as <code>{downloadedFileName}</code>
        </div>
      )}
    </div>
  );
}

export default DownloadButton;

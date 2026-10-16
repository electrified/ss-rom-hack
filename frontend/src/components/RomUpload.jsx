import React, { useState, useRef, useEffect } from 'react';
import ui from './ui';

const styles = {
  uploadArea: 'block w-full cursor-pointer rounded-lg border-2 border-dashed border-ui-border-upload bg-transparent px-8 py-12 text-center [font:inherit] text-inherit transition-all duration-300 hover:border-ui-accent-bright hover:bg-ui-accent-bright-05 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ui-heading [&_p]:mb-4 [&_p]:text-ui-text-muted',
  dragover: 'border-ui-accent-bright! bg-ui-accent-bright-10!',
  fileTypes: 'text-[0.85rem] text-ui-text-dim!',
  fileInput: 'hidden',
  tipBox: 'my-6 rounded-lg border border-solid border-ui-border-tip border-l-[3px] border-l-ui-accent bg-ui-surface-raised p-4 text-[0.9rem] text-ui-text-soft',
  uploadIcon: 'mb-4 opacity-70',
};
import { decodeRom } from '../lib/sslib/index';

function RomUpload({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const requestRef = useRef(0);
  useEffect(() => () => { requestRef.current++; }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
    e.target.value = '';
  };

  const handleFile = async (file) => {
    const request = ++requestRef.current;
    setIsLoading(false);
    // Validate file type (ROM files are typically .md or .bin)
    if (!file.name.match(/\.(md|bin)$/i)) {
      setError('Please open a valid ROM file (.md or .bin)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      if (request !== requestRef.current) return;
      const romBytes = new Uint8Array(buffer);
      const teamsJson = decodeRom(romBytes);

      const romInfo = {
        edition: 'mega drive',
        size: file.size,
        teams_count: {
          national: teamsJson.national.length,
          club: teamsJson.club.length,
          custom: teamsJson.custom.length,
        },
      };

      onUploadSuccess({ romBytes, romInfo, teamsJson });
    } catch (err) {
      if (request === requestRef.current) setError(err.message || 'Failed to decode ROM. Make sure this is a valid Sensible Soccer Mega Drive ROM.');
    } finally {
      if (request === requestRef.current) setIsLoading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="card">
      <h2>Step 1: Open ROM</h2>
      <p>Open your Sensible Soccer Mega Drive ROM to get started.</p>
      <div className={styles.tipBox}>
        All processing happens locally in your browser, nothing is uploaded to a server.
      </div>
      
      <button type="button" aria-label="Open ROM file"
        className={`${styles.uploadArea} ${isDragging ? styles.dragover : ''}`}
        data-testid="upload-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {isLoading ? (
          <>
            <div className={ui.spinner}></div>
            <p>Decoding ROM...</p>
          </>
        ) : (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" className={styles.uploadIcon}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>Drag and drop your ROM file here, or click to browse</p>
            <p className={styles.fileTypes}>Supported: .md, .bin files</p>
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        className={styles.fileInput}
        data-testid="file-input"
        accept=".md,.bin"
        onChange={handleFileInput}
      />

      {error && (
        <div className={ui.errorMessage} role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

export default RomUpload;

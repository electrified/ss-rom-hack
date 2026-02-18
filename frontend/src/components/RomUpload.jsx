import React, { useState, useRef, useCallback } from 'react';
import { decodeRom } from '../lib/sslib/index';

function RomUpload({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFile = async (file) => {
    // Validate file type (ROM files are typically .md or .bin)
    if (!file.name.match(/\.(md|bin)$/i)) {
      setError('Please upload a valid ROM file (.md or .bin)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
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
      setError(err.message || 'Failed to decode ROM. Make sure this is a valid Sensible Soccer Mega Drive ROM.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="card">
      <h2>Step 1: Upload ROM</h2>
      <p>Upload your Sensible Soccer ROM file to get started. All processing happens locally in your browser — nothing is uploaded to a server.</p>
      
      <div
        className={`upload-area ${isDragging ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {isLoading ? (
          <>
            <div className="spinner"></div>
            <p>Decoding ROM...</p>
          </>
        ) : (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '1rem', opacity: 0.5 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>Drag and drop your ROM file here, or click to browse</p>
            <p className="file-types">Supported: .md, .bin files</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="file-input"
        accept=".md,.bin"
        onChange={handleFileInput}
      />

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

export default RomUpload;

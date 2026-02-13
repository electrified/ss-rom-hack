import React, { useState, useRef, useCallback } from 'react';
import { validateTeams } from '../api';

function JsonUpload({ sessionId, onValidationComplete, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
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
    // Validate file type
    if (!file.name.endsWith('.json')) {
      setError('Please upload a JSON file (.json)');
      return;
    }

    setIsValidating(true);
    setError(null);
    setFileName(file.name);

    try {
      // Read the file
      const text = await file.text();
      const teamsJson = JSON.parse(text);

      // Validate against the ROM
      const result = await validateTeams(sessionId, teamsJson);
      
      // Pass result and the JSON back to parent
      onValidationComplete(result, teamsJson);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file. Please check your file syntax.');
      } else {
        setError(err.message);
      }
      onValidationComplete(null, null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="card">
      <h2>Step 3: Upload Modified JSON</h2>
      <p>Upload your modified teams.json file to validate the changes.</p>
      
      <div
        className={`upload-area ${isDragging ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
      >
        {isValidating ? (
          <>
            <div className="spinner"></div>
            <p>Validating your changes...</p>
          </>
        ) : (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '1rem', opacity: 0.5 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <p>Drag and drop your modified teams.json here, or click to browse</p>
            <p className="file-types">Supported: .json files</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="file-input"
        accept=".json"
        onChange={handleFileInput}
        disabled={disabled}
      />

      {fileName && !error && (
        <div className="file-info">
          <span className="filename">{fileName}</span>
          <span style={{ color: '#2ecc71' }}>✓ Uploaded</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

export default JsonUpload;

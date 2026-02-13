import React, { useState } from 'react';

export default function JsonUpload({ sessionId, teamsJson, onValidate, loading, error }) {
  const [localError, setLocalError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setLocalError(null);
      onValidate(json);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.json')) return;
    
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setLocalError(null);
      onValidate(json);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="step">
      <h2>3. Upload Modified JSON</h2>
      <div
        className="dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <p>Drag & drop your modified .json file here</p>
        <p>or</p>
        <input
          type="file"
          accept=".json"
          onChange={handleFileChange}
          disabled={loading}
        />
      </div>
      {loading && <p className="loading">Validating JSON...</p>}
      {(error || localError) && <p className="error">{error || localError}</p>}
    </div>
  );
}

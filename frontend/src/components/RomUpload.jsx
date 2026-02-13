import React from 'react';

export default function RomUpload({ onUpload, loading, error }) {
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.md')) {
      onUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="step">
      <h2>1. Upload ROM</h2>
      <div
        className="dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <p>Drag & drop a .md ROM file here</p>
        <p>or</p>
        <input
          type="file"
          accept=".md"
          onChange={handleFileChange}
          disabled={loading}
        />
      </div>
      {loading && <p className="loading">Processing ROM...</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

import { useState, useRef } from 'react';

export default function RomUpload({ onUpload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.md')) {
      setError('Please upload a .md file (Mega Drive ROM)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onUpload(file);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleChange = (e) => {
    handleFile(e.target.files[0]);
  };

  return (
    <div className="upload-section">
      <h2>Upload ROM</h2>
      <div
        className={`dropzone ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {loading ? (
          <p>Processing ROM...</p>
        ) : (
          <p>Drop a Sensible Soccer ROM (.md) here or click to browse</p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".md"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

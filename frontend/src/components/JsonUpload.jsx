import { useState, useRef } from 'react';

export default function JsonUpload({ sessionId, onValidate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setError('Please upload a .json file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const teamsJson = JSON.parse(text);
      await onValidate(teamsJson);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError('Invalid JSON file');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    handleFile(e.target.files[0]);
  };

  return (
    <div className="upload-section">
      <h2>Upload Modified JSON</h2>
      <p>Upload your edited teams.json file to validate and generate a new ROM.</p>
      <div className="file-input-wrapper">
        <button 
          className="btn-secondary" 
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Select JSON File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

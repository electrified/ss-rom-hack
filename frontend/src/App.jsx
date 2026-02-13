import React, { useState } from 'react';
import RomUpload from './components/RomUpload';
import TeamsSummary from './components/TeamsSummary';
import JsonUpload from './components/JsonUpload';
import ValidationResults from './components/ValidationResults';
import DownloadButton from './components/DownloadButton';
import { uploadRom, validateTeams, generateRom } from './api';

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [romInfo, setRomInfo] = useState(null);
  const [teamsJson, setTeamsJson] = useState(null);
  const [modifiedJson, setModifiedJson] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generateLoading, setGenerateLoading] = useState(false);

  const handleUploadRom = async (file) => {
    setLoading(true);
    setError(null);
    try {
      const result = await uploadRom(file);
      setSessionId(result.session_id);
      setRomInfo(result.rom_info);
      setTeamsJson(result.teams_json);
      setModifiedJson(null);
      setValidationResults(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!teamsJson) return;
    const blob = new Blob([JSON.stringify(teamsJson, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleValidate = async (json) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      setModifiedJson(json);
      const result = await validateTeams(sessionId, json);
      setValidationResults(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRom = async () => {
    if (!sessionId || !modifiedJson) return;
    setGenerateLoading(true);
    setError(null);
    try {
      await generateRom(sessionId, modifiedJson);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerateLoading(false);
    }
  };

  const isValid = validationResults?.valid;

  return (
    <div className="app">
      <h1>Sensible Soccer ROM Editor</h1>
      
      <RomUpload 
        onUpload={handleUploadRom} 
        loading={loading}
        error={error}
      />
      
      {romInfo && (
        <TeamsSummary 
          romInfo={romInfo}
          teamsJson={teamsJson}
          onDownloadJson={handleDownloadJson}
        />
      )}
      
      {sessionId && (
        <JsonUpload 
          sessionId={sessionId}
          teamsJson={teamsJson}
          onValidate={handleValidate}
          loading={loading}
          error={error}
        />
      )}
      
      <ValidationResults results={validationResults} />
      
      {modifiedJson && (
        <DownloadButton 
          sessionId={sessionId}
          teamsJson={modifiedJson}
          onGenerate={handleGenerateRom}
          disabled={!isValid}
          loading={generateLoading}
        />
      )}
    </div>
  );
}

export default App;

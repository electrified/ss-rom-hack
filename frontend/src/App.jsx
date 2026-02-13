import { useState } from 'react';
import RomUpload from './components/RomUpload';
import TeamsSummary from './components/TeamsSummary';
import JsonUpload from './components/JsonUpload';
import ValidationResults from './components/ValidationResults';
import DownloadButton from './components/DownloadButton';
import { uploadRom, validateTeams, generateRom } from './api';

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [romInfo, setRomInfo] = useState(null);
  const [teamsJson, setTeamsJson] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [modifiedJson, setModifiedJson] = useState(null);

  const handleUpload = async (file) => {
    const result = await uploadRom(file);
    setSessionId(result.session_id);
    setRomInfo(result.rom_info);
    setTeamsJson(result.teams_json);
    setValidationResults(null);
    setModifiedJson(null);
  };

  const handleValidate = async (json) => {
    setModifiedJson(json);
    const result = await validateTeams(sessionId, json);
    setValidationResults(result);
  };

  const handleDownload = async () => {
    await generateRom(sessionId, modifiedJson);
  };

  return (
    <div className="app">
      <header>
        <h1>Sensible Soccer ROM Editor</h1>
        <p>Upload a ROM, edit teams in JSON, and download your modified ROM</p>
      </header>

      <main>
        {!sessionId && <RomUpload onUpload={handleUpload} />}
        
        {sessionId && (
          <>
            <TeamsSummary 
              romInfo={romInfo} 
              teamsJson={teamsJson}
            />
            
            <JsonUpload 
              sessionId={sessionId}
              onValidate={handleValidate}
            />
            
            {validationResults && (
              <ValidationResults results={validationResults} />
            )}
            
            {validationResults?.valid && (
              <DownloadButton 
                sessionId={sessionId}
                teamsJson={modifiedJson}
                onDownload={handleDownload}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

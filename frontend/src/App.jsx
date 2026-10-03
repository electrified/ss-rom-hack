import React, { useState, useEffect, useRef, useMemo } from 'react';
import RomUpload from './components/RomUpload';
import TeamEditor from './components/TeamEditor';
import DownloadButton from './components/DownloadButton';
import MusicPlayer from './components/MusicPlayer';
import EditorBoundary from './components/EditorBoundary';
import { showCookiePreferences } from './cookieConsent';
import { validateTeams, extractRomStructure } from './lib/sslib/index';

function App() {
  const [currentStep, setCurrentStep] = useState('upload');
  const [romBytes, setRomBytes] = useState(null);
  const [romStructure, setRomStructure] = useState(null);
  const [teamsJson, setTeamsJson] = useState(null);
  const [documentId, setDocumentId] = useState(0);
  const [uploadId, setUploadId] = useState(0);
  const generation = useRef(0);
  const editorRef = useRef(null);
  const validation = useMemo(() => romStructure && teamsJson ? validateTeams(romStructure, teamsJson) : null, [romStructure, teamsJson]);
  const lastValid = useRef(null);
  useEffect(() => { if (validation?.valid) lastValid.current = teamsJson; }, [validation, teamsJson]);

  const handleUploadSuccess = (result) => {
    const structure = extractRomStructure(result.romBytes);
    generation.current++;
    setDocumentId(generation.current);
    lastValid.current = result.teamsJson;
    setRomBytes(result.romBytes);
    setRomStructure(structure);
    setTeamsJson(result.teamsJson);
    setCurrentStep('edit');
  };

  useEffect(() => {
    if (currentStep === 'edit' && editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentStep]);

  const handleTeamsChange = (newTeams) => {
    if (documentId === generation.current) setTeamsJson(newTeams);
  };

  const handleStartOver = () => {
    generation.current++;
    setDocumentId(generation.current);
    setUploadId(id => id + 1);
    lastValid.current = null;
    setCurrentStep('upload');
    setRomBytes(null);
    setRomStructure(null);
    setTeamsJson(null);
  };

  const errorCount = validation
    ? validation.global.length + Object.values(validation.teams).reduce(
      (sum, catTeams) => sum + Object.values(catTeams).reduce(
        (tSum, te) => tSum + te.team.length + te.formation.length +
          Object.values(te.players).reduce((pSum, msgs) => pSum + msgs.length, 0),
        0),
      0)
    : 0;

  return (
    <div className="app">
      <header>
        <div className="logo">
          <div className="logo-ball">⚽</div>
          <div className="logo-text">
            <span className="logo-sensible">SENSIBLE</span>
            <span className="logo-soccer">SOCCER</span>
          </div>
        </div>
        <p>Mega Drive ROM Editor</p>
        <MusicPlayer />
      </header>

      {/* Progress Steps */}
      <div className="steps">
        <div className={`step ${currentStep === 'upload' ? 'active' : 'completed'}`}>
          <div className="step-number">1</div>
          <div className="step-label">Open ROM</div>
        </div>
        <div className={`step ${currentStep === 'edit' ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Edit Teams</div>
        </div>
      </div>

      {/* Step 1: Open ROM */}
      <RomUpload key={uploadId} onUploadSuccess={handleUploadSuccess} />

      {/* Step 2: Edit Teams */}
      {currentStep !== 'upload' && teamsJson && romBytes && (
        <EditorBoundary key={documentId} teams={teamsJson} onRecover={() => {
          setTeamsJson(lastValid.current);
          generation.current++;
          setDocumentId(generation.current);
        }}>
        <TeamEditor
          ref={editorRef}
          teamsJson={teamsJson}
          onTeamsChange={handleTeamsChange}
          romStructure={romStructure}
          validation={validation}
        />
        </EditorBoundary>
      )}

      {/* Download ROM */}
      {currentStep !== 'upload' && (
        <div className="card">
          <h2>Download ROM</h2>

          {validation && !validation.valid && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              {errorCount} validation error{errorCount !== 1 ? 's' : ''} must be fixed before downloading.
              {validation.global.length > 0 && (
                <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                  {validation.global.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              )}
            </div>
          )}

          {validation?.budget && <p role="status">Team data: {validation.budget.used} / {validation.budget.capacity} bytes
            ({validation.budget.capacity - validation.budget.used} bytes remaining)</p>}
          <DownloadButton
            romBytes={romBytes}
            teamsJson={teamsJson}
            disabled={!validation?.valid}
          />
        </div>
      )}

      {/* Start Over Button */}
      {currentStep !== 'upload' && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button onClick={handleStartOver} className="secondary">
            Start Over (Open Another ROM)
          </button>
        </div>
      )}
      <footer>
        <button className="cookie-settings" onClick={showCookiePreferences}>Cookie settings</button>
        <div>v{__APP_VERSION__} &copy; 2026 Ed Brindley. Made in Sheffield and Coventry.</div>
        <div style={{ marginTop: '0.4rem', fontSize: '0.75em' }}>
          Unofficial fan project — not affiliated with or endorsed by Sensible Software or any rights holder.
          Sensible Soccer is a registered trademark of Electronic Arts Inc.
        </div>
      </footer>
    </div>
  );
}

export default App;

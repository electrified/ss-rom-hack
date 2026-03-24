import React, { useState, useEffect, useRef } from 'react';
import RomUpload from './components/RomUpload';
import TeamEditor from './components/TeamEditor';
import DownloadButton from './components/DownloadButton';
import MusicPlayer from './components/MusicPlayer';
import { validateTeams, extractRomStructure } from './lib/sslib/index';

function App() {
  const [currentStep, setCurrentStep] = useState('upload');
  const [romBytes, setRomBytes] = useState(null);
  const [romStructure, setRomStructure] = useState(null);
  const [teamsJson, setTeamsJson] = useState(null);
  const [validation, setValidation] = useState(null);
  const debounceRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!romStructure || !teamsJson) {
      setValidation(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setValidation(validateTeams(romStructure, teamsJson));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [romStructure, teamsJson]);

  const handleUploadSuccess = (result) => {
    setRomBytes(result.romBytes);
    setRomStructure(extractRomStructure(result.romBytes));
    setTeamsJson(result.teamsJson);
    setCurrentStep('edit');
  };

  useEffect(() => {
    if (currentStep === 'edit' && editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentStep]);

  const handleTeamsChange = (newTeams) => {
    setTeamsJson(newTeams);
  };

  const handleStartOver = () => {
    setCurrentStep('upload');
    setRomBytes(null);
    setRomStructure(null);
    setTeamsJson(null);
    setValidation(null);
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
        <p>ROM Editor — upload, edit, and generate modified ROM files</p>
        <p style={{ fontSize: '0.65rem', color: '#3d5e3d', marginTop: '0.5rem', fontFamily: 'inherit', letterSpacing: '0.03em' }}>
          Unofficial fan project — not affiliated with Sensible Software or any rights holder
        </p>
        <MusicPlayer />
      </header>

      {/* Progress Steps */}
      <div className="steps">
        <div className={`step ${currentStep === 'upload' ? 'active' : 'completed'}`}>
          <div className="step-number">1</div>
          <div className="step-label">Upload ROM</div>
        </div>
        <div className={`step ${currentStep === 'edit' ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Edit Teams</div>
        </div>
      </div>

      {/* Step 1: Upload ROM */}
      <RomUpload onUploadSuccess={handleUploadSuccess} />

      {/* Step 2: Edit Teams */}
      {currentStep !== 'upload' && teamsJson && romBytes && (
        <TeamEditor
          ref={editorRef}
          teamsJson={teamsJson}
          onTeamsChange={handleTeamsChange}
          romBytes={romBytes}
          validation={validation}
        />
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
            Start Over (Upload New ROM)
          </button>
        </div>
      )}
      <footer>
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

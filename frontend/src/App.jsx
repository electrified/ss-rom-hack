import React, { useState } from 'react';
import RomUpload from './components/RomUpload';
import TeamsSummary from './components/TeamsSummary';
import JsonUpload from './components/JsonUpload';
import ValidationResults from './components/ValidationResults';
import DownloadButton from './components/DownloadButton';
import MusicPlayer from './components/MusicPlayer';

function App() {
  const [currentStep, setCurrentStep] = useState('upload');
  const [romBytes, setRomBytes] = useState(null);
  const [romInfo, setRomInfo] = useState(null);
  const [teamsJson, setTeamsJson] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [modifiedTeamsJson, setModifiedTeamsJson] = useState(null);
  const [jsonFileName, setJsonFileName] = useState(null);
  const [isValid, setIsValid] = useState(false);

  const handleUploadSuccess = (result) => {
    setRomBytes(result.romBytes);
    setRomInfo(result.romInfo);
    setTeamsJson(result.teamsJson);
    setCurrentStep('summary');
    setValidationResults(null);
    setModifiedTeamsJson(null);
    setIsValid(false);
  };

  const handleValidationComplete = (results, json, fileName) => {
    setValidationResults(results);
    setModifiedTeamsJson(json);
    setJsonFileName(fileName);
    setIsValid(results && results.valid);
    if (results) {
      setCurrentStep('download');
    }
  };

  const handleReset = () => {
    setValidationResults(null);
    setModifiedTeamsJson(null);
    setJsonFileName(null);
    setIsValid(false);
    setCurrentStep('summary');
  };

  const handleStartOver = () => {
    setCurrentStep('upload');
    setRomBytes(null);
    setRomInfo(null);
    setTeamsJson(null);
    setValidationResults(null);
    setModifiedTeamsJson(null);
    setJsonFileName(null);
    setIsValid(false);
  };

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
        <MusicPlayer />
      </header>

      {/* Progress Steps */}
      <div className="steps">
        <div className={`step ${currentStep === 'upload' ? 'active' : ''} ${currentStep !== 'upload' ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Upload ROM</div>
        </div>
        <div className={`step ${currentStep === 'summary' ? 'active' : ''} ${['validate', 'download'].includes(currentStep) ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Download JSON</div>
        </div>
        <div className={`step ${currentStep === 'validate' ? 'active' : ''} ${currentStep === 'download' ? 'completed' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Validate</div>
        </div>
        <div className={`step ${currentStep === 'download' ? 'active' : ''}`}>
          <div className="step-number">4</div>
          <div className="step-label">Download ROM</div>
        </div>
      </div>

      {/* Step 1: Upload ROM */}
      <RomUpload onUploadSuccess={handleUploadSuccess} />

      {/* Step 2: Teams Summary */}
      {currentStep !== 'upload' && romInfo && teamsJson && (
        <TeamsSummary
          romInfo={romInfo}
          teamsJson={teamsJson}
        />
      )}

      {/* Step 3: Upload Modified JSON */}
      {currentStep !== 'upload' && romBytes && (
        <JsonUpload
          romBytes={romBytes}
          onValidationComplete={handleValidationComplete}
          disabled={currentStep === 'upload'}
        />
      )}

      {/* Validation Results */}
      {validationResults && (
        <ValidationResults
          results={validationResults}
          onReset={handleReset}
        />
      )}

      {/* Step 4: Download ROM */}
      {currentStep !== 'upload' && (
        <DownloadButton
          romBytes={romBytes}
          teamsJson={modifiedTeamsJson || teamsJson}
          jsonFileName={jsonFileName}
          disabled={!isValid}
          onSuccess={handleReset}
        />
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
        v{__APP_VERSION__}
      </footer>
    </div>
  );
}

export default App;

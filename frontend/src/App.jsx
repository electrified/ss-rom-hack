import React, { useState } from 'react';
import RomUpload from './components/RomUpload';
import TeamsSummary from './components/TeamsSummary';
import JsonUpload from './components/JsonUpload';
import ValidationResults from './components/ValidationResults';
import DownloadButton from './components/DownloadButton';

function App() {
  // Step tracking: 'upload', 'summary', 'validate', 'download'
  const [currentStep, setCurrentStep] = useState('upload');
  
  // Session data
  const [sessionId, setSessionId] = useState(null);
  const [romInfo, setRomInfo] = useState(null);
  const [teamsJson, setTeamsJson] = useState(null);
  
  // Validation results
  const [validationResults, setValidationResults] = useState(null);
  const [modifiedTeamsJson, setModifiedTeamsJson] = useState(null);
  const [isValid, setIsValid] = useState(false);

  const handleUploadSuccess = (result) => {
    setSessionId(result.session_id);
    setRomInfo(result.rom_info);
    setTeamsJson(result.teams_json);
    setCurrentStep('summary');
    // Reset validation state
    setValidationResults(null);
    setModifiedTeamsJson(null);
    setIsValid(false);
  };

  const handleValidationComplete = (results, json) => {
    setValidationResults(results);
    setModifiedTeamsJson(json);
    setIsValid(results && results.valid);
    if (results) {
      setCurrentStep('download');
    }
  };

  const handleReset = () => {
    setValidationResults(null);
    setModifiedTeamsJson(null);
    setIsValid(false);
    setCurrentStep('summary');
  };

  const handleStartOver = () => {
    setCurrentStep('upload');
    setSessionId(null);
    setRomInfo(null);
    setTeamsJson(null);
    setValidationResults(null);
    setModifiedTeamsJson(null);
    setIsValid(false);
  };

  return (
    <div className="app">
      <header>
        <h1>Sensible Soccer ROM Editor</h1>
        <p>Upload, edit, and generate modified ROM files</p>
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
          onDownloadJson={() => {}}
        />
      )}

      {/* Step 3: Upload Modified JSON */}
      {currentStep !== 'upload' && romInfo && (
        <JsonUpload 
          sessionId={sessionId}
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
          sessionId={sessionId}
          teamsJson={modifiedTeamsJson || teamsJson}
          disabled={!isValid}
          onSuccess={handleStartOver}
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
    </div>
  );
}

export default App;

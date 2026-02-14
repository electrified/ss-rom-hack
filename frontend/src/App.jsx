import React, { useState, useEffect } from 'react';
import RomUpload from './components/RomUpload';
import TeamsSummary from './components/TeamsSummary';
import JsonUpload from './components/JsonUpload';
import ValidationResults from './components/ValidationResults';
import DownloadButton from './components/DownloadButton';
import AdminApp from './admin/AdminApp';

function App() {
  // Check if we're on admin route
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPage, setAdminPage] = useState('dashboard');
  
  // Main app state - ALWAYS defined (no early return before hooks)
  const [currentStep, setCurrentStep] = useState('upload');
  const [sessionId, setSessionId] = useState(null);
  const [romInfo, setRomInfo] = useState(null);
  const [teamsJson, setTeamsJson] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [modifiedTeamsJson, setModifiedTeamsJson] = useState(null);
  const [jsonFileName, setJsonFileName] = useState(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/admin')) {
        setIsAdmin(true);
        const parts = hash.split('/');
        if (parts.length >= 3) {
          setAdminPage(parts[2]);
        } else {
          setAdminPage('dashboard');
        }
      } else {
        setIsAdmin(false);
      }
    };
    
    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);

  // Admin view - after all hooks are called
  if (isAdmin) {
    return <AdminApp page={adminPage} />;
  }

  // Main app view

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
    setSessionId(null);
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
        <h1>Sensible Soccer ROM Editor</h1>
        <p>Upload, edit, and generate modified ROM files</p>
        <a href="#/admin" style={{ 
          position: 'absolute', 
          top: '1rem', 
          right: '1rem',
          fontSize: '0.8rem',
          opacity: 0.5
        }}>
          Admin
        </a>
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
    </div>
  );
}

export default App;

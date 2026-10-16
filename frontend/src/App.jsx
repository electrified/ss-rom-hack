import React, { useState, useEffect, useRef, useMemo } from 'react';
import ui from './components/ui';

const styles = {
  steps: 'mb-8 flex justify-between px-4',
  step: "relative flex-1 text-center after:absolute after:top-[15px] after:left-1/2 after:-z-10 after:h-[2px] after:w-full after:bg-ui-surface-action after:content-[''] after:transition-colors after:duration-300 last:after:hidden",
  completed: 'after:bg-[var(--color-border-top)]!',
  stepNumber: 'mb-2 inline-block size-8 rounded-full bg-ui-surface-action font-semibold leading-8',
  activeNumber: 'bg-ui-accent! text-ui-white!',
  completedNumber: 'bg-ui-accent-bright! text-ui-background!',
  stepLabel: 'text-[0.85rem] text-ui-text-muted',
  activeLabel: 'text-ui-accent-bright!',
  validationError: 'mb-4',
  validationErrorList: 'mt-2 ml-6',
  startOver: 'my-8 text-center',
};
import RomUpload from './components/RomUpload';
import TeamEditor from './components/TeamEditor';
import DownloadButton from './components/DownloadButton';
import EditorBoundary from './components/EditorBoundary';
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
    <>
      {/* Progress Steps */}
      <div className={styles.steps}>
        <div className={`${styles.step} ${currentStep === 'upload' ? '' : styles.completed}`}>
          <div className={`${styles.stepNumber} ${currentStep === 'upload' ? styles.activeNumber : styles.completedNumber}`}>1</div>
          <div className={`${styles.stepLabel} ${currentStep === 'upload' ? styles.activeLabel : ''}`}>Open ROM</div>
        </div>
        <div className={styles.step}>
          <div className={`${styles.stepNumber} ${currentStep === 'edit' ? styles.activeNumber : ''}`}>2</div>
          <div className={`${styles.stepLabel} ${currentStep === 'edit' ? styles.activeLabel : ''}`}>Edit Teams</div>
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
            <div className={`${ui.errorMessage} ${styles.validationError}`}>
              {errorCount} validation error{errorCount !== 1 ? 's' : ''} must be fixed before downloading.
              {validation.global.length > 0 && (
                <ul className={styles.validationErrorList}>
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
        <div className={styles.startOver}>
          <button onClick={handleStartOver} className={`${ui.button} ${ui.secondary}`}>
            Start Over (Open Another ROM)
          </button>
        </div>
      )}
    </>
  );
}

export default App;

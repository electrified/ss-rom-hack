import React from 'react';

function ValidationResults({ results, onReset }) {
  if (!results) {
    return null;
  }

  const { valid, errors, warnings } = results;
  const hasErrors = errors && errors.length > 0;
  const hasWarnings = warnings && warnings.length > 0;

  return (
    <div className="card">
      <h2>Validation Results</h2>
      
      <div className={`validation-status ${valid ? 'valid' : 'invalid'}`}>
        <h3>{valid ? '✓ Validation Passed' : '✗ Validation Failed'}</h3>
        <p>
          {valid 
            ? 'Your changes are valid and ready to be applied to the ROM.'
            : `Found ${errors.length} error(s) that must be fixed.`
          }
        </p>
      </div>

      {hasErrors && (
        <>
          <h3 style={{ color: '#e74c3c', marginBottom: '1rem' }}>
            Errors ({errors.length})
          </h3>
          <p style={{ marginBottom: '1rem', color: '#888' }}>
            These errors must be fixed before you can generate the ROM:
          </p>
          <ul className="validation-list">
            {errors.map((error, index) => (
              <li key={index} className="validation-item error">
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasWarnings && (
        <>
          <h3 style={{ color: '#f1c40f', marginBottom: '1rem', marginTop: hasErrors ? '2rem' : 0 }}>
            Warnings ({warnings.length})
          </h3>
          <p style={{ marginBottom: '1rem', color: '#888' }}>
            These warnings won't prevent ROM generation, but you may want to review them:
          </p>
          <ul className="validation-list">
            {warnings.map((warning, index) => (
              <li key={index} className="validation-item warning">
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasErrors && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button onClick={onReset} className="secondary">
            Try Another JSON File
          </button>
        </div>
      )}
    </div>
  );
}

export default ValidationResults;

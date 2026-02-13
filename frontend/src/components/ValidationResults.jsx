import React from 'react';

export default function ValidationResults({ results }) {
  if (!results) return null;

  const { valid, errors, warnings } = results;

  return (
    <div className="step">
      <h2>4. Validation Results</h2>
      {valid && warnings.length === 0 && (
        <p className="success">Validation passed! No errors or warnings.</p>
      )}
      
      {errors.length > 0 && (
        <div className="errors">
          <h3>Errors ({errors.length})</h3>
          <ul>
            {errors.map((err, i) => (
              <li key={i} className="error">{err}</li>
            ))}
          </ul>
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="warnings">
          <h3>Warnings ({warnings.length})</h3>
          <ul>
            {warnings.map((warn, i) => (
              <li key={i} className="warning">{warn}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

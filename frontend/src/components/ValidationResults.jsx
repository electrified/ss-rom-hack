export default function ValidationResults({ results }) {
  if (!results) return null;

  const { valid, errors, warnings } = results;

  return (
    <div className="validation-section">
      <h2>Validation Results</h2>
      
      {valid && warnings.length === 0 ? (
        <p className="success">Validation passed! You can now download the modified ROM.</p>
      ) : valid ? (
        <div>
          <p className="success">Validation passed with warnings:</p>
          <ul className="warnings">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      ) : (
        <div>
          <p className="error-text">Validation failed:</p>
          <ul className="errors">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          {warnings.length > 0 && (
            <>
              <p className="warning-text">Warnings:</p>
              <ul className="warnings">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

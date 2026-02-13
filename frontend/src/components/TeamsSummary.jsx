import React from 'react';

export default function TeamsSummary({ romInfo, teamsJson, onDownloadJson }) {
  if (!romInfo) return null;

  const { edition, teams_count } = romInfo;
  const totalTeams = teams_count.national + teams_count.club + teams_count.custom;

  return (
    <div className="step">
      <h2>2. ROM Summary</h2>
      <div className="summary">
        <p><strong>Edition:</strong> {edition}</p>
        <p><strong>Total Teams:</strong> {totalTeams}</p>
        <ul>
          <li>National: {teams_count.national}</li>
          <li>Club: {teams_count.club}</li>
          <li>Custom: {teams_count.custom}</li>
        </ul>
        <button onClick={onDownloadJson}>Download Teams JSON</button>
      </div>
    </div>
  );
}

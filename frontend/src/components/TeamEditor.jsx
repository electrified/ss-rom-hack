import React, { useState, useRef, useCallback, forwardRef } from 'react';
import TeamDetail from './TeamDetail';
import { CATEGORIES } from '../lib/sslib/index';
import './TeamEditor.css';

const TeamEditor = forwardRef(function TeamEditor({ teamsJson, onTeamsChange, romBytes, validation }, ref) {
  const [category, setCategory] = useState('national');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [search, setSearch] = useState('');
  const jsonInputRef = useRef(null);

  const teams = teamsJson[category] || [];
  const filtered = search
    ? teams.filter((t) => {
        const q = search.toUpperCase();
        return t.team.includes(q) || t.country.includes(q) || t.coach.includes(q);
      })
    : teams;

  const filteredWithIndex = filtered.map(t => ({
    team: t,
    index: teams.indexOf(t),
  }));

  const selectedTeam = selectedIndex !== null ? teams[selectedIndex] : null;

  const categoryTeamErrors = validation?.teams?.[category] || {};
  const selectedTeamErrors = selectedIndex !== null ? categoryTeamErrors[selectedIndex] : null;

  const handleTeamUpdate = useCallback((updatedTeam) => {
    const newTeams = teams.map((t, i) => i === selectedIndex ? updatedTeam : t);
    onTeamsChange({
      ...teamsJson,
      [category]: newTeams,
    });
  }, [teams, selectedIndex, category, teamsJson, onTeamsChange]);

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setSelectedIndex(null);
    setSearch('');
  };

  const handleSelectTeam = (index) => {
    setSelectedIndex(index);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(teamsJson, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleImportClick = () => {
    jsonInputRef.current?.click();
  };

  const handleImportJson = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.national && parsed.club && parsed.custom) {
        onTeamsChange(parsed);
        setSelectedIndex(null);
      } else {
        alert('Invalid teams JSON: must contain national, club, and custom arrays.');
      }
    } catch (err) {
      alert('Failed to parse JSON file: ' + err.message);
    }
  };

  const teamHasErrors = (index) => {
    const te = categoryTeamErrors[index];
    if (!te) return false;
    return te.team.length > 0 || te.formation.length > 0 || Object.keys(te.players).length > 0;
  };

  // Count teams with errors per category for tab badges
  const categoryErrorCounts = {};
  for (const cat of CATEGORIES) {
    const catTeams = validation?.teams?.[cat] || {};
    categoryErrorCounts[cat] = Object.keys(catTeams).length;
  }

  return (
    <div className="card" ref={ref}>
      <h2>Step 2: Edit Teams</h2>

      <div className="json-bar">
        <button className="secondary" onClick={handleExportJson} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          Export JSON
        </button>
        <button className="secondary" onClick={handleImportClick} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          Import JSON
        </button>
        <input
          ref={jsonInputRef}
          type="file"
          className="json-file-input"
          accept=".json"
          onChange={handleImportJson}
        />
        <div className="json-bar-spacer" />
        <span style={{ fontSize: '0.75rem', color: '#3d5e3d' }}>
          {(teamsJson.national?.length || 0) + (teamsJson.club?.length || 0) + (teamsJson.custom?.length || 0)} teams
        </span>
      </div>

      <div className="team-editor" style={{ marginTop: '1rem' }}>
        {/* Sidebar */}
        <div className="team-editor-sidebar">
          <div className="category-tabs">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`category-tab ${category === cat ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat} ({(teamsJson[cat] || []).length})
                {categoryErrorCounts[cat] > 0 && (
                  <span className="category-issue-badge">{categoryErrorCounts[cat]}</span>
                )}
              </button>
            ))}
          </div>

          <div className="team-search">
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="team-list">
            {filteredWithIndex.length === 0 ? (
              <div className="team-list-empty">
                {search ? 'No matches' : 'No teams'}
              </div>
            ) : (
              filteredWithIndex.map(({ team: t, index }) => {
                const hasErrors = teamHasErrors(index);
                return (
                  <div
                    key={index}
                    className={`team-list-item ${selectedIndex === index ? 'selected' : ''} ${hasErrors ? 'has-error' : ''}`}
                    onClick={() => handleSelectTeam(index)}
                  >
                    {t.team}
                    {hasErrors && <span className="team-issue-dot error" />}
                    <span className="team-country">{t.country}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="team-editor-main">
          {selectedTeam ? (
            <TeamDetail
              key={`${category}-${selectedIndex}`}
              team={selectedTeam}
              onUpdate={handleTeamUpdate}
              errors={selectedTeamErrors}
            />
          ) : (
            <div className="team-detail-empty">
              Select a team from the list to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default TeamEditor;


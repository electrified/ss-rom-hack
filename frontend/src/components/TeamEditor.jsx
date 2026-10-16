import React, { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import ui from './ui';

const styles = {
  teamEditor: 'mt-4 flex min-h-[500px] gap-6 max-[768px]:min-h-0 max-[768px]:flex-col',
  teamEditorSidebar: 'flex w-[240px] shrink-0 flex-col gap-3 max-[768px]:w-full',
  teamEditorMain: 'min-w-0 flex-1',
  categoryTabs: 'flex gap-[2px] rounded-[6px] bg-ui-surface-raised p-[2px]',
  categoryTab: 'min-w-0 flex-1 cursor-pointer rounded-sm border-0 bg-transparent px-1 py-2 text-[0.7rem] font-semibold text-ui-text-muted capitalize transition-all duration-200 enabled:hover:bg-ui-accent-bright-10 enabled:hover:text-ui-accent-bright max-[768px]:px-[0.2rem] max-[768px]:py-[0.4rem] max-[768px]:text-[0.6rem]',
  active: 'bg-ui-accent! text-ui-white!',
  teamSearch: 'relative',
  searchInput: 'w-full rounded-[6px] border border-solid border-ui-border bg-ui-surface-raised px-3 py-2 text-[0.85rem] text-ui-text outline-none transition-colors duration-200 focus:border-ui-accent placeholder:text-ui-text-dim',
  teamList: 'min-h-0 max-h-[500px] flex-1 overflow-y-auto rounded-[6px] border border-solid border-ui-border bg-ui-surface-raised max-[768px]:max-h-[200px]',
  teamListItem: 'block w-full cursor-pointer rounded-none border-0 border-b border-solid border-b-ui-border bg-transparent px-3 py-2 text-left font-[inherit] text-[0.85rem] leading-[1.6] text-ui-text-soft transition-colors duration-150 last:border-b-0 hover:bg-ui-accent-bright-08 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-heading',
  selected: 'border-l-[3px] border-l-ui-accent bg-ui-accent-20! pl-[calc(0.75rem-3px)]! text-ui-accent-bright!',
  hasError: 'border-l-[3px]! border-l-ui-error! pl-[calc(0.75rem-3px)]!',
  teamCountry: 'mt-px block text-[0.7rem] text-ui-text-muted',
  teamListEmpty: 'p-6 text-center text-[0.85rem] text-ui-text-dim',
  teamDetailEmpty: 'flex h-[300px] items-center justify-center rounded-lg border-2 border-dashed border-ui-border text-center text-[0.9rem] text-ui-text-dim',
  jsonBar: 'flex flex-wrap items-center gap-2 [&_button]:px-3 [&_button]:py-[0.4rem] [&_button]:text-[0.8rem]',
  jsonBarSpacer: 'flex-1',
  jsonFileInput: 'hidden',
  teamIssueDot: 'ml-[0.4rem] inline-block size-2 rounded-full align-middle',
  error: 'bg-ui-error [box-shadow:0_0_4px_var(--color-error-60)]',
  categoryIssueBadge: 'ml-[0.3rem] inline-block h-[14px] min-w-[14px] rounded-[7px] bg-ui-error text-center text-[0.55rem] leading-[14px] font-bold text-ui-white align-middle',
  teamCount: 'text-xs text-ui-text-dim',
};
import TeamDetail from './TeamDetail';
import { CATEGORIES, normalizeTeams, validateTeams } from '../lib/sslib/index';

const TeamEditor = forwardRef(function TeamEditor({ teamsJson, onTeamsChange, romStructure, validation }, ref) {
  const [category, setCategory] = useState('national');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [search, setSearch] = useState('');
  const jsonInputRef = useRef(null);
  const importRequest = useRef(0);
  const [importError, setImportError] = useState(null);
  useEffect(() => () => { importRequest.current++; }, []);

  const teams = teamsJson[category];
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
    const request = ++importRequest.current;
    setImportError(null);

    try {
      const text = await file.text();
      if (request !== importRequest.current) return;
      const parsed = normalizeTeams(JSON.parse(text));
      const checked = validateTeams(romStructure, parsed);
      if (!checked.valid) throw new Error([...checked.global, ...Object.values(checked.teams).flatMap(cat => Object.values(cat).flatMap(t => [...t.team, ...t.formation, ...Object.values(t.players).flat()]))].join('\n'));
      onTeamsChange(parsed);
      setSelectedIndex(null);
      setSearch('');
    } catch (err) {
      if (request === importRequest.current) setImportError(err.message);
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

      <div className={styles.jsonBar}>
        <button className={`${ui.button} ${ui.secondary}`} onClick={handleExportJson}>
          Export JSON
        </button>
        <button className={`${ui.button} ${ui.secondary}`} onClick={handleImportClick}>
          Import JSON
        </button>
        <input
          ref={jsonInputRef}
          type="file"
          className={styles.jsonFileInput}
          data-testid="json-file-input"
          accept=".json"
          onChange={handleImportJson}
        />
        <div className={styles.jsonBarSpacer} />
        <span className={styles.teamCount}>
          {(teamsJson.national?.length || 0) + (teamsJson.club?.length || 0) + (teamsJson.custom?.length || 0)} teams
        </span>
      </div>

      {importError && <div className={ui.errorMessage} role="alert">Import failed: {importError}</div>}

      <div className={styles.teamEditor} data-testid="team-editor">
        {/* Sidebar */}
        <div className={styles.teamEditorSidebar}>
          <div className={styles.categoryTabs}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`${styles.categoryTab} ${category === cat ? styles.active : ''}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat} ({(teamsJson[cat] || []).length})
                {categoryErrorCounts[cat] > 0 && (
                  <span className={styles.categoryIssueBadge}>{categoryErrorCounts[cat]}</span>
                )}
              </button>
            ))}
          </div>

          <div className={styles.teamSearch}>
            <input
              type="text"
              className={styles.searchInput}
              aria-label="Search teams" placeholder="Search teams..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.teamList}>
            {filteredWithIndex.length === 0 ? (
              <div className={styles.teamListEmpty}>
                {search ? 'No matches' : 'No teams'}
              </div>
            ) : (
              filteredWithIndex.map(({ team: t, index }) => {
                const hasErrors = teamHasErrors(index);
                return (
                  <button
                    type="button" aria-pressed={selectedIndex === index}
                    key={index}
                    className={`${styles.teamListItem} ${selectedIndex === index ? styles.selected : ''} ${hasErrors ? styles.hasError : ''}`}
                    data-testid="team-list-item"
                    onClick={() => handleSelectTeam(index)}
                  >
                    {t.team}
                    {hasErrors && <span className={`${styles.teamIssueDot} ${styles.error}`} />}
                    <span className={styles.teamCountry}>{t.country}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className={styles.teamEditorMain}>
          {selectedTeam ? (
            <TeamDetail
              key={`${category}-${selectedIndex}`}
              team={selectedTeam}
              onUpdate={handleTeamUpdate}
              errors={selectedTeamErrors}
            />
          ) : (
            <div className={styles.teamDetailEmpty} data-testid="team-detail-empty">
              Select a team from the list to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default TeamEditor;

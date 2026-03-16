import React, { useState, useRef, useCallback, useEffect } from 'react';
import KitEditor from './KitEditor';
import PlayerEditor from './PlayerEditor';
import HelpTip from './HelpTip';
import { CHARSET, TACTIC_NAMES, MAX_TEAM_NAME, MAX_COUNTRY, MAX_COACH } from '../lib/sslib/index';

const VALID_CHARS = new Set(CHARSET.slice(1));
const TACTICS = Object.values(TACTIC_NAMES);
const DEBOUNCE_MS = 300;
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

function TeamDetail({ team: teamProp, onUpdate, errors }) {
  // Local editing state — teamProp is only used as the initial value.
  // Team switching is handled by the `key` prop on this component.
  const [team, setTeam] = useState(teamProp);
  const debounceRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const flush = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
    onUpdateRef.current(teamRef.current);
  }, []);

  const teamRef = useRef(team);
  teamRef.current = team;

  const update = useCallback((field, value) => {
    setTeam(prev => {
      const updated = { ...prev, [field]: value };
      teamRef.current = updated;
      return updated;
    });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  const onKitChange = useCallback((kit) => update('kit', kit), [update]);
  const onPlayersChange = useCallback((players) => update('players', players), [update]);

  // Flush pending changes on unmount (team switch / navigate away)
  useEffect(() => {
    return () => {
      if (debounceRef.current) flush();
    };
  }, [flush]);

  const textInvalid = (val) => [...val].some(ch => !VALID_CHARS.has(ch));

  const teamErrors = errors?.team || EMPTY_ARRAY;
  const formationErrors = errors?.formation || EMPTY_ARRAY;
  const playerErrors = errors?.players || EMPTY_OBJECT;

  return (
    <div className="team-detail-sections">
      {teamErrors.length > 0 && (
        <div className="team-issues-banner">
          {teamErrors.map((msg, i) => (
            <div key={i} className="team-issue-item error">{msg}</div>
          ))}
        </div>
      )}

      <div className="editor-section">
        <h4>Team Info</h4>
        <div className="form-row">
          <div className="form-field">
            <label>Team Name</label>
            <input
              type="text"
              value={team.team}
              maxLength={MAX_TEAM_NAME}
              className={textInvalid(team.team) ? 'invalid' : ''}
              onChange={e => update('team', e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-field">
            <label>Country<HelpTip text="Not used by custom or national teams." /></label>
            <input
              type="text"
              value={team.country}
              maxLength={MAX_COUNTRY}
              className={textInvalid(team.country) ? 'invalid' : ''}
              onChange={e => update('country', e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Coach</label>
            <input
              type="text"
              value={team.coach}
              maxLength={MAX_COACH}
              className={textInvalid(team.coach) ? 'invalid' : ''}
              onChange={e => update('coach', e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-field">
            <label>Tactic</label>
            <select value={team.tactic} onChange={e => update('tactic', e.target.value)}>
              {TACTICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Skill (0=best, 7=worst)</label>
            <select value={team.skill} onChange={e => update('skill', parseInt(e.target.value))}>
              {[0,1,2,3,4,5,6,7].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Flag<HelpTip text="Unused by the game engine. Safe to leave at 0." /></label>
            <select value={team.flag} onChange={e => update('flag', parseInt(e.target.value))}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
          </div>
        </div>
      </div>

      <KitEditor kit={team.kit} onChange={onKitChange} />

      <PlayerEditor
        players={team.players}
        onChange={onPlayersChange}
        playerErrors={playerErrors}
        formationErrors={formationErrors}
      />
    </div>
  );
}

export default TeamDetail;

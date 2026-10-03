import React, { useCallback } from 'react';
import KitEditor from './KitEditor';
import PlayerEditor from './PlayerEditor';
import HelpTip from './HelpTip';
import { CHARSET, TACTIC_NAMES, MAX_TEAM_NAME, MAX_COUNTRY, MAX_COACH } from '../lib/sslib/index';

const VALID_CHARS = new Set(CHARSET.slice(1));
const TACTICS = Object.values(TACTIC_NAMES);
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

function TeamDetail({ team, onUpdate, errors }) {
  const update = useCallback((field, value) => onUpdate({ ...team, [field]: value }), [team, onUpdate]);
  const onKitChange = useCallback((kit) => update('kit', kit), [update]);
  const onPlayersChange = useCallback((players) => update('players', players), [update]);

  const textInvalid = (val) => [...val].some(ch => !VALID_CHARS.has(ch));

  const teamErrors = errors?.team || EMPTY_ARRAY;
  const formationErrors = errors?.formation || EMPTY_ARRAY;
  const playerErrors = errors?.players || EMPTY_OBJECT;

  return (
    <div className="team-detail-sections">
      {teamErrors.length > 0 && (
        <div className="team-issues-banner" id="team-errors" role="alert">
          {teamErrors.map((msg, i) => (
            <div key={i} className="team-issue-item error">{msg}</div>
          ))}
        </div>
      )}

      <div className="editor-section">
        <h4>Team Info</h4>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="team-team">Team Name</label>
            <input
              type="text"
              id="team-team" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.team}
              maxLength={MAX_TEAM_NAME}
              className={textInvalid(team.team) ? 'invalid' : ''}
              onChange={e => update('team', e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-field">
            <div className="field-label"><label htmlFor="team-country">Country</label><HelpTip text="Not used by custom or national teams." /></div>
            <input
              type="text"
              id="team-country" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.country}
              maxLength={MAX_COUNTRY}
              className={textInvalid(team.country) ? 'invalid' : ''}
              onChange={e => update('country', e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="team-coach">Coach</label>
            <input
              type="text"
              id="team-coach" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.coach}
              maxLength={MAX_COACH}
              className={textInvalid(team.coach) ? 'invalid' : ''}
              onChange={e => update('coach', e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-field">
            <label htmlFor="team-tactic">Tactic</label>
            <select id="team-tactic" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.tactic} onChange={e => update('tactic', e.target.value)}>
              {!TACTICS.includes(team.tactic) && <option value={team.tactic}>{team.tactic}</option>}
              {TACTICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="team-skill">Skill (0=best, 7=worst)</label>
            <select id="team-skill" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.skill} onChange={e => update('skill', parseInt(e.target.value))}>
              {[0,1,2,3,4,5,6,7].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <div className="field-label"><label htmlFor="team-flag">Flag</label><HelpTip text="Unused by the game engine. Safe to leave at 0." /></div>
            <select id="team-flag" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.flag} onChange={e => update('flag', parseInt(e.target.value))}>
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

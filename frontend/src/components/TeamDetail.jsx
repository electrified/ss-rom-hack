import React, { useCallback } from 'react';
import ui from './ui';

const styles = {
  teamDetailSections: 'flex flex-col gap-5',
  teamIssuesBanner: 'flex flex-col gap-[0.4rem] rounded-lg border border-solid border-[var(--color-border-error)] bg-ui-error-08 p-3',
  formRow: 'mb-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 last:mb-0 max-[768px]:grid-cols-2 max-[480px]:grid-cols-1',
  formField: 'flex flex-col gap-1 [&_label]:text-xs [&_label]:leading-[1.6] [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-[0.05em] [&_label]:text-ui-text-muted',
  control: 'rounded-sm border border-solid border-ui-border bg-ui-surface px-2 py-[0.4rem] text-[0.85rem] text-ui-text outline-none transition-colors duration-200 focus:border-ui-accent',
  invalid: 'border-ui-error!',
  fieldLabel: 'flex items-baseline gap-1',
};
import KitEditor from './KitEditor';
import PlayerEditor from './PlayerEditor';
import HelpTip from './HelpTip';
import { CHARSET, FORMATION_NAMES, changeFormation, MAX_TEAM_NAME, MAX_COUNTRY, MAX_COACH } from '../lib/sslib/index';

const VALID_CHARS = new Set(CHARSET.slice(1));
const FORMATIONS = Object.values(FORMATION_NAMES);
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
    <div className={styles.teamDetailSections} data-testid="team-detail-sections">
      {teamErrors.length > 0 && (
        <div className={styles.teamIssuesBanner} id="team-errors" role="alert">
          {teamErrors.map((msg, i) => (
            <div key={i} className={`${ui.teamIssueItem} ${ui.error}`}>{msg}</div>
          ))}
        </div>
      )}

      <div className={ui.editorSection} data-testid="team-info-section">
        <h4>Team Info</h4>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label htmlFor="team-team">Team Name</label>
            <input
              type="text"
              id="team-team" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.team}
              maxLength={MAX_TEAM_NAME}
              className={`${styles.control} ${textInvalid(team.team) ? styles.invalid : ''}`}
              onChange={e => update('team', e.target.value.toUpperCase())}
            />
          </div>
          <div className={styles.formField}>
            <div className={styles.fieldLabel}><label htmlFor="team-country">Country</label><HelpTip text="Not used by custom or national teams." /></div>
            <input
              type="text"
              id="team-country" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.country}
              maxLength={MAX_COUNTRY}
              className={`${styles.control} ${textInvalid(team.country) ? styles.invalid : ''}`}
              onChange={e => update('country', e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label htmlFor="team-coach">Coach</label>
            <input
              type="text"
              id="team-coach" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.coach}
              maxLength={MAX_COACH}
              className={`${styles.control} ${textInvalid(team.coach) ? styles.invalid : ''}`}
              onChange={e => update('coach', e.target.value.toUpperCase())}
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="team-formation">Formation</label>
            <select className={`${styles.control} cursor-pointer`} id="team-formation" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.formation} onChange={e => onUpdate(changeFormation(team, e.target.value))}>
              {!FORMATIONS.includes(team.formation) && <option value={team.formation}>{team.formation}</option>}
              {FORMATIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <label htmlFor="team-skill">Skill (0=best, 7=worst)</label>
            <select className={`${styles.control} cursor-pointer`} id="team-skill" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.skill} onChange={e => update('skill', parseInt(e.target.value))}>
              {[0,1,2,3,4,5,6,7].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className={styles.formField}>
            <div className={styles.fieldLabel}><label htmlFor="team-flag">Flag</label><HelpTip text="Unused by the game engine. Safe to leave at 0." /></div>
            <select className={`${styles.control} cursor-pointer`} id="team-flag" aria-describedby={teamErrors.length ? "team-errors" : undefined} value={team.flag} onChange={e => update('flag', parseInt(e.target.value))}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
          </div>
        </div>
      </div>

      <KitEditor kit={team.kit} onChange={onKitChange} />

      <PlayerEditor
        formation={team.formation}
        players={team.players}
        onChange={onPlayersChange}
        playerErrors={playerErrors}
        formationErrors={formationErrors}
      />
    </div>
  );
}

export default TeamDetail;

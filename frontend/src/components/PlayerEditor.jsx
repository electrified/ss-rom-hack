import React, { useCallback } from 'react';
import ui from './ui';
import { CHARSET, POSITION_NAMES, ROLE_NAMES, HEAD_NAMES, MAX_PLAYER_NAME, expectedRole, positionLabel, assignPosition, ROLE_LABELS } from '../lib/sslib/index';
import HelpTip from './HelpTip';

const VALID_CHARS = new Set(CHARSET.slice(1));
const POSITIONS = Object.values(POSITION_NAMES);
const ROLES = Object.values(ROLE_NAMES);
const HEADS = Object.values(HEAD_NAMES);

const styles = {
  playerTableWrapper: 'overflow-x-auto [-webkit-overflow-scrolling:touch]',
  playerTable: 'w-full min-w-[600px] border-collapse text-[0.8rem] max-[768px]:min-w-[560px] [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:border-0 [&_th]:border-b-2 [&_th]:border-solid [&_th]:border-ui-border [&_th]:bg-ui-surface [&_th]:px-2 [&_th]:py-[0.4rem] [&_th]:text-left [&_th]:text-[0.7rem] [&_th]:font-semibold [&_th]:tracking-[0.05em] [&_th]:text-ui-text-muted [&_th]:uppercase [&_th]:whitespace-nowrap [&_td]:border-0 [&_td]:border-b [&_td]:border-solid [&_td]:border-ui-border [&_td]:px-[0.3rem] [&_td]:py-1 [&_td]:align-middle [&_tr:hover]:bg-ui-accent-bright-04 [&_input]:w-full [&_input]:rounded-[3px] [&_input]:border [&_input]:border-solid [&_input]:border-transparent [&_input]:bg-ui-surface [&_input]:px-[0.4rem] [&_input]:py-[0.3rem] [&_input]:text-[0.8rem] [&_input]:text-ui-text [&_input]:outline-none [&_input]:transition-colors [&_input]:duration-200 [&_input:focus]:border-ui-accent [&_input:focus]:bg-ui-surface-raised [&_select]:w-full [&_select]:cursor-pointer [&_select]:rounded-[3px] [&_select]:border [&_select]:border-solid [&_select]:border-transparent [&_select]:bg-ui-surface [&_select]:px-1 [&_select]:py-[0.3rem] [&_select]:text-xs [&_select]:text-ui-text [&_select]:outline-none [&_select:focus]:border-ui-accent',
  colNum: 'w-[70px]',
  colName: 'min-w-[140px] max-[768px]:min-w-[120px]',
  colPos: 'min-w-[205px]',
  colHead: 'w-[110px]',
  colStar: 'w-9 text-center',
  invalid: 'border-ui-error!',
  storedRole: 'block p-[0.2rem] text-xs text-ui-intro',
  roleReset: 'block cursor-pointer border-0 bg-transparent py-[0.2rem] [font:inherit] text-ui-intro underline',
  starCheckbox: 'size-[18px]! cursor-pointer accent-ui-accent',
  formationErrors: 'mb-3 flex flex-col gap-[0.4rem]',
  playerRowError: '[&>td]:bg-ui-error-10!',
  playerIssueRow: '[&_td]:px-2! [&_td]:pt-[0.2rem]! [&_td]:pb-[0.4rem]!',
  playerIssueMsg: 'block py-[0.15rem] text-[0.7rem]',
  error: 'text-ui-error',
  advancedPlayerSettings: 'mt-4 [&_summary]:cursor-pointer [&_summary]:py-2 [&_p]:my-2',
  roleOverrides: 'grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 [&_label]:flex [&_label]:flex-col [&_label]:gap-1 [&_select]:border [&_select]:border-solid [&_select]:border-ui-border-control [&_select]:bg-ui-surface [&_select]:p-2 [&_select]:text-ui-text',
};

const HEAD_LABELS = {
  white_dark: 'White/Dark', white_blonde: 'White/Blonde', black_dark: 'Black/Dark',
};

const EMPTY_ARRAY = [];

const PlayerRow = React.memo(function PlayerRow({ player, index, errors, onUpdate, formation }) {
  const combinedPosition = player.position === 'sub' ? `sub:${player.role}` : player.position;
  const mismatch = player.position !== 'sub' && expectedRole(formation, player.position) !== player.role;
  const nameInvalid = [...player.name].some(ch => !VALID_CHARS.has(ch));

  return (
    <React.Fragment>
      <tr className={errors.length > 0 ? styles.playerRowError : ''}>
        <td className={styles.colNum}>
          <input
            type="number"
            min={1}
            max={16}
            aria-label={`Player ${index + 1}: Shirt number`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.number}
            onChange={e => onUpdate(index, 'number', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </td>
        <td className={styles.colName}>
          <input
            type="text"
            aria-label={`Player ${index + 1}: Name`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.name}
            maxLength={MAX_PLAYER_NAME}
            className={nameInvalid ? styles.invalid : ''}
            onChange={e => onUpdate(index, 'name', e.target.value.toUpperCase())}
            title={nameInvalid ? 'Only A-Z, space, dash, apostrophe, period allowed' : ''}
          />
        </td>
        <td className={styles.colPos}>
          <select aria-label={`Player ${index + 1}: Position`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={combinedPosition}
            onChange={e => onUpdate(index, 'position', e.target.value)}>
            {!POSITIONS.includes(player.position) && <option value={combinedPosition}>{player.position}</option>}
            <optgroup label="Starting XI">
              {POSITIONS.filter(p => p !== 'sub').map(p => <option key={p} value={p}>{positionLabel(formation, p)}</option>)}
            </optgroup>
            <optgroup label="Substitutes">
              {ROLES.map(role => <option key={role} value={`sub:${role}`}>Substitute — {ROLE_LABELS[role]}</option>)}
            </optgroup>
          </select>
          {mismatch && <span className={styles.storedRole}>Stored role: {ROLE_LABELS[player.role] ?? player.role}
            <button type="button" className={styles.roleReset} aria-label={`Player ${index + 1}: Use usual role`} onClick={() => onUpdate(index, 'position', player.position)}>Use usual role</button>
          </span>}
        </td>
        <td className={styles.colHead}>
          <select aria-label={`Player ${index + 1}: Skin/Hair`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.head}
            onChange={e => onUpdate(index, 'head', e.target.value)}>
            {!HEADS.includes(player.head) && <option value={player.head}>{player.head}</option>}
            {HEADS.map(h => (
              <option key={h} value={h}>{HEAD_LABELS[h]}</option>
            ))}
          </select>
        </td>
        <td className={styles.colStar}>
          <input
            type="checkbox"
            className={styles.starCheckbox}
            aria-label={`Player ${index + 1}: Star player`} checked={!!player.star}
            onChange={e => onUpdate(index, 'star', e.target.checked)}
          />
        </td>
      </tr>
      {errors.length > 0 && (
        <tr className={styles.playerIssueRow}>
          <td colSpan={5} id={`player-errors-${index}`} role="alert">
            {errors.map((msg, i) => (
              <span key={i} className={`${styles.playerIssueMsg} ${styles.error}`}>{msg}</span>
            ))}
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});

function PlayerEditor({ formation, players, onChange, playerErrors, formationErrors }) {
  const updatePlayer = useCallback((index, field, value) => {
    onChange(players.map((p, i) => {
      if (i !== index) return p;
      if (field === 'position') {
        const [position, role] = value.split(':');
        return assignPosition(p, formation, position, role);
      }
      const updated = { ...p, [field]: value };
      if (field === 'star' && !value) delete updated.star;
      return updated;
    }));
  }, [players, onChange, formation]);

  return (
    <div className={ui.editorSection}>
      <h4>Players ({players.length})</h4>

      {formationErrors.length > 0 && (
        <div className={styles.formationErrors}>
          {formationErrors.map((msg, i) => (
            <div key={i} className={`${ui.teamIssueItem} ${ui.error}`}>{msg}</div>
          ))}
        </div>
      )}

      <div className={styles.playerTableWrapper} data-testid="player-table-wrapper">
        <table className={styles.playerTable}>
          <thead>
            <tr>
              <th className={styles.colNum}>#</th>
              <th className={styles.colName}>Name</th>
              <th className={styles.colPos}>Position<HelpTip text="Choosing a position also sets its usual role for this formation. Choose a substitute type for the bench. Occupied positions are flagged, not swapped." /></th>
              <th className={styles.colHead}>Skin/Hair<HelpTip text="Player's skin tone and hair colour appearance in-game." /></th>
              <th className={styles.colStar}>★<HelpTip text="Star player. Only used in expert mode and doesn't affect custom teams." /></th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => (
              <PlayerRow
                key={index}
                player={player}
                formation={formation}
                index={index}
                errors={playerErrors[index] || EMPTY_ARRAY}
                onUpdate={updatePlayer}
              />
            ))}
          </tbody>
        </table>
      </div>
      <details className={styles.advancedPlayerSettings} data-testid="advanced-player-settings">
        <summary>Advanced player settings</summary>
        <p>Stored roles are preserved when loading a ROM. Override them here for unusual combinations. Choosing a position sets its usual role again.</p>
        <div className={styles.roleOverrides}>
          {players.map((player, index) => <label key={index}>
            Player {index + 1}: {player.name || '(unnamed)'}
            <select aria-label={`Player ${index + 1}: Stored role`} value={player.role} onChange={e => updatePlayer(index, 'role', e.target.value)}>
              {!ROLES.includes(player.role) && <option value={player.role}>{player.role}</option>}
              {ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </label>)}
        </div>
      </details>
    </div>
  );
}

export default React.memo(PlayerEditor);

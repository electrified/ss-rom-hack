import React, { useCallback } from 'react';
import { CHARSET, POSITION_NAMES, ROLE_NAMES, HEAD_NAMES, MAX_PLAYER_NAME, expectedRole, positionLabel, assignPosition, ROLE_LABELS } from '../lib/sslib/index';
import HelpTip from './HelpTip';

const VALID_CHARS = new Set(CHARSET.slice(1));
const POSITIONS = Object.values(POSITION_NAMES);
const ROLES = Object.values(ROLE_NAMES);
const HEADS = Object.values(HEAD_NAMES);

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
      <tr className={errors.length > 0 ? 'player-row-error' : ''}>
        <td className="col-num">
          <input
            type="number"
            min={1}
            max={16}
            aria-label={`Player ${index + 1}: Shirt number`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.number}
            onChange={e => onUpdate(index, 'number', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </td>
        <td className="col-name">
          <input
            type="text"
            aria-label={`Player ${index + 1}: Name`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.name}
            maxLength={MAX_PLAYER_NAME}
            className={nameInvalid ? 'invalid' : ''}
            onChange={e => onUpdate(index, 'name', e.target.value.toUpperCase())}
            title={nameInvalid ? 'Only A-Z, space, dash, apostrophe, period allowed' : ''}
          />
        </td>
        <td className="col-pos">
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
          {mismatch && <span className="stored-role">Stored role: {ROLE_LABELS[player.role] ?? player.role}
            <button type="button" className="role-reset" aria-label={`Player ${index + 1}: Use usual role`} onClick={() => onUpdate(index, 'position', player.position)}>Use usual role</button>
          </span>}
        </td>
        <td className="col-head">
          <select aria-label={`Player ${index + 1}: Skin/Hair`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.head}
            onChange={e => onUpdate(index, 'head', e.target.value)}>
            {!HEADS.includes(player.head) && <option value={player.head}>{player.head}</option>}
            {HEADS.map(h => (
              <option key={h} value={h}>{HEAD_LABELS[h]}</option>
            ))}
          </select>
        </td>
        <td className="col-star">
          <input
            type="checkbox"
            className="star-checkbox"
            aria-label={`Player ${index + 1}: Star player`} checked={!!player.star}
            onChange={e => onUpdate(index, 'star', e.target.checked)}
          />
        </td>
      </tr>
      {errors.length > 0 && (
        <tr className="player-issue-row">
          <td colSpan={5} id={`player-errors-${index}`} role="alert">
            {errors.map((msg, i) => (
              <span key={i} className="player-issue-msg error">{msg}</span>
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
    <div className="editor-section">
      <h4>Players ({players.length})</h4>

      {formationErrors.length > 0 && (
        <div className="formation-errors">
          {formationErrors.map((msg, i) => (
            <div key={i} className="team-issue-item error">{msg}</div>
          ))}
        </div>
      )}

      <div className="player-table-wrapper">
        <table className="player-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-name">Name</th>
              <th className="col-pos">Position<HelpTip text="Choosing a position also sets its usual role for this formation. Choose a substitute type for the bench. Occupied positions are flagged, not swapped." /></th>
              <th className="col-head">Skin/Hair<HelpTip text="Player's skin tone and hair colour appearance in-game." /></th>
              <th className="col-star">★<HelpTip text="Star player. Only used in expert mode and doesn't affect custom teams." /></th>
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
      <details className="advanced-player-settings">
        <summary>Advanced player settings</summary>
        <p>Stored roles are preserved when loading a ROM. Override them here for unusual combinations. Choosing a position sets its usual role again.</p>
        <div className="role-overrides">
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

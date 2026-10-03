import React, { useCallback } from 'react';
import { CHARSET, POSITION_NAMES, ROLE_NAMES, HEAD_NAMES, MAX_PLAYER_NAME } from '../lib/sslib/index';
import HelpTip from './HelpTip';

const VALID_CHARS = new Set(CHARSET.slice(1));
const POSITIONS = Object.values(POSITION_NAMES);
const ROLES = Object.values(ROLE_NAMES);
const HEADS = Object.values(HEAD_NAMES);

const POSITION_LABELS = {
  goalkeeper: 'GK', right_back: 'RB', left_back: 'LB',
  centre_back: 'CB', defender: 'DEF',
  right_midfielder: 'RM', centre_midfielder: 'CM',
  left_midfielder: 'LM', midfielder: 'MID',
  forward: 'FW', second_forward: 'FW2', sub: 'SUB',
};

const ROLE_LABELS = {
  goalkeeper: 'G', defender: 'D', midfielder: 'M', forward: 'F',
};

const HEAD_LABELS = {
  white_dark: 'White/Dark', white_blonde: 'White/Blonde', black_dark: 'Black/Dark',
};

const EMPTY_ARRAY = [];

const PlayerRow = React.memo(function PlayerRow({ player, index, errors, onUpdate }) {
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
          <select aria-label={`Player ${index + 1}: Position`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.position}
            onChange={e => onUpdate(index, 'position', e.target.value)}>
            {!POSITIONS.includes(player.position) && <option value={player.position}>{player.position}</option>}
            {POSITIONS.map(p => (
              <option key={p} value={p}>{POSITION_LABELS[p]}</option>
            ))}
          </select>
        </td>
        <td className="col-role">
          <select aria-label={`Player ${index + 1}: Role`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.role}
            onChange={e => onUpdate(index, 'role', e.target.value)}>
            {!ROLES.includes(player.role) && <option value={player.role}>{player.role}</option>}
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </td>
        <td className="col-head">
          <select aria-label={`Player ${index + 1}: Head`} aria-invalid={errors.length > 0} aria-describedby={errors.length ? `player-errors-${index}` : undefined} value={player.head}
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
          <td colSpan={6} id={`player-errors-${index}`} role="alert">
            {errors.map((msg, i) => (
              <span key={i} className="player-issue-msg error">{msg}</span>
            ))}
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});

function PlayerEditor({ players, onChange, playerErrors, formationErrors }) {
  const updatePlayer = useCallback((index, field, value) => {
    onChange(players.map((p, i) => {
      if (i !== index) return p;
      const updated = { ...p, [field]: value };
      if (field === 'star' && !value) delete updated.star;
      return updated;
    }));
  }, [players, onChange]);

  const starters = [];
  const subs = [];
  players.forEach((p, i) => {
    if (p.position === 'sub') {
      subs.push({ player: p, index: i });
    } else {
      starters.push({ player: p, index: i });
    }
  });

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
              <th className="col-pos">Position<HelpTip text="Formation slot on the pitch. Determines where the player lines up (e.g. RB, CM, FW). Set to SUB for substitutes." /></th>
              <th className="col-role">Role<HelpTip text="General role type (G/D/M/F). Should generally match the player's position." /></th>
              <th className="col-head">Head<HelpTip text="Player's skin tone and hair colour appearance in-game." /></th>
              <th className="col-star">★<HelpTip text="Star player. Only used in expert mode and doesn't affect custom teams." /></th>
            </tr>
          </thead>
          <tbody>
            {starters.length > 0 && (
              <>
                <tr><td colSpan={6} className="player-section-label">Starting XI</td></tr>
                {starters.map(({ player, index }) => (
                  <PlayerRow
                    key={index}
                    player={player}
                    index={index}
                    errors={playerErrors[index] || EMPTY_ARRAY}
                    onUpdate={updatePlayer}
                  />
                ))}
              </>
            )}
            {subs.length > 0 && (
              <>
                <tr><td colSpan={6} className="player-section-label">Substitutes</td></tr>
                {subs.map(({ player, index }) => (
                  <PlayerRow
                    key={index}
                    player={player}
                    index={index}
                    errors={playerErrors[index] || EMPTY_ARRAY}
                    onUpdate={updatePlayer}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(PlayerEditor);

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CHARSET, POSITION_NAMES, ROLE_NAMES, HEAD_NAMES, MAX_PLAYER_NAME } from '../lib/sslib/index';

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
            value={player.number}
            onChange={e => onUpdate(index, 'number', parseInt(e.target.value) || 1)}
          />
        </td>
        <td className="col-name">
          <input
            type="text"
            value={player.name}
            maxLength={MAX_PLAYER_NAME}
            className={nameInvalid ? 'invalid' : ''}
            onChange={e => onUpdate(index, 'name', e.target.value.toUpperCase())}
            title={nameInvalid ? 'Only A-Z, space, dash, apostrophe, period allowed' : ''}
          />
        </td>
        <td className="col-pos">
          <select value={player.position}
            onChange={e => onUpdate(index, 'position', e.target.value)}>
            {POSITIONS.map(p => (
              <option key={p} value={p}>{POSITION_LABELS[p]}</option>
            ))}
          </select>
        </td>
        <td className="col-role">
          <select value={player.role}
            onChange={e => onUpdate(index, 'role', e.target.value)}>
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </td>
        <td className="col-head">
          <select value={player.head}
            onChange={e => onUpdate(index, 'head', e.target.value)}>
            {HEADS.map(h => (
              <option key={h} value={h}>{HEAD_LABELS[h]}</option>
            ))}
          </select>
        </td>
        <td className="col-star">
          <input
            type="checkbox"
            className="star-checkbox"
            checked={!!player.star}
            onChange={e => onUpdate(index, 'star', e.target.checked)}
          />
        </td>
      </tr>
      {errors.length > 0 && (
        <tr className="player-issue-row">
          <td colSpan={6}>
            {errors.map((msg, i) => (
              <span key={i} className="player-issue-msg error">{msg}</span>
            ))}
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});

const DEBOUNCE_MS = 300;

function PlayerEditor({ players: playersProp, onChange, playerErrors, formationErrors }) {
  const [players, setPlayers] = useState(playersProp);
  const debounceRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const playersRef = useRef(players);
  playersRef.current = players;

  const flush = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
    onChangeRef.current(playersRef.current);
  }, []);

  const updatePlayer = useCallback((index, field, value) => {
    setPlayers(prev => {
      const updated = prev.map((p, i) => {
        if (i !== index) return p;
        const newPlayer = { ...p, [field]: value };
        if (field === 'star') {
          if (value) {
            newPlayer.star = true;
          } else {
            delete newPlayer.star;
          }
        }
        return newPlayer;
      });
      playersRef.current = updated;
      return updated;
    });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) flush();
    };
  }, [flush]);

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
              <th className="col-pos">Position</th>
              <th className="col-role">Role</th>
              <th className="col-head">Head</th>
              <th className="col-star" title="Star player">★</th>
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

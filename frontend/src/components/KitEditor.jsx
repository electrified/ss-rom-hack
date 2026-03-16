import React, { useState, useRef, useEffect, useCallback } from 'react';
import { COLOUR_NAMES, STYLE_NAMES } from '../lib/sslib/index';

const COLOURS = Object.values(COLOUR_NAMES);
const STYLES = Object.values(STYLE_NAMES);

const COLOUR_CSS = {
  grey: '#808080', white: '#ffffff', black: '#1a1a1a', brown: '#8B4513',
  dark_orange: '#cc6600', orange: '#ff8c00', light_grey: '#c0c0c0',
  dark_grey: '#505050', dark_grey_2: '#404040', red: '#dc2626',
  blue: '#2563eb', dark_red: '#8b0000', light_blue: '#60a5fa',
  green: '#16a34a', yellow: '#eab308',
};

const STYLE_LABELS = { plain: 'Plain', sleeves: 'Sleeves', vertical: 'Stripes', horizontal: 'Hoops' };

function ShirtSvg({ style, color1, color2, id }) {
  const c1 = COLOUR_CSS[color1] || '#888';
  const c2 = COLOUR_CSS[color2] || '#888';
  const clipId = `shirt-clip-${id}`;

  const shirtPath = "M24,4 L36,4 L36,10 Q42,12 48,18 L54,30 L46,34 L42,24 L42,48 L18,48 L18,24 L14,34 L6,30 L12,18 Q18,12 24,10 Z";
  const leftSleeve = "M12,18 Q18,12 24,10 L24,4 L24,10 L18,24 L14,34 L6,30 Z";
  const rightSleeve = "M48,18 Q42,12 36,10 L36,4 L36,10 L42,24 L46,34 L54,30 Z";
  const bodyPath = "M24,10 L36,10 L42,24 L42,48 L18,48 L18,24 Z";

  let fill;
  if (style === 'plain') {
    fill = <path d={shirtPath} fill={c1} />;
  } else if (style === 'sleeves') {
    fill = (
      <>
        <path d={bodyPath} fill={c1} />
        <path d={leftSleeve} fill={c2} />
        <path d={rightSleeve} fill={c2} />
      </>
    );
  } else if (style === 'vertical') {
    fill = (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={shirtPath} />
          </clipPath>
        </defs>
        <path d={shirtPath} fill={c1} />
        <g clipPath={`url(#${clipId})`}>
          <rect x="4" y="0" width="7" height="62" fill={c2} />
          <rect x="18" y="0" width="7" height="62" fill={c2} />
          <rect x="32" y="0" width="7" height="62" fill={c2} />
          <rect x="46" y="0" width="7" height="62" fill={c2} />
        </g>
      </>
    );
  } else if (style === 'horizontal') {
    fill = (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={shirtPath} />
          </clipPath>
        </defs>
        <path d={shirtPath} fill={c1} />
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="4" width="60" height="7" fill={c2} />
          <rect x="0" y="18" width="60" height="7" fill={c2} />
          <rect x="0" y="32" width="60" height="7" fill={c2} />
          <rect x="0" y="46" width="60" height="7" fill={c2} />
        </g>
      </>
    );
  }

  return (
    <svg viewBox="0 0 60 52" className="kit-svg-shirt">
      {fill}
      <path d={shirtPath} fill="none" stroke="#000" strokeWidth="1.2" />
    </svg>
  );
}

function ShortsSvg({ color }) {
  const c = COLOUR_CSS[color] || '#888';
  return (
    <svg viewBox="0 0 60 24" className="kit-svg-shorts">
      <path d="M18,2 L42,2 L44,22 L33,22 L30,14 L27,22 L16,22 Z" fill={c} stroke="#000" strokeWidth="1.2" />
    </svg>
  );
}

function SocksSvg({ color }) {
  const c = COLOUR_CSS[color] || '#888';
  // Right sock: straight tube, smooth heel curve, flat sole, rounded toe, foot points right
  const rightSock = "M34,1 L44,1 L44,22 C44,25 48,27 52,27 C55,27 57,29 57,31 C57,33 55,35 52,35 L40,35 C35,35 34,33 34,29 Z";
  return (
    <svg viewBox="0 0 60 38" className="kit-svg-socks">
      {/* Left sock - mirrored right sock */}
      <g transform="translate(60,0) scale(-1,1)">
        <path d={rightSock} fill={c} stroke="#000" strokeWidth="1" strokeLinejoin="round" />
      </g>
      {/* Right sock */}
      <path d={rightSock} fill={c} stroke="#000" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function ColourPicker({ selected, onSelect, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const handleClickOutside = useCallback((e) => {
    if (ref.current && !ref.current.contains(e.target)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div className="kit-colour-picker" ref={ref}>
      <button className="kit-colour-trigger" onClick={() => setOpen(!open)}>
        <span className="kit-colour-trigger-swatch" style={{ background: COLOUR_CSS[selected] || '#888' }} />
        <span className="kit-colour-trigger-label">{label}</span>
        <span className="kit-colour-trigger-name">{selected.replace(/_/g, ' ')}</span>
      </button>
      {open && (
        <div className="kit-colour-popover">
          {COLOURS.map(c => (
            <button
              key={c}
              className={`kit-colour-option${c === selected ? ' active' : ''}`}
              style={{ background: COLOUR_CSS[c] || '#888' }}
              title={c.replace(/_/g, ' ')}
              onClick={() => { onSelect(c); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KitSetEditor({ kitSet, label, id, onChange }) {
  const update = (field, value) => {
    onChange({ ...kitSet, [field]: value });
  };

  return (
    <div className="kit-set">
      <h5>{label}</h5>
      <div className="kit-mannequin">
        <ShirtSvg style={kitSet.style} color1={kitSet.shirt1} color2={kitSet.shirt2} id={id} />
        <ShortsSvg color={kitSet.shorts} />
        <SocksSvg color={kitSet.socks} />
      </div>
      <div className="kit-controls">
        <div className="kit-style-row">
          <span className="kit-colour-trigger-label">Style</span>
          <div className="kit-style-buttons">
            {STYLES.map(s => (
              <button
                key={s}
                className={`kit-style-btn${s === kitSet.style ? ' active' : ''}`}
                onClick={() => update('style', s)}
              >
                {STYLE_LABELS[s] || s}
              </button>
            ))}
          </div>
        </div>
        <ColourPicker selected={kitSet.shirt1} onSelect={c => update('shirt1', c)} label="Shirt 1" />
        <ColourPicker selected={kitSet.shirt2} onSelect={c => update('shirt2', c)} label="Shirt 2" />
        <ColourPicker selected={kitSet.shorts} onSelect={c => update('shorts', c)} label="Shorts" />
        <ColourPicker selected={kitSet.socks} onSelect={c => update('socks', c)} label="Socks" />
      </div>
    </div>
  );
}

function KitEditor({ kit, onChange }) {
  const updateSet = (which, kitSet) => {
    onChange({ ...kit, [which]: kitSet });
  };

  return (
    <div className="editor-section">
      <h4>Kit</h4>
      <div className="kit-sets">
        <KitSetEditor
          kitSet={kit.first}
          label="First Kit"
          id="first"
          onChange={set => updateSet('first', set)}
        />
        <KitSetEditor
          kitSet={kit.second}
          label="Second Kit"
          id="second"
          onChange={set => updateSet('second', set)}
        />
      </div>
    </div>
  );
}

export default React.memo(KitEditor);

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

  const shirtPath = "M30.0,0.0 L23.4,0.0 L16.5,4.9 L6.0,27.5 L10.5,31.4 L18.3,20.1 L18.7,46.2 L41.3,46.2 L41.7,20.1 L49.5,31.4 L54.0,27.5 L43.5,4.9 L36.6,0.0 Z";

  let fill;
  if (style === 'plain' || style === 'sleeves') {
    fill = <path d={shirtPath} fill={c1} fillRule="nonzero" />;
  } else if (style === 'vertical') {
    fill = (
      <React.Fragment>
        <defs>
          <clipPath id={clipId}>
            <path d={shirtPath} />
          </clipPath>
        </defs>
        <path d={shirtPath} fill={c1} />
        <g clipPath={`url(#${clipId})`}>
          <rect x="5" y="0" width="6" height="52" fill={c2} />
          <rect x="17" y="0" width="6" height="52" fill={c2} />
          <rect x="29" y="0" width="6" height="52" fill={c2} />
          <rect x="41" y="0" width="6" height="52" fill={c2} />
          <rect x="53" y="0" width="6" height="52" fill={c2} />
        </g>
      </React.Fragment>
    );
  } else if (style === 'horizontal') {
    fill = (
      <React.Fragment>
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
      </React.Fragment>
    );
  }

  return (
    <svg viewBox="0 0 60 50" className="kit-svg-shirt">
      {fill}
      {/* Crisp 16-bit outline */}
      <path d={shirtPath} fill="none" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
    </svg>
  );
}

function ShortsSvg({ color }) {
  const c = COLOUR_CSS[color] || '#888';
  // Precise pixel staircase based on kit.png
  const shortsPath = "M30.0,0.2 L18.7,0.2 L15.2,21.3 L27.1,23.8 L28.4,19.3 L30.0,19.1 L31.6,19.3 L32.9,23.8 L44.8,21.3 L41.3,0.2 Z";
  
  return (
    <svg viewBox="0 0 60 25" className="kit-svg-shorts">
      <path d={shortsPath} fill={c} stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
    </svg>
  );
}

function SocksSvg({ color }) {
  const c = COLOUR_CSS[color] || '#888';
  // Precise outward stepping blocks
  const socksPath = "M15.2,0.0 L10.7,26.3 L16.5,27.5 L23.6,2.5 Z M44.8,0.0 L49.3,26.3 L43.5,27.5 L36.4,2.5 Z";

  return (
    <svg viewBox="0 0 60 30" className="kit-svg-socks">
      <path d={socksPath} fill={c} stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
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

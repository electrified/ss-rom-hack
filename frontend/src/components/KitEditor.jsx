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

  const shirtPath = "M23.4,0.0 L23.4,1.8 L23.0,2.3 L22.8,2.3 L22.6,2.5 L18.9,2.5 L18.7,2.7 L18.7,3.1 L18.1,3.7 L17.7,3.7 L17.7,3.9 L17.5,4.1 L17.5,4.5 L17.3,4.7 L17.1,4.7 L16.9,4.9 L16.5,4.9 L16.5,6.8 L15.8,7.4 L15.4,7.4 L15.2,7.6 L15.2,9.4 L14.8,9.8 L14.4,9.8 L14.2,10.1 L14.2,11.3 L14.0,11.5 L14.0,11.9 L13.6,12.3 L13.4,12.3 L13.2,12.5 L13.0,12.5 L13.0,14.2 L12.8,14.4 L12.8,14.6 L12.6,14.8 L12.4,14.8 L12.2,15.0 L11.7,15.0 L11.7,16.8 L11.1,17.4 L10.7,17.4 L10.7,18.7 L10.5,18.9 L10.5,19.5 L10.1,19.9 L9.7,19.9 L9.5,20.1 L9.5,21.5 L9.3,21.7 L9.3,21.9 L8.9,22.4 L8.5,22.4 L8.3,22.6 L8.3,24.2 L8.1,24.4 L8.1,24.6 L7.8,24.8 L7.6,24.8 L7.4,25.0 L7.0,25.0 L7.0,26.9 L6.4,27.5 L6.0,27.5 L6.2,27.7 L6.6,27.7 L7.0,28.1 L7.0,28.7 L7.2,28.9 L7.6,28.9 L8.3,29.5 L8.3,29.9 L8.5,30.2 L8.9,30.2 L9.3,30.6 L9.3,30.8 L9.5,31.0 L9.5,31.4 L10.5,31.4 L10.7,31.2 L10.7,29.3 L11.1,28.9 L11.5,28.9 L11.9,28.5 L11.9,28.1 L12.4,27.7 L12.6,27.7 L12.8,27.5 L13.0,27.5 L13.0,25.8 L13.2,25.6 L13.2,25.4 L13.4,25.2 L13.6,25.2 L13.8,25.0 L14.2,25.0 L14.2,24.4 L14.8,23.8 L15.2,23.8 L15.4,23.6 L15.4,21.7 L15.6,21.5 L15.8,21.5 L16.1,21.3 L16.5,21.3 L16.5,20.9 L16.7,20.7 L16.7,20.5 L17.1,20.1 L18.3,20.1 L18.7,20.5 L18.7,21.1 L18.9,21.3 L18.9,26.7 L18.7,26.9 L18.7,46.2 L18.9,46.4 L41.1,46.4 L41.1,20.7 L41.7,20.1 L42.7,20.1 L43.3,20.7 L43.3,21.1 L43.5,21.3 L43.9,21.3 L44.6,21.9 L44.6,23.8 L45.0,23.8 L45.6,24.4 L45.6,24.8 L45.8,25.0 L46.0,25.0 L46.2,25.2 L46.4,25.2 L46.8,25.6 L46.8,27.5 L47.0,27.7 L47.4,27.7 L48.1,28.3 L48.1,28.7 L48.3,28.9 L48.7,28.9 L49.1,29.3 L49.1,29.7 L49.3,29.9 L49.3,31.4 L50.3,31.4 L50.5,31.2 L50.5,30.6 L50.9,30.2 L51.3,30.2 L51.5,29.9 L51.5,29.7 L51.7,29.5 L51.7,29.3 L52.2,28.9 L52.6,28.9 L52.8,28.7 L52.8,28.3 L53.0,28.1 L53.0,27.9 L53.2,27.7 L53.6,27.7 L53.8,27.5 L53.4,27.5 L53.0,27.1 L53.0,26.9 L52.8,26.7 L52.8,25.0 L52.4,25.0 L52.2,24.8 L51.9,24.8 L51.7,24.6 L51.7,24.2 L51.5,24.0 L51.5,22.6 L51.3,22.6 L51.1,22.4 L50.9,22.4 L50.5,21.9 L50.5,20.1 L50.3,19.9 L49.7,19.9 L49.5,19.7 L49.5,19.5 L49.3,19.3 L49.3,17.6 L49.1,17.4 L48.7,17.4 L48.3,17.0 L48.3,16.8 L48.1,16.6 L48.1,15.0 L47.6,15.0 L47.4,14.8 L47.2,14.8 L47.0,14.6 L47.0,13.9 L46.8,13.7 L46.8,12.5 L46.6,12.5 L46.4,12.3 L46.2,12.3 L45.8,11.9 L45.8,10.1 L45.6,10.1 L45.4,9.8 L45.0,9.8 L44.8,9.6 L44.8,9.4 L44.6,9.2 L44.6,7.6 L44.4,7.4 L43.9,7.4 L43.5,7.0 L43.5,6.6 L43.3,6.4 L43.3,4.9 L42.9,4.9 L42.3,4.3 L42.3,3.7 L41.9,3.7 L41.7,3.5 L41.5,3.5 L41.3,3.3 L41.3,3.1 L41.1,2.9 L41.1,2.5 L37.2,2.5 L36.6,1.8 L36.6,1.6 L36.4,1.4 L36.4,0.0 Z";

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
  const shortsPath = "M18.9,0.0 L18.7,0.2 L18.7,4.5 L18.3,4.9 L17.9,4.9 L17.7,5.1 L17.7,10.3 L17.5,10.5 L17.5,10.9 L17.3,11.1 L17.1,11.1 L16.9,11.3 L16.5,11.3 L16.5,16.8 L16.3,17.0 L16.3,17.2 L16.1,17.4 L15.6,17.4 L15.4,17.6 L15.2,17.6 L15.2,21.3 L17.9,21.3 L18.1,21.5 L18.3,21.5 L18.7,21.9 L18.7,22.4 L18.9,22.6 L22.4,22.6 L22.6,22.8 L23.0,22.8 L23.4,23.2 L23.4,23.8 L27.1,23.8 L27.1,21.9 L27.5,21.5 L27.7,21.5 L27.9,21.3 L28.2,21.3 L28.2,19.9 L28.4,19.7 L28.4,19.3 L28.6,19.1 L28.8,19.1 L29.0,18.9 L31.0,18.9 L31.6,19.5 L31.6,21.3 L31.8,21.5 L32.3,21.5 L32.7,21.9 L32.7,22.2 L32.9,22.4 L32.9,23.8 L33.1,24.0 L35.1,24.0 L35.3,23.8 L36.4,23.8 L36.4,23.6 L36.6,23.4 L36.6,23.2 L37.0,22.8 L37.2,22.8 L37.4,22.6 L41.1,22.6 L41.1,22.2 L41.3,21.9 L41.3,21.7 L41.5,21.5 L41.9,21.5 L42.1,21.3 L44.6,21.3 L44.6,17.6 L44.4,17.6 L44.2,17.4 L43.9,17.4 L43.5,17.0 L43.5,16.6 L43.3,16.4 L43.3,11.3 L42.9,11.3 L42.3,10.7 L42.3,5.1 L42.1,5.1 L41.9,4.9 L41.5,4.9 L41.3,4.7 L41.3,4.5 L41.1,4.3 L41.1,0.0 Z";
  
  return (
    <svg viewBox="0 0 60 25" className="kit-svg-shorts">
      <path d={shortsPath} fill={c} stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
    </svg>
  );
}

function SocksSvg({ color }) {
  const c = COLOUR_CSS[color] || '#888';
  // Precise outward stepping blocks
  const socksPath = "M15.2,0.0 L15.2,1.8 L14.8,2.3 L14.6,2.3 L14.4,2.5 L14.2,2.5 L14.2,7.6 L14.0,7.8 L14.0,8.2 L13.6,8.6 L13.2,8.6 L13.0,8.8 L13.0,15.4 L12.8,15.6 L12.8,15.8 L12.6,16.0 L12.4,16.0 L12.2,16.2 L11.7,16.2 L11.7,23.2 L11.3,23.6 L10.9,23.6 L10.7,23.8 L10.7,26.3 L13.4,26.3 L13.6,26.5 L13.8,26.5 L14.0,26.7 L14.0,27.1 L14.2,27.3 L14.2,27.5 L16.5,27.5 L16.5,26.1 L16.7,25.8 L16.7,25.4 L16.9,25.2 L17.1,25.2 L17.3,25.0 L17.7,25.0 L17.7,21.9 L18.3,21.3 L18.7,21.3 L18.9,21.1 L18.9,18.1 L19.3,17.6 L19.7,17.6 L19.9,17.4 L19.9,13.5 L20.2,13.3 L20.2,12.9 L20.4,12.7 L20.6,12.7 L20.8,12.5 L21.2,12.5 L21.2,9.4 L21.8,8.8 L22.2,8.8 L22.4,8.6 L22.4,5.5 L22.8,5.1 L23.2,5.1 L23.4,4.9 L23.4,4.5 L23.6,4.3 L23.6,2.5 L22.0,2.5 L21.8,2.3 L21.6,2.3 L21.4,2.1 L21.4,1.8 L21.2,1.6 L21.2,1.2 L17.5,1.2 L17.3,1.0 L17.1,1.0 L16.7,0.6 L16.7,0.4 L16.5,0.2 L16.5,0.0 Z M44.6,0.0 L44.6,0.4 L43.9,1.0 L43.7,1.0 L43.5,1.2 L39.8,1.2 L39.8,1.6 L39.6,1.8 L39.6,2.1 L39.4,2.3 L39.2,2.3 L39.0,2.5 L37.6,2.5 L37.6,4.9 L37.8,5.1 L38.2,5.1 L38.6,5.5 L38.6,8.6 L38.8,8.8 L39.2,8.8 L39.8,9.4 L39.8,12.5 L40.3,12.5 L40.5,12.7 L40.7,12.7 L40.9,12.9 L40.9,13.3 L41.1,13.5 L41.1,17.4 L41.3,17.6 L41.7,17.6 L42.1,18.1 L42.1,21.1 L42.3,21.3 L42.7,21.3 L43.3,21.9 L43.3,25.0 L43.7,25.0 L43.9,25.2 L44.2,25.2 L44.4,25.4 L44.4,25.6 L44.6,25.8 L44.6,27.5 L47.0,27.5 L47.0,26.9 L47.4,26.5 L47.6,26.5 L47.8,26.3 L50.5,26.3 L50.5,23.8 L50.1,23.8 L49.9,23.6 L49.7,23.6 L49.3,23.2 L49.3,16.2 L48.7,16.2 L48.3,15.8 L48.3,15.6 L48.1,15.4 L48.1,8.8 L47.8,8.6 L47.4,8.6 L47.0,8.2 L47.0,7.6 L46.8,7.4 L46.8,2.5 L46.6,2.5 L46.4,2.3 L46.2,2.3 L46.0,2.1 L46.0,1.8 L45.8,1.6 L45.8,0.0 Z";

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

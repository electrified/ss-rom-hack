import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import ui from './ui';
import { COLOUR_NAMES, STYLE_NAMES } from '../lib/sslib/index';

const COLOURS = Object.values(COLOUR_NAMES);
const STYLES = Object.values(STYLE_NAMES);

const styles = {
  kitSets: 'grid grid-cols-2 gap-4 max-[768px]:grid-cols-1',
  kitSet: 'rounded-[6px] border border-solid border-ui-border bg-ui-surface p-3 [&_h5]:mb-3 [&_h5]:text-center [&_h5]:font-pixel [&_h5]:text-[0.5rem] [&_h5]:tracking-[0.1em] [&_h5]:text-ui-text-soft [&_h5]:uppercase',
  kitMannequin: 'mb-3 flex flex-col items-center gap-px',
  kitSvgShirt: 'h-[86px] w-[100px] max-[768px]:h-[69px] max-[768px]:w-[80px]',
  kitSvgShorts: '-mt-[2px] h-10 w-[100px] max-[768px]:h-8 max-[768px]:w-[80px]',
  kitSvgSocks: '-mt-[2px] h-[42px] w-[100px] max-[768px]:h-[34px] max-[768px]:w-[80px]',
  kitControls: 'flex flex-col gap-2',
  kitStyleRow: 'flex flex-col gap-[0.3rem]',
  kitStyleButtons: 'flex gap-[2px] rounded bg-ui-surface-raised p-[2px]',
  kitStyleBtn: 'flex-1 cursor-pointer rounded-[3px] border-0 bg-transparent px-[0.2rem] py-[0.3rem] text-[0.6rem] font-semibold text-ui-text-muted transition-all duration-150 hover:bg-ui-accent-bright-10 hover:text-ui-accent-bright',
  active: 'bg-ui-accent! text-ui-white!',
  kitColourPicker: 'relative',
  kitColourTrigger: 'flex w-full cursor-pointer items-center gap-[0.4rem] rounded border border-solid border-ui-border bg-ui-surface-raised px-2 py-[0.3rem] transition-colors duration-150 hover:border-ui-accent',
  kitColourTriggerSwatch: 'size-4 shrink-0 rounded-[3px] border border-solid border-ui-white-20',
  kitColourTriggerLabel: 'shrink-0 text-[0.65rem] font-semibold tracking-[0.05em] text-ui-text-muted uppercase',
  kitColourTriggerName: 'ml-auto text-[0.7rem] text-ui-text-soft capitalize',
  kitColourPopover: 'absolute inset-x-0 top-full z-10 mt-[2px] grid grid-cols-5 gap-1 rounded-[6px] border border-solid border-ui-accent bg-ui-surface p-[6px] [box-shadow:0_4px_12px_var(--color-shadow-50)]',
  kitColourOption: 'aspect-square w-full cursor-pointer rounded border-2 border-solid border-transparent p-0 transition-[border-color,transform] duration-100 hover:scale-110 hover:border-ui-accent-bright focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ui-heading',
  selectedColour: 'border-ui-white! [box-shadow:0_0_4px_var(--color-accent-bright-60)]',
};

// Fixed game palette for kit previews; these colours are independent of the UI theme.
const COLOUR_CSS = {
  grey: '#acacac', white: '#ffffff', black: '#000000', orange: '#ff7400',
  red: '#ff0000', blue: '#0000ff', dark_red: '#740034', light_blue: '#9090ff',
  green: '#349000', yellow: '#ffff00',
};

const STYLE_LABELS = { plain: 'Plain', sleeves: 'Sleeves', vertical: 'Stripes', horizontal: 'Hoops' };

function ShirtSvg({ style, color1, color2, id }) {
  const c1 = COLOUR_CSS[color1] || '#888';
  const c2 = COLOUR_CSS[color2] || '#888';
  const clipId = `shirt-clip-${id}`;

  const shirtPath = "M30.0,0.0 L23.4,0.0 L16.5,4.9 L6.0,27.5 L10.5,31.4 L18.3,20.1 L18.7,46.2 L41.3,46.2 L41.7,20.1 L49.5,31.4 L54.0,27.5 L43.5,4.9 L36.6,0.0 Z";
  const bodyPath = "M30.0,0.0 L23.4,0.0 L16.5,4.9 L18.3,20.1 L18.7,46.2 L41.3,46.2 L41.7,20.1 L43.5,4.9 L36.6,0.0 Z";
  const leftSleeve = "M16.5,4.9 L6.0,27.5 L10.5,31.4 L18.3,20.1 Z";
  const rightSleeve = "M43.5,4.9 L54.0,27.5 L49.5,31.4 L41.7,20.1 Z";

  let fill;
  if (style === 'plain') {
    fill = <path d={shirtPath} fill={c1} fillRule="nonzero" />;
  } else if (style === 'sleeves') {
    fill = (
      <React.Fragment>
        <path d={bodyPath} fill={c1} />
        <path d={leftSleeve} fill={c2} />
        <path d={rightSleeve} fill={c2} />
      </React.Fragment>
    );
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
    <svg viewBox="0 0 60 50" className={styles.kitSvgShirt}>
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
    <svg viewBox="0 0 60 25" className={styles.kitSvgShorts}>
      <path d={shortsPath} fill={c} stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
    </svg>
  );
}

function SocksSvg({ color }) {
  const c = COLOUR_CSS[color] || '#888';
  // Precise outward stepping blocks
  const socksPath = "M15.2,0.0 L10.7,26.3 L16.5,27.5 L23.6,2.5 Z M44.8,0.0 L49.3,26.3 L43.5,27.5 L36.4,2.5 Z";

  return (
    <svg viewBox="0 0 60 30" className={styles.kitSvgSocks}>
      <path d={socksPath} fill={c} stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
    </svg>
  );
}

function ColourPicker({ selected, onSelect, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trigger = useRef(null);
  const id = useId();

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

  useEffect(() => { if (open) ref.current?.querySelector('[data-colour-option][aria-pressed="true"], [data-colour-option]')?.focus(); }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return (
    <div onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }} className={styles.kitColourPicker} ref={ref}>
      <button type="button" ref={trigger} aria-expanded={open} aria-controls={id} aria-label={`${label}: ${selected}`} className={styles.kitColourTrigger} onClick={() => setOpen(!open)}>
        <span className={styles.kitColourTriggerSwatch} style={{ background: COLOUR_CSS[selected] || '#888' }} />
        <span className={styles.kitColourTriggerLabel}>{label}</span>
        <span className={styles.kitColourTriggerName}>{selected.replace(/_/g, ' ')}</span>
      </button>
      {open && (
        <div className={styles.kitColourPopover} id={id} role="group" aria-label={`${label} colours`}>
          {COLOURS.map(c => (
            <button
              key={c}
              className={`${styles.kitColourOption} ${c === selected ? styles.selectedColour : ''}`}
              data-colour-option
              style={{ background: COLOUR_CSS[c] || '#888' }}
              aria-label={c.replace(/_/g, ' ')} aria-pressed={c === selected} title={c.replace(/_/g, ' ')}
              onClick={() => { onSelect(c); close(); }}
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
    <div className={styles.kitSet}>
      <h5>{label}</h5>
      <div className={styles.kitMannequin}>
        <ShirtSvg style={kitSet.style} color1={kitSet.shirt1} color2={kitSet.shirt2} id={id} />
        <ShortsSvg color={kitSet.shorts} />
        <SocksSvg color={kitSet.socks} />
      </div>
      <div className={styles.kitControls}>
        <div className={styles.kitStyleRow}>
          <span className={styles.kitColourTriggerLabel}>Style</span>
          <div className={styles.kitStyleButtons}>
            {STYLES.map(s => (
              <button
                key={s}
                aria-label={`${label} style: ${STYLE_LABELS[s]}`} aria-pressed={s === kitSet.style} className={`${styles.kitStyleBtn} ${s === kitSet.style ? styles.active : ''}`}
                onClick={() => update('style', s)}
              >
                {STYLE_LABELS[s] || s}
              </button>
            ))}
          </div>
        </div>
        <ColourPicker selected={kitSet.shirt1} onSelect={c => update('shirt1', c)} label={`${label}: Shirt 1`} />
        <ColourPicker selected={kitSet.shirt2} onSelect={c => update('shirt2', c)} label={`${label}: Shirt 2`} />
        <ColourPicker selected={kitSet.shorts} onSelect={c => update('shorts', c)} label={`${label}: Shorts`} />
        <ColourPicker selected={kitSet.socks} onSelect={c => update('socks', c)} label={`${label}: Socks`} />
      </div>
    </div>
  );
}

function KitEditor({ kit, onChange }) {
  const updateSet = (which, kitSet) => {
    onChange({ ...kit, [which]: kitSet });
  };

  return (
    <div className={ui.editorSection} data-testid="kit-section">
      <h4>Kit</h4>
      <div className={styles.kitSets} data-testid="kit-sets">
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

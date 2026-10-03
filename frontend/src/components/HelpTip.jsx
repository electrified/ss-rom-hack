import React, { useState, useRef, useEffect, useCallback, useId } from 'react';

function HelpTip({ text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);
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

  return (
    <span className="help-tip" ref={ref} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } }}>
      <button
        className={`help-tip-btn${open ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        ref={buttonRef} aria-label={`Help: ${text}`} aria-expanded={open} aria-controls={id}
        type="button"
      >?</button>
      {open && <span id={id} role="note" className="help-tip-bubble">{text}</span>}
    </span>
  );
}

export default HelpTip;

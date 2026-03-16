import React, { useState, useRef, useEffect, useCallback } from 'react';

function HelpTip({ text }) {
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
    <span className="help-tip" ref={ref}>
      <button
        className={`help-tip-btn${open ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        type="button"
      >?</button>
      {open && <span className="help-tip-bubble">{text}</span>}
    </span>
  );
}

export default HelpTip;

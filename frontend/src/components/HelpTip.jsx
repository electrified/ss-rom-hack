import React, { useState, useRef, useEffect, useCallback, useId } from 'react';

const styles = {
  helpTip: 'relative ml-[0.3rem] inline-flex align-middle',
  helpTipBtn: 'inline-flex size-[14px] cursor-pointer items-center justify-center rounded-full border border-solid border-ui-text-dim bg-transparent p-0 text-[0.55rem] leading-none font-bold text-ui-text-muted transition-all duration-150 hover:border-ui-accent hover:bg-ui-accent-15 hover:text-ui-accent-bright focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ui-heading',
  active: 'border-ui-accent! bg-ui-accent-15! text-ui-accent-bright!',
  helpTipBubble: 'pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-max max-w-[220px] -translate-x-1/2 rounded-[5px] border border-solid border-ui-accent bg-ui-border px-[0.6rem] py-[0.4rem] text-[0.7rem] leading-[1.4] font-normal tracking-normal text-ui-text-soft normal-case whitespace-normal [box-shadow:0_2px_8px_var(--color-shadow-40)] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[5px] after:border-solid after:border-transparent after:border-t-ui-accent after:content-[" "] [th_&]:top-[calc(100%+6px)] [th_&]:right-[-8px] [th_&]:bottom-auto [th_&]:left-auto [th_&]:translate-x-0 [th_&]:after:top-auto [th_&]:after:right-[10px] [th_&]:after:bottom-full [th_&]:after:left-auto [th_&]:after:translate-x-0 [th_&]:after:border-t-transparent [th_&]:after:border-b-ui-accent',
};

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
    <span className={styles.helpTip} ref={ref} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } }}>
      <button
        className={`${styles.helpTipBtn} ${open ? styles.active : ''}`}
        onClick={() => setOpen(!open)}
        ref={buttonRef} aria-label={`Help: ${text}`} aria-expanded={open} aria-controls={id}
        type="button"
      >?</button>
      {open && <span id={id} role="note" className={styles.helpTipBubble}>{text}</span>}
    </span>
  );
}

export default HelpTip;

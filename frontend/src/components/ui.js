// Shared Tailwind classes. Colours resolve through theme.css at runtime.
const ui = {
  button: 'cursor-pointer rounded-[6px] border-0 bg-ui-accent px-6 py-3 text-base leading-normal font-semibold text-ui-white transition-all duration-300 enabled:hover:-translate-y-px enabled:hover:bg-ui-accent-hover disabled:cursor-not-allowed disabled:bg-ui-surface-action disabled:text-ui-text-dim',
  secondary: 'bg-ui-surface-action! text-ui-text! enabled:hover:bg-ui-secondary-hover!',
  spinner: 'inline-block size-5 animate-[spin_1s_ease-in-out_infinite] rounded-full border-[3px] border-solid border-ui-accent-bright-30 border-t-ui-accent-bright',
  errorMessage: 'mt-4 rounded-lg border border-solid border-ui-error bg-ui-error-20 p-4 text-ui-error',
  successMessage: 'mt-4 rounded-lg border border-solid border-ui-accent bg-ui-accent-15 p-4 text-ui-accent-bright',
  editorSection: 'rounded-lg border border-solid border-ui-border bg-ui-surface-raised p-4 [&_h4]:mb-3 [&_h4]:font-pixel [&_h4]:text-[0.55rem] [&_h4]:leading-[1.6] [&_h4]:text-ui-accent-bright [&_h4]:[text-shadow:1px_1px_0_var(--color-border)]',
  teamIssueItem: 'rounded-sm px-2 py-[0.3rem] text-[0.8rem]',
  error: 'border-0 border-l-[3px] border-solid border-ui-error bg-ui-error-12 text-ui-error',
};

export default ui;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error The app's browser integration is JavaScript.
import { createAnalytics } from './analytics';

describe('analytics consent', () => {
  let browser: any;
  let appendChild: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    browser = { location: { hostname: 'example.com', origin: 'https://example.com', pathname: '/sensi/' } };
    appendChild = vi.fn();
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', { createElement: () => ({}), head: { appendChild } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does not load Google or queue events before consent', () => {
    createAnalytics('G-TEST123')(false);
    expect(appendChild).not.toHaveBeenCalled();
    expect(browser.dataLayer).toBeUndefined();
  });

  it('ignores missing or malformed measurement IDs', () => {
    for (const id of [undefined, '', 'UA-123', 'G-<script>']) createAnalytics(id)(true);
    expect(appendChild).not.toHaveBeenCalled();
    expect(browser.dataLayer).toBeUndefined();
  });

  it('loads once after consent and disables collection on withdrawal', () => {
    const setConsent = createAnalytics('G-TEST123');
    setConsent(true);
    setConsent(true);
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(appendChild.mock.calls[0][0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST123');
    const commands = browser.dataLayer.map((args: any) => Array.from(args));
    expect(commands[0]).toEqual(['consent', 'default', expect.objectContaining({ analytics_storage: 'denied', ad_storage: 'denied' })]);
    expect(commands.filter((args: any) => args[0] === 'config')).toHaveLength(1);
    setConsent(false);
    expect(browser['ga-disable-G-TEST123']).toBe(true);
    expect(Array.from(browser.dataLayer.at(-1))).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    setConsent(true);
    expect(browser['ga-disable-G-TEST123']).toBe(false);
    expect(appendChild).toHaveBeenCalledTimes(1);
  });
});

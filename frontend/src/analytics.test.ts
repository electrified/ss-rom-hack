import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error The app's browser integration is JavaScript.
import { createAnalytics } from './analytics';

describe('analytics initialization', () => {
  let browser: any;
  let appendChild: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    browser = { location: { hostname: 'example.com', origin: 'https://example.com', pathname: '/sensi/', search: '?private=value', hash: '#private' } };
    appendChild = vi.fn();
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', { createElement: () => ({}), head: { appendChild } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ignores missing or malformed measurement IDs', () => {
    for (const id of [undefined, '', 'UA-123', 'G-<script>']) createAnalytics(id)();
    expect(appendChild).not.toHaveBeenCalled();
    expect(browser.dataLayer).toBeUndefined();
  });

  it('loads immediately and initializes only once', () => {
    const initAnalytics = createAnalytics('G-TEST123');
    initAnalytics();
    initAnalytics();
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(appendChild.mock.calls[0][0]).toMatchObject({async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST123'});
    const commands = browser.dataLayer.map((args: any) => Array.from(args));
    expect(commands).toEqual([
      ['js', expect.any(Date)],
      ['config', 'G-TEST123', expect.objectContaining({
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: 'https://example.com/sensi/',
        page_referrer: '',
      })],
    ]);
  });

  it('preserves an existing data layer', () => {
    browser.dataLayer = [['existing-event']];
    createAnalytics('G-TEST123')();
    expect(browser.dataLayer[0]).toEqual(['existing-event']);
    expect(browser.dataLayer).toHaveLength(3);
  });
});

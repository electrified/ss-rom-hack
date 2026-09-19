import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import { createAnalytics } from './analytics';

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const analyticsEnabled = /^G-[A-Z0-9]+$/.test(measurementId || '');
const setAnalyticsConsent = createAnalytics(measurementId);
const syncConsent = () => setAnalyticsConsent(CookieConsent.acceptedCategory('analytics'));

export function initCookieConsent() {
  return CookieConsent.run({
    mode: 'opt-in',
    cookie: { name: 'sensi_cookie_consent', expiresAfterDays: 180 },
    guiOptions: {
      consentModal: { layout: 'box', position: 'bottom right', equalWeightButtons: true },
      preferencesModal: { layout: 'box', equalWeightButtons: true },
    },
    onConsent: syncConsent,
    onChange: syncConsent,
    categories: {
      necessary: { enabled: true, readOnly: true },
      ...(analyticsEnabled ? {
        analytics: {
          autoClear: { cookies: [{ name: /^_ga(?:_|$)/ }] },
        },
      } : {}),
    },
    language: {
      default: 'en',
      translations: {
        en: {
          consentModal: {
            title: 'Your cookie choices',
            description: analyticsEnabled
              ? 'With your permission, we use Google Analytics to understand visits to this site. Your ROM files and team edits stay in your browser. You can change your choice at any time in Cookie settings.'
              : 'We use a cookie to remember your cookie preferences. Google Analytics is not enabled on this site.',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject optional cookies',
            showPreferencesBtn: 'Manage preferences',
          },
          preferencesModal: {
            title: 'Cookie settings',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject optional cookies',
            savePreferencesBtn: 'Save preferences',
            closeIconLabel: 'Close cookie settings',
            sections: [
              {
                title: 'Your privacy',
                description: 'ROM processing happens locally in your browser. We do not send ROM contents or team edits to Google Analytics. You can withdraw analytics consent here without losing your work.',
              },
              {
                title: 'Essential cookies',
                description: 'The sensi_cookie_consent cookie remembers your choice for 180 days.',
                linkedCategory: 'necessary',
              },
              ...(analyticsEnabled ? [{
                title: 'Google Analytics',
                description: 'Optional analytics sends information about visits, your browser and device to Google. Google receives your IP address as part of the connection. Advertising features are disabled. The _ga and _ga_* cookies distinguish visitors and sessions and expire after 180 days, renewed on visits. Rejecting analytics stops collection and removes these cookies. Read <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s privacy policy</a>.',
                linkedCategory: 'analytics',
              }] : []),
            ],
          },
        },
      },
    },
  });
}

export const showCookiePreferences = () => CookieConsent.showPreferences();

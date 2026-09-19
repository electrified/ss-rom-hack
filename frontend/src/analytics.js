// Basic consent mode: no Google script or request until analytics is accepted.
export function createAnalytics(measurementId) {
  const enabled = /^G-[A-Z0-9]+$/.test(measurementId || '');
  let loaded = false;

  return function setConsent(accepted) {
    if (!enabled) return;
    window[`ga-disable-${measurementId}`] = !accepted;
    if (!accepted && !loaded) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    if (!loaded) {
      window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
    window.gtag('consent', 'update', { analytics_storage: accepted ? 'granted' : 'denied' });
    if (!accepted || loaded) return;

    loaded = true;
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: window.location.hostname,
      cookie_expires: 60 * 60 * 24 * 180,
      // Keep URL parameters and fragments out of the initial page view.
      page_location: window.location.origin + window.location.pathname,
      page_referrer: '',
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  };
}

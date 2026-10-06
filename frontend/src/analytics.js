export function createAnalytics(measurementId) {
  const enabled = /^G-[A-Z0-9]+$/.test(measurementId || '');
  let loaded = false;

  return function initAnalytics() {
    if (!enabled || loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
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

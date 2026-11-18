/* Cal.com inline booking for skytsystems.dk.
   - Stores first-touch UTMs in the session, so a visitor who lands with them and books later is still attributed.
   - Passes them to Cal.com, which prefills the hidden booking fields (utm_source ... fbclid) that travel to n8n and Attio.
   - On a completed booking: Meta Schedule event (if the pixel is on the page) and redirect to /tak.
   Config: window.BOOKING = { calLink, redirect, containers: ['#id', ...], theme: 'light' | 'dark' (default), brand, hideDetails } before this script. */
(function () {
  var cfg = window.BOOKING || {};
  var TRACKED = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'ad_id', 'adset_id', 'campaign_id'];
  var KEY = 'booking_attribution';

  function attribution() {
    var incoming = new URLSearchParams(location.search);
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) {}
    TRACKED.forEach(function (k) { var v = incoming.get(k); if (v) stored[k] = v; });
    try { sessionStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) {}
    return stored;
  }

  (function (C, A, L) {
    var p = function (a, ar) { a.q.push(ar); };
    var d = C.document;
    C.Cal = C.Cal || function () {
      var cal = C.Cal, ar = arguments;
      if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; }
      if (ar[0] === L) {
        var api = function () { p(api, arguments); };
        var namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); }
        else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  })(window, 'https://app.cal.com/embed/embed.js', 'init');

  var utm = attribution();
  (cfg.containers || []).forEach(function (selector, i) {
    if (!document.querySelector(selector)) return;
    var ns = 'booking' + i;
    Cal('init', ns, { origin: 'https://cal.com' });
    var theme = cfg.theme || 'dark', vars = {};
    vars[theme] = { 'cal-brand': cfg.brand || '#b7aa95' };
    var config = { layout: 'month_view', theme: theme };
    TRACKED.forEach(function (k) { if (utm[k]) config[k] = utm[k]; });
    ['_fbp', '_fbc'].forEach(function (c) { var m = document.cookie.match(new RegExp('(?:^|; )' + c + '=([^;]*)')); if (m) config[c.slice(1)] = decodeURIComponent(m[1]); });
    Cal.ns[ns]('inline', { elementOrSelector: selector, calLink: cfg.calLink, config: config });
    Cal.ns[ns]('ui', { theme: theme, hideEventTypeDetails: !!cfg.hideDetails, layout: 'month_view', cssVarsPerTheme: vars });
    Cal.ns[ns]('on', {
      action: 'bookingSuccessfulV2',
      callback: function (e) {
        var uid = e && e.detail && e.detail.data && e.detail.data.uid;
        if (window.fbq) window.fbq('track', 'Schedule', {}, uid ? { eventID: 'booking_' + uid } : undefined);
        if (window.gtag) window.gtag('event', 'book_call', { event_label: cfg.calLink });
        if (cfg.redirect) location.href = cfg.redirect;
      }
    });
  });
})();

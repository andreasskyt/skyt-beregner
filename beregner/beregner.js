/* Lost-revenue calculator for skytsystems.dk/beregner (companies that live on quotes and orders).
   5 one-tap questions, a contact gate, then the result. Every number is built only from the visitor's own answers.
   Stores first-touch UTMs with booking.js's sessionStorage key, fires Meta Lead and POSTs the answers to WEBHOOK_URL. */
(function () {
  function nejText(n) { return n === 1.5 ? '1 til 2' : String(n); }
  var WEBHOOK_URL = '';       // n8n webhook, not created yet. Empty = log to console only.

  /* bucket midpoints; every number on the result comes only from the visitor's answers */
  var TILBUD = { 'under10': 5, '10-30': 20, '30-75': 50, 'over75': 100 };
  var TIMER = { 'under1': 0.5, '1-3': 2, '3-8': 5, 'over8': 12 };
  var NEJ = { '0': 0, '1-2': 1.5, '3-5': 4, 'over5': 7 };
  var ORDRE = { 'under25': 15000, '25-100': 60000, '100-500': 250000, 'over500': 750000 };
  var HITRATE = { 'under20': 0.15, '20-40': 0.30, 'over40': 0.50 };

  /* first-touch attribution, same key as booking.js */
  var TRACKED = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'ad_id', 'adset_id', 'campaign_id'];
  var KEY = 'booking_attribution';
  var attribution = (function () {
    var incoming = new URLSearchParams(location.search), stored = {};
    try { stored = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) {}
    TRACKED.forEach(function (k) { var v = incoming.get(k); if (v) stored[k] = v; });
    try { sessionStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) {}
    return stored;
  })();
  function cookie(name) { var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function post(body) {
    if (!WEBHOOK_URL) { console.log('beregner: WEBHOOK_URL is empty, payload not sent', body); return; }
    try {
      fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
        .catch(function (e) { console.warn('beregner: webhook failed', e); });
    } catch (e) { console.warn('beregner: webhook failed', e); }
  }

  var $ = function (id) { return document.getElementById(id); };
  var form = $('calc');
  var steps = [].slice.call(form.querySelectorAll('.step'));
  var QUESTIONS = steps.length - 1;
  var next = $('next'), back = $('back');
  var answers = {};
  var current = 0, eventId = '';

  var nf = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 });
  function num(x) { return nf.format(x); }

  function estimate() {
    var t = TILBUD[answers.tilbud], h = TIMER[answers.timer], n = NEJ[answers.nej], o = ORDRE[answers.ordre], r = HITRATE[answers.hitrate];
    var lost = n * o * r * 12;
    return {
      hours_month: t * h,
      lost_year: lost > 0 ? Math.max(10000, Math.round(lost / 10000) * 10000) : 0,
      extra_offers: t,
      midpoints: { tilbud: t, timer: h, nej: n, ordre: o, hitrate: r }
    };
  }
  function hoursText(e) { return 'ca. ' + num(Math.max(1, Math.round(e.hours_month))) + ' timer'; }
  function krText(x) { return num(x) + ' kr.'; }

  /* fills the teaser (p) and the result (r) with the same layout */
  function fill(px, e) {
    var m = e.midpoints;
    if (e.lost_year > 0) {
      $(px + '-big').textContent = krText(e.lost_year);
      $(px + '-big-l').textContent = 'i omsætning I siger nej til om året';
      $(px + '-day').textContent = 'Det er ca. ' + nejText(m.nej) + ' opgaver om måneden, I ikke når at regne på';
      $(px + '-n1').textContent = hoursText(e);
      $(px + '-n1-l').textContent = 'om måneden på tilbud';
    } else {
      $(px + '-big').textContent = hoursText(e);
      $(px + '-big-l').textContent = 'om måneden på tilbud';
      $(px + '-day').textContent = 'Tid, jeres folk kunne bruge på flere kunder';
      $(px + '-n1').textContent = krText(0);
      $(px + '-n1-l').textContent = 'i omsætning I siger nej til om året';
    }
    $(px + '-n2').textContent = 'ca. ' + num(e.extra_offers);
  }

  function valid(i) {
    var s = steps[i], k = s.dataset.key;
    if (s.dataset.type === 'single') return !!answers[k];
    return true;
  }
  function show(i) {
    var s = steps[i], type = s.dataset.type;
    steps.forEach(function (x, j) { x.classList.toggle('is-active', j === i); });
    current = i;
    $('fill').style.width = ((i + 1) / steps.length * 100) + '%';
    $('bar').setAttribute('aria-valuenow', i + 1);
    $('count').textContent = type === 'form' ? 'Sidste trin' : (i + 1) + ' af ' + QUESTIONS;
    back.hidden = i === 0;
    next.hidden = type === 'single';
    next.textContent = type === 'form' ? 'Vis mit tal' : 'Næste';
    next.disabled = !valid(i);
    $('trust').hidden = type !== 'form';
    if (type === 'form') fill('p', estimate());
    if (i > 0) {
      var h = s.querySelector('h2'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
    }
  }

  steps.forEach(function (s, i) {
    s.addEventListener('click', function (e) {
      var o = e.target.closest('.opt'); if (!o) return;
      var k = s.dataset.key, v = o.dataset.value;
      answers[k] = v;
      s.querySelectorAll('.opt').forEach(function (b) { b.setAttribute('aria-checked', b === o ? 'true' : 'false'); });
      setTimeout(function () { if (current === i) show(i + 1); }, 300);   // single choice moves on by itself
    });
  });

  back.addEventListener('click', function () { if (current > 0) show(current - 1); });
  next.addEventListener('click', function () {
    if (steps[current].dataset.type === 'form') return submit();
    if (valid(current)) show(current + 1);
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (steps[current].dataset.type === 'form') submit();
    else if (valid(current)) show(current + 1);
  });

  function setErr(name, msg) {
    var input = form.elements[name];
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    form.querySelector('.err[data-for="' + name + '"]').textContent = msg || '';
    return !msg;
  }
  function checkContact() {
    var c = {
      navn: form.elements.navn.value.trim(),
      firma: form.elements.firma.value.trim(),
      mail: form.elements.mail.value.trim(),
      telefon: form.elements.telefon.value.replace(/[\s\-().]/g, '')
    };
    var bad = [];
    if (!setErr('navn', c.navn.length < 2 ? 'Skriv dit navn.' : '')) bad.push('navn');
    if (!setErr('firma', c.firma.length < 2 ? 'Skriv navnet på firmaet.' : '')) bad.push('firma');
    if (!setErr('mail', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.mail) ? '' : 'Tjek din mail.')) bad.push('mail');
    var dk = c.telefon.replace(/^(\+45|0045)/, '');
    var telOk = !c.telefon || /^\d{8}$/.test(dk) || /^\+\d{8,15}$/.test(c.telefon);
    if (!setErr('telefon', telOk ? '' : 'Skriv et nummer med 8 cifre, eller lad feltet stå tomt.')) bad.push('telefon');
    if (bad.length) { form.elements[bad[0]].focus(); return null; }
    if (/^\d{8}$/.test(dk)) c.telefon = '+45' + dk;
    return c;
  }

  function submit() {
    if (next.classList.contains('is-busy')) return;
    var c = checkContact(); if (!c) return;
    var est = estimate();
    eventId = 'lead_' + uuid();
    var payload = {
      source: 'beregner',
      event_id: eventId,
      submitted_at: new Date().toISOString(),
      page: location.href,
      answers: answers,
      estimate: est,
      contact: c,
      wants_call: !!c.telefon,
      fbp: cookie('_fbp'),
      fbc: cookie('_fbc')
    };
    TRACKED.forEach(function (k) { payload[k] = attribution[k] || ''; });
    if (window.fbq) window.fbq('track', 'Lead', { content_name: 'beregner' }, { eventID: eventId });
    post(payload);

    next.classList.add('is-busy'); next.disabled = true; next.textContent = 'Beregner…';
    $('peek').classList.add('is-open');
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () { render(c, est); }, reduced ? 0 : 600);
  }

  function render(c, est) {
    var first = c.navn.split(/\s+/)[0], m = est.midpoints;
    $('r-title').textContent = first + ', her er tallet for ' + c.firma + '.';
    fill('r', est);
    $('r-note').textContent =
      'Tallet bygger kun på dine svar. Vi regner med midten af hvert interval. ' +
      'Timer på tilbud: ' + num(m.tilbud) + ' tilbud om måneden gange ' + num(m.timer) + (m.timer === 1 ? ' time' : ' timer') + ' er ca. ' + num(est.hours_month) + ' timer om måneden. ' +
      'Omsætning I siger nej til: ' + nejText(m.nej) + ' opgaver om måneden gange ' + krText(m.ordre) + ' gange ' + Math.round(m.hitrate * 100) + ' procent, som I typisk vinder, gange 12 måneder er ca. ' + krText(est.lost_year) + ' om året. ' +
      'Flere tilbud: tog hvert tilbud halv tid, kunne de samme folk regne på ' + num(est.extra_offers) + ' tilbud mere om måneden. Et skøn, ikke en garanti.';

    form.style.display = 'none';
    $('intro').style.display = 'none';
    var r = $('result');
    r.classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('r-title').focus({ preventScroll: true });
    loadBooking();
  }

  var bookingLoaded = false;
  function loadBooking() {
    if (bookingLoaded) return; bookingLoaded = true;
    window.BOOKING = { calLink: 'team/skyt-systems/intro-opkald', redirect: '/tak', containers: ['#cal'], theme: 'light', brand: '#2a3826', hideDetails: true };
    var s = document.createElement('script'); s.src = '/booking.js'; s.async = true; document.body.appendChild(s);
  }

  /* optional follow-up on the result: AI use today, sent as a second payload with the same event_id */
  $('ai-opts').addEventListener('click', function (e) {
    var o = e.target.closest('.opt'); if (!o) return;
    this.querySelectorAll('.opt').forEach(function (b) { b.setAttribute('aria-checked', b === o ? 'true' : 'false'); });
    var v = o.dataset.value;
    $('ai-reply').textContent = v === 'betaler'
      ? 'I betaler allerede for værktøjet. Spørgsmålet er, om det bliver brugt på jeres tilbud.'
      : 'Tak. Det hjælper os med at forberede gennemgangen.';
    post({ source: 'beregner', type: 'ai_followup', event_id: eventId, ai: v, submitted_at: new Date().toISOString() });
  });

  show(0);
})();

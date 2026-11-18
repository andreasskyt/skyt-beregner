/* Workshop calculator for skytsystems.dk/beregner (Tjure ads, "AI-klar før 2027").
   4 one-tap questions, a contact gate, then the result. The numbers use only the visitor's answers
   plus our workshop promise (at least 2 hours a week per person).
   Stores first-touch UTMs with booking.js's sessionStorage key, fires Meta Lead and POSTs the answers to WEBHOOK_URL. */
(function () {
  var WEBHOOK_URL = '';       // n8n webhook, not created yet. Empty = log to console only.
  var SOURCE = 'beregner-workshop';

  /* bucket midpoints */
  var STAFF = { 'under10': 5, '10-20': 15, '21-50': 35, 'over50': 60 };
  var HOURS_DAY = { 'under1': 0.5, '1-2': 1.5, '2-4': 3, 'over4': 5 };
  var PROMISE_WEEK = 2;                 // hours per person per week we promise after the workshop
  var WEEKS = 46, WORKDAYS_PER_MONTH = 46 * 5 / 12, HOURS_PER_WORKDAY = 7.4;
  var HOURLY_COST = 350;               // our estimate of total salary cost per hour (not asked: it varies too much per person)
  var FTE_HOURS_MONTH = 37 * WEEKS / 12; // hours a full-time employee works per month

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
  var current = 0, eventId = 'lead_' + uuid(), submitted = false, lastPartial = '';

  /* Save each contact field as it is typed, not only on submit, so a visitor who leaves after the mail is not lost. */
  function partialContact() {
    var mail = form.elements.mail.value.trim(), tel = form.elements.telefon.value.replace(/[\s\-().]/g, ''), navn = form.elements.navn.value.trim();
    var mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail), telOk = /^(\+45|0045)?\d{8}$/.test(tel) || /^\+\d{8,15}$/.test(tel);
    if (!mailOk && !telOk) return null;
    return { mail: mailOk ? mail : '', telefon: telOk ? tel : '', navn: navn };
  }
  function savePartial(beacon) {
    if (submitted) return;
    var c = partialContact(); if (!c) return;
    var key = JSON.stringify(c); if (key === lastPartial) return; lastPartial = key;
    var body = { source: SOURCE, type: 'partial', event_id: eventId, saved_at: new Date().toISOString(), page: location.href, answers: answers, contact: c, company_domain: (c.mail.split('@')[1] || '').toLowerCase(), fbp: cookie('_fbp'), fbc: cookie('_fbc') };
    TRACKED.forEach(function (k) { body[k] = attribution[k] || ''; });
    if (beacon && WEBHOOK_URL && navigator.sendBeacon) { navigator.sendBeacon(WEBHOOK_URL, new Blob([JSON.stringify(body)], { type: 'application/json' })); return; }
    post(body);
  }

  var nf = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 });
  function num(x) { return nf.format(x); }

  function estimate() {
    var staff = STAFF[answers.ansatte], day = HOURS_DAY[answers.gentaget];
    var perWeek = Math.min(PROMISE_WEEK, day * 5);
    return {
      repetitive_month: staff * day * WORKDAYS_PER_MONTH,
      back_month: staff * perWeek * WEEKS / 12,
      workdays_year: staff * perWeek * WEEKS / HOURS_PER_WORKDAY,
      kr_year: staff * perWeek * WEEKS * HOURLY_COST,
      fte: staff * perWeek * WEEKS / 12 / FTE_HOURS_MONTH,
      midpoints: { staff: staff, hours_day: day, per_week: perWeek }
    };
  }
  function roundTo(x, step) { return Math.max(step, Math.round(x / step) * step); }
  function hoursText(x) { return 'ca. ' + num(roundTo(x, 5)) + ' timer'; }
  function daysText(x) { return num(Math.max(1, Math.round(x))); }
  function waitLine(e) {
    return 'Det svarer til ca. ' + num(roundTo(e.kr_year, 10000)) + ' kr. i løn om året';
  }

  /* fills the teaser (p) and the result (r) with the same layout */
  function fill(px, e) {
    $(px + '-big').textContent = hoursText(e.back_month);
    $(px + '-big-l').textContent = 'om måneden I får tilbage, når hver person sparer mindst 2 timer om ugen';
    $(px + '-day').textContent = waitLine(e);
    $(px + '-n1').textContent = hoursText(e.repetitive_month);
    $(px + '-n1-l').textContent = 'om måneden på gentagne opgaver';
    $(px + '-n2').textContent = num(Math.max(0.1, Math.round(e.fte * 10) / 10));
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
    next.textContent = type === 'form' ? 'Afslør tallet' : 'Næste';
    next.disabled = !valid(i);
    $('trust').hidden = type !== 'form';
    if (type === 'form') { try { fill('p', estimate()); } catch (err) { console.warn('beregner: preview kept placeholder', err); } }
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
      mail: form.elements.mail.value.trim(),
      telefon: form.elements.telefon.value.replace(/[\s\-().]/g, '')
    };
    var bad = [];
    if (!setErr('navn', c.navn.length < 2 ? 'Skriv dit navn.' : '')) bad.push('navn');
    if (!setErr('mail', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.mail) ? '' : 'Tjek din mail.')) bad.push('mail');
    var dk = c.telefon.replace(/^(\+45|0045)/, '');
    var telOk = /^\d{8}$/.test(dk) || /^\+\d{8,15}$/.test(c.telefon);
    if (!setErr('telefon', telOk ? '' : 'Skriv et nummer med 8 cifre.')) bad.push('telefon');
    if (bad.length) { form.elements[bad[0]].focus(); return null; }
    if (/^\d{8}$/.test(dk)) c.telefon = '+45' + dk;
    return c;
  }

  function submit() {
    if (next.classList.contains('is-busy')) return;
    var c = checkContact(); if (!c) return;
    var est = estimate();
    submitted = true;
    var payload = {
      source: SOURCE,
      event_id: eventId,
      submitted_at: new Date().toISOString(),
      page: location.href,
      answers: answers,
      estimate: est,
      contact: c,
      wants_call: !!c.telefon,
      company_domain: (c.mail.split('@')[1] || '').toLowerCase(),
      fbp: cookie('_fbp'),
      fbc: cookie('_fbc')
    };
    TRACKED.forEach(function (k) { payload[k] = attribution[k] || ''; });
    if (window.fbq) window.fbq('track', 'Lead', { content_name: SOURCE }, { eventID: eventId });
    post(payload);

    next.classList.add('is-busy'); next.disabled = true; next.textContent = 'Beregner…';
    $('peek').classList.add('is-open');
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () { render(c, est); }, reduced ? 0 : 600);
  }

  function render(c, est) {
    var first = c.navn.split(/\s+/)[0], m = est.midpoints;
    $('r-title').textContent = first + ', her er jeres tal.';
    fill('r', est);
    $('r-note').textContent =
      'Tallet bygger på dine svar, og vi regner med midten af hvert interval. ' +
      'Gentagne opgaver: ' + num(m.staff) + ' personer gange ' + num(m.hours_day) + (m.hours_day === 1 ? ' time' : ' timer') + ' om dagen pr. medarbejder gange ca. ' + num(Math.round(WORKDAYS_PER_MONTH * 10) / 10) + ' arbejdsdage om måneden er ca. ' + num(Math.round(est.repetitive_month)) + ' timer. ' +
      'Tid tilbage: ' + num(m.staff) + ' personer gange ' + num(m.per_week) + ' timer om ugen gange ' + WEEKS + ' arbejdsuger delt med 12 er ca. ' + num(Math.round(est.back_month)) + ' timer om måneden. ' +
      'De 2 timer om ugen pr. person er det mindste, vi lover efter workshoppen' + (m.per_week < PROMISE_WEEK ? ', men vi regner aldrig med mere end den tid, I selv bruger på gentagne opgaver' : '') + '. ' +
      'Løn: vi regner med ' + HOURLY_COST + ' kr. i timen i samlede lønomkostninger, det er vores eget skøn, så ca. ' + num(roundTo(est.kr_year, 10000)) + ' kr. om året. Fuldtidsansatte: timerne om måneden delt med ca. ' + num(Math.round(FTE_HOURS_MONTH)) + ' timer, som en fuldtidsansat arbejder om måneden. Et skøn, ikke en garanti.';

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

  var partialTimer;
  ['mail', 'telefon', 'navn'].forEach(function (n) {
    var el = form.elements[n];
    el.addEventListener('input', function () { clearTimeout(partialTimer); partialTimer = setTimeout(function () { savePartial(false); }, 1500); });
    el.addEventListener('change', function () { savePartial(false); });
    el.addEventListener('blur', function () { savePartial(false); });
  });
  window.addEventListener('pagehide', function () { savePartial(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') savePartial(true); });

  show(0);
})();

// Builds the stand-in for Claude around the extension: the sidebar, the usage
// popover (as Claude renders it), and the session rail's context headline.
// The usage API answers with the scenario from the toolbar; changing a
// setting reloads the page, so the extension starts fresh each time.
(function () {
  const HOUR_MS = 3_600_000;
  const DAY_MS = 24 * HOUR_MS;

  // Each limit: percent used and how far through its window we are (null:
  // the window has not started). The numbers have to be reachable in Claude:
  // a full 5-hour session uses about 20–25% of the weekly limit, so weekly
  // usage is at least a fifth of the session's (90% of a session at 10%
  // weekly is impossible), and a model's weekly limit never runs ahead of the
  // one for all models. checkScenarios() below enforces both.
  const SESSION_SHARE_OF_WEEK = 0.2;
  const USAGE = {
    under: {
      label: 'Under pace',
      session: { percent: 8, elapsed: 0.56 },
      weekly: { percent: 30, elapsed: 0.5 },
      fable: { percent: 0, elapsed: 0.5 },
    },
    on: {
      label: 'On pace',
      session: { percent: 35, elapsed: 0.4 },
      weekly: { percent: 50, elapsed: 0.49 },
      fable: { percent: 12, elapsed: 0.49 },
    },
    over: {
      label: 'Over pace',
      session: { percent: 72, elapsed: 0.45 },
      weekly: { percent: 68, elapsed: 0.42 },
      fable: { percent: 20, elapsed: 0.42 },
    },
    session: {
      label: 'Session tight, weekly fine',
      session: { percent: 85, elapsed: 0.55 },
      weekly: { percent: 40, elapsed: 0.6 },
      fable: { percent: 15, elapsed: 0.6 },
    },
    weekly: {
      label: 'Weekly tight, session fine',
      session: { percent: 30, elapsed: 0.57 },
      weekly: { percent: 82, elapsed: 0.64 },
      fable: { percent: 25, elapsed: 0.64 },
    },
    limit: {
      label: 'Both near the limit',
      session: { percent: 93, elapsed: 0.6 },
      weekly: { percent: 86, elapsed: 0.71 },
      fable: { percent: 40, elapsed: 0.71 },
    },
    fresh: {
      label: 'New windows',
      session: { percent: 0, elapsed: null },
      weekly: { percent: 3, elapsed: 0.05 },
      fable: { percent: 0, elapsed: 0.05 },
    },
  };

  // Claude offers "Compact session" from 50% of the context window.
  const CONTEXT = {
    low: { label: 'Low (23%)', pct: 23, summary: '226.3k / 1M' },
    mid: { label: 'Compactable (58%)', pct: 58, summary: '578.1k / 1M' },
    compact: { label: 'Compactable (75%)', pct: 75, summary: '750.3k / 1M' },
    high: { label: 'Almost full (91%)', pct: 91, summary: '910.4k / 1M' },
    hidden: { label: 'Session rail hidden', pct: null },
  };
  const COMPACT_FROM = 50;

  const TEXT = {
    en: {
      locale: 'en-US',
      nav: ['New session', 'Search', 'Routines', 'Artifacts', 'More'],
      recents: 'Recents',
      chats: ['Fix the release script', 'Usage popover redesign', 'Booking UI', 'Sidebar spacing'],
      reply: 'Reply…',
      usage: 'Usage',
      limits: 'Usage limits',
      breakdown: 'See breakdown',
      settings: 'Usage settings',
      session: 'Session limit',
      weekly: 'Weekly',
      scoped: (model) => 'Weekly · ' + model,
      used: (percent) => percent + ' used',
      resetsIn: (h, m) => 'Resets in ' + (h > 0 ? h + ' hr ' : '') + m + ' min',
      resetsAt: (when) => 'Resets ' + when,
      notStarted: 'Starts when a message is sent',
      compact: 'Compact session',
      showRail: 'Show session rail',
    },
    de: {
      locale: 'de-DE',
      nav: ['Neue Sitzung', 'Suchen', 'Routinen', 'Artefakte', 'Mehr'],
      recents: 'Zuletzt verwendet',
      chats: ['Release-Skript reparieren', 'Nutzungs-Popover neu', 'Booking UI', 'Abstände der Seitenleiste'],
      reply: 'Antworten…',
      usage: 'Nutzung',
      limits: 'Nutzungslimits',
      breakdown: 'Aufschlüsselung anzeigen',
      settings: 'Nutzungseinstellungen',
      session: 'Sitzungslimit',
      weekly: 'Wöchentlich',
      scoped: (model) => 'Wöchentlich · ' + model,
      used: (percent) => percent + ' genutzt',
      resetsIn: (h, m) => 'Zurücksetzung in ' + (h > 0 ? h + ' Std. ' : '') + m + ' Min.',
      resetsAt: (when) => 'Zurücksetzung am ' + when,
      notStarted: 'Beginnt, wenn eine Nachricht gesendet wird',
      compact: 'Sitzung komprimieren',
      showRail: 'Sitzungsleiste anzeigen',
    },
  };

  const ICONS = {
    'New session': 'M10 4v12M4 10h12',
    Search: 'M8.5 14a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM12.5 12.5 17 17',
    Routines: 'M10 3.5a6.5 6.5 0 1 0 6.5 6.5M10 6v4l2.5 2.5',
    Artifacts: 'M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z',
    More: 'M5 10h.01M10 10h.01M15 10h.01',
  };

  function checkScenarios() {
    for (const [name, scenario] of Object.entries(USAGE)) {
      if (scenario.weekly.percent < scenario.session.percent * SESSION_SHARE_OF_WEEK) {
        console.error(`Scenario "${name}": ${scenario.session.percent}% of a session needs at least `
          + `${Math.ceil(scenario.session.percent * SESSION_SHARE_OF_WEEK)}% weekly usage.`);
      }
      if (scenario.fable.percent > scenario.weekly.percent) {
        console.error(`Scenario "${name}": the Fable limit is ahead of the weekly limit for all models.`);
      }
    }
  }
  checkScenarios();

  // Settings ----------------------------------------------------------------

  const params = new URLSearchParams(location.search);
  const pick = (name, options, fallback) => (params.get(name) in options ? params.get(name) : fallback);
  const state = {
    usage: pick('usage', USAGE, 'under'),
    context: pick('context', CONTEXT, 'mid'),
    lang: pick('lang', TEXT, 'en'),
    theme: pick('theme', { dark: 1, light: 1 }, 'dark'),
  };
  const text = TEXT[state.lang];

  document.documentElement.lang = text.locale;
  document.documentElement.dataset.theme = state.theme;
  // Scripts/screenshots.js: no toolbar and no page background.
  if (params.has('capture')) document.documentElement.dataset.capture = '';
  // Every load starts like a fresh install: rows open, both places on.
  for (const key of Object.keys(localStorage)) if (key.startsWith('usage-pace:')) localStorage.removeItem(key);

  const toolbar = document.getElementById('toolbar');
  for (const [name, options] of [['usage', USAGE], ['context', CONTEXT]]) {
    toolbar.elements[name].append(...Object.entries(options).map(([value, option]) => new Option(option.label, value)));
  }
  for (const name of Object.keys(state)) toolbar.elements[name].value = state[name];
  toolbar.addEventListener('change', () => {
    location.search = new URLSearchParams(new FormData(toolbar)).toString();
  });

  // Usage API ---------------------------------------------------------------

  const now = Date.now();
  const scenario = USAGE[state.usage];

  // Weekly windows reset on the hour, as in Claude.
  function resetsAt(limit, windowMs, roundToHour) {
    if (limit.elapsed === null) return null;
    let at = now + (1 - limit.elapsed) * windowMs;
    if (roundToHour) at = Math.ceil(at / HOUR_MS) * HOUR_MS;
    return new Date(at).toISOString();
  }

  const limits = [
    { kind: 'session', percent: scenario.session.percent, resets_at: resetsAt(scenario.session, 5 * HOUR_MS, false) },
    { kind: 'weekly_all', percent: scenario.weekly.percent, resets_at: resetsAt(scenario.weekly, 7 * DAY_MS, true) },
    {
      kind: 'weekly_scoped',
      scope: { model: { display_name: 'Fable' } },
      percent: scenario.fable.percent,
      resets_at: resetsAt(scenario.fable, 7 * DAY_MS, true),
    },
  ];

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const { pathname } = new URL(String(input), location.href);
    if (pathname === '/api/organizations') return Response.json([{ uuid: 'demo' }]);
    if (pathname === '/api/organizations/demo/usage') return Response.json({ limits });
    return realFetch(input, init);
  };

  // Sidebar -----------------------------------------------------------------

  function icon(path) {
    return '<svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
  }

  document.getElementById('nav-group').innerHTML = text.nav.map((label, index) =>
    '<button type="button" class="nav-row"><span data-cds="Icon" aria-hidden="true" class="nav-icon">'
    + icon(ICONS[TEXT.en.nav[index]]) + '</span><span>' + label + '</span></button>').join('');
  document.getElementById('recents-label').textContent = text.recents;
  document.getElementById('recents').innerHTML = text.chats.map((chat) => '<li>' + chat + '</li>').join('');
  document.getElementById('composer-placeholder').textContent = text.reply;

  // Usage popover, laid out like Claude's ----------------------------------

  const percentFormat = new Intl.NumberFormat(text.locale, { style: 'percent', maximumFractionDigits: 0 });
  const weekdayFormat = new Intl.DateTimeFormat(text.locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  function caption(limit) {
    if (!limit.resets_at) return text.notStarted;
    const resetAt = Date.parse(limit.resets_at);
    if (limit.kind !== 'session') return text.resetsAt(weekdayFormat.format(new Date(resetAt)));
    const minutes = Math.max(1, Math.ceil((resetAt - now) / 60_000));
    return text.resetsIn(Math.floor(minutes / 60), minutes % 60);
  }

  function variant(percent) {
    return percent >= 95 ? 'danger' : percent >= 80 ? 'warning' : 'accent';
  }

  // Claude leaves out model limits that have not been used yet.
  const rows = limits
    .filter((limit) => limit.kind !== 'weekly_scoped' || limit.percent > 0)
    .map((limit, index) => {
      const label = limit.kind === 'session'
        ? text.session
        : limit.kind === 'weekly_all' ? text.weekly : text.scoped(limit.scope.model.display_name);
      return '<div class="flex flex-col gap-xs">'
        + '<div class="flex items-baseline justify-between gap-sm text-body">'
        + '<span id="limit-' + index + '" class="min-w-0 font-medium text-primary">' + label + '</span>'
        + '<span aria-hidden="true" class="shrink-0 whitespace-nowrap text-footnote tabular-nums text-muted-as-secondary">'
        + text.used(percentFormat.format(limit.percent / 100)) + '</span></div>'
        + '<div class="flex flex-col gap-1">'
        + '<div data-cds="Meter" data-variant="' + variant(limit.percent) + '">'
        + '<div role="meter" aria-labelledby="limit-' + index + '" aria-describedby="caption-' + index + '" class="meter-track">'
        + '<div data-usage-bar-fill class="meter-fill" style="width:' + limit.percent + '%"></div></div></div>'
        + '<span id="caption-' + index + '" class="text-footnote text-muted-as-secondary">' + caption(limit) + '</span>'
        + '</div></div>';
    });

  document.getElementById('portal-root').innerHTML =
    '<div data-cds="Popover" role="dialog" class="popover"><div class="flex flex-col py-sm">'
    + '<div class="flex flex-col gap-sm pt-0.5 pb-sm">'
    + '<div class="flex items-center justify-between gap-sm px-lg">'
    + '<span aria-hidden="true" class="text-heading-medium text-primary">' + text.usage + '</span>'
    + '<span class="flex items-center gap-1">'
    + '<button type="button" class="icon-button" aria-label="' + text.breakdown + '">'
    + icon('M4 16h12M6 13V9M9 13V5M12 13V8M15 13V6') + '</button>'
    + '<a class="icon-button" href="/settings/usage" aria-label="' + text.settings + '">'
    + icon('M3.8 14.2a6.8 6.8 0 1 1 12.4 0M10 11.2l3.2-3.4') + '</a>'
    + '</span></div>'
    + '<div role="group" aria-label="' + text.limits + '" class="flex flex-col gap-sm">'
    + '<div class="flex flex-col gap-md px-lg">' + rows.join('') + '</div>'
    + '</div></div></div></div>';

  // Settings links stay on the demo page.
  document.addEventListener('click', (event) => {
    if (event.target.closest('a[href="/settings/usage"]')) event.preventDefault();
  });

  // Session rail ------------------------------------------------------------

  // The extension reads the context from the rail's headline, copies the
  // rail's colored bar (a StackedMeter, one segment per kind of content) and
  // presses the rail's own Compact button; compacting here drops the
  // context to 12%.
  const SEGMENTS = [
    { name: 'MCP tools', pct: 1.6, color: '#d0603a' },
    { name: 'System tools', pct: 1.6, color: '#4c9a75' },
    { name: 'Skills', pct: 1, color: '#c9922e' },
    { name: 'System prompt', pct: 1.2, color: '#a3a19b' },
    { name: 'Autocompact buffer', pct: 3.3, color: '#6b6a66' },
  ];

  function stackedMeter(pct) {
    const fixed = SEGMENTS.reduce((sum, segment) => sum + segment.pct, 0);
    const segments = [{ name: 'Messages', pct: Math.max(0, pct - fixed), color: '#4a7fd9' }, ...SEGMENTS];
    const meter = document.createElement('div');
    meter.setAttribute('data-cds', 'StackedMeter');
    meter.className = 'stacked-meter';
    meter.append(...segments.map((segment) => {
      const part = document.createElement('span');
      part.dataset.category = segment.name;
      part.style.width = segment.pct + '%';
      part.style.backgroundColor = segment.color;
      return part;
    }));
    return meter;
  }

  const context = CONTEXT[state.context];
  const rail = document.getElementById('rail');
  if (context.pct === null) {
    const show = document.createElement('button');
    show.type = 'button';
    show.className = 'show-rail';
    show.setAttribute('aria-label', text.showRail);
    show.textContent = '⇥';
    document.querySelector('.conversation').prepend(show);
  } else {
    const section = document.createElement('section');
    const headline = document.createElement('span');
    headline.setAttribute('data-rail-context-summary', '');
    headline.setAttribute('data-rail-context-pct', String(context.pct));
    headline.textContent = context.summary;
    let meter = stackedMeter(context.pct);
    section.append(headline, meter);
    if (context.pct >= COMPACT_FROM) {
      const compact = document.createElement('button');
      compact.type = 'button';
      compact.textContent = text.compact;
      compact.addEventListener('click', () => {
        headline.setAttribute('data-rail-context-pct', '12');
        headline.firstChild.nodeValue = '120.4k / 1M';
        meter.replaceWith(meter = stackedMeter(12));
        compact.remove();
      });
      section.append(compact);
    }
    rail.append(section);
  }
})();

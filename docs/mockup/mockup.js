// Mockups of the Claude desktop app (Code tab, dark) with the real extension
// running inside, for the README and for posts. demo.js has answered the
// usage API and built the usage popover; this builds Claude's sidebar and
// conversation around them. ?view= picks what to show:
//   hero      the whole window (README)
//   overview  the whole window with a headline (posts)
//   sidebar   the sidebar with callouts (posts)
//   sessions  the session states, with a note next to each row (README)
//   popover   Claude's usage popover with callouts (README, posts)
//   pace      the pace states, one small usage popover each (README)
// ?bare leaves out the headline and the credit. Once the extension has drawn
// (mockupReady), layoutMockup() places the parts and returns the size to
// capture.
(function () {
  const params = new URLSearchParams(location.search);
  const VIEWS = ['hero', 'overview', 'sidebar', 'sessions', 'popover', 'pace'];
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'overview';
  const root = document.documentElement;
  root.dataset.view = view;
  const bare = params.has('bare') || view === 'hero';
  if (bare) root.dataset.bare = '';
  const SIZES = { hero: [1300, 960], overview: [1600, 1130], sidebar: [1120, 900], sessions: [900, 700], popover: [1120, 720], pace: [880, 640] };
  let [width, height] = SIZES[view];
  function resize(w, h) {
    [width, height] = [Math.ceil(w), Math.ceil(h)];
    root.style.setProperty('--canvas-w', width + 'px');
    root.style.setProperty('--canvas-h', height + 'px');
  }
  resize(width, height);

  const ICONS = {
    sidebar: 'M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM8 3.5v13',
    back: 'M12 4.5 6.5 10 12 15.5',
    forward: 'M8 4.5 13.5 10 8 15.5',
    chat: 'M16.5 9V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v5A2.5 2.5 0 0 0 6 13.5h1V16l2.6-2.2M14.2 11.4a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zM16 16l1.6 1.6',
    code: 'M7 6.5 3.5 10 7 13.5M13 6.5l3.5 3.5-3.5 3.5',
    chevron: 'M6 8l4 4 4-4',
    list: 'M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM6.8 7.5h.01M9.3 7.5h4.2M6.8 10h.01M9.3 10h4.2M6.8 12.5h.01M9.3 12.5h4.2',
    terminal: 'M4 6.5 7.5 10 4 13.5M9.5 14.5h6.5',
    diff: 'M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM10 6.3v5M7.5 8.8h5M7.5 13.5h5',
    globe: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM3 10h14M10 3c1.9 2.1 2.9 4.4 2.9 7s-1 4.9-2.9 7c-1.9-2.1-2.9-4.4-2.9-7s1-4.9 2.9-7z',
    folder: 'M3 6.5a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    more: 'M5 10h.01M10 10h.01M15 10h.01',
    plus: 'M10 4.5v11M4.5 10h11',
    mic: 'M10 3a2.4 2.4 0 0 0-2.4 2.4v4.2a2.4 2.4 0 0 0 4.8 0V5.4A2.4 2.4 0 0 0 10 3zM5.6 9.6a4.4 4.4 0 0 0 8.8 0M10 14v3',
    bug: 'M7.2 7.2a2.8 2.8 0 0 1 5.6 0M6.5 8.8h7v3.7a3.5 3.5 0 0 1-7 0zM10 8.8v7.2M3.5 11h3M13.5 11h3M4.3 7.3l2.2 1.5M15.7 7.3l-2.2 1.5M4.3 15.6l2.3-1.7M15.7 15.6l-2.3-1.7',
    new: 'M10 4.5v11M4.5 10h11',
    search: 'M8.8 14.6a5.8 5.8 0 1 0 0-11.6 5.8 5.8 0 0 0 0 11.6zM13 13l4 4',
    artifacts: 'M7.3 6.8V5.5a2 2 0 0 1 2-2h5.2a2 2 0 0 1 2 2v5.2a2 2 0 0 1-2 2h-1.3M3.5 9a2 2 0 0 1 2-2h5.2a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z',
    scheduled: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 6.3V10l2.6 1.6',
    customize: 'M3.5 8.2a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM7.6 6.2V5A1.4 1.4 0 0 1 9 3.6h2A1.4 1.4 0 0 1 12.4 5v1.2',
  };
  const svg = (name) => name === 'caret'
    ? '<svg viewBox="0 0 20 20"><path d="M6.4 8.3h7.2L10 12.6z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="' + (name === 'more' ? 2.4 : 1.5)
      + '" stroke-linecap="round" stroke-linejoin="round"><path d="' + ICONS[name] + '"/></svg>';

  const HEADLINES = {
    overview: ['UI+ for Claude', 'Your usage, pace and active sessions, right inside the Claude desktop app.'],
    sidebar: ['In the sidebar', ''],
    popover: ['In Claude’s usage popover', ''],
  };
  document.getElementById('headline-title').textContent = HEADLINES[view]?.[0] ?? '';
  document.getElementById('headline-text').textContent = HEADLINES[view]?.[1] ?? '';

  // Claude's navigation. The last row is a button, as in Claude: the
  // extension copies it for its Usage row.
  const NAV = [['new', 'New'], ['search', 'Search'], ['artifacts', 'Artifacts'], ['scheduled', 'Scheduled'], ['customize', 'Customize']];
  document.getElementById('nav-group').innerHTML = NAV.map(([icon, label]) =>
    '<button type="button" class="nav-row"><span data-cds="Icon" aria-hidden="true" class="nav-icon" data-icon="' + icon + '"></span><span>' + label + '</span></button>').join('');
  document.getElementById('recents-label').textContent = 'Pinned';

  // Pinned sessions, marked the way Claude marks them (a status dot named by
  // its kind). Side sessions sit under the session that started them, behind
  // a guide line and without an icon.
  const SESSIONS = view === 'sessions'
    ? [
      { name: 'Popover redesign', state: 'running', note: ['Working', 'Claude is on it. The gear turns.'] },
      { name: 'Booking UI', state: 'awaiting', note: ['Waiting', 'Claude needs your answer.'] },
      { name: 'Sidebar spacing', state: 'ready', note: ['Ready', 'A response you haven’t read yet.'] },
      { name: 'Flaky test in CI', state: 'error', note: ['Error', 'Something went wrong.'] },
      { name: 'Fix the release script', state: 'running', caret: true },
      { name: 'Notarize the disk image', state: 'running', child: true, note: ['Side session', 'Started from another session, same signals.'] },
      { name: 'Landing page copy', note: ['Idle', 'Nothing going on, so no icon.'] },
    ]
    : [
      { name: 'Popover redesign', state: 'running' },
      { name: 'Usage polling retries', state: 'running' },
      { name: 'Fix the release script', state: 'running', caret: true },
      { name: 'Notarize the disk image', child: true },
      { name: 'Booking UI', state: 'awaiting' },
      { name: 'Sidebar spacing', state: 'ready' },
      { name: 'Release notes for 0.4.1', selected: true },
      { name: 'Landing page copy' },
      { name: 'Flaky test in CI' },
      { name: 'Pricing page' },
      { name: 'Docs cleanup' },
      { name: 'Onboarding emails' },
      { name: 'Icon refresh' },
      { name: 'Support replies' },
    ];
  const shown = view === 'sidebar' ? SESSIONS.slice(0, 8) : SESSIONS;
  document.getElementById('recents').innerHTML = shown.map((session, index) => {
    const dot = session.state ? '<span class="status-dot" data-kind="' + session.state + '"></span>' : '';
    const lead = session.child
      ? '<span class="child-connector"></span><span data-row-label="iconless" class="session-label">' + session.name + '</span>'
      : '<span class="df-leading-slot"><span class="session-icon" data-icon="code"></span></span><span data-row-label class="session-label">' + session.name + '</span>';
    return '<li data-row class="group" data-index="' + index + '"><a data-row-main-button href="#" class="session-row' + (session.selected ? ' selected' : '') + '">'
      + lead + dot + (session.caret ? '<span class="row-caret" data-icon="caret"></span>' : '') + '</a></li>';
  }).join('');

  document.getElementById('session-title').textContent = 'Release notes for 0.4.1';
  document.getElementById('composer-placeholder').textContent = 'Type / for commands';
  document.getElementById('thread').innerHTML =
    '<div class="message-user">Can you write the release notes for 0.4.1? Keep them short.</div>'
    + '<div class="message-claude">'
    + '<p>Here’s a short version for the GitHub release:</p>'
    + '<ul><li><b>UI+ for Claude</b> is the new name for the same add-on.</li>'
    + '<li>Opening the new app replaces the old one and keeps your settings.</li>'
    + '<li>Quit Claude with ⌘Q and open it again to see the change.</li></ul>'
    + '<p><b>Ready to publish.</b> Want me to build the disk image and notarize it now?</p>'
    + '</div>';

  // Pace states: the weekly limit of the demo's scenarios (under, on, over
  // pace, near the limit), drawn the way the extension draws its time line
  // above Claude's meter.
  const PACE = [
    { title: 'Room to spare', text: 'Time runs ahead of your usage.', pace: '20% under pace', used: 30, elapsed: 50 },
    { title: 'On pace', text: 'Your usage keeps up with time.', pace: 'On pace', used: 49, elapsed: 50 },
    { title: 'Too fast', text: 'Your usage runs ahead of time.', pace: '26% over pace', used: 68, elapsed: 42 },
    { title: 'Near the limit', text: 'Too fast, and Claude marks the limit as close.', pace: '15% over pace', used: 86, elapsed: 71, warning: true },
  ];
  if (view === 'pace') {
    document.getElementById('states').innerHTML = PACE.map((state) => {
      const shared = Math.min(state.used, state.elapsed);
      const end = Math.max(state.used, state.elapsed);
      const over = state.used > state.elapsed;
      return '<div class="state"><strong>' + state.title + '</strong><span>' + state.text + '</span>'
        + '<div class="state-panel">'
        + '<div class="state-head"><span class="text-heading-medium text-primary">Usage</span><span class="up-popover-pace">' + state.pace + '</span></div>'
        + '<div class="state-row text-body"><span class="font-medium text-primary">Weekly</span>'
        + '<span class="text-footnote tabular-nums text-muted-as-secondary">' + state.used + '% used</span></div>'
        + '<div class="up-time up-in-popover' + (state.warning ? ' up-on-warning' : '') + '">'
        + '<div class="up-segment ' + (over ? 'up-segment-over' : 'up-segment-buffer') + '" style="width:' + end + '%"></div>'
        + '<div class="up-segment up-segment-elapsed" style="width:' + shared + '%"></div></div>'
        + '<div data-cds="Meter" data-variant="' + (state.warning ? 'warning' : 'accent') + '"><div class="meter-track">'
        + '<div class="meter-fill" style="width:' + state.used + '%"></div></div></div>'
        + '</div></div>';
    }).join('');
  }
  document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = svg(node.dataset.icon); });

  // Each callout marks one part (or several next to each other) and explains it.
  const CALLOUTS = {
    sidebar: [
      { targets: ['#usage-pace'], padY: 6, title: 'Your limits, always in view', text: 'Session and weekly usage, plus how far over or under pace you are this week.' },
      { targets: ['[data-up-session="running"]'], all: true, padY: -2, title: 'Claude at work', text: 'A turning gear marks every session Claude is busy with.' },
      { targets: ['[data-up-session="awaiting"]', '[data-up-session="ready"]'], padY: -2, title: 'Needs you', text: 'Waiting, Ready or Error, right in the list.' },
    ],
    popover: [
      { targets: ['.up-context'], padY: 6, title: 'Session context', text: 'Claude’s context bar, with Compact session one click away.' },
      { targets: ['.up-time.up-in-popover'], padY: 4, title: 'Pace lines', text: 'How much of each window has passed. Green: room to spare. Orange, or red near the limit: faster than time.' },
      { targets: ['.up-settings'], padY: 6, title: 'Your call', text: 'Turn the sidebar, the popover additions and the gears on or off.' },
    ],
  };

  window.mockupReady = () => {
    const has = (selector) => Boolean(document.querySelector(selector));
    const count = (selector) => document.querySelectorAll(selector).length;
    const popover = has('[data-cds="Popover"] .up-time') && has('.up-context') && has('.up-settings');
    if (view === 'pace') return true;
    if (view === 'popover') return popover;
    if (view === 'sessions') return count('[data-up-session="running"]') === 3 && has('[data-up-session="error"]') && has('[data-up-session="idle"]');
    const sessions = count('[data-up-session="running"]') === 3 && has('[data-up-session="awaiting"]') && has('[data-up-session="ready"]');
    if (view === 'sidebar') return has('#usage-pace .up-time') && sessions;
    return has('#usage-pace .up-time') && popover && sessions;
  };

  // A pace line goes with the bar below it.
  function rectsOf(selector, all) {
    const nodes = all ? [...document.querySelectorAll(selector)] : [document.querySelector(selector)];
    return nodes.flatMap((node) => {
      const boxes = [node.getBoundingClientRect()];
      if (selector.includes('up-time') && node.nextElementSibling) boxes.push(node.nextElementSibling.getBoundingClientRect());
      return boxes;
    });
  }

  function union(boxes) {
    return {
      left: Math.min(...boxes.map((box) => box.left)),
      top: Math.min(...boxes.map((box) => box.top)),
      right: Math.max(...boxes.map((box) => box.right)),
      bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
  }

  function line(layer, x1, y1, x2, y2) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${x1} ${y1} C${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--line)');
    path.setAttribute('stroke-width', '1');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x2);
    dot.setAttribute('cy', y2);
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', 'var(--line)');
    layer.append(path, dot);
  }

  function drawCallouts(layer, lines) {
    const list = CALLOUTS[view];
    const panel = (view === 'sidebar' ? document.querySelector('.window') : document.querySelector('[data-cds="Popover"]')).getBoundingClientRect();
    const x = Math.round(panel.right + 110);
    let minTop = 0;
    for (const { targets, all, padY, title, text } of list) {
      const box = union(targets.flatMap((selector) => rectsOf(selector, all)));
      // Marks stay inside the panel they point into.
      const left = Math.max(box.left - 6, panel.left + 4);
      const right = Math.min(box.right + 6, panel.right - 4);
      const top = box.top - padY;
      const bottom = box.bottom + padY;
      const mark = document.createElement('div');
      mark.className = 'mark';
      Object.assign(mark.style, { left: left + 'px', top: top + 'px', width: right - left + 'px', height: bottom - top + 'px' });
      const callout = document.createElement('div');
      callout.className = 'callout';
      callout.innerHTML = '<strong></strong><span></span>';
      callout.querySelector('strong').textContent = title;
      callout.querySelector('span').textContent = text;
      callout.style.left = x + 'px';
      layer.append(mark, callout);
      const h = callout.getBoundingClientRect().height;
      const centerY = (top + bottom) / 2;
      const calloutTop = Math.max(Math.round(centerY - h / 2), minTop);
      callout.style.top = calloutTop + 'px';
      minTop = calloutTop + h + 22;
      line(lines, right, centerY, x - 10, calloutTop + h / 2);
    }
  }

  // One line next to each session row that has a note.
  function drawNotes(layer, lines) {
    const card = document.querySelector('.window').getBoundingClientRect();
    const x = Math.round(card.right + 64);
    shown.forEach((session, index) => {
      if (!session.note) return;
      const row = document.querySelector(`[data-index="${index}"] .session-row`).getBoundingClientRect();
      const note = document.createElement('div');
      note.className = 'row-note';
      note.innerHTML = '<strong></strong><span></span>';
      note.querySelector('strong').textContent = session.note[0];
      note.querySelector('span').textContent = session.note[1];
      layer.append(note);
      const centerY = (row.top + row.bottom) / 2;
      const h = note.getBoundingClientRect().height;
      Object.assign(note.style, { left: x + 'px', top: Math.round(centerY - h / 2) + 'px' });
      line(lines, card.right - 4, centerY, x - 12, centerY);
    });
  }

  // The bounding box of everything drawn, for views that fit their content.
  // The popover view's window is an empty frame the size of the canvas.
  function contentBox() {
    const parts = [...document.querySelectorAll(view === 'popover' ? '.callout, [data-cds="Popover"]' : '.window, .states, .callout, .row-note')]
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0);
    return union(parts);
  }

  window.layoutMockup = () => {
    const win = document.querySelector('.window');
    const anchor = document.querySelector('.popover-anchor');
    if (view === 'sidebar' || view === 'sessions') {
      win.style.left = (bare ? 40 : 150) + 'px';
      const h = win.getBoundingClientRect().height;
      win.style.top = (bare ? 40 : Math.max(150, Math.round((height - h) / 2 + 30))) + 'px';
    }
    if (view === 'popover') {
      anchor.style.left = (bare ? 40 : 150) + 'px';
      const h = anchor.getBoundingClientRect().height;
      anchor.style.top = (bare ? 40 : Math.max(150, Math.round((height - h) / 2 + 30))) + 'px';
    }
    const layer = document.getElementById('callouts');
    layer.replaceChildren();
    const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    layer.append(lines);
    if (CALLOUTS[view]) drawCallouts(layer, lines);
    if (view === 'sessions') drawNotes(layer, lines);
    // Bare composites end 40 px after their content.
    if (bare && view !== 'hero') {
      const box = contentBox();
      resize(box.right + 40, box.bottom + 40);
    }
    return { width, height };
  };
})();

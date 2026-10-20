// Stand-in for the Claude desktop app: serves a fake https://claude.ai (a
// sidebar page, a usage popover modelled on Claude's, and the usage API) and
// loads Extension/ into the default session, as Claude does when started
// with REACT_PROFILE=1. Prints the widget state after each step.
const { app, BrowserWindow, protocol, session } = require('electron');
const path = require('path');

const PAGE = `<!doctype html><html lang="en" style="--cds-fill-accent:#2a78d6"><body style="width:300px;font:14px sans-serif">
<div class="dframe-nav-scroll">
  <div><a>Artifacts</a><a>Customize</a><button id="more" aria-expanded="false" class="nav-row"><span data-cds="Icon" aria-hidden="true" style="font-size:16px">&#xe000;</span><span class="text-muted">More</span></button></div>
  <div class="dframe-recents-by-mode"><div class="df-label-inset"><button><span>Projects</span></button></div><ul><li>Booking UI</li></ul></div>
</div>
<aside><section><span data-rail-context-summary data-rail-context-pct="37">74k / 200k</span><div data-cds="StackedMeter" role="img" aria-label="Context" tabindex="0"><span style="width:30%;background-color:rgb(74, 127, 217)"></span><span style="width:7%;background-color:rgb(208, 96, 58)"></span></div><button onclick="window.compacted = (window.compacted ?? 0) + 1">Compact session</button></section></aside>
<div id="portal-root"></div>
</body></html>`;

// Like Claude's, the popover shows fewer rows than the usage API returns and
// calls the weekly limit for all models just "Weekly".
const POPOVER = `<div data-cds="Popover" role="dialog"><div style="display:flex;flex-direction:column">
  <div class="usage-header" style="display:flex;justify-content:space-between"><span aria-hidden="true">Usage</span><span class="usage-icons"><button aria-label="See breakdown">#</button><a href="/settings/usage" aria-label="Usage settings">○</a></span></div>
  <div role="group" aria-label="Usage limits"><div class="usage-rows" style="display:flex;flex-direction:column;gap:12px;padding:0 16px">
    ${['Session limit', 'Weekly'].map((label, index) => `
      <div style="display:flex;flex-direction:column;gap:4px"><div><span id="limit-${index}">${label}</span><span>1% used</span></div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <div data-cds="Meter" data-variant="${index === 1 ? 'warning' : 'accent'}"><div role="meter" aria-labelledby="limit-${index}" style="height:4px"><div data-usage-bar-fill style="height:100%;width:1%"></div></div></div>
        <span id="caption-${index}">Resets in 4 hr</span>
      </div></div>`).join('')}
  </div></div>
</div></div>`;

const CREDITS = `<div class="credits"><div><span id="credits-label">Cloud session credits</span></div>
  <div data-cds="Meter" data-variant="success"><div role="meter" aria-labelledby="credits-label" style="height:4px"><div data-usage-bar-fill style="height:100%;width:100%"></div></div></div></div>`;

function usage(weekly = 30) {
  const at = (ms) => new Date(Date.now() + ms).toISOString();
  const week = at(6 * 86_400_000);
  return {
    limits: [
      { kind: 'session', percent: 9, resets_at: at((4 * 60 + 17) * 60_000) },
      { kind: 'weekly_all', percent: weekly, resets_at: week },
      { kind: 'weekly_scoped', scope: { model: { display_name: 'Fable' } }, percent: 4, resets_at: week },
    ],
  };
}

// Who is signed in. The lastActiveOrg cookie keeps naming org-active after
// switching to the second account, as it can in Claude; that account's
// first organization is API-only and has no plan limits.
const ACCOUNTS = {
  first: { organizations: [{ uuid: 'org-other' }], usage: { 'org-active': usage } },
  second: { organizations: [{ uuid: 'org-api' }, { uuid: 'org-second' }], usage: { 'org-api': () => ({}), 'org-second': () => usage(10) } },
  none: { organizations: [], usage: {} },
};
let account = ACCOUNTS.first;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function state(contents) {
  return contents.executeJavaScript(`(async () => {
    const widget = document.getElementById('usage-pace');
    const header = widget?.querySelector('.up-header');
    const popover = document.querySelector('[data-cds="Popover"]');
    let mutations = 0;
    const counter = new MutationObserver((records) => { mutations += records.length; });
    counter.observe(document.body, { childList: true, subtree: true, characterData: true });
    await new Promise((resolve) => setTimeout(resolve, 600));
    counter.disconnect();
    return {
      sidebar: widget?.isConnected ? {
        header: header.innerText.replace(/\\s+/g, ' ').trim(),
        headerClasses: header.className,
        iconSize: [...header.querySelectorAll('svg')].map((svg) => Math.round(svg.getBoundingClientRect().width)),
        headerIds: widget.querySelectorAll('[id]').length,
        rowsVisible: widget.querySelector('.up-rows').getBoundingClientRect().height > 0,
        text: widget.querySelector('.up-rows').innerText,
        previous: widget.previousElementSibling.textContent.replace(/[^\\x20-\\x7e]/g, '').trim(),
        next: widget.nextElementSibling.className,
        over: widget.querySelectorAll('.up-in-sidebar .up-segment-over').length,
        buffer: widget.querySelectorAll('.up-in-sidebar .up-segment-buffer').length,
        styled: getComputedStyle(widget.querySelector('.up-track')).position === 'relative',
      } : null,
      popover: popover && {
        pace: popover.querySelector('.up-popover-pace')?.textContent ?? null,
        lines: [...popover.querySelectorAll('[role="meter"]')].map((bar) => bar.closest('[data-cds="Meter"]').previousElementSibling?.classList.contains('up-time') ?? false),
        paceBeforeIcons: popover.querySelector('.up-popover-pace')?.nextElementSibling?.className ?? null,
        context: popover.querySelector('.up-context') && [...popover.querySelectorAll('.up-context-title, .up-context-value, .up-context-caption, .up-context-action')].map((node) => node.textContent).join(' '),
        contextBar: popover.querySelector('.up-context-stacked:not([hidden]) [data-cds="StackedMeter"]')
          ? [...popover.querySelectorAll('.up-context-stacked [data-cds="StackedMeter"] > span')].map((part) => part.style.backgroundColor).join(' ')
          : null,
        contextBarQuiet: [...popover.querySelectorAll('.up-context-stacked [role], .up-context-stacked [tabindex]')].length === 0,
        plainBarHidden: popover.querySelector('.up-context-track')?.hidden ?? null,
        contextFirst: popover.querySelector('.usage-rows')?.firstElementChild.classList.contains('up-context') ?? false,
        contextWidth: popover.querySelector('.up-context-fill')?.style.width ?? null,
        compacted: window.compacted ?? 0,
        settingsLast: popover.querySelector('[role="group"]')?.lastElementChild?.classList.contains('up-settings') ?? false,
        settingsInset: popover.querySelector('.up-settings')?.style.paddingLeft ?? null,
        contextBlocks: popover.querySelectorAll('.up-context').length,
        overLines: popover.querySelectorAll('.up-in-popover .up-segment-over').length,
        onWarning: [...popover.querySelectorAll('.up-in-popover')].map((line) => line.classList.contains('up-on-warning')),
        settings: [...popover.querySelectorAll('.up-settings input')].map((input) => input.dataset.setting + ':' + input.checked),
        settingsText: popover.querySelector('.up-settings')?.innerText.replace(/\\s+/g, ' ').trim() ?? null,
        settingsRows: popover.querySelectorAll('.up-settings').length,
        removedHint: popover.querySelector('.up-settings.up-removed')?.innerText ?? null,
      },
      mutations,
    };
  })()`);
}

async function step(contents, name, script, wait = 400) {
  if (script) await contents.executeJavaScript(script);
  await delay(wait);
  console.log(name + ' ' + JSON.stringify(await state(contents)));
}

// No Dock icon while the tests run.
app.dock?.hide();

app.whenReady().then(async () => {
  // The organization comes from the lastActiveOrg cookie, as on claude.ai;
  // /api/organizations lists another one to prove the cookie wins.
  protocol.handle('https', (request) => {
    const { pathname } = new URL(request.url);
    const usageOf = account.usage[/^\/api\/organizations\/([^/]+)\/usage$/.exec(pathname)?.[1]];
    if (usageOf) return Response.json(usageOf());
    if (pathname.endsWith('/usage')) return new Response('forbidden', { status: 403 });
    if (pathname === '/api/organizations') return Response.json(account.organizations);
    if (pathname.startsWith('/api/')) return new Response('not found', { status: 404 });
    return new Response(PAGE, { headers: { 'content-type': 'text/html' } });
  });
  await session.defaultSession.clearStorageData();
  await session.defaultSession.cookies.set({ url: 'https://claude.ai', name: 'lastActiveOrg', value: 'org-active' });
  await session.defaultSession.extensions.loadExtension(path.join(__dirname, '..', '..', 'Extension'));

  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
  const { webContents: contents } = win;
  await win.loadURL('https://claude.ai/epitaxy/test');
  await delay(1000);

  await step(contents, 'LOADED');
  await step(contents, 'POPOVER', `document.getElementById('portal-root').innerHTML = ${JSON.stringify(POPOVER)}`);
  // Like cloud session credits in some accounts: a block with a meter of its
  // own below the limits, loaded after them.
  await step(contents, 'CREDITS', `document.querySelector('[role="group"]').insertAdjacentHTML('beforeend', ${JSON.stringify(CREDITS)})`);
  await step(contents, 'CREDITS_GONE', `document.querySelector('.credits').remove()`);
  await step(contents, 'COMPACTED', `document.querySelector('.up-context-action').click()`);
  await step(contents, 'CONTEXT_CHANGED', `const summary = document.querySelector('[data-rail-context-summary]'); summary.setAttribute('data-rail-context-pct', '85'); summary.firstChild.nodeValue = '170k / 200k'`);
  await step(contents, 'COLLAPSED', `document.querySelector('#usage-pace .up-header').click()`);
  await step(contents, 'POPOVER_OFF', `document.querySelector('.up-settings input[data-setting="popover"]').click()`);
  await step(contents, 'SIDEBAR_OFF', `document.querySelector('.up-settings input[data-setting="sidebar"]').click()`);
  contents.reload();
  await delay(1000);
  await step(contents, 'RELOADED', `document.getElementById('portal-root').innerHTML = ${JSON.stringify(POPOVER)}`);
  await step(contents, 'SIDEBAR_ON', `document.querySelector('.up-settings input[data-setting="sidebar"]').click()`);
  // Switching accounts without a reload. The extension notices the
  // lastActiveOrg cookie changing, here to the new account's API-only
  // organization, which has no plan limits.
  const organization = (value) => session.defaultSession.cookies.set({ url: 'https://claude.ai', name: 'lastActiveOrg', value });
  account = ACCOUNTS.second;
  await organization('org-api');
  await step(contents, 'SWITCHED', null, 3000);
  account = ACCOUNTS.none;
  await step(contents, 'SIGNED_OUT', `document.dispatchEvent(new Event('visibilitychange'))`);
  // Signing in again while the cookie still names the first account's
  // organization: without usage, the extension asks again within seconds.
  await organization('org-active');
  await delay(2500);
  account = ACCOUNTS.first;
  await step(contents, 'SWITCHED_BACK', null, 6000);
  await step(contents, 'CONFIRM', `document.querySelector('.up-uninstall').click()`);
  await step(contents, 'CANCELLED', `document.querySelector('.up-confirm-cancel').click()`);
  await step(contents, 'UNINSTALLED', `document.querySelector('.up-uninstall').click(); document.querySelector('.up-confirm-remove').click()`);
  contents.reload();
  await delay(1000);
  await step(contents, 'AFTER_UNINSTALL', `document.getElementById('portal-root').innerHTML = ${JSON.stringify(POPOVER)}`);
  app.quit();
});

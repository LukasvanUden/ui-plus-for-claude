// Exports PNGs of docs/demo for the README: for each shot below, the usage
// popover and the sidebar row, in dark and light, at 2x. Run with
// `npm run screenshots`; the images land in docs/screenshots.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');

// usage and context name scenarios in docs/demo/demo.js. Every shot keeps
// the context at 50% or more, where Claude offers Compact session.
const SHOTS = [
  { name: 'session-tight', usage: 'session', context: 'mid' },
  { name: 'weekly-tight', usage: 'weekly', context: 'high' },
  { name: 'compact', usage: 'under', context: 'compact' },
];
const THEMES = ['dark', 'light'];
const LANG = 'en';
// Room around each element, for the popover's shadow.
const MARGIN = 16;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  const server = http.createServer((request, response) => {
    let file = path.join(ROOT, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (file.endsWith(path.sep)) file = path.join(file, 'index.html');
    if (!file.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Waits until the extension has drawn its time lines in both places.
async function settled(contents) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const ready = await contents.executeJavaScript(
      `Boolean(document.querySelector('[data-cds="Popover"] .up-time') && document.querySelector('#usage-pace .up-time'))`,
    );
    if (ready) return new Promise((resolve) => setTimeout(resolve, 300));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The extension did not render in the demo page.');
}

// The popover with its shadow; the sidebar from its top down to the end of
// the Usage rows.
function regions(contents) {
  return contents.executeJavaScript(`(() => {
    const box = (top, right, bottom, left) => ({
      x: Math.max(0, Math.floor(left - ${MARGIN})),
      y: Math.max(0, Math.floor(top - ${MARGIN})),
      width: Math.ceil(right - left + 2 * ${MARGIN}),
      height: Math.ceil(bottom - top + 2 * ${MARGIN}),
    });
    const popover = document.querySelector('[data-cds="Popover"]').getBoundingClientRect();
    const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
    const usage = document.getElementById('usage-pace').getBoundingClientRect();
    return {
      popover: box(popover.top, popover.right, popover.bottom, popover.left),
      sidebar: {
        x: Math.floor(sidebar.left),
        y: Math.floor(sidebar.top),
        width: Math.ceil(sidebar.width),
        height: Math.ceil(usage.bottom - sidebar.top + 4),
      },
    };
  })()`);
}

app.commandLine.appendSwitch('force-device-scale-factor', '2');
app.dock?.hide();

app.whenReady().then(async () => {
  const server = await serve();
  const { port } = server.address();
  fs.mkdirSync(OUT, { recursive: true });
  // Transparent around the popover, so the images sit on any page color.
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 760,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { backgroundThrottling: false },
  });
  const contents = win.webContents;
  contents.on('console-message', (event) => {
    if (event.level === 'error') console.error('demo: ' + event.message);
  });

  for (const shot of SHOTS) {
    for (const theme of THEMES) {
      const query = new URLSearchParams({ usage: shot.usage, context: shot.context, lang: LANG, theme, capture: '1' });
      await win.loadURL(`http://127.0.0.1:${port}/docs/demo/?${query}`);
      await settled(contents);
      for (const [part, rect] of Object.entries(await regions(contents))) {
        const file = path.join(OUT, `${shot.name}-${part}-${theme}.png`);
        fs.writeFileSync(file, (await contents.capturePage(rect)).toPNG());
        console.log(path.relative(ROOT, file));
      }
    }
  }
  server.close();
  app.quit();
});

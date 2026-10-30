// Exports the README images from docs/mockup at 2x: the whole window, the
// pace states, the session states (a PNG, and a GIF of the turning gears
// when ffmpeg is installed) and the usage popover. Run with
// `npm run screenshots`; the images land in docs/screenshots.
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');

// usage and context name scenarios in docs/demo/demo.js.
const SHOTS = [
  { name: 'hero', view: 'hero', usage: 'weekly' },
  { name: 'pace', view: 'pace' },
  { name: 'sessions', view: 'sessions', usage: 'weekly', gif: true },
  { name: 'popover', view: 'popover', usage: 'session' },
];
// The gear turns once in 2.4 s (Extension/widget.css). It has six teeth, so
// the GIF shows a sixth of a turn and loops without a jump.
const LOOP_S = 2.4 / 6;
const FRAMES = 8;

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Loads a view, waits until the extension has drawn it, and returns the
// area to capture.
async function render(win, port, shot) {
  const query = new URLSearchParams({ view: shot.view, usage: shot.usage ?? 'under', context: 'mid', lang: 'en', theme: 'dark', capture: '1', bare: '' });
  await win.loadURL(`http://127.0.0.1:${port}/docs/mockup/?${query}`);
  const contents = win.webContents;
  for (let attempt = 0; !(await contents.executeJavaScript('window.mockupReady()')); attempt += 1) {
    if (attempt === 80) throw new Error('The mockup did not render: ' + shot.view);
    await delay(100);
  }
  await delay(600);
  const { width, height } = await contents.executeJavaScript('window.layoutMockup()');
  await delay(300);
  return { x: 0, y: 0, width, height };
}

// One frame per step of the loop, each holding the gears' animation at a
// later point. Only what changes between frames (the gears) is stored again.
async function gif(contents, rect, file) {
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-plus-frames-'));
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const at = (frame / FRAMES) * LOOP_S;
    await contents.executeJavaScript(`(() => {
      const style = document.getElementById('gif-frame') ?? document.head.appendChild(Object.assign(document.createElement('style'), { id: 'gif-frame' }));
      style.textContent = '[data-up-session] > :is(.df-leading-slot, [data-row-label="iconless"])::before { animation-play-state: paused !important; animation-delay: -${at}s !important; }';
    })()`);
    await delay(60);
    fs.writeFileSync(path.join(frames, `frame${String(frame).padStart(2, '0')}.png`), (await contents.capturePage(rect)).toPNG());
  }
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(FRAMES / LOOP_S), '-i', path.join(frames, 'frame%02d.png'),
    '-vf', 'split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', file,
  ]);
  fs.rmSync(frames, { recursive: true });
}

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

app.commandLine.appendSwitch('force-device-scale-factor', '2');
app.dock?.hide();

app.whenReady().then(async () => {
  const server = await serve();
  const { port } = server.address();
  fs.mkdirSync(OUT, { recursive: true });
  // One window for every shot, large enough for each; the canvas is
  // transparent around the window and the rounded cards.
  const win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1100,
    useContentSize: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { backgroundThrottling: false },
  });
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error') console.error('mockup: ' + event.message);
  });

  const ffmpeg = hasFfmpeg();
  for (const shot of SHOTS) {
    const rect = await render(win, port, shot);
    const file = path.join(OUT, shot.name + '.png');
    fs.writeFileSync(file, (await win.webContents.capturePage(rect)).toPNG());
    console.log(path.relative(ROOT, file));
    if (shot.gif && ffmpeg) {
      const animated = path.join(OUT, shot.name + '.gif');
      await gif(win.webContents, rect, animated);
      console.log(path.relative(ROOT, animated));
    } else if (shot.gif) {
      console.log('ffmpeg not found: no ' + shot.name + '.gif');
    }
  }
  server.close();
  app.quit();
});

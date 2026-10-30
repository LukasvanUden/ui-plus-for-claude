// End to end against Tests/fake-claude: the extension loads into the default
// session, reads the usage API, adds a collapsible "Usage" row below "More",
// draws time lines in Claude's usage popover, and follows the popover settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const root = fileURLToPath(new URL('..', import.meta.url));

async function runFakeClaude() {
  const child = spawn(electron, ['Tests/fake-claude/main.js'], { cwd: root });
  const steps = {};
  for await (const line of createInterface({ input: child.stdout })) {
    const match = /^([A-Z_]+) (\{.*\})$/.exec(line);
    if (match) steps[match[1]] = JSON.parse(match[2]);
  }
  return steps;
}

test('sidebar row, popover time lines and settings', { timeout: 60_000 }, async () => {
  const steps = await runFakeClaude();

  const { sidebar } = steps.LOADED;
  assert.equal(sidebar.previous, 'ArtifactsScheduledCustomize', 'below the More row, also while it shows another page than "More"');
  assert.equal(sidebar.next, 'dframe-recents-by-mode', 'by the first section label that shows, not one of a hidden list');
  assert.equal(sidebar.header, 'Usage 16% over pace');
  assert.match(sidebar.headerClasses, /\bnav-row\b.*\bup-header\b/);
  assert.deepEqual(sidebar.iconSize, [16], 'the gauge takes the size of Claude\'s icon');
  assert.equal(sidebar.headerIds, 0);
  assert.equal(sidebar.rowsVisible, true);
  assert.equal(sidebar.styled, true);
  assert.equal(sidebar.over, 1);
  assert.equal(sidebar.buffer, 2);
  assert.match(sidebar.text, /Session limit\s+4 hr 1\d min · 9%/);
  assert.match(sidebar.text, /Weekly · Fable/);
  assert.equal(steps.LOADED.mutations, 0, 'the page settles once the widget is in place');
  assert.deepEqual(steps.LOADED.sessions, [
    'running turning icon-hidden',
    'awaiting still icon-hidden Waiting',
    'ready still icon-hidden Ready',
    'error still icon-hidden Error',
    'idle no-gear icon-hidden',
    '- no-gear icon-visible',
  ], 'a gear for active sessions, a badge for those that need you, no icon for the rest; navigation rows stay');
  assert.equal(steps.LOADED.tailMark, 'none', 'Claude\'s own mark at the end of the row gives way to the badge');
  assert.equal(steps.LOADED.decoration, 'none', 'also beside a wrapped link');
  assert.doesNotMatch(steps.LOADED.shimmer, /rgba\(0, 0, 0, 0\)|inline/, 'the title of a working session does not shimmer');

  assert.equal(steps.CLASSLESS.sidebar?.previous, 'ArtifactsScheduledMore', 'without Claude\'s layout classes, below the row labelled "More"');
  assert.equal(steps.CLASSLESS_ELSEWHERE.sidebar, null, 'never next to a "More" outside the sidebar');

  assert.deepEqual(steps.SESSION_CHANGED.sessions.slice(0, 2), ['ready still icon-hidden Ready', 'running turning icon-hidden'], 'follows state changes in place');
  assert.deepEqual(steps.SESSIONS_OFF.sessions, Array(5).fill('- no-gear icon-visible').concat('- no-gear icon-visible'));
  assert.notEqual(steps.SESSIONS_OFF.tailMark, 'none');
  assert.notEqual(steps.SESSIONS_OFF.decoration, 'none');
  assert.equal(steps.SESSIONS_OFF.shimmer, 'rgba(0, 0, 0, 0) inline');
  assert.deepEqual(steps.SESSIONS_OFF.popover.settings, ['sidebar:true', 'popover:true', 'sessions:false']);
  assert.equal(steps.SESSIONS_ON.sessions[0], 'ready still icon-hidden Ready');

  const { popover } = steps.POPOVER;
  assert.equal(popover.pace, '16% over pace');
  assert.equal(popover.paceBeforeIcons, 'usage-icons', 'the pace sits next to the header icons');
  assert.deepEqual(popover.lines, [true, true], 'rows are matched by title, "Weekly" included');
  assert.equal(popover.overLines, 1);
  assert.deepEqual(popover.onWarning, [false, true], 'red only where Claude\'s own meter left its accent color');
  assert.equal(popover.settingsLast, true, 'the settings row comes last');
  assert.equal(popover.settingsInset, '16px', 'with the inset of the limits');
  assert.equal(popover.contextBlocks, 1);
  assert.equal(popover.context, 'Context 37% used 74k / 200k Compact session', 'the session rail\'s context shows above the limits');
  assert.equal(popover.contextFirst, true);
  assert.equal(popover.contextWidth, '37%');
  assert.equal(popover.contextBar, 'rgb(74, 127, 217) rgb(208, 96, 58)', 'the rail\'s colored bar is copied with its colors');
  assert.equal(popover.contextBarQuiet, true, 'the copy has nothing to focus or announce');
  assert.equal(popover.plainBarHidden, true);

  const credits = steps.CREDITS.popover;
  assert.equal(credits.contextBlocks, 1, 'credits below the limits leave one context block');
  assert.equal(credits.contextFirst, true, 'still first among the limits');
  assert.equal(credits.settingsLast, true, 'the settings row moves below the credits');
  assert.equal(credits.settingsInset, '16px');
  assert.deepEqual(credits.lines, [true, true, false], 'no time line on the credits meter');
  assert.equal(steps.CREDITS.mutations, 0);
  assert.deepEqual(steps.CREDITS_GONE.popover.lines, [true, true]);

  assert.equal(steps.COMPACTED.popover.compacted, 1, 'the button presses the rail\'s own Compact button');
  assert.equal(steps.COMPACTED.mutations, 0);
  assert.equal(steps.CONTEXT_CHANGED.popover.context, 'Context 85% used 170k / 200k Compact session', 'follows the rail as it changes');
  assert.equal(steps.CONTEXT_CHANGED.popover.contextWidth, '85%');
  assert.deepEqual(popover.settings, ['sidebar:true', 'popover:true', 'sessions:true']);
  assert.equal(popover.settingsText, 'UI+ Sidebar Popover Sessions Uninstall…');
  assert.equal(steps.POPOVER.mutations, 0, 'enhancing the popover does not retrigger itself');

  assert.equal(steps.COLLAPSED.sidebar.rowsVisible, false);
  assert.equal(steps.COLLAPSED.sidebar.header, 'Usage 16% over pace');

  assert.equal(steps.POPOVER_OFF.popover.pace, null);
  assert.deepEqual(steps.POPOVER_OFF.popover.lines, [false, false]);
  assert.equal(steps.POPOVER_OFF.popover.context, null);
  assert.deepEqual(steps.POPOVER_OFF.popover.settings, ['sidebar:true', 'popover:false', 'sessions:true']);

  assert.equal(steps.SIDEBAR_OFF.sidebar, null);

  assert.equal(steps.RELOADED.sidebar, null, 'settings survive a reload');
  assert.deepEqual(steps.RELOADED.popover.lines, [false, false]);
  assert.deepEqual(steps.RELOADED.popover.settings, ['sidebar:false', 'popover:false', 'sessions:true']);

  assert.equal(steps.SIDEBAR_ON.sidebar.header, 'Usage 16% over pace');

  assert.equal(steps.SWITCHED.sidebar?.header, 'Usage 4% under pace', 'a stale lastActiveOrg cookie falls back to the new account\'s organization with limits');
  assert.equal(steps.SIGNED_OUT.sidebar, null, 'without usage the previous account\'s numbers disappear');
  assert.equal(steps.SWITCHED_BACK.sidebar?.header, 'Usage 16% over pace');

  const confirm = steps.CONFIRM;
  assert.equal(confirm.popover.settingsText, 'Remove UI+ from Claude? Cancel Remove', '"Uninstall…" asks first');
  assert.equal(confirm.sidebar.header, 'Usage 16% over pace', 'nothing is hidden before confirming');
  assert.equal(confirm.mutations, 0);

  assert.equal(steps.CANCELLED.popover.settingsText, 'UI+ Sidebar Popover Sessions Uninstall…');
  assert.deepEqual(steps.CANCELLED.popover.settings, ['sidebar:true', 'popover:false', 'sessions:true']);
  assert.equal(steps.CANCELLED.sidebar.header, 'Usage 16% over pace');

  const uninstalled = steps.UNINSTALLED;
  assert.equal(uninstalled.sidebar, null, 'confirming hides the sidebar row right away');
  assert.match(uninstalled.popover.removedHint, /^Hidden\. To remove UI\+ completely/);
  assert.deepEqual(uninstalled.popover.settings, []);
  assert.equal(uninstalled.mutations, 0);

  const after = steps.AFTER_UNINSTALL;
  assert.equal(after.sidebar, null, 'stays hidden after a reload');
  assert.equal(after.popover.settingsRows, 0);
  assert.deepEqual(after.popover.lines, [false, false]);
  assert.equal(after.popover.pace, null);
});

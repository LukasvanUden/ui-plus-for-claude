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

test('sidebar row, popover time lines and settings', { timeout: 40_000 }, async () => {
  const steps = await runFakeClaude();

  const { sidebar } = steps.LOADED;
  assert.equal(sidebar.previous, 'ArtifactsCustomizeMore');
  assert.equal(sidebar.next, 'dframe-recents-by-mode');
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

  const { popover } = steps.POPOVER;
  assert.equal(popover.pace, '16% over pace');
  assert.equal(popover.paceBeforeIcons, 'usage-icons', 'the pace sits next to the header icons');
  assert.deepEqual(popover.lines, [true, true], 'rows are matched by title, "Weekly" included');
  assert.equal(popover.overLines, 1);
  assert.deepEqual(popover.onWarning, [false, true], 'red only where Claude\'s own meter left its accent color');
  assert.equal(popover.settingsParent, 'usage-rows', 'the settings row shares the inset of the limits');
  assert.equal(popover.context, 'Context 37% used 74k / 200k Compact session', 'the session rail\'s context shows above the limits');
  assert.equal(popover.contextFirst, true);
  assert.equal(popover.contextWidth, '37%');

  assert.equal(steps.COMPACTED.popover.compacted, 1, 'the button presses the rail\'s own Compact button');
  assert.equal(steps.COMPACTED.mutations, 0);
  assert.equal(steps.CONTEXT_CHANGED.popover.context, 'Context 85% used 170k / 200k Compact session', 'follows the rail as it changes');
  assert.equal(steps.CONTEXT_CHANGED.popover.contextWidth, '85%');
  assert.deepEqual(popover.settings, ['sidebar:true', 'popover:true']);
  assert.equal(popover.settingsText, 'Usage Pace Sidebar Popover Uninstall…');
  assert.equal(steps.POPOVER.mutations, 0, 'enhancing the popover does not retrigger itself');

  assert.equal(steps.COLLAPSED.sidebar.rowsVisible, false);
  assert.equal(steps.COLLAPSED.sidebar.header, 'Usage 16% over pace');

  assert.equal(steps.POPOVER_OFF.popover.pace, null);
  assert.deepEqual(steps.POPOVER_OFF.popover.lines, [false, false]);
  assert.equal(steps.POPOVER_OFF.popover.context, null);
  assert.deepEqual(steps.POPOVER_OFF.popover.settings, ['sidebar:true', 'popover:false']);

  assert.equal(steps.SIDEBAR_OFF.sidebar, null);

  assert.equal(steps.RELOADED.sidebar, null, 'settings survive a reload');
  assert.deepEqual(steps.RELOADED.popover.lines, [false, false]);
  assert.deepEqual(steps.RELOADED.popover.settings, ['sidebar:false', 'popover:false']);

  assert.equal(steps.SIDEBAR_ON.sidebar.header, 'Usage 16% over pace');

  assert.equal(steps.SWITCHED.sidebar?.header, 'Usage 4% under pace', 'a stale lastActiveOrg cookie falls back to the new account\'s organization with limits');
  assert.equal(steps.SIGNED_OUT.sidebar, null, 'without usage the previous account\'s numbers disappear');
  assert.equal(steps.SWITCHED_BACK.sidebar?.header, 'Usage 16% over pace');

  const confirm = steps.CONFIRM;
  assert.equal(confirm.popover.settingsText, 'Remove Usage Pace from Claude? Cancel Remove', '"Uninstall…" asks first');
  assert.equal(confirm.sidebar.header, 'Usage 16% over pace', 'nothing is hidden before confirming');
  assert.equal(confirm.mutations, 0);

  assert.equal(steps.CANCELLED.popover.settingsText, 'Usage Pace Sidebar Popover Uninstall…');
  assert.deepEqual(steps.CANCELLED.popover.settings, ['sidebar:true', 'popover:false']);
  assert.equal(steps.CANCELLED.sidebar.header, 'Usage 16% over pace');

  const uninstalled = steps.UNINSTALLED;
  assert.equal(uninstalled.sidebar, null, 'confirming hides the sidebar row right away');
  assert.match(uninstalled.popover.removedHint, /^Hidden\. To remove Usage Pace completely/);
  assert.deepEqual(uninstalled.popover.settings, []);
  assert.equal(uninstalled.mutations, 0);

  const after = steps.AFTER_UNINSTALL;
  assert.equal(after.sidebar, null, 'stays hidden after a reload');
  assert.equal(after.popover.settingsRows, 0);
  assert.deepEqual(after.popover.lines, [false, false]);
  assert.equal(after.popover.pace, null);
});

// Run with: node scripts/check-climbing-session.js
// These checks use the real TypeScript classes with browser/API boundaries stubbed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('../frontend/ClientApp/node_modules/typescript');

const angular = {};
for (const name of ['Component', 'Injectable', 'HostListener', 'ViewChild']) angular[name] = () => () => {};
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(setImmediate);
const source = name => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/ClientApp/src/app/', name), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText;
const sources = {
  home: source('home/home.component.ts'),
  session: source('services/session.service.ts'),
  problem: source('problem.ts')
};

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(entries = new Map()) {
  const timers = new Map(), listeners = new Map();
  let timerId = 0, setup = 'Sep2021';
  const localStorage = { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
  const document = { body: { style: { overflow: 'auto' } }, activeElement: null, contains: target => target.connected !== false };
  const window = { setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) };
  let model;
  function load(code) {
    const context = { exports: {}, localStorage, document, window, require: name => {
      if (name === '@angular/core') return angular;
      if (name === '../problem') return model;
      throw Error('Unexpected runtime dependency: ' + name);
    } };
    vm.runInNewContext(code, context);
    return context.exports;
  }
  model = load(sources.problem);
  const sessions = new (load(sources.session).SessionService)();
  const searches = [], deletions = [], wall = [], navigation = [];
  const home = new (load(sources.home).HomeComponent)(
    {
      search: (...args) => { const request = deferred(); searches.push({ args, ...request }); return request.promise; },
      deleteProblem: id => { const request = deferred(); deletions.push({ id, ...request }); return request.promise; }
    },
    { showRoute: route => { const request = deferred(); wall.push({ route: plain(route), ...request }); return request.promise; } },
    { subscribe: (event, handler) => { listeners.set(event, handler); return () => listeners.delete(event); } },
    { getHoldSetup: () => setup }, sessions,
    { navigate: (...args) => { navigation.push(args); return Promise.resolve(); } },
    { snapshot: { queryParamMap: { get: () => null } } }
  );
  const problem = (id, difficulty = 'V2', layout = 'Sep2021') => ({
    id, name: id, difficulty, setup: layout, setter: 'Setter', notes: '',
    route: Object.assign(new model.Route(), { START: ['0'], TOP: ['401'] })
  });
  return {
    home, sessions, searches, deletions, wall, navigation, document, timers, problem, entries,
    switchSetup(value) { setup = value; listeners.get('holdSetupChangedEvent')(value); },
    flushTimers() { const callbacks = Array.from(timers.values()); timers.clear(); callbacks.forEach(callback => callback()); },
    async load(problems) { home.ngOnInit(); searches[searches.length - 1].resolve(problems); await flush(); },
    async acknowledgeWall() { wall[wall.length - 1].resolve({}); await flush(); }
  };
}

const checks = [];
const check = (name, run) => checks.push({ name, run });

check('restore, filters, queue, favorites and zoom leave the physical wall untouched', async () => {
  const h = harness(), rows = ['A', 'B', 'C'].map(id => h.problem(id));
  h.sessions.setSessionIds('Sep2021', ['missing-id', 'B']);
  h.sessions.recordSelection('Sep2021', 'C');
  await h.load(rows);
  assert.strictEqual(h.home.selectedProblem.id, 'C');
  assert.deepStrictEqual(plain(h.home.sessionProblems.map(p => p.id)), ['B']);
  assert.deepStrictEqual(plain(h.sessions.getSessionIds('Sep2021')), ['missing-id', 'B']);
  h.home.name = 'B'; h.home.applyFilters(); h.home.updateMinimum(1); h.home.resetFilters();
  h.home.toggleSession(rows[0]); h.home.moveEarlier(rows[0]); h.home.toggleFavorite(rows[1]);
  h.home.setCollection('favorites'); h.home.setCollection('session');
  h.home.openPanel('zoom'); h.home.closePanel();
  assert.strictEqual(h.wall.length, 0);
});

check('out-of-order layout responses cannot replace the current layout or send lights', async () => {
  const h = harness();
  h.home.ngOnInit(); h.switchSetup('Art');
  h.searches[1].resolve([h.problem('Drawing', 'V0', 'Art')]); await flush();
  h.searches[0].resolve([h.problem('Old layout')]); await flush();
  assert.strictEqual(h.home.setup, 'Art');
  assert.strictEqual(h.home.selectedProblem.id, 'Drawing');
  assert.strictEqual(h.wall.length, 0);
});

check('Next keeps the loaded filtered result order when library filters change', async () => {
  const h = harness(), rows = [h.problem('A'), h.problem('B', 'V6'), h.problem('C')];
  await h.load(rows);
  h.home.maximumGrade = 2; h.home.applyFilters(); h.home.loadProblem(rows[0], true);
  await h.acknowledgeWall();
  h.home.resetFilters();
  assert.deepStrictEqual(plain(h.home.navigation.map(p => p.id)), ['A', 'C']);
  h.home.step(1); await h.acknowledgeWall();
  assert.strictEqual(h.home.selectedProblem.id, 'C');
  assert.strictEqual(h.wall.length, 2);
  assert.strictEqual(h.home.nextDisabled, true);
});

check('Session navigation follows the full saved queue even when filters locate a route', async () => {
  const h = harness(), rows = [h.problem('A'), h.problem('B', 'V6'), h.problem('C')];
  h.sessions.setSessionIds('Sep2021', ['A', 'B', 'C']);
  await h.load(rows);
  h.home.setCollection('session'); h.home.maximumGrade = 2; h.home.applyFilters();
  assert.deepStrictEqual(plain(h.home.visibleProblems.map(p => p.id)), ['A', 'C']);
  h.home.loadProblem(rows[0], true); await h.acknowledgeWall();
  assert.strictEqual(h.home.navigationLabel, 'Session · 1 of 3');
  h.home.step(1); await h.acknowledgeWall();
  assert.strictEqual(h.home.selectedProblem.id, 'B');
});

check('reloading an active session quietly restores the selected route and queue order', async () => {
  const first = harness(), rows = ['A', 'B', 'C'].map(id => first.problem(id));
  first.sessions.setSessionIds('Sep2021', ['C', 'B', 'A']);
  await first.load(rows);
  first.home.startSession(); await first.acknowledgeWall();
  first.home.step(1); await first.acknowledgeWall();
  assert.strictEqual(first.sessions.isSessionActive('Sep2021'), true);
  first.home.ngOnDestroy();
  const reloaded = harness(first.entries);
  await reloaded.load(rows);
  assert.strictEqual(reloaded.home.selectedProblem.id, 'B');
  assert.strictEqual(reloaded.home.navigationLabel, 'Session · 2 of 3');
  assert.deepStrictEqual(plain(reloaded.home.navigation.map(p => p.id)), ['C', 'B', 'A']);
  assert.strictEqual(reloaded.wall.length, 0);
  reloaded.home.step(1); await reloaded.acknowledgeWall();
  assert.strictEqual(reloaded.home.selectedProblem.id, 'A');
  assert.strictEqual(reloaded.wall.length, 1);
});

check('active session restoration falls back quietly when the selected route left the queue', async () => {
  for (const queue of [[], ['C'], ['missing-id']]) {
    const h = harness(), rows = ['A', 'B', 'C'].map(id => h.problem(id));
    h.sessions.setSessionIds('Sep2021', queue);
    h.sessions.setSessionActive('Sep2021', true);
    h.sessions.recordSelection('Sep2021', 'B');
    await h.load(rows);
    assert.strictEqual(h.home.selectedProblem.id, 'B');
    assert.strictEqual(h.home.navigationLabel, 'Problem · 2 of 3');
    assert.strictEqual(h.wall.length, 0);
  }
});

check('explicitly loading from another collection exits the persisted active session', async () => {
  const h = harness(), rows = ['A', 'B'].map(id => h.problem(id));
  h.sessions.setSessionIds('Sep2021', ['B', 'A']);
  await h.load(rows);
  h.home.startSession(); await h.acknowledgeWall();
  h.home.setCollection('all'); h.home.loadProblem(rows[0], true); await h.acknowledgeWall();
  assert.strictEqual(h.sessions.isSessionActive('Sep2021'), false);
  const reloaded = harness(h.entries);
  await reloaded.load(rows);
  assert.strictEqual(reloaded.home.navigationLabel, 'Problem · 1 of 2');
  assert.strictEqual(reloaded.wall.length, 0);
});

check('finishing an old deletion preserves a newer selection, panel and wall command', async () => {
  const h = harness(), rows = ['A', 'B', 'C'].map(id => h.problem(id));
  h.sessions.setSessionIds('Sep2021', ['A', 'C']); h.sessions.toggleFavorite('Sep2021', 'A');
  await h.load(rows);
  h.home.confirmDelete = true; h.home.deleteProblem();
  h.home.loadProblem(rows[2], true); await h.acknowledgeWall();
  h.home.openPanel('zoom');
  const navigationCount = h.navigation.length;
  h.deletions[0].resolve(); await flush();
  assert.strictEqual(h.home.selectedProblem.id, 'C');
  assert.strictEqual(h.home.panel, 'zoom');
  assert.strictEqual(h.wall.length, 1);
  assert.strictEqual(h.navigation.length, navigationCount);
  assert.deepStrictEqual(plain(h.home.problems.map(p => p.id)), ['B', 'C']);
  assert.deepStrictEqual(plain(h.sessions.getSessionIds('Sep2021')), ['C']);
  assert.deepStrictEqual(plain(h.sessions.getFavoriteIds('Sep2021')), []);
});

check('deletion completing in another layout cleans only the original saved collection', async () => {
  const h = harness(), oldRows = [h.problem('A'), h.problem('B')];
  const artRows = [h.problem('X', 'V0', 'Art'), h.problem('Y', 'V0', 'Art')];
  h.sessions.setSessionIds('Sep2021', ['A', 'B']); h.sessions.toggleFavorite('Sep2021', 'A');
  h.sessions.setSessionIds('Art', ['Y', 'X']); h.sessions.toggleFavorite('Art', 'X');
  await h.load(oldRows);
  h.home.confirmDelete = true; h.home.deleteProblem();
  h.switchSetup('Art'); h.searches[1].resolve(artRows); await flush();
  h.home.loadProblem(artRows[1], true); await h.acknowledgeWall(); h.home.openPanel('zoom');
  const navigationCount = h.navigation.length;
  h.deletions[0].resolve(); await flush();
  assert.strictEqual(h.home.setup, 'Art'); assert.strictEqual(h.home.selectedProblem.id, 'Y');
  assert.strictEqual(h.home.panel, 'zoom'); assert.strictEqual(h.navigation.length, navigationCount);
  assert.strictEqual(h.wall.length, 1);
  assert.deepStrictEqual(plain(h.sessions.getSessionIds('Sep2021')), ['B']);
  assert.deepStrictEqual(plain(h.sessions.getFavoriteIds('Sep2021')), []);
  assert.deepStrictEqual(plain(h.sessions.getSessionIds('Art')), ['Y', 'X']);
  assert.deepStrictEqual(plain(h.sessions.getFavoriteIds('Art')), ['X']);
});

check('a failed clear after deleting the last problem can be retried without a selection', async () => {
  const h = harness(); await h.load([h.problem('Only problem')]);
  h.home.toggleLighting(); await h.acknowledgeWall();
  h.home.confirmDelete = true; h.home.deleteProblem(); h.deletions[0].resolve(); await flush();
  assert.strictEqual(h.home.selectedProblem, null);
  assert.strictEqual(h.wall.length, 2);
  assert.strictEqual(h.home.canToggleLighting, false);
  h.wall[1].reject(new Error('Connection interrupted')); await flush();
  assert.strictEqual(h.home.wallState, 'error'); assert.strictEqual(h.home.canToggleLighting, true);
  h.home.toggleLighting();
  assert.strictEqual(h.wall.length, 3);
  assert.deepStrictEqual(h.wall[2].route, { START: [], MOVES: [], TOP: [], FEET: [], RGB: [] });
  await h.acknowledgeWall();
  assert.strictEqual(h.home.wallState, 'off'); assert.strictEqual(h.home.wallError, '');
});

check('picking a problem restores the destroyed list at its saved scroll position', async () => {
  const h = harness(), rows = ['A', 'B', 'C'].map(id => h.problem(id));
  await h.load(rows);
  h.home.openPanel('library');
  h.home.problemList = { nativeElement: { scrollTop: 0 } };
  h.flushTimers();
  h.home.problemList.nativeElement.scrollTop = 780;
  h.home.loadProblem(rows[1], true);
  h.home.problemList = null;
  assert.strictEqual(h.home.panel, null);
  assert.strictEqual(h.wall.length, 1);
  h.home.openPanel('library');
  h.home.problemList = { nativeElement: { scrollTop: 0 } };
  h.flushTimers();
  assert.strictEqual(h.home.problemList.nativeElement.scrollTop, 780);
  assert.strictEqual(h.wall.length, 1, 'reopening the list must not change the wall');
});

check('scroll positions belong to each filter and collection, including pending DOM scroll events', async () => {
  const h = harness();
  await h.load(['A', 'B', 'C'].map(id => h.problem(id)));
  h.home.openPanel('library');
  const list = { scrollTop: 0 };
  h.home.problemList = { nativeElement: list };
  h.flushTimers(); list.scrollTop = 640;
  h.home.name = 'B'; h.home.applyFilters();
  list.scrollTop = 0; h.home.rememberLibraryScroll(); h.flushTimers();
  assert.strictEqual(list.scrollTop, 0);
  list.scrollTop = 120;
  h.home.resetFilters(); h.flushTimers();
  assert.strictEqual(list.scrollTop, 640);
  h.home.name = 'B'; h.home.applyFilters(); h.flushTimers();
  assert.strictEqual(list.scrollTop, 120);
  h.home.setCollection('favorites'); h.flushTimers();
  assert.strictEqual(list.scrollTop, 0);
  h.home.setCollection('all'); h.flushTimers();
  assert.strictEqual(list.scrollTop, 120);
  h.home.resetFilters(); h.flushTimers();
  assert.strictEqual(list.scrollTop, 640);
  h.home.closePanel();
  h.home.openPanel('library');
  h.home.ngOnDestroy(); h.flushTimers();
  assert.strictEqual(h.timers.size, 0);
});

check('focus returns after the modal update and pending focus is cancelled on destruction', async () => {
  const h = harness(); let originFocus = 0, dialogFocus = 0;
  const origin = { focus: () => originFocus++ };
  h.home.dialog = { nativeElement: { querySelector: () => ({ focus: () => dialogFocus++ }) } };
  h.home.openPanel('library', { currentTarget: origin }); h.flushTimers();
  assert.strictEqual(dialogFocus, 1); assert.strictEqual(h.document.body.style.overflow, 'hidden');
  h.home.closePanel();
  assert.strictEqual(originFocus, 0); assert.strictEqual(h.document.body.style.overflow, 'auto');
  h.flushTimers(); assert.strictEqual(originFocus, 1);
  h.home.openPanel('library', { currentTarget: origin }); h.home.closePanel(); h.home.ngOnDestroy();
  h.flushTimers(); assert.strictEqual(originFocus, 1); assert.strictEqual(h.timers.size, 0);
});

(async () => {
  for (const { name, run } of checks) {
    try { await run(); } catch (error) { throw new Error(name + '\n' + error.stack); }
  }
  console.log(`Climbing session: ${checks.length} state regression checks passed.`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });

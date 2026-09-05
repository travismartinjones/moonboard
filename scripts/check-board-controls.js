// Run with: node scripts/check-board-controls.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('../frontend/ClientApp/node_modules/typescript');
const { Subject } = require('../frontend/ClientApp/node_modules/rxjs');
const operators = require('../frontend/ClientApp/node_modules/rxjs/operators');
const app = path.join(__dirname, '../frontend/ClientApp/src/app');
const decorator = () => () => {};
const angular = {
  Component: () => target => target, Injectable: () => target => target,
  Input: decorator, Output: decorator, Inject: decorator,
  ViewChild: decorator, HostBinding: decorator, EventEmitter: class { emit() {} }
};
const values = new Map();
const localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
const browser = { addEventListener() {}, removeEventListener() {} };
const loaded = new Map();
function load(relativePath) {
  const filename = path.resolve(app, relativePath);
  if (loaded.has(filename)) return loaded.get(filename);
  const context = {
    exports: {}, localStorage, window: browser,
    require: name => {
      if (name === '@angular/core') return angular;
      if (name === '@angular/common/http') return {};
      if (name === 'rxjs/operators') return operators;
      if (name.startsWith('.')) return load(path.relative(app, path.resolve(path.dirname(filename), name + '.ts')));
      throw new Error('Unexpected dependency: ' + name);
    }
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
  }).outputText;
  vm.runInNewContext(compiled, context, { filename });
  loaded.set(filename, context.exports);
  return context.exports;
}
const { Route, Problem } = load('problem.ts');
const { LedsService } = load('services/leds.service.ts');
const { EventAggregatorService } = load('services/event-aggregator.service.ts');
const { ProblemComponent } = load('problem/problem.component.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
let checks = 0;
async function check(name, test) { await test(); checks++; }
function transport() {
  const calls = [];
  const service = new LedsService({ put: (url, route) => {
    const response = new Subject(); calls.push({ url, route, response }); return response;
  } }, '/api/');
  return { service, calls };
}
function board() {
  const events = new EventAggregatorService();
  const commands = [];
  let fail = false;
  const component = new ProblemComponent(events, { showRoute: route => {
    commands.push(plain(route));
    return fail ? Promise.reject(new Error('Offline test')) : Promise.resolve({ accepted: true });
  } }, { getHoldSetup: () => 'Sep2021' }, { detectChanges() {} });
  return { component, events, commands, setFailure: value => { fail = value; } };
}
(async () => {
  await check('transport snapshots mutable routes and serializes latest intent', async () => {
    const { service, calls } = transport();
    const route = new Route();
    route.START.push('1'); route.RGB.push({ index: '2', r: 1, g: 2, b: 3 });
    const first = service.showRoute(route);
    route.START.push('3'); route.RGB[0].r = 255;
    const superseded = service.showRoute(route).catch(error => error);
    const off = service.showRoute(new Route());
    assert.strictEqual(calls.length, 1, 'Only one HTTP request may be in flight');
    assert.deepStrictEqual(plain(calls[0].route.START), ['1']);
    assert.strictEqual(calls[0].route.RGB[0].r, 1);
    assert.strictEqual((await superseded).code, 'SUPERSEDED');
    calls[0].response.next({ accepted: 'first' }); calls[0].response.complete();
    assert.deepStrictEqual(await first, { accepted: 'first' });
    await flush();
    assert.strictEqual(calls.length, 2, 'Superseded Art strokes must not create a backlog');
    assert.deepStrictEqual(plain(calls[1].route), plain(new Route()));
    calls[1].response.next(null); calls[1].response.complete(); await off;
  });
  await check('transport rejects errors, times out, and never retries automatically', async () => {
    const { service, calls } = transport();
    const failed = service.showRoute(new Route()).catch(error => error);
    calls[0].response.error({ status: 503 });
    assert.match((await failed).message, /HTTP 503/);
    await flush(); assert.strictEqual(calls.length, 1);
    service.requestTimeoutMs = 10;
    const timedOut = service.showRoute(new Route()).catch(error => error);
    assert.match((await timedOut).message, /timed out.*unknown/);
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].response.observers.length, 0, 'Timeout unsubscribes the HTTP observable');
    await flush(); assert.strictEqual(calls.length, 2, 'No automatic retry');
    const recovered = service.showRoute(new Route());
    calls[2].response.next('HTTP response'); calls[2].response.complete();
    assert.strictEqual(await recovered, 'HTTP response');
  });
  await check('preview lifecycle and controls never send LEDs', async () => {
    const { component, events, commands } = board();
    const problem = new Problem(); problem.isNew = false; problem.route.START.push('1');
    component.problem = problem; component.readonly = true; component.autoSend = false;
    component.ngOnChanges({ problem: {} }); component.ngOnInit();
    events.publish('holdSetupChangedEvent', 'Art');
    component.toggleLighting(); component.retryLighting(); component.onHoldSelected(1);
    await flush();
    assert.strictEqual(commands.length, 0);
    assert.strictEqual(events.handlers.length, 1);
    component.ngOnDestroy(); assert.strictEqual(events.handlers.length, 0);
  });
  await check('blank editors wait for intent, toggle sends empty route, and failed sends require retry', async () => {
    values.set('isLighting', 'true');
    const { component, commands, setFailure } = board();
    component.ngOnChanges({ problem: {} }); component.ngOnInit();
    assert.strictEqual(commands.length, 0, 'New blank route must not clear the wall on entry');
    component.toggleLighting(); await flush();
    assert.strictEqual(component.lastSentLighting, true);
    assert.strictEqual(commands.length, 1, 'Initial Light problem action sends on');
    component.onHoldSelected(1); await flush();
    assert.deepStrictEqual(commands[1].START, ['1']);
    component.toggleLighting(); await flush();
    assert.deepStrictEqual(commands[2], plain(new Route()));
    assert.strictEqual(component.lastSentLighting, false);
    assert.strictEqual(values.get('isLighting'), 'false');
    setFailure(true); component.toggleLighting(); await flush();
    assert.strictEqual(component.isSending, false);
    assert.strictEqual(component.lightingError, 'Offline test');
    const count = commands.length; await flush(); assert.strictEqual(commands.length, count);
    setFailure(false); component.retryLighting(); await flush();
    assert.strictEqual(commands.length, count + 1);
    assert.strictEqual(component.lightingError, '');
    component.ngOnDestroy();
  });
  await check('saved editors initialize silently, geometry fits both axes, and mapping stays complete', async () => {
    values.set('isLighting', 'true');
    const { component, commands } = board();
    const problem = new Problem(); problem.isNew = false; problem.route.TOP.push('401');
    component.problem = problem; component.ngOnChanges({ problem: {} }); component.ngOnInit();
    assert.strictEqual(commands.length, 0, 'Loading a saved editor must not send to the wall');
    component.onHoldSelected(1);
    assert.strictEqual(commands.length, 1, 'A deliberate hold edit sends the new route');
    const holds = [].concat(...component.cells).filter(cell => cell.type === 'hold');
    assert.strictEqual(holds.length, 402);
    assert.strictEqual(new Set(holds.map(cell => cell.index)).size, 402);
    assert.deepStrictEqual(Array.from(holds, cell => cell.index).sort((a, b) => a - b), Array.from({ length: 402 }, (_, i) => i));
    component.fitToContainer = true;
    for (const [width, height] of [[390, 1000], [390, 420], [800, 300], [1000, 1560]]) {
      component.boardStage = { nativeElement: { clientWidth: width, clientHeight: height,
        getBoundingClientRect: () => ({ width: width * 3, height: height * 3 }) } };
      component.updateBoardSize();
      assert(component.fittedWidth <= width + .001);
      assert(component.fittedHeight <= height + .001);
      assert(Math.abs(component.fittedHeight / component.fittedWidth - 1.56) < .000001);
    }
    component.ngOnDestroy();
  });
  console.log(`Board controls: ${checks} transport, lifecycle, and geometry checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

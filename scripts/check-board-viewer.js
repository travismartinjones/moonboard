// Run with: node scripts/check-board-viewer.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('../frontend/ClientApp/node_modules/typescript');
const filename = path.join(__dirname, '../frontend/ClientApp/src/app/board-viewer/board-viewer.component.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
}).outputText;
const noopDecorator = () => () => {};
const core = {
  Component: () => target => target,
  Input: noopDecorator, Output: noopDecorator, ViewChild: noopDecorator,
  EventEmitter: class { constructor() { this.count = 0; } emit() { this.count++; } }
};
function target() {
  const listeners = [];
  return {
    listeners,
    addEventListener(type, handler, options) { listeners.push({ type, handler, options }); },
    removeEventListener(type, handler) {
      const index = listeners.findIndex(listener => listener.type === type && listener.handler === handler);
      assert(index >= 0, 'Cleanup must remove the exact registered listener');
      listeners.splice(index, 1);
    },
    dispatch(type, event) { listeners.filter(listener => listener.type === type).forEach(listener => listener.handler(event)); }
  };
}
function fixture(pointerEvents = true) {
  const browser = target();
  const document = target();
  let observer;
  browser.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observer = this; }
    observe(element) { this.element = element; }
    disconnect() { this.disconnected = true; }
  };
  if (pointerEvents) browser.PointerEvent = function () {};
  const context = { exports: {}, window: browser, document, require: name => {
    assert.strictEqual(name, '@angular/core'); return core;
  } };
  vm.runInNewContext(compiled, context, { filename });
  const area = target();
  let bounds = { left: 10, top: 20, width: 400, height: 624 };
  const captures = new Set();
  area.getBoundingClientRect = () => bounds;
  area.setPointerCapture = id => captures.add(id);
  area.hasPointerCapture = id => captures.has(id);
  area.releasePointerCapture = id => captures.delete(id);
  const component = new context.exports.BoardViewerComponent({ detectChanges() {} });
  component.gestureArea = { nativeElement: area };
  return { component, area, browser, document, captures, api: context.exports,
    get observer() { return observer; }, setBounds: value => { bounds = value; } };
}
const closeTo = (actual, expected) => assert(Math.abs(actual - expected) < .000001, `${actual} != ${expected}`);
const event = (id, x, y) => ({ pointerId: id, pointerType: 'touch', button: 0,
  clientX: x + 10, clientY: y + 20, cancelable: true, preventDefault() { this.prevented = true; } });
let checks = 0;
function check(name, test) { test(); checks++; }

check('pinch keeps its image anchor under a moving midpoint', () => {
  const { api } = fixture();
  const initial = { scale: 1, x: 0, y: 0 };
  const from = { x: 150, y: 300 }, to = { x: 180, y: 320 };
  const zoomed = api.zoomViewerBetween(initial, 2, from, to, 400, 624);
  closeTo(zoomed.scale, 2);
  closeTo(from.x * zoomed.scale + zoomed.x, to.x);
  closeTo(from.y * zoomed.scale + zoomed.y, to.y);
  const restored = api.zoomViewerBetween(zoomed, 1, to, from, 400, 624);
  closeTo(restored.x, 0); closeTo(restored.y, 0);
});

check('pan limits use the fitted image, preserve letterboxing, and clamp zoom', () => {
  const { api } = fixture();
  for (const [width, height] of [[390, 844], [844, 390], [400, 624]]) {
    const board = api.fittedBoardBounds(width, height);
    for (const scale of [1, 1.1, 2, 5, 20]) {
      for (const direction of [-1, 1]) {
        const view = api.clampViewerTransform({ scale, x: direction * 99999, y: -direction * 99999 }, width, height);
        assert(view.scale >= 1 && view.scale <= 5);
        const left = view.x + view.scale * board.left;
        const top = view.y + view.scale * board.top;
        const right = left + view.scale * board.width;
        const bottom = top + view.scale * board.height;
        if (board.width * view.scale <= width) closeTo(left, width - right);
        else { assert(left <= .000001); assert(right >= width - .000001); }
        if (board.height * view.scale <= height) closeTo(top, height - bottom);
        else { assert(top <= .000001); assert(bottom >= height - .000001); }
      }
    }
  }
});

check('pointer pinch transitions to one-finger pan without jumps and cancels cleanly', () => {
  const f = fixture(); const c = f.component; c.ngAfterViewInit();
  c.onPointerDown(event(1, 100, 300)); c.onPointerDown(event(2, 200, 300));
  c.onPointerMove(event(2, 300, 300));
  closeTo(c.view.scale, 2); closeTo(c.view.x, -100); closeTo(c.view.y, -300);
  assert.strictEqual(c.surfaceTransform, 'matrix(2,0,0,2,-100,-300)', 'Angular8 needs a single sanitized transform function');
  const before = { ...c.view };
  c.onPointerEnd(event(2, 300, 300));
  c.onPointerMove(event(1, 100, 300));
  closeTo(c.view.x, before.x); closeTo(c.view.y, before.y);
  c.onPointerMove(event(1, 120, 310));
  closeTo(c.view.x, before.x + 20); closeTo(c.view.y, before.y + 10);
  f.area.dispatch('pointercancel', event(1, 120, 310));
  assert.strictEqual(c.pointers.size, 0); assert.strictEqual(c.gesture, null); assert.strictEqual(f.captures.size, 0);
  const canceled = { ...c.view };
  c.onPointerMove(event(1, 300, 500)); closeTo(c.view.x, canceled.x);
  c.ngOnDestroy();
});

check('older iOS fallback uses non-passive touch gestures and resets on touch cancellation', () => {
  const f = fixture(false); const c = f.component; c.ngAfterViewInit();
  for (const type of ['touchstart', 'touchmove', 'gesturestart', 'gesturechange']) {
    assert.strictEqual(f.area.listeners.find(listener => listener.type === type).options.passive, false);
  }
  const touchEvent = points => ({ touches: points.map(([identifier, x, y]) => ({ identifier, clientX: x + 10, clientY: y + 20 })),
    cancelable: true, preventDefault() { this.prevented = true; } });
  const start = touchEvent([[1, 100, 300], [2, 200, 300]]);
  f.area.dispatch('touchstart', start); assert.strictEqual(start.prevented, true);
  const move = touchEvent([[1, 100, 300], [2, 300, 300]]);
  f.area.dispatch('touchmove', move); assert.strictEqual(move.prevented, true); closeTo(c.view.scale, 2);
  f.area.dispatch('touchcancel', touchEvent([]));
  assert.strictEqual(c.pointers.size, 0); assert.strictEqual(c.gesture, null);
  c.onMouseDown({ button: 0, clientX: 200, clientY: 200, preventDefault() {} });
  assert.strictEqual(c.pointers.size, 0, 'Compatibility mouse events after touch must not restart a drag');
  c.ngOnDestroy();
});

check('rotation preserves the viewed image point where bounds permit and releases capture', () => {
  const f = fixture(); const c = f.component; c.ngAfterViewInit();
  c.view = { scale: 3, x: -420, y: -650 };
  const old = f.api.fittedBoardBounds(400, 624);
  const x = ((200 - c.view.x) / c.view.scale - old.left) / old.width;
  const y = ((312 - c.view.y) / c.view.scale - old.top) / old.height;
  c.onPointerDown(event(1, 120, 200));
  f.setBounds({ left: 0, top: 0, width: 624, height: 400 }); f.observer.callback();
  const next = f.api.fittedBoardBounds(624, 400);
  closeTo(((312 - c.view.x) / c.view.scale - next.left) / next.width, x);
  closeTo(((200 - c.view.y) / c.view.scale - next.top) / next.height, y);
  assert.strictEqual(c.pointers.size, 0); assert.strictEqual(f.captures.size, 0);
  c.ngOnDestroy();
});

check('native browser zoom shortcuts pass through and all listeners clean up', () => {
  for (const pointerEvents of [true, false]) {
    const f = fixture(pointerEvents); const c = f.component; c.ngAfterViewInit();
    let prevented = false;
    c.onKeyDown({ key: '+', ctrlKey: true, preventDefault() { prevented = true; } });
    assert.strictEqual(prevented, false); closeTo(c.view.scale, 1);
    c.onKeyDown({ key: '+', preventDefault() {} }); assert(c.view.scale > 1);
    c.onKeyDown({ key: '0', preventDefault() {} }); closeTo(c.view.scale, 1);
    c.onPointerDown(event(1, 100, 100)); f.browser.dispatch('blur', {});
    assert.strictEqual(c.pointers.size, 0);
    c.close(); assert.strictEqual(c.closed.count, 1);
    c.ngOnDestroy();
    assert.strictEqual(f.area.listeners.length, 0); assert.strictEqual(f.browser.listeners.length, 0);
    assert.strictEqual(f.document.listeners.length, 0); assert.strictEqual(f.observer.disconnected, true);
  }
});
console.log(`Board viewer: ${checks} pinch, pan, resize, and lifecycle checks passed.`);

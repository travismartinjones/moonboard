// Run with: node scripts/check-session-service.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('../frontend/ClientApp/node_modules/typescript');

const filename = path.join(__dirname, '../frontend/ClientApp/src/app/services/session.service.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.CommonJS,
    experimentalDecorators: true
  }
}).outputText;

function storage() {
  const entries = new Map();
  return {
    getItem: key => entries.has(key) ? entries.get(key) : null,
    setItem: (key, value) => entries.set(key, value)
  };
}

function service(localStorage) {
  const context = {
    exports: {}, localStorage,
    require: name => {
      assert.strictEqual(name, '@angular/core');
      return { Injectable: () => target => target };
    }
  };
  vm.runInNewContext(compiled, context, { filename });
  return new context.exports.SessionService();
}

const plain = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(name, test) {
  test();
  checks++;
}

check('state survives reload and stays separate for each setup', () => {
  const store = storage();
  const first = service(store);
  ['Nov2020', 'Sep2021', 'Art'].forEach((setup, index) => {
    first.setSessionIds(setup, [`route-${index}`, 'shared-id']);
    first.setSessionActive(setup, index === 1);
    first.toggleFavorite(setup, `favorite-${index}`);
    first.recordSelection(setup, `selected-${index}`);
  });
  const reloaded = service(store);
  ['Nov2020', 'Sep2021', 'Art'].forEach((setup, index) => {
    assert.deepStrictEqual(plain(reloaded.getSessionIds(setup)), [`route-${index}`, 'shared-id']);
    assert.strictEqual(reloaded.isSessionActive(setup), index === 1);
    assert.deepStrictEqual(plain(reloaded.getFavoriteIds(setup)), [`favorite-${index}`]);
    assert.deepStrictEqual(plain(reloaded.getRecentIds(setup)), [`selected-${index}`]);
    assert.strictEqual(reloaded.getLastSelectedId(setup), `selected-${index}`);
  });
});

check('active session migration accepts only a saved boolean and defaults to inactive', () => {
  for (const value of [undefined, null, 'true', 1, [], {}, false, true]) {
    const store = storage();
    store.setItem('moonboard.session.v1:Sep2021', JSON.stringify({ sessionIds: ['saved-route'], activeSession: value }));
    const instance = service(store);
    assert.strictEqual(instance.isSessionActive('Sep2021'), value === true);
    assert.deepStrictEqual(plain(instance.getSessionIds('Sep2021')), ['saved-route']);
    instance.setSessionActive('Sep2021', true);
    assert.strictEqual(service(store).isSessionActive('Sep2021'), true);
    instance.setSessionActive('Sep2021', false);
    assert.strictEqual(service(store).isSessionActive('Sep2021'), false);
  }
});

check('caller mutations cannot change stored arrays', () => {
  const instance = service(storage());
  const ids = ['one', 'two', 'one', '', null, 3];
  instance.setSessionIds('Sep2021', ids);
  ids.push('unexpected');
  instance.getSessionIds('Sep2021').push('unexpected');
  instance.toggleFavorite('Sep2021', 'one');
  instance.getFavoriteIds('Sep2021').pop();
  instance.recordSelection('Sep2021', 'two');
  instance.getRecentIds('Sep2021').pop();
  assert.deepStrictEqual(plain(instance.getSessionIds('Sep2021')), ['one', 'two']);
  assert.deepStrictEqual(plain(instance.getFavoriteIds('Sep2021')), ['one']);
  assert.deepStrictEqual(plain(instance.getRecentIds('Sep2021')), ['two']);
});

check('recent selections move to the front and evict the oldest after twenty', () => {
  const instance = service(storage());
  for (let index = 0; index < 25; index++) instance.recordSelection('Art', `route-${index}`);
  instance.recordSelection('Art', 'route-10');
  const ids = plain(instance.getRecentIds('Art'));
  assert.strictEqual(ids.length, 20);
  assert.strictEqual(new Set(ids).size, 20);
  assert.strictEqual(ids[0], 'route-10');
  assert.strictEqual(ids[19], 'route-5');
  assert.strictEqual(ids.indexOf('route-4'), -1);
  assert.strictEqual(instance.getLastSelectedId('Art'), 'route-10');
});

check('corrupt or wrongly shaped storage recovers without changing other setups', () => {
  for (const content of ['{broken', 'null', '3', '[]', '"text"']) {
    const store = storage();
    store.setItem('moonboard.session.v1:Art', content);
    const instance = service(store);
    assert.deepStrictEqual(plain(instance.getSessionIds('Art')), []);
    assert.strictEqual(instance.getLastSelectedId('Art'), null);
    instance.recordSelection('Art', 'new-route');
    assert.strictEqual(service(store).getLastSelectedId('Art'), 'new-route');
  }
  const store = storage();
  store.setItem('moonboard.session.v1:Art', JSON.stringify({
    sessionIds: ['valid', 'valid', 4, {}, ' '], favoriteIds: 'wrong',
    recentIds: Array.from({ length: 25 }, (_, index) => `route-${index}`), lastSelectedId: {}
  }));
  const instance = service(store);
  assert.deepStrictEqual(plain(instance.getSessionIds('Art')), ['valid']);
  assert.deepStrictEqual(plain(instance.getFavoriteIds('Art')), []);
  assert.strictEqual(instance.getRecentIds('Art').length, 20);
  assert.strictEqual(instance.getLastSelectedId('Art'), null);
});

check('blocked or missing storage still supports the current visit', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  for (const store of [undefined, blocked]) {
    const instance = service(store);
    instance.setSessionIds('Sep2021', ['one']);
    instance.setSessionActive('Sep2021', true);
    instance.toggleFavorite('Sep2021', 'one');
    instance.recordSelection('Sep2021', 'one');
    assert.deepStrictEqual(plain(instance.getSessionIds('Sep2021')), ['one']);
    assert.strictEqual(instance.isSessionActive('Sep2021'), true);
    assert.deepStrictEqual(plain(instance.getFavoriteIds('Sep2021')), ['one']);
    assert.strictEqual(instance.getLastSelectedId('Sep2021'), 'one');
  }
});

check('quota failures retain newer in-memory state instead of reverting to storage', () => {
  const store = storage();
  const instance = service(store);
  instance.setSessionIds('Nov2020', ['old']);
  store.setItem = () => { throw Error('quota exceeded'); };
  instance.setSessionIds('Nov2020', ['new']);
  instance.toggleFavorite('Nov2020', 'new');
  instance.toggleFavorite('Nov2020', 'new');
  instance.recordSelection('Nov2020', 'new');
  instance.recordSelection('Nov2020', ' ');
  assert.deepStrictEqual(plain(instance.getSessionIds('Nov2020')), ['new']);
  assert.deepStrictEqual(plain(instance.getFavoriteIds('Nov2020')), []);
  assert.strictEqual(instance.getLastSelectedId('Nov2020'), 'new');
});

console.log(`SessionService: ${checks} persistence checks passed.`);

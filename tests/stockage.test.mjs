import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerStockage, CLE_LOCALE } from '../src/stockage.js';

function fauxLocal() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
function fauxDb() {
  const docs = new Map();
  const appels = [];
  return {
    appels,
    docs,
    doc(path) {
      return {
        async get() { appels.push(['get', path]); const d = docs.get(path); return { exists: !!d, data: () => d }; },
        async set(data) { appels.push(['set', path]); docs.set(path, JSON.parse(JSON.stringify(data))); },
      };
    },
  };
}

test('sans rien : mémoire', async () => {
  const s = creerStockage({ local: null, db: null });
  assert.equal(s.mode, 'memoire');
  assert.equal(await s.charger(), null);
  await s.sauver({ version: 1, x: 2 });
  assert.deepEqual(await s.charger(), { version: 1, x: 2 });
});

test('localStorage', async () => {
  const local = fauxLocal();
  const s = creerStockage({ local, db: null });
  assert.equal(s.mode, 'local');
  assert.equal(await s.charger(), null);
  await s.sauver({ version: 1, a: [1, 2] });
  assert.equal(local.getItem(CLE_LOCALE), '{"version":1,"a":[1,2]}');
  assert.deepEqual(await s.charger(), { version: 1, a: [1, 2] });
});

test('localStorage corrompu → null, et l’ancien contenu est mis de côté', async () => {
  const local = fauxLocal();
  local.setItem(CLE_LOCALE, '{pas du json');
  const s = creerStockage({ local, db: null });
  assert.equal(await s.charger(), null);
  assert.equal(local.getItem(CLE_LOCALE + '.corrompu'), '{pas du json');
});

test('localStorage qui lève → bascule mémoire', async () => {
  const local = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); } };
  const s = creerStockage({ local, db: null });
  assert.equal(await s.charger(), null);
  await s.sauver({ version: 1 });
  assert.equal(s.mode, 'memoire');
  assert.deepEqual(await s.charger(), { version: 1 });
});

test('base de l’artefact', async () => {
  const db = fauxDb();
  const local = fauxLocal();
  const s = creerStockage({ local, db });
  assert.equal(s.mode, 'artefact');
  assert.equal(await s.charger(), null);
  await s.sauver({ version: 1, b: 3 });
  assert.deepEqual(await s.charger(), { version: 1, b: 3 });
  assert.deepEqual(db.appels.map((a) => a[1]), ['etat/eleve', 'etat/eleve', 'etat/eleve']);
  // le local sert de copie de secours
  assert.equal(local.getItem(CLE_LOCALE), '{"version":1,"b":3}');
});

test('base qui échoue à l’écriture → on garde le local', async () => {
  const db = fauxDb();
  db.doc = () => ({ async get() { throw { code: 'unavailable' }; }, async set() { throw { code: 'unavailable' }; } });
  const local = fauxLocal();
  const s = creerStockage({ local, db });
  await s.sauver({ version: 1, c: 1 });
  assert.deepEqual(await s.charger(), { version: 1, c: 1 });
  assert.ok(s.derniereErreur);
});

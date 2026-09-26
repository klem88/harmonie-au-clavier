import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererPiece, notesAttendues, sequencePiece, dureePieceMs, melodieValide, NIVEAUX_PIECE } from '../src/piece.js';
import { U } from '../src/rythme.js';
import { note, midi, gammeMajeure, classe } from '../src/theorie.js';

const GRAINES = Array.from({ length: 500 }, (_, i) => i * 7919 + 13);
const SAUT_MAX_DEMI_TONS = { 1: 4, 2: 5, 3: 7 };

test('même graine, même pièce ; graines différentes, pièces variées', () => {
  assert.deepEqual(genererPiece(2, 42), genererPiece(2, 42));
  const formes = new Set(GRAINES.slice(0, 20).map((g) => JSON.stringify(genererPiece(1, g).notes.map((n) => [n.midi, n.duree]))));
  assert.ok(formes.size >= 15, `seulement ${formes.size} pièces différentes sur 20`);
});

for (const niveau of [1, 2, 3]) {
  test(`niveau ${niveau} : règles respectées sur 500 graines`, () => {
    const cfg = NIVEAUX_PIECE[niveau];
    const vus = { temps: new Set(), tonalites: new Set(), croches: false };
    for (const g of GRAINES) {
      const p = genererPiece(niveau, g);
      vus.temps.add(p.temps); vus.tonalites.add(p.tonalite);
      assert.ok(cfg.tonalites.includes(p.tonalite));
      const mesureU = p.temps * U;
      for (let m = 0; m < p.mesures; m++) {
        const dans = p.notes.filter((n) => n.mesure === m);
        assert.equal(dans.reduce((s, n) => s + n.duree, 0), mesureU, `graine ${g} mesure ${m} incomplète`);
        for (const n of dans) assert.ok(n.pos + n.duree <= (m + 1) * mesureU, `graine ${g} : note à cheval sur la barre`);
      }
      const toniqueMidi = midi(note(p.tonalite), 4);
      const midis = p.notes.map((n) => n.midi);
      const haut = niveau === 3 ? 14 : 7;
      for (const x of midis) assert.ok(x >= toniqueMidi && x <= toniqueMidi + haut, `graine ${g} : ${x} hors position`);
      for (let i = 1; i < midis.length; i++) {
        const d = midis[i] - midis[i - 1];
        assert.ok(Math.abs(d) <= SAUT_MAX_DEMI_TONS[niveau], `graine ${g} : saut de ${d}`);
        assert.notEqual(Math.abs(d), 6, `graine ${g} : triton`);
        if (i >= 2) {
          const a = midis[i - 1] - midis[i - 2];
          if (Math.abs(d) >= 3 && Math.abs(a) >= 3) assert.notEqual(Math.sign(d), Math.sign(a), `graine ${g} : deux sauts de suite dans le même sens`);
        }
      }
      const gamme = gammeMajeure(note(p.tonalite)).map(classe);
      assert.ok([gamme[0], gamme[2], gamme[4]].includes(midis[0] % 12), `graine ${g} : départ hors I-III-V`);
      const der = p.notes.at(-1);
      assert.equal(der.midi % 12, toniqueMidi % 12, `graine ${g} : ne finit pas sur la tonique`);
      assert.ok(der.duree >= 2 * U, `graine ${g} : fin trop courte`);
      if (niveau === 3) assert.equal(der.midi, toniqueMidi + 12, `graine ${g} : J3 finit après le changement de position`);
      if (p.notes.some((n) => n.duree === U / 2)) vus.croches = true;
    }
    if (niveau === 1) { assert.deepEqual([...vus.tonalites], ['C']); assert.equal(vus.croches, false); }
    if (niveau >= 2) { assert.equal(vus.tonalites.size, 4); assert.ok(vus.croches); }
    if (niveau === 3) assert.deepEqual([...vus.temps].sort(), [3, 4]);
  });
}

test('notes attendues, durée et séquence de lecture au tempo', () => {
  const p = genererPiece(1, 7);
  const a = notesAttendues(p, 60);
  assert.equal(a.length, p.notes.length);
  assert.deepEqual(a.map((x) => x.tMs), p.notes.map((n) => (n.pos * 1000) / U));
  assert.deepEqual(a.map((x) => x.mesure), p.notes.map((n) => n.mesure));
  assert.equal(dureePieceMs(p, 60), 16000);
  const s = sequencePiece(p, 120);
  assert.equal(s.reduce((t, e) => t + e.dureeMs, 0), 8000);
  assert.deepEqual(s[0].midis, [p.notes[0].midi]);
});

test('melodieValide refuse deux sauts de suite dans le même sens et le triton', () => {
  assert.equal(melodieValide([0, 2, 4], [60, 64, 67], 4), false);
  assert.equal(melodieValide([0, 2, 1], [60, 64, 62], 4), true);
  assert.equal(melodieValide([3, 6], [65, 71], 4), false);
  assert.equal(melodieValide([0, 3], [60, 65], 2), false, 'saut trop grand pour le niveau');
});

test('main droite par défaut : clé de sol', () => {
  const p = genererPiece(2, 42);
  assert.equal(p.main, 'droite');
  assert.equal(p.cle, 'sol');
  assert.deepEqual(genererPiece(2, 42, { main: 'droite' }), p);
});

test('main gauche : même pièce une octave plus bas, en clé de fa, autour de do3', () => {
  for (const niveau of [1, 2, 3]) {
    for (const g of GRAINES.slice(0, 200)) {
      const d = genererPiece(niveau, g);
      const p = genererPiece(niveau, g, { main: 'gauche' });
      assert.equal(p.main, 'gauche');
      assert.equal(p.cle, 'fa');
      assert.deepEqual(p.notes.map((n) => n.midi), d.notes.map((n) => n.midi - 12));
      assert.deepEqual(p.notes.map((n) => n.octave), d.notes.map((n) => n.octave - 1));
      assert.deepEqual(p.notes.map((n) => [n.pos, n.duree]), d.notes.map((n) => [n.pos, n.duree]));
      for (const n of p.notes) assert.ok(n.midi >= 48 && n.midi <= (niveau === 3 ? 69 : 62), `niveau ${niveau} graine ${g} : ${n.midi} hors registre`);
    }
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererPieceEnsemble, NIVEAUX_ENSEMBLE, ACCORDS_ENSEMBLE, CONSONANCES, mesureComplementaire, notesAttenduesEnsemble, instantsAttendus, notesAJouer } from '../src/ensemble.js';
import { U } from '../src/rythme.js';
import { note, midi } from '../src/theorie.js';

const GRAINES = Array.from({ length: 500 }, (_, i) => i * 7919 + 13);
const mod7 = (d) => ((d % 7) + 7) % 7;
const tempsFort = (pos, temps) => pos % (temps === 4 ? 2 * U : 3 * U) === 0;

test('même graine, même pièce ; graines différentes, pièces variées', () => {
  assert.deepEqual(genererPieceEnsemble(2, 42), genererPieceEnsemble(2, 42));
  const formes = new Set(GRAINES.slice(0, 20).map((g) => JSON.stringify(genererPieceEnsemble(1, g).droite.map((n) => [n.midi, n.duree]))));
  assert.ok(formes.size >= 15, `seulement ${formes.size} pièces différentes sur 20`);
});

test('niveau inconnu : erreur', () => {
  assert.throws(() => genererPieceEnsemble(9, 1), /Niveau mains ensemble inconnu/);
});

for (const niveau of [1, 2, 3]) {
  test(`E${niveau} : règles respectées sur 500 graines`, () => {
    const cfg = NIVEAUX_ENSEMBLE[niveau];
    const vus = new Set();
    for (const g of GRAINES) {
      const p = genererPieceEnsemble(niveau, g);
      vus.add(`${p.tonalite}${p.temps}`);
      assert.equal(p.main, 'ensemble');
      assert.ok(cfg.tonalites.includes(p.tonalite) && cfg.temps.includes(p.temps));
      assert.equal(p.harmonies[0], 'I'); assert.equal(p.harmonies[3], 'I');
      assert.ok(['IV', 'V'].includes(p.harmonies[2]));
      const mesureU = p.temps * U;
      const tonique4 = midi(note(p.tonalite), 4); const tonique3 = tonique4 - 12;
      for (const main of ['droite', 'gauche']) {
        for (let m = 0; m < p.mesures; m++) {
          const dans = p[main].filter((n) => n.mesure === m);
          assert.equal(dans.reduce((s, n) => s + n.duree, 0), mesureU, `graine ${g} ${main} mesure ${m} incomplète`);
        }
      }
      // main droite : position, temps forts dans l'accord, fin sur la tonique en valeur longue
      for (const n of p.droite) {
        assert.ok(n.midi >= tonique4 && n.midi <= tonique4 + 7, `graine ${g} : ${n.midi} hors position (droite)`);
        if (tempsFort(n.pos, p.temps)) assert.ok(ACCORDS_ENSEMBLE[p.harmonies[n.mesure]].notes.includes(mod7(n.degre)), `graine ${g} : temps fort hors accord`);
      }
      assert.equal(p.droite.at(-1).midi, tonique4);
      assert.ok(p.droite.at(-1).duree >= 2 * U);
      // main gauche : position de cinq doigts sur la tonique à l'octave 3, au-dessus de do3
      for (const n of p.gauche) {
        assert.ok(n.midi >= tonique3 && n.midi <= tonique3 + 7 && n.midi >= 48, `graine ${g} : ${n.midi} hors position (gauche)`);
        assert.ok(n.duree >= U, `graine ${g} : croche à la main gauche`);
        if (n.pos % mesureU === 0) {
          const acc = ACCORDS_ENSEMBLE[p.harmonies[n.mesure]];
          if (cfg.basseTemps1) assert.equal(n.degre, acc.basse, `graine ${g} : temps 1 sans la basse`);
          else assert.ok(acc.notes.includes(mod7(n.degre)), `graine ${g} : temps 1 hors accord`);
        }
      }
      const derniere = p.gauche.at(-1);
      assert.equal(derniere.midi, tonique3);
      assert.equal(derniere.pos, (p.mesures - 1) * mesureU);
      assert.equal(derniere.duree, mesureU);
      // attaques simultanées : consonance, jamais d'octave
      const droiteA = new Map(p.droite.map((n) => [n.pos, n]));
      for (const n of p.gauche) {
        const d = droiteA.get(n.pos);
        if (d) assert.ok(CONSONANCES.includes((d.midi - n.midi) % 12), `graine ${g} : ${d.midi}/${n.midi} dissonant ou à l'octave`);
      }
      if (niveau === 1) for (const n of p.gauche) assert.ok(['r', 'b'].includes(n.token));
      if (cfg.complementaire) {
        for (let m = 0; m < p.mesures - 1; m++) {
          const texte = (main) => p[main].filter((n) => n.mesure === m).map((n) => n.token).join(' ');
          assert.ok(mesureComplementaire(texte('droite'), texte('gauche'), p.temps), `graine ${g} mesure ${m} : pas complémentaire`);
        }
      }
    }
    assert.ok(vus.size >= Math.min(3, cfg.tonalites.length * cfg.temps.length), `variété : ${[...vus]}`);
  });
}

test('mesureComplementaire : une main tient pendant que l\'autre bouge', () => {
  assert.equal(mesureComplementaire('b b', 'n n n n', 4), true);   // temps 2, 4 : gauche seule ; 3 : les deux
  assert.equal(mesureComplementaire('n n n n', 'n n n n', 4), false);
  assert.equal(mesureComplementaire('b n', 'n n n', 3), true);
});

test('notes attendues, instants et notes à jouer', () => {
  const p = genererPieceEnsemble(1, 13);
  const notes = notesAttenduesEnsemble(p, 60);
  assert.equal(notes.length, p.droite.length + p.gauche.length);
  const g0 = notes.find((n) => n.main === 'gauche' && n.i === 0);
  assert.deepEqual([g0.tMs, g0.midi], [0, p.gauche[0].midi]);
  assert.equal(g0.dureeMs, Math.round(p.gauche[0].duree * 1000 / U));
  const inst = instantsAttendus(notes);
  assert.equal(new Set(inst.map((x) => x.pos)).size, inst.length);
  for (let k = 1; k < inst.length; k++) assert.ok(inst[k].pos > inst[k - 1].pos);
  assert.deepEqual(new Set(inst.map((x) => x.pos)), new Set(notes.map((n) => n.pos)));
  assert.deepEqual(notesAJouer(p, 60)[0], { midi: notes[0].midi, debutMs: notes[0].tMs, dureeMs: notes[0].dureeMs });
});

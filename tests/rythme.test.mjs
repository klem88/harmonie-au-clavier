import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cellule, onsets, onsetsMs, dureeMs, compter, notationSvg, evaluerFrappe, commentaireFrappe, nomValeur, tempsValeur, frappeSvg,
} from '../src/rythme.js';

test('cellule : durées et mesures', () => {
  const c = cellule('n c c n c c');
  assert.equal(c.duree, 48);
  assert.equal(c.mesures, 1);
  assert.deepEqual(c.evenements.map((e) => e.pos), [0, 12, 18, 24, 36, 42]);
  assert.equal(cellule('n. c n. c n n n n').mesures, 2);
  assert.equal(cellule('n n n', { temps: 3 }).mesures, 1);
  assert.throws(() => cellule('n n n'), /nombre entier de mesures/);
  assert.throws(() => cellule('n x'), /illisible/);
});

test('onsets : silences et liaisons ne frappent pas, swing décale le « et »', () => {
  assert.deepEqual(onsets(cellule('-c c -c c -c c -c c')), [6, 18, 30, 42]);
  assert.deepEqual(onsets(cellule('n c _c n c c')), [0, 12, 24, 36, 42]);
  assert.deepEqual(onsets(cellule('c c n n n', { swing: true })), [0, 8, 12, 24, 36]);
  assert.deepEqual(onsets(cellule('t t t t t t n n')), [0, 4, 8, 12, 16, 20, 24, 36]);
  assert.deepEqual(onsetsMs(cellule('n n n n'), 120), [0, 500, 1000, 1500]);
  assert.equal(dureeMs(cellule('n n n n'), 60), 4000);
});

test('compter', () => {
  assert.equal(compter(cellule('n n n n')), '1 2 3 4');
  assert.equal(compter(cellule('n c c n c c')), '1 2 et 3 4 et');
  assert.equal(compter(cellule('c n c n n')), '1 et (2) et 3 4');
  assert.equal(compter(cellule('-c c -c c -c c -c c')), '(1) et (2) et (3) et (4) et');
  assert.equal(compter(cellule('n. c n. c')), '1 (2) et 3 (4) et');
  assert.equal(compter(cellule('t t t n n n')), '1 tri o 2 3 4');
  assert.equal(compter(cellule('c. d n b')), '1 a 2 3 (4)');
  assert.equal(compter(cellule('n n n', { temps: 3 })), '1 2 3');
  assert.equal(compter(cellule('b n n n n n n')), '1 (2) 3 4 1 2 3 4');
});

test('valeurs', () => {
  assert.equal(nomValeur('n.'), 'noire pointée');
  assert.equal(tempsValeur('n.'), '1 temps et demi');
  assert.equal(tempsValeur('t'), '1/3 de temps');
  assert.equal(tempsValeur('r'), '4 temps');
});

test('notationSvg : têtes, hampes, ligatures, silences, triolet, compte', () => {
  const svg = notationSvg(cellule('n c c -n t t t'));
  assert.ok(svg.startsWith('<svg'));
  assert.equal((svg.match(/class="tete"/g) || []).length, 6);
  assert.ok(svg.includes('class="silence"'));
  assert.ok(svg.includes('>3<'), 'chiffre du triolet');
  assert.ok(svg.includes('stroke-width="3.2"'), 'ligature des croches');
  const avecCompte = notationSvg(cellule('c n c n n'), { compte: true });
  assert.ok(avecCompte.includes('>(2)<'));
  assert.ok(notationSvg(cellule('c c c c c c c c', { swing: true })).includes('swing'));
  assert.ok(notationSvg(cellule('n c _c n c c')).includes('class="liaison"'));
  const blanches = notationSvg(cellule('b b'));
  assert.equal((blanches.match(/class="tete vide"/g) || []).length, 2, 'blanche : tête vide (classe, pas seulement l’attribut)');
  assert.equal((notationSvg(cellule('n n n n')).match(/tete vide/g) || []).length, 0, 'noire : tête pleine');
  assert.equal((notationSvg(cellule('r')).match(/tete vide/g) || []).length, 1, 'ronde : tête vide');
  assert.equal((notationSvg(cellule('b. n', { temps: 4 })).match(/tete vide/g) || []).length, 1, 'blanche pointée : tête vide');
  assert.ok(!notationSvg({ ...cellule('n n n n'), chiffrage: false }).includes('class="chiffrage"'));
});

test('frappeSvg : une marque par attaque, manques creux, extras en croix', () => {
  const r = evaluerFrappe([0, 500, 1000], [10, 1020, 700]);
  const svg = frappeSvg(r, 1500, [10, 1020, 700]);
  assert.equal((svg.match(/class="frappe /g) || []).length, 4);
  assert.ok(svg.includes('manque') && svg.includes('extra'));
});

test('evaluerFrappe', () => {
  const attendus = [0, 500, 1000, 1500];
  let r = evaluerFrappe(attendus, [10, 520, 990, 1530]);
  assert.equal(r.juste, true);
  assert.equal(r.manques, 0);
  assert.equal(r.extras, 0);
  assert.equal(r.ecartMoyen, 18);
  assert.equal(r.ecartSigne, 13);
  assert.deepEqual(r.details.map((d) => d.ecart), [10, 20, -10, 30]);

  r = evaluerFrappe(attendus, [10, 520, 1530]);
  assert.equal(r.juste, false);
  assert.equal(r.manques, 1);
  assert.equal(r.details[2].tap, null);

  r = evaluerFrappe(attendus, [0, 500, 1000, 1500, 250, 750]);
  assert.equal(r.extras, 2);
  assert.equal(r.juste, false);

  r = evaluerFrappe(attendus, [100, 600, 1100, 1600]);
  assert.equal(r.ecartMoyen, 100);
  assert.equal(r.juste, false, 'trop d’écart');
  assert.equal(evaluerFrappe(attendus, [100, 600, 1100, 1600], { tolerance: 120 }).juste, true);

  // un tap ne sert qu'une fois : deux attaques proches ne partagent pas la même frappe
  r = evaluerFrappe([0, 100], [50]);
  assert.equal(r.manques, 1);

  assert.equal(evaluerFrappe(attendus, []).ecartMoyen, null);
  assert.match(commentaireFrappe(evaluerFrappe(attendus, [40, 540, 1040, 1540])), /en retard/);
  assert.match(commentaireFrappe(evaluerFrappe(attendus, [10, 520, 1530])), /1 attaque manquée/);
});

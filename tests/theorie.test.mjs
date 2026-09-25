import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  note, nomFr, nomLettre, classe, memeNote, enharmonique, transposer, demiTons,
  TYPES_ACCORD, notesAccord, nomAccord, gammeMajeure, gammeMineureNaturelle,
  armure, relativeMineure, relativeMajeure, quinteSup, quinteInf,
  accordDegre, chiffreRomain, DEGRES_MAJEUR,
} from '../src/theorie.js';

const fr = (notes) => notes.map(nomFr);

test('note() accepte les deux graphies', () => {
  assert.deepEqual(note('Bb'), { lettre: 'B', alt: -1 });
  assert.deepEqual(note('B♭'), { lettre: 'B', alt: -1 });
  assert.deepEqual(note('F#'), { lettre: 'F', alt: 1 });
  assert.deepEqual(note('F♯'), { lettre: 'F', alt: 1 });
  assert.deepEqual(note('C'), { lettre: 'C', alt: 0 });
  assert.deepEqual(note('Cb'), { lettre: 'C', alt: -1 });
});

test('noms français et lettres', () => {
  assert.equal(nomFr(note('Bb')), 'si♭');
  assert.equal(nomFr(note('F#')), 'fa♯');
  assert.equal(nomFr(note('E')), 'mi');
  assert.equal(nomLettre(note('Ab')), 'A♭');
  assert.equal(nomLettre(note('C#')), 'C♯');
  assert.equal(nomFr({ lettre: 'B', alt: 1 }), 'si♯');
  assert.equal(nomFr({ lettre: 'F', alt: 2 }), 'fa𝄪');
});

test('classe et enharmonie', () => {
  assert.equal(classe(note('C')), 0);
  assert.equal(classe(note('Bb')), 10);
  assert.equal(classe(note('B#')), 0);
  assert.equal(classe(note('Cb')), 11);
  assert.ok(memeNote(note('Bb'), { lettre: 'B', alt: -1 }));
  assert.ok(!memeNote(note('Bb'), note('A#')));
  assert.equal(nomFr(enharmonique(note('F#'))), 'sol♭');
  assert.equal(nomFr(enharmonique(note('Gb'))), 'fa♯');
  assert.equal(nomFr(enharmonique(note('B'))), 'do♭');
  assert.equal(nomFr(enharmonique(note('F'))), 'mi♯');
  assert.equal(enharmonique(note('D')), null);
});

test('intervalles et transposition', () => {
  assert.equal(demiTons('M3'), 4);
  assert.equal(demiTons('m7'), 10);
  assert.equal(nomFr(transposer(note('B'), 'M3')), 'ré♯');
  assert.equal(nomFr(transposer(note('Ab'), 'm7')), 'sol♭');
  assert.equal(nomFr(transposer(note('E'), 'A5')), 'si♯');
  assert.equal(nomFr(transposer(note('B'), 'd7')), 'la♭');
  assert.equal(nomFr(transposer(note('F'), 'P5')), 'do');
  assert.equal(nomFr(transposer(note('C'), 'P1')), 'do');
  assert.equal(nomFr(transposer(note('Gb'), 'd5')), 'ré♭♭'.replace('♭♭', '𝄫'));
});

test('accords : orthographe exacte', () => {
  assert.deepEqual(fr(notesAccord(note('Ab'), '7')), ['la♭', 'do', 'mi♭', 'sol♭']);
  assert.deepEqual(fr(notesAccord(note('F#'), 'm7b5')), ['fa♯', 'la', 'do', 'mi']);
  assert.deepEqual(fr(notesAccord(note('B'), 'dim7')), ['si', 'ré', 'fa', 'la♭']);
  assert.deepEqual(fr(notesAccord(note('Db'), 'maj7')), ['ré♭', 'fa', 'la♭', 'do']);
  assert.deepEqual(fr(notesAccord(note('E'), 'aug')), ['mi', 'sol♯', 'si♯']);
  assert.deepEqual(fr(notesAccord(note('Eb'), 'min')), ['mi♭', 'sol♭', 'si♭']);
  assert.deepEqual(fr(notesAccord(note('D'), 'dim')), ['ré', 'fa', 'la♭']);
  assert.deepEqual(fr(notesAccord(note('G'), 'm7')), ['sol', 'si♭', 'ré', 'fa']);
  assert.deepEqual(fr(notesAccord(note('C'), 'maj')), ['do', 'mi', 'sol']);
});

test('noms d’accords', () => {
  assert.equal(nomAccord(note('Bb'), 'maj7'), 'B♭maj7');
  assert.equal(nomAccord(note('D'), 'm7b5'), 'Dm7♭5');
  assert.equal(nomAccord(note('C'), 'dim7'), 'C°7');
  assert.equal(nomAccord(note('F#'), 'min'), 'F♯m');
  assert.equal(nomAccord(note('E'), 'aug'), 'E+');
  assert.equal(nomAccord(note('G'), '7'), 'G7');
  assert.equal(nomAccord(note('A'), 'maj'), 'A');
  assert.equal(TYPES_ACCORD.m7.libelle, 'mineur 7');
});

test('gammes', () => {
  assert.deepEqual(fr(gammeMajeure(note('Gb'))), ['sol♭', 'la♭', 'si♭', 'do♭', 'ré♭', 'mi♭', 'fa']);
  assert.deepEqual(fr(gammeMajeure(note('B'))), ['si', 'do♯', 'ré♯', 'mi', 'fa♯', 'sol♯', 'la♯']);
  assert.deepEqual(fr(gammeMineureNaturelle(note('C'))), ['do', 'ré', 'mi♭', 'fa', 'sol', 'la♭', 'si♭']);
});

test('armures majeures : les 15', () => {
  const attendu = {
    C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
    F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
  };
  for (const [t, n] of Object.entries(attendu)) {
    assert.equal(armure(note(t)).nombre, n, `armure de ${t}`);
  }
  assert.deepEqual(fr(armure(note('Gb')).alterations), ['si♭', 'mi♭', 'la♭', 'ré♭', 'sol♭', 'do♭']);
  assert.deepEqual(fr(armure(note('A')).alterations), ['fa♯', 'do♯', 'sol♯']);
  assert.deepEqual(armure(note('C')).alterations, []);
});

test('relatives et armures mineures', () => {
  assert.equal(nomFr(relativeMineure(note('Eb'))), 'do');
  assert.equal(nomFr(relativeMineure(note('C'))), 'la');
  assert.equal(nomFr(relativeMajeure(note('F#'))), 'la');
  assert.equal(armure(note('F#'), 'mineur').nombre, 3);
  assert.equal(armure(note('D'), 'mineur').nombre, -1);
});

test('cycle des quintes', () => {
  assert.equal(nomFr(quinteSup(note('Bb'))), 'fa');
  assert.equal(nomFr(quinteSup(note('B'))), 'fa♯');
  assert.equal(nomFr(quinteInf(note('C'))), 'fa');
  assert.equal(nomFr(quinteInf(note('Gb'))), 'do♭');
});

test('degrés harmonisés', () => {
  const v = accordDegre(note('Ab'), 5, { septieme: true });
  assert.equal(nomAccord(v.fond, v.type), 'E♭7');
  const ii = accordDegre(note('C'), 2, { septieme: true, mode: 'mineur' });
  assert.equal(nomAccord(ii.fond, ii.type), 'Dm7♭5');
  const iv = accordDegre(note('G'), 4);
  assert.equal(nomAccord(iv.fond, iv.type), 'C');
  const vii = accordDegre(note('C'), 7, { septieme: true });
  assert.equal(nomAccord(vii.fond, vii.type), 'Bm7♭5');
  const vii3 = accordDegre(note('C'), 7);
  assert.equal(nomAccord(vii3.fond, vii3.type), 'B°');
  const i = accordDegre(note('A'), 1, { mode: 'mineur' });
  assert.equal(nomAccord(i.fond, i.type), 'Am');
  assert.deepEqual(DEGRES_MAJEUR, ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  assert.equal(chiffreRomain(2), 'ii');
  assert.equal(chiffreRomain(5, 'majeur', true), 'V7');
  assert.equal(chiffreRomain(2, 'mineur', true), 'iiø');
  assert.equal(chiffreRomain(1, 'majeur', true), 'Imaj7');
  assert.equal(chiffreRomain(7, 'majeur', true), 'viiø');
});

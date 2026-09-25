import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midisMontants, sequenceAudio, dureeTotaleMs, creerLecteur } from '../src/audio.js';
import { note, midi, intervalleEntre, renversement, nomIntervalle } from '../src/theorie.js';

test('midi', () => {
  assert.equal(midi(note('C')), 60);
  assert.equal(midi(note('A')), 69);
  assert.equal(midi(note('Bb'), 3), 58);
  assert.equal(midi(note('B#'), 3), 60);
  assert.equal(midi(note('Cb')), 59);
});

test('intervalleEntre et renversement', () => {
  assert.equal(intervalleEntre(note('C'), note('E')), 'M3');
  assert.equal(intervalleEntre(note('C'), note('F#')), 'A4');
  assert.equal(intervalleEntre(note('C'), note('Gb')), 'd5');
  assert.equal(intervalleEntre(note('A'), note('F')), 'm6');
  assert.equal(intervalleEntre(note('E'), note('D')), 'm7');
  assert.equal(intervalleEntre(note('C'), note('C')), 'P1');
  assert.equal(intervalleEntre(note('C'), note('D#')), null);
  assert.equal(renversement('m3'), 'M6');
  assert.equal(renversement('A4'), 'd5');
  assert.equal(nomIntervalle('M6'), 'sixte majeure');
});

test('midisMontants : toujours en montant', () => {
  assert.deepEqual(midisMontants([note('C'), note('E'), note('G')]), [60, 64, 67]);
  assert.deepEqual(midisMontants([note('G'), note('C')]), [67, 72]);
  assert.deepEqual(midisMontants([note('Ab'), note('C'), note('Eb'), note('Gb')]), [68, 72, 75, 78]);
});

test('sequenceAudio', () => {
  const mel = sequenceAudio({ mode: 'melodique', notes: [note('C'), note('E')] });
  assert.deepEqual(mel.map((e) => e.midis), [[60], [64], [60, 64]]);
  const acc = sequenceAudio({ mode: 'accord', notes: [note('D'), note('F'), note('A'), note('C')] });
  assert.deepEqual(acc[0].midis, [50, 62, 65, 69, 72]);
  const cad = sequenceAudio({ mode: 'cadence', accords: [[note('D'), note('F'), note('A')], [note('G'), note('B'), note('D')]] });
  assert.equal(cad.length, 2);
  assert.equal(cad[0].midis[0], 38);
  assert.equal(dureeTotaleMs(cad), 1800);
});

test('sequenceAudio : modes midis et accordMidis', () => {
  assert.deepEqual(sequenceAudio({ mode: 'midis', midis: [48, 55], dureeMs: 500 }), [{ midis: [48], dureeMs: 500 }, { midis: [55], dureeMs: 500 }]);
  assert.deepEqual(sequenceAudio({ mode: 'accordMidis', midis: [48, 52, 55] }), [{ midis: [48, 52, 55], dureeMs: 1600 }]);
});

test('creerLecteur sans Web Audio → null', () => {
  assert.equal(creerLecteur(undefined), null);
});

test('sequencePercussions : décompte, clics accentués, notes décalées de l’origine', async () => {
  const { sequencePercussions, equiperPercussions } = await import('../src/audio.js');
  const s = sequencePercussions({ bpm: 120, temps: 4, mesures: 1, onsetsMs: [0, 250, 1000] });
  assert.equal(s.origineMs, 2000);
  assert.equal(s.dureeMs, 4000);
  const clics = s.evenements.filter((e) => e.genre !== 'note');
  assert.equal(clics.length, 8);
  assert.deepEqual(clics.filter((e) => e.genre === 'accent').map((e) => e.tMs), [0, 2000]);
  assert.deepEqual(s.evenements.filter((e) => e.genre === 'note').map((e) => e.tMs), [2000, 2250, 3000]);
  assert.equal(equiperPercussions(null), null);
  const faux = {}; equiperPercussions(faux, function Ctx() { this.currentTime = 0; this.state = 'running'; });
  assert.equal(typeof faux.jouerPercussions, 'function');
});

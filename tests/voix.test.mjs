import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detecterHauteur, midiDeFrequence, frequenceDeMidi, evaluerChant, commentaireChant, creerMicro } from '../src/voix.js';

function sinus(f, sr, n, amp = 0.3, harmoniques = [1]) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = harmoniques.reduce((s, h, k) => s + (amp / (k + 1)) * Math.sin((2 * Math.PI * f * h * i) / sr), 0);
  return b;
}

test('detecterHauteur : sinus purs et sons riches, silence rejeté', () => {
  const sr = 44100;
  for (const f of [110, 220, 261.6, 440]) {
    const d = detecterHauteur(sinus(f, sr, 2048), sr);
    assert.ok(Math.abs(d - f) / f < 0.01, `${f} Hz détecté ${d}`);
  }
  const riche = detecterHauteur(sinus(196, sr, 2048, 0.3, [1, 2, 3, 4]), sr);
  assert.ok(Math.abs(riche - 196) < 3, `son riche : ${riche}`);
  assert.equal(detecterHauteur(new Float32Array(2048), sr), null);
  assert.equal(detecterHauteur(sinus(440, sr, 2048, 0.001), sr), null, 'trop faible');
});

test('conversions', () => {
  assert.equal(Math.round(midiDeFrequence(440)), 69);
  assert.ok(Math.abs(frequenceDeMidi(60) - 261.63) < 0.1);
});

test('evaluerChant : classe de hauteur, tolérance en cents, plateau stable', () => {
  const frames = [null, null, 60.02, 59.98, 60.0, 60.01, 59.99, 60.0, 60.02, 59.98, 60.0, 60.0];
  let r = evaluerChant(frames, 60);
  assert.equal(r.juste, true);
  assert.ok(Math.abs(r.cents) <= 10);
  // octave libre : chanter do3 pour un do4 est juste
  r = evaluerChant(frames.map((m) => (m === null ? null : m - 12)), 60);
  assert.equal(r.juste, true);
  // un demi-ton trop haut : faux, +100 cents
  r = evaluerChant(frames.map((m) => (m === null ? null : m + 1)), 60);
  assert.equal(r.juste, false);
  assert.equal(r.cents, 100);
  // les frames aberrantes (attaque, bruit) sont écartées
  r = evaluerChant([...frames, 72.5, 48.2], 60);
  assert.equal(r.juste, true);
  // trop peu de voix
  r = evaluerChant([null, null, 60, 60], 60);
  assert.equal(r.juste, false);
  assert.equal(r.cents, null);
  assert.match(commentaireChant(r, 'do', null), /pas entendu/);
  assert.match(commentaireChant(evaluerChant(frames, 60), 'do', 'do'), /propre|tolérance/);
  assert.match(commentaireChant(evaluerChant(frames.map((m) => (m === null ? null : m + 1)), 60), 'do', 'do♯'), /trop haut/);
});

test('creerMicro sans getUserMedia → null', () => {
  assert.equal(creerMicro({ getUserMedia: undefined, Contexte: undefined }), null);
});

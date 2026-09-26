import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatsPiece, amplitudesDeDb, harmoniquesLibres, trameEnsemble, verifierEnsemble, proposer, HARMONIQUES } from '../src/verification.js';
import { genererPieceEnsemble, notesAttenduesEnsemble } from '../src/ensemble.js';
import { synthetiser, tramesDe, amplitudes, SR, FFT } from './son-synthetique.mjs';

const LARGEUR = SR / FFT;
const BPM = 60;
const PIECE = genererPieceEnsemble(1, 13); // droite 67,65,64,62,64,64,64,62,60,62,60,64,60 · gauche 48,48,53,53,48
const CANDIDATS = candidatsPiece(PIECE);

// Joue la pièce (retard constant de 150 ms) ; `modif` change ou retire (null) une note attendue.
function ecouter(piece, modif = (n) => n, { pauseApres = null } = {}) {
  const evs = [];
  for (const n of notesAttenduesEnsemble(piece, BPM)) {
    const m = modif(n);
    if (!m) continue;
    const pause = pauseApres !== null && n.tMs > pauseApres ? 2000 : 0;
    evs.push({ tMs: m.tMs + 650 + pause, midi: m.midi, dureeMs: m.dureeMs });
  }
  const trames = tramesDe(synthetiser(evs, 16000 + 3500), CANDIDATS).map((x) => ({ ...x, tMs: x.tMs - 500 }));
  return verifierEnsemble(piece, trames, { bpm: BPM, candidats: CANDIDATS, largeurHz: LARGEUR });
}
const etats = (l) => l.map((x) => x.etat).join(' ');

test('candidats : notes de la pièce et demi-tons voisins, triés', () => {
  assert.deepEqual(candidatsPiece({ droite: [{ midi: 60 }, { midi: 64 }], gauche: [{ midi: 48 }] }), [47, 48, 49, 59, 60, 61, 63, 64, 65]);
});

test('amplitudesDeDb : dB vers amplitude linéaire, -Infinity vers 0', () => {
  assert.deepEqual([...amplitudesDeDb(new Float32Array([0, -20, -Infinity]))].map((x) => Math.round(x * 1000) / 1000), [1, 0.1, 0]);
});

test('harmoniques utiles : assez aigus pour séparer le demi-ton, sans ceux d\'une note attaquée en même temps', () => {
  assert.deepEqual(harmoniquesLibres(72, [], LARGEUR), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(harmoniquesLibres(48, [], LARGEUR), [4, 5, 6]);      // do3 : les trois premiers sont trop proches du voisin
  assert.deepEqual(harmoniquesLibres(48, [67], LARGEUR), [4, 5]);       // sol4 = 3e harmonique de do3 : 6 (sol5) est pris
  assert.deepEqual(harmoniquesLibres(64, [48], LARGEUR), [3, 4, 5, 6]); // mi5 = 5e harmonique de do3 : 2 est pris
});

test('trameEnsemble : énergie des 1024 derniers échantillons, harmoniques de chaque candidat', () => {
  const sig = synthetiser([{ tMs: 0, midi: 60, dureeMs: 1000 }], 200);
  const bloc = sig.slice(sig.length - FFT);
  const t = trameEnsemble(bloc, amplitudes(bloc), { sampleRate: SR, fftSize: FFT }, [59, 60, 61], 42);
  assert.equal(t.tMs, 42);
  assert.ok(t.rms > 0.01);
  assert.equal(t.h.length, 3 * HARMONIQUES);
  const moy = (c) => t.h.slice(c * HARMONIQUES + 1, (c + 1) * HARMONIQUES).reduce((s, x) => s + x, 0);
  assert.ok(moy(1) > 3 * moy(0) && moy(1) > 3 * moy(2), 'do4 ressort au-dessus de si3 et do♯4');
});

test('pièce jouée juste, avec un retard constant : tout est juste, réussite proposée', () => {
  const r = ecouter(PIECE);
  assert.equal(etats(r.notes.droite), Array(PIECE.droite.length).fill('juste').join(' '));
  assert.equal(etats(r.notes.gauche), Array(PIECE.gauche.length).fill('juste').join(' '));
  assert.ok(Math.abs(r.latenceMs - 150) <= 20, `latence ${r.latenceMs}`);
  assert.deepEqual([r.justes, r.total, r.douteuses, r.arrets.length, r.compte, r.propose], [18, 18, 0, 0, true, 'reussi']);
});

test('fausse note à la main gauche (un demi-ton au-dessus) : fausse', () => {
  const r = ecouter(PIECE, (n) => (n.main === 'gauche' && n.i === 1 ? { ...n, midi: n.midi + 1 } : n));
  assert.equal(r.notes.gauche[1].etat, 'fausse');
  assert.equal(r.notes.gauche[0].etat, 'juste');
  assert.equal(r.fausses, 1);
});

test('note oubliée à la main droite : manquée', () => {
  const r = ecouter(PIECE, (n) => (n.main === 'droite' && n.i === 3 ? null : n));
  assert.equal(r.notes.droite[3].etat, 'manquee');
  assert.equal(r.manquees, 1);
});

test('arrêt de deux secondes au milieu : arrêt signalé, pas de réussite proposée', () => {
  const r = ecouter(PIECE, undefined, { pauseApres: 7000 });
  assert.ok(r.arrets.length >= 1, `arrêts ${r.arrets}`);
  assert.equal(r.propose, 'pasEncore');
});

test('silence : rien entendu, la pièce ne compte pas', () => {
  const trames = tramesDe(new Float32Array(SR * 2), CANDIDATS);
  const r = verifierEnsemble(PIECE, trames, { bpm: BPM, candidats: CANDIDATS, largeurHz: LARGEUR });
  assert.equal(r.rienEntendu, true);
  assert.equal(r.compte, false);
});

test('verdict proposé : douteuses retirées du calcul, aucune proposition au-delà de 30 % de douteuses', () => {
  const base = { justes: 17, decalees: 0, douteuses: 0, total: 20, arrets: [] };
  assert.equal(proposer(base), 'reussi');                                   // 17/20 = 85 %
  assert.equal(proposer({ ...base, justes: 16 }), 'pasEncore');             // 80 %
  assert.equal(proposer({ ...base, justes: 14, douteuses: 3 }), 'pasEncore'); // 14/17 jugées = 82 %
  assert.equal(proposer({ ...base, justes: 15, douteuses: 3 }), 'reussi');  // 15/17 = 88 %
  assert.equal(proposer({ ...base, arrets: [3] }), 'pasEncore');
  assert.equal(proposer({ ...base, decalees: 5 }), 'pasEncore');            // 25 % décalées
  assert.equal(proposer({ ...base, douteuses: 7 }), null);                  // 35 % douteuses
  assert.equal(proposer({ ...base, total: 0 }), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trameDe, detecterAttaques, aligner, creerEcoute, REGLES_ECOUTE } from '../src/ecoute.js';

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// Trames simulées toutes les 15 ms. Un son de piano monte d'un coup puis décroît ; une note liée
// (legato: true) change de hauteur sans nouveau saut d'énergie. Pas de hauteur mesurable pendant 20 ms après l'attaque.
function simuler(notes, { finMs = notes.at(-1).tMs + 1200, pas = 15 } = {}) {
  const trames = [];
  for (let t = 0; t <= finMs; t += pas) {
    const avant = notes.filter((n) => n.tMs <= t);
    if (!avant.length) { trames.push({ tMs: t, rms: 0.002, f0: null }); continue; }
    const n = avant.at(-1);
    const frappe = [...avant].reverse().find((x) => !x.legato);
    const rms = 0.2 * Math.exp(-(t - frappe.tMs) / 700);
    trames.push({ tMs: t, rms, f0: rms >= 0.01 && t - n.tMs >= 20 ? hz(n.midi) : null });
  }
  return trames;
}
const proche = (a, b, tol) => Math.abs(a - b) <= tol;

test('trameDe : energie et hauteur de sons de piano simules, silence', () => {
  const sr = 48000; const n = 2048;
  for (const m of [60, 67, 72, 79]) {
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = [1, 0.5, 0.3, 0.2].reduce((s, a, k) => s + 0.1 * a * Math.sin((2 * Math.PI * hz(m) * (k + 1) * i) / sr), 0);
    const t = trameDe(buf, sr, 123);
    assert.equal(t.tMs, 123);
    assert.ok(t.rms > 0.05);
    assert.ok(Math.abs(t.f0 - hz(m)) / hz(m) < 0.01, `midi ${m} : f0 ${t.f0}`);
  }
  const muet = trameDe(new Float32Array(n), sr, 0);
  assert.equal(muet.rms, 0);
  assert.equal(muet.f0, null);
});

test('trameDe : tampon de 1024 echantillons a 48 kHz (fftSize allege)', () => {
  const sr = 48000; const n = 1024; const m = 60;
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = [1, 0.5, 0.3, 0.2].reduce((s, a, k) => s + 0.1 * a * Math.sin((2 * Math.PI * hz(m) * (k + 1) * i) / sr), 0);
  const t = trameDe(buf, sr, 0);
  assert.ok(Math.abs(t.f0 - hz(m)) / hz(m) < 0.01, `midi ${m} : f0 ${t.f0}`);
});

test('trameDe : main gauche, notes graves jusqu a do3 avec la plage abaissee', () => {
  const sr = 48000; const n = 1024;
  for (const m of [48, 50, 53, 55]) {
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = [1, 0.5, 0.3, 0.2].reduce((s, a, k) => s + 0.1 * a * Math.sin((2 * Math.PI * hz(m) * (k + 1) * i) / sr), 0);
    const t = trameDe(buf, sr, 0, { fMin: REGLES_ECOUTE.fMin.gauche });
    assert.ok(Math.abs(t.f0 - hz(m)) / hz(m) < 0.01, `midi ${m} : f0 ${t.f0}`);
  }
  assert.equal(REGLES_ECOUTE.fMin.droite, 180, 'main droite inchangée');
});

test('notes graves simulees (main gauche) : une attaque par note, a la bonne hauteur', () => {
  const notes = [300, 800, 1300, 1800].map((tMs, i) => ({ tMs, midi: [48, 50, 52, 53][i] }));
  assert.deepEqual(detecterAttaques(simuler(notes)).map((x) => x.midi), [48, 50, 52, 53]);
});

test('notes detachees : une attaque par note, a la bonne hauteur', () => {
  const notes = [300, 800, 1300, 1800].map((tMs, i) => ({ tMs, midi: [60, 62, 64, 65][i] }));
  const a = detecterAttaques(simuler(notes));
  assert.deepEqual(a.map((x) => x.midi), [60, 62, 64, 65]);
  a.forEach((x, i) => assert.ok(proche(x.tMs, notes[i].tMs, 15), `${x.tMs} au lieu de ${notes[i].tMs}`));
});

test('notes repetees : chaque frappe compte', () => {
  const a = detecterAttaques(simuler([300, 700, 1100, 1500].map((tMs) => ({ tMs, midi: 67 }))));
  assert.equal(a.length, 4);
  assert.ok(a.every((x) => x.midi === 67));
});

test('legato : un changement de hauteur sans saut d energie est une attaque', () => {
  const a = detecterAttaques(simuler([{ tMs: 300, midi: 60 }, { tMs: 800, midi: 62, legato: true }]));
  assert.deepEqual(a.map((x) => x.midi), [60, 62]);
  assert.ok(proche(a[1].tMs, 800, 30));
});

// Trames réelles (fa♯4 joué doucement) : le détecteur alterne fa♯4 et fa♯3 (sous-harmonique).
// La médiane de {54, 66} donnait 60 (do) : une note juste comptée fausse.
test('erreur d octave vers le bas : la note garde sa vraie hauteur', () => {
  const brut = [[2694, 12, 640], [2712, 11, 641], [2724, 11, 641], [2739, 15, 638], [2754, 22, null], [2769, 27, null],
    [2784, 25, null], [2799, 23, null], [2814, 20, null], [2830, 15, null], [2846, 14, null], [2859, 11, 542],
    [2874, 10, 661], [2890, 9, null], [2904, 9, null], [2919, 8, null], [2934, 7, null], [2949, 7, null], [2965, 6, null]];
  const trames = brut.map(([tMs, r, h]) => ({ tMs, rms: r / 1000, f0: h === null ? null : hz(h / 10) }));
  const a = detecterAttaques(trames);
  assert.deepEqual(a.map((x) => [x.tMs, x.midi]), [[2754, 66]]);
  const alterne = simuler([{ tMs: 300, midi: 66 }]).map((t, k) => (t.f0 && k % 2 ? { ...t, f0: hz(54) } : t));
  assert.deepEqual(detecterAttaques(alterne).map((x) => x.midi), [66]);
});

// Trames réelles : mi4 frappé pendant que ré4 sonne encore. Pas de saut d'énergie assez net ; la hauteur
// ne se stabilise qu'à 8424 ms, alors que le ré s'arrête (attaque réelle) dès 8320 ms.
test('legato reel : l attaque date de la fin de l ancienne hauteur, pas de la stabilisation', () => {
  const brut = [[8154, 27, 621], [8170, 26, 621], [8184, 25, 621], [8201, 24, 621], [8214, 24, 621], [8231, 23, 621],
    [8244, 22, 621], [8261, 21, 621], [8274, 21, 620], [8289, 19, 620], [8304, 21, 620], [8320, 26, null], [8336, 25, null],
    [8349, 23, null], [8366, 25, null], [8379, 29, null], [8395, 28, null], [8410, 23, null], [8424, 22, 640], [8439, 20, 641],
    [8454, 19, 641], [8469, 19, 641], [8484, 18, 640], [8499, 16, 641], [8514, 16, 640], [8531, 15, 640], [8545, 14, 641],
    [8559, 14, 640], [8574, 13, 641], [8589, 12, 641], [8604, 12, 640], [8620, 11, 640]];
  const trames = brut.map(([tMs, r, h]) => ({ tMs, rms: r / 1000, f0: h === null ? null : hz(h / 10) }));
  const a = detecterAttaques(trames);
  assert.deepEqual(a.map((x) => [x.tMs, x.midi]), [[8320, 64]]);
});

test('bruits sans hauteur et souffle faible : rien', () => {
  const trames = simuler([{ tMs: 0, midi: 60 }], { finMs: 2000 }).map((t) => ({ tMs: t.tMs, rms: 0.002, f0: null }));
  trames[60] = { tMs: trames[60].tMs, rms: 0.3, f0: null }; // clic : fort mais sans hauteur
  trames[61] = { tMs: trames[61].tMs, rms: 0.3, f0: null };
  assert.deepEqual(detecterAttaques(trames), []);
  const souffle = trames.map((t) => ({ ...t, rms: 0.006, f0: hz(60) }));
  assert.deepEqual(detecterAttaques(souffle), []);
});

test('creerEcoute hors navigateur : null', () => {
  assert.equal(creerEcoute({ getUserMedia: undefined, Contexte: undefined }), null);
});

test('creerEcoute().ouvrir() : deux appels concurrents ne créent qu\'un seul contexte', async () => {
  let nbContextes = 0;
  let nbAppelsGetUserMedia = 0;
  let resoudreFlux;
  const getUserMedia = () => {
    nbAppelsGetUserMedia += 1;
    return new Promise((r) => { resoudreFlux = r; });
  };
  class FauxContexte {
    constructor() { nbContextes += 1; this.state = 'running'; }
    createAnalyser() { return { fftSize: 0 }; }
    createMediaStreamSource() { return { connect() {} }; }
    close() { return Promise.resolve(); }
  }
  const ecoute = creerEcoute({ getUserMedia, Contexte: FauxContexte });
  const p1 = ecoute.ouvrir();
  const p2 = ecoute.ouvrir();
  resoudreFlux({ getTracks: () => [] });
  await Promise.all([p1, p2]);
  assert.equal(nbAppelsGetUserMedia, 1);
  assert.equal(nbContextes, 1);
  assert.equal(ecoute.estOuvert(), true);
});

const MELODIE = [60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 64, 62];
const ATT = MELODIE.map((midi, i) => ({ midi, tMs: i * 1000, mesure: Math.floor(i / 4) })); // 60 à la noire, 3 mesures
const jouer = (decal = 150) => ATT.map((a) => ({ midi: a.midi, tMs: a.tMs + decal }));
const etats = (r) => r.notes.map((n) => n.etat);

test('aligner : jeu parfait avec le retard du micro', () => {
  const r = aligner(ATT, jouer(150), { bpm: 60 });
  assert.deepEqual(etats(r), ATT.map(() => 'juste'));
  assert.equal(r.latenceMs, 150);
  assert.equal(r.ecartMedianMs, 0);
  assert.deepEqual(r.arrets, []);
  assert.equal(r.justes, 12); assert.equal(r.total, 12);
  assert.equal(r.reussi, true); assert.equal(r.compte, true);
});

test('aligner : note manquée', () => {
  const j = jouer(); j.splice(3, 1);
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.notes[3].etat, 'manquee');
  assert.equal(r.notes[3].jouee, null);
  assert.equal(r.justes, 11);
  assert.equal(r.reussi, true, '11/12 ≥ 85 %');
});

test('aligner : note en trop, placée sur la partition', () => {
  const j = jouer(); j.splice(3, 0, { midi: 71, tMs: 2650 });
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.enTrop.length, 1);
  assert.equal(r.enTrop[0].midi, 71);
  assert.equal(r.enTrop[0].pos, 30);
  assert.equal(r.justes, 12);
});

test('aligner : fausse note', () => {
  const j = jouer(); j[2].midi = 65;
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.notes[2].etat, 'fausse');
  assert.equal(r.notes[2].jouee, 65);
  assert.equal(r.justes, 11);
});

test('aligner : note décalée, toujours juste de hauteur', () => {
  const j = jouer(); j[5].tMs += 250;
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.notes[5].etat, 'decale');
  assert.equal(r.notes[5].ecartMs, 250);
  assert.equal(r.justes, 12);
  assert.deepEqual(r.arrets, []);
  assert.equal(r.decalees, 1);
  assert.equal(r.reussi, true, '1 décalée sur 12 reste réussi');
});

test('aligner : tempo faux mais régulier (trop vite) — pas réussi', () => {
  const j = ATT.map((a) => ({ midi: a.midi, tMs: Math.round(a.tMs * 0.8 + 150) }));
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.reussi, false);
  assert.deepEqual(r.arrets, []);
  assert.equal(r.justes, 12);
});

test('aligner : tempo faux mais régulier (trop lent) — pas réussi', () => {
  const j = ATT.map((a) => ({ midi: a.midi, tMs: Math.round(a.tMs * 1.2 + 150) }));
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.reussi, false);
});

test('aligner : notes du décompte (tMs négatif) ignorées', () => {
  const j = [{ midi: 60, tMs: -2000 }, ...jouer()];
  const r = aligner(ATT, j, { bpm: 60 });
  assert.deepEqual(r.enTrop, []);
  assert.equal(r.justes, 12);
});

test('aligner : départ hésitant, la suite reste juste', () => {
  const j = jouer(); j[0].tMs += 350; j[1].tMs += 350;
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.latenceMs, 150);
  assert.deepEqual(etats(r).slice(2), ATT.slice(2).map(() => 'juste'));
  assert.equal(r.notes[0].etat, 'decale');
  assert.deepEqual(r.arrets, []);
});

test('aligner : arrêt au milieu, la suite reste juste', () => {
  const j = jouer(); for (let i = 6; i < j.length; i++) j[i].tMs += 2000;
  const r = aligner(ATT, j, { bpm: 60 });
  assert.deepEqual(r.arrets, [2]);
  assert.deepEqual(etats(r), ATT.map(() => 'juste'));
  assert.equal(r.reussi, false);
});

test('aligner : rien entendu, sons parasites', () => {
  const vide = aligner(ATT, [], { bpm: 60 });
  assert.equal(vide.rienEntendu, true); assert.equal(vide.compte, false); assert.equal(vide.reussi, false);
  assert.deepEqual(etats(vide), ATT.map(() => 'manquee'));
  assert.equal(vide.ecartMedianMs, null);
  const bruit = [...jouer(), ...Array.from({ length: 8 }, (_, i) => ({ midi: 90, tMs: 300 + i * 1300 }))].sort((a, b) => a.tMs - b.tMs);
  const r = aligner(ATT, bruit, { bpm: 60 });
  assert.equal(r.parasites, true); assert.equal(r.compte, false); assert.equal(r.reussi, false);
});

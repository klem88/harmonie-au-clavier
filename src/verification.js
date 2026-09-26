// Écoute mains ensemble : pas de transcription libre, on vérifie que les notes attendues sonnent.
// Chaque trame garde l'amplitude des harmoniques 1 à 6 de chaque note candidate ; une note est jugée sur la
// montée de ses harmoniques après son instant, sans ceux qu'elle partage avec une note attaquée en même temps.
// Pur, sans DOM : le spectre vient du navigateur (getFloatFrequencyData), ou d'une FFT dans les tests.

import { detecterAttaques, aligner, REGLES_ECOUTE } from './ecoute.js';
import { notesAttenduesEnsemble, instantsAttendus } from './ensemble.js';

export const HARMONIQUES = 6;
const QUART_DE_TON = 2 ** (1 / 24);
const hzDeMidi = (m) => 440 * 2 ** ((m - 69) / 12);

// Notes de la pièce et leurs demi-tons voisins, triées.
export function candidatsPiece(piece) {
  const s = new Set();
  for (const n of [...piece.droite, ...piece.gauche]) for (const d of [-1, 0, 1]) s.add(n.midi + d);
  return [...s].sort((a, b) => a - b);
}

// Trame : énergie (sur les 1024 derniers échantillons, pour garder des attaques nettes) et, pour chaque
// candidat, l'amplitude maximale à ± un quart de ton de chacun de ses harmoniques.
// amplitudes : spectre linéaire, fftSize / 2 cases.
export function trameEnsemble(bufTemps, amplitudes, { sampleRate, fftSize }, candidats, tMs) {
  let e = 0; const n0 = Math.max(0, bufTemps.length - 1024);
  for (let i = n0; i < bufTemps.length; i++) e += bufTemps[i] * bufTemps[i];
  const largeur = sampleRate / fftSize;
  const h = new Float32Array(candidats.length * HARMONIQUES);
  candidats.forEach((m, c) => {
    for (let k = 1; k <= HARMONIQUES; k++) {
      const f = k * hzDeMidi(m);
      // interpolation linéaire entre les deux cases qui encadrent la fréquence exacte
      const x = f / largeur; const i = Math.floor(x);
      h[c * HARMONIQUES + k - 1] = i + 1 < amplitudes.length ? amplitudes[i] * (1 - (x - i)) + amplitudes[i + 1] * (x - i) : 0;
    }
  });
  return { tMs, rms: Math.sqrt(e / (bufTemps.length - n0)), h };
}

export function amplitudesDeDb(db) {
  const a = new Float32Array(db.length);
  for (let i = 0; i < db.length; i++) a[i] = Number.isFinite(db[i]) ? 10 ** (db[i] / 20) : 0;
  return a;
}

// Harmoniques utiles de `m` : assez aigus pour que le demi-ton voisin soit à deux cases du spectre au moins
// (largeurHz = sampleRate / fftSize), et qui ne tombent (à un quart de ton près) sur aucun harmonique 1 à 8
// d'une autre note attaquée au même instant.
export function harmoniquesLibres(m, autres, largeurHz) {
  const libres = [];
  for (let k = 1; k <= HARMONIQUES; k++) {
    const f = k * hzDeMidi(m);
    if (f * (2 ** (1 / 12) - 1) < 2 * largeurHz) continue;
    const pris = autres.some((y) => { for (let j = 1; j <= 8; j++) { const r = f / (j * hzDeMidi(y)); if (r < QUART_DE_TON && r > 1 / QUART_DE_TON) return true; } return false; });
    if (!pris) libres.push(k);
  }
  return libres;
}

const medianeVerif = (t) => { if (!t.length) return 0; const s = [...t].sort((a, b) => a - b); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

// Verdict proposé à l'élève : 'reussi', 'pasEncore', ou null quand trop de notes sont douteuses (à lui de juger).
// Les douteuses sont retirées du calcul.
export function proposer({ justes, decalees, douteuses, total, arrets }, regles = REGLES_ECOUTE) {
  if (total === 0 || douteuses / total > regles.ensemble.douteusesMax) return null;
  const jugees = total - douteuses;
  return jugees > 0 && justes / jugees >= regles.tauxReussite && arrets.length === 0 && decalees / jugees <= regles.decaleesMax ? 'reussi' : 'pasEncore';
}

export function verifierEnsemble(piece, trames, { bpm, candidats, largeurHz = 48000 / 4096, regles = REGLES_ECOUTE }) {
  const R = regles.ensemble;
  const notes = notesAttenduesEnsemble(piece, bpm);
  const instants = instantsAttendus(notes);
  const attaques = detecterAttaques(trames, regles, { hauteur: false });
  const al = aligner(instants, attaques, { bpm, regles });
  // Instant réel de chaque position : l'attaque appariée, sinon l'instant attendu + le décalage courant.
  let decalage = al.latenceMs;
  const tReel = new Map();
  instants.forEach((x, k) => {
    const n = al.notes[k];
    if (n.tJoueMs !== null) decalage = n.tJoueMs - x.tMs;
    tReel.set(x.pos, { t: n.tJoueMs ?? x.tMs + decalage, etat: n.etat, ecartMs: n.ecartMs, apparie: n.tJoueMs !== null });
  });
  let maxGlobal = 0;
  for (const tr of trames) for (const v of tr.h) if (v > maxGlobal) maxGlobal = v;
  const plancher = R.plancherRelatif * maxGlobal || 1e-9;
  const indice = new Map(candidats.map((m, c) => [m, c]));
  const moyenne = (tr, c, libres) => libres.reduce((s, k) => s + tr.h[c * HARMONIQUES + k - 1], 0) / libres.length;
  const mesurer = (m, t, dureeMs, libres) => {
    const c = indice.get(m);
    if (c === undefined || libres.length < R.harmoniquesMin) return null;
    const avant = medianeVerif(trames.filter((x) => x.tMs >= t - 120 && x.tMs <= t - 20).map((x) => moyenne(x, c, libres)));
    const apresT = trames.filter((x) => x.tMs >= t + 40 && x.tMs <= t + Math.min(250, dureeMs)).map((x) => moyenne(x, c, libres));
    const apres = apresT.length ? Math.max(...apresT) : 0;
    return { avant, apres, montee: apres / Math.max(avant, plancher) };
  };
  const resultat = { droite: [], gauche: [] };
  for (const n of notes) {
    const inst = tReel.get(n.pos);
    // Notes attaquées au même instant : leurs harmoniques montent en même temps. Les notes tenues, elles,
    // ne montent pas et sont neutralisées par la comparaison avant / après.
    const autres = notes.filter((y) => y !== n && y.pos === n.pos).map((y) => y.midi);
    const moi = mesurer(n.midi, inst.t, n.dureeMs, harmoniquesLibres(n.midi, autres, largeurHz));
    const voisins = [n.midi - 1, n.midi + 1].map((v) => mesurer(v, inst.t, n.dureeMs, harmoniquesLibres(v, [...autres, n.midi], largeurHz))).filter(Boolean);
    let etat;
    if (!moi) etat = 'douteuse';
    else if (moi.montee >= R.montee && voisins.every((v) => moi.apres >= R.domine * v.apres)) etat = inst.etat === 'decale' ? 'decale' : 'juste';
    else if (voisins.some((v) => v.montee >= R.montee && v.apres >= R.domine * moi.apres)) etat = 'fausse';
    else if (moi.montee < R.monteeManquee && voisins.every((v) => v.montee < R.montee)) etat = 'manquee';
    else etat = 'douteuse';
    resultat[n.main][n.i] = { etat, ecartMs: inst.ecartMs, montee: moi ? Math.round(moi.montee * 10) / 10 : null, voisins: voisins.map((v) => Math.round(v.montee * 10) / 10) };
  }
  const toutes = [...resultat.droite, ...resultat.gauche];
  const nb = (e) => toutes.filter((x) => x.etat === e).length;
  const total = toutes.length;
  const decalees = nb('decale');
  const justes = nb('juste') + decalees;
  const douteuses = nb('douteuse');
  const propose = proposer({ justes, decalees, douteuses, total, arrets: al.arrets }, regles);
  return {
    notes: resultat, justes, decalees, fausses: nb('fausse'), manquees: nb('manquee'), douteuses, total,
    latenceMs: al.latenceMs, ecartMedianMs: al.ecartMedianMs, arrets: al.arrets,
    compte: al.compte, rienEntendu: al.rienEntendu, parasites: al.parasites, propose,
  };
}

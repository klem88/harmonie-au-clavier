// Déchiffrage : une courte pièce inédite pour la main droite (clé de sol), tirée d'une graine.
// Pur, sans DOM : même niveau + même graine = même pièce.

import { note, gammeMajeure, armure, midi } from './theorie.js';
import { cellule, U } from './rythme.js';

const LETTRES_PIECE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const MESURES_PIECE = 4;

// rythmes : une cellule par mesure ; finales : dernière mesure, qui finit sur une valeur longue.
// sautMax en degrés de la gamme (2 = tierce, 3 = quarte, 4 = quinte).
export const NIVEAUX_PIECE = {
  1: {
    tonalites: ['C'], temps: [4], sautMax: 2, changement: false,
    rythmes: { 4: ['n n n n', 'b n n', 'n n b', 'n b n', 'b b'] },
    finales: { 4: ['n n b', 'b b'] },
  },
  2: {
    tonalites: ['C', 'G', 'F', 'D'], temps: [4], sautMax: 3, changement: false,
    rythmes: { 4: ['n n n n', 'b n n', 'n n b', 'n b n', 'c c n n n', 'n c c n n', 'n n c c n', 'c c c c n n', 'c c n c c n'] },
    finales: { 4: ['n n b', 'b b', 'c c n b'] },
  },
  3: {
    tonalites: ['C', 'G', 'F', 'D'], temps: [3, 4], sautMax: 4, changement: true,
    rythmes: {
      4: ['n n n n', 'b n n', 'n c c n n', 'c c c c n n', 'n. c n n', 'n. c b', 'n n n. c', 'c c n c c n'],
      3: ['n n n', 'b n', 'n b', 'n. c n', 'c c n n', 'n c c n'],
    },
    finales: { 4: ['n n b', 'b b', 'r', 'n. c b'], 3: ['b.', 'n b'] },
  },
};

// Pseudo-aléatoire reproductible (mulberry32).
export function generateurAlea(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const choisirDans = (r, tab) => tab[Math.floor(r() * tab.length)];

// [pas en degrés, poids] : surtout des degrés conjoints, quelques sauts.
const PAS_MELODIE = [[1, 6], [-1, 6], [0, 1], [2, 3], [-2, 3], [3, 1], [-3, 1], [4, 1], [-4, 1]];
function tirerPas(r, sautMax) {
  const possibles = PAS_MELODIE.filter(([p]) => Math.abs(p) <= sautMax);
  let x = r() * possibles.reduce((s, [, w]) => s + w, 0);
  for (const [p, w] of possibles) { x -= w; if (x < 0) return p; }
  return possibles[0][0];
}

// Sauts bornés, pas de triton, jamais deux sauts (tierce ou plus) de suite dans le même sens.
export function melodieValide(degres, midis, sautMax) {
  for (let i = 1; i < degres.length; i++) {
    const d = degres[i] - degres[i - 1];
    if (Math.abs(d) > sautMax || Math.abs(midis[i] - midis[i - 1]) === 6) return false;
    if (i >= 2) {
      const avant = degres[i - 1] - degres[i - 2];
      if (Math.abs(d) >= 2 && Math.abs(avant) >= 2 && Math.sign(d) === Math.sign(avant)) return false;
    }
  }
  return true;
}

// Degré 0 = tonique à l'octave 4 ; 7 = tonique à l'octave au-dessus.
function noteDuDegre(tonique, gamme, d) {
  const rang = LETTRES_PIECE.indexOf(tonique.lettre) + d;
  const n = gamme[((d % 7) + 7) % 7];
  const octave = 4 + Math.floor(rang / 7);
  return { note: n, octave, midi: midi(n, octave) };
}

export function genererPiece(niveau, graine) {
  const cfg = NIVEAUX_PIECE[niveau];
  if (!cfg) throw new Error(`Niveau de déchiffrage inconnu : ${niveau}`);
  const r = generateurAlea(graine);
  const tonalite = choisirDans(r, cfg.tonalites);
  const temps = choisirDans(r, cfg.temps);
  const tonique = note(tonalite);
  const gamme = gammeMajeure(tonique);
  const evenements = [];
  for (let m = 0; m < MESURES_PIECE; m++) {
    const texte = choisirDans(r, m === MESURES_PIECE - 1 ? cfg.finales[temps] : cfg.rythmes[temps]);
    for (const e of cellule(texte, { temps }).evenements) evenements.push({ pos: m * temps * U + e.pos, duree: e.d, token: e.token, mesure: m });
  }
  // J3 : la main monte d'une quarte ou d'une quinte au début de la mesure 3 et finit sur la tonique à l'octave.
  const iChangement = cfg.changement ? evenements.findIndex((e) => e.mesure === 2) : -1;
  const decalage = cfg.changement ? choisirDans(r, [3, 4]) : 0;
  const n = evenements.length;
  for (let essai = 0; essai < 500; essai++) {
    const degres = [choisirDans(r, [0, 2, 4])];
    for (let i = 1; i < n && degres.length === i; i++) {
      const base = iChangement >= 0 && i >= iChangement ? decalage : 0;
      if (i === n - 1) { degres.push(base ? 7 : 0); break; }
      for (let k = 0; k < 30; k++) {
        const x = degres[i - 1] + tirerPas(r, cfg.sautMax);
        if (x >= base && x <= base + 4) { degres.push(x); break; }
      }
    }
    if (degres.length !== n) continue;
    const notes = degres.map((d, i) => ({ ...noteDuDegre(tonique, gamme, d), ...evenements[i], degre: d }));
    if (melodieValide(degres, notes.map((x) => x.midi), cfg.sautMax)) {
      return { niveau, graine, tonalite, tonique, armure: armure(tonique).nombre, temps, mesures: MESURES_PIECE, notes };
    }
  }
  throw new Error(`Pièce impossible à générer (niveau ${niveau}, graine ${graine})`);
}

export function notesAttendues(piece, bpm) {
  const parUnite = 60000 / bpm / U;
  return piece.notes.map((n) => ({ midi: n.midi, tMs: Math.round(n.pos * parUnite), mesure: n.mesure }));
}
export function dureePieceMs(piece, bpm) { return Math.round((piece.mesures * piece.temps * 60000) / bpm); }
export function sequencePiece(piece, bpm) {
  return piece.notes.map((n) => ({ midis: [n.midi], dureeMs: Math.round((n.duree * 60000) / bpm / U) }));
}

// Moteur musical : notes orthographiées (lettre + altération), intervalles,
// accords, gammes, armures, cycle des quintes, degrés. Aucune dépendance, aucun DOM.

const LETTRES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const CLASSES = [0, 2, 4, 5, 7, 9, 11];
const NOMS_FR = { C: 'do', D: 'ré', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si' };
const SYMBOLES = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };

// intervalle → [pas de lettre, demi-tons]
const INTERVALLES = {
  P1: [0, 0], m2: [1, 1], M2: [1, 2], m3: [2, 3], M3: [2, 4], P4: [3, 5], A4: [3, 6],
  d5: [4, 6], P5: [4, 7], A5: [4, 8], m6: [5, 8], M6: [5, 9], d7: [6, 9], m7: [6, 10],
  M7: [6, 11], P8: [7, 12],
};

export function note(texte) {
  const m = /^([A-Ga-g])([#♯b♭]*)$/.exec(texte.trim());
  if (!m) throw new Error(`Note illisible : ${texte}`);
  let alt = 0;
  for (const c of m[2]) alt += (c === '#' || c === '♯') ? 1 : -1;
  return { lettre: m[1].toUpperCase(), alt };
}

export function nomFr(n) { return NOMS_FR[n.lettre] + SYMBOLES[n.alt]; }
export function nomLettre(n) { return n.lettre + SYMBOLES[n.alt]; }
export function classe(n) { return ((CLASSES[LETTRES.indexOf(n.lettre)] + n.alt) % 12 + 12) % 12; }
export function memeNote(a, b) { return a.lettre === b.lettre && a.alt === b.alt; }
export function demiTons(intervalle) { return INTERVALLES[intervalle][1]; }

function noteSurLettre(idxLettre, classeCible) {
  const idx = ((idxLettre % 7) + 7) % 7;
  let diff = ((classeCible - CLASSES[idx]) % 12 + 12) % 12;
  if (diff > 6) diff -= 12;
  return { lettre: LETTRES[idx], alt: diff };
}

export function transposer(n, intervalle) {
  const [pas, semis] = INTERVALLES[intervalle];
  return noteSurLettre(LETTRES.indexOf(n.lettre) + pas, (classe(n) + semis) % 12);
}

// Même son, lettre voisine, altération simple ; null si impossible (ré, sol, la…)
export function enharmonique(n) {
  const idx = LETTRES.indexOf(n.lettre);
  for (const d of [1, -1]) {
    const c = noteSurLettre(idx + d, classe(n));
    if (Math.abs(c.alt) <= 1) return c;
  }
  return null;
}

export const TYPES_ACCORD = {
  maj: { suffixe: '', intervalles: ['P1', 'M3', 'P5'], libelle: 'majeur' },
  min: { suffixe: 'm', intervalles: ['P1', 'm3', 'P5'], libelle: 'mineur' },
  dim: { suffixe: '°', intervalles: ['P1', 'm3', 'd5'], libelle: 'diminué' },
  aug: { suffixe: '+', intervalles: ['P1', 'M3', 'A5'], libelle: 'augmenté' },
  maj7: { suffixe: 'maj7', intervalles: ['P1', 'M3', 'P5', 'M7'], libelle: 'majeur 7' },
  7: { suffixe: '7', intervalles: ['P1', 'M3', 'P5', 'm7'], libelle: '7 (dominante)' },
  m7: { suffixe: 'm7', intervalles: ['P1', 'm3', 'P5', 'm7'], libelle: 'mineur 7' },
  m7b5: { suffixe: 'm7♭5', intervalles: ['P1', 'm3', 'd5', 'm7'], libelle: 'demi-diminué (ø)' },
  dim7: { suffixe: '°7', intervalles: ['P1', 'm3', 'd5', 'd7'], libelle: 'diminué 7' },
};

export function notesAccord(fond, type) {
  return TYPES_ACCORD[type].intervalles.map((i) => transposer(fond, i));
}
export function nomAccord(fond, type) { return nomLettre(fond) + TYPES_ACCORD[type].suffixe; }

const GAMME_MAJEURE = ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'];
const GAMME_MINEURE = ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'];
export function gammeMajeure(t) { return GAMME_MAJEURE.map((i) => transposer(t, i)); }
export function gammeMineureNaturelle(t) { return GAMME_MINEURE.map((i) => transposer(t, i)); }

const ORDRE_DIESES = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const ORDRE_BEMOLS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export function armure(tonique, mode = 'majeur') {
  const gamme = mode === 'mineur' ? gammeMineureNaturelle(tonique) : gammeMajeure(tonique);
  const nombre = gamme.reduce((s, n) => s + n.alt, 0);
  const alterations = nombre >= 0
    ? ORDRE_DIESES.slice(0, nombre).map((l) => ({ lettre: l, alt: 1 }))
    : ORDRE_BEMOLS.slice(0, -nombre).map((l) => ({ lettre: l, alt: -1 }));
  return { nombre, alterations };
}

export function relativeMineure(t) { return transposer(t, 'M6'); }
export function relativeMajeure(t) { return transposer(t, 'm3'); }
export function quinteSup(n) { return transposer(n, 'P5'); }
export function quinteInf(n) { return transposer(n, 'P4'); }

export const DEGRES_MAJEUR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const TYPES_DEGRE = {
  majeur: {
    triade: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
    septieme: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'],
  },
  // mineur « pratique » pour le II-V-i : iiø, V7 (sensible haussée), i mineur
  mineur: {
    triade: ['min', 'dim', 'maj', 'min', 'maj', 'maj', 'maj'],
    septieme: ['min', 'm7b5', 'maj7', 'm7', '7', 'maj7', '7'],
  },
};

export function accordDegre(tonique, degre, { septieme = false, mode = 'majeur' } = {}) {
  const gamme = mode === 'mineur' ? gammeMineureNaturelle(tonique) : gammeMajeure(tonique);
  const type = TYPES_DEGRE[mode][septieme ? 'septieme' : 'triade'][degre - 1];
  return { fond: gamme[degre - 1], type };
}

const SUFFIXE_ROMAIN = { maj: '', min: '', dim: '°', aug: '+', maj7: 'maj7', 7: '7', m7: 'm7', m7b5: 'ø', dim7: '°7' };
export function chiffreRomain(degre, mode = 'majeur', septieme = false) {
  const type = TYPES_DEGRE[mode][septieme ? 'septieme' : 'triade'][degre - 1];
  const majuscule = ['maj', 'aug', 'maj7', '7'].includes(type);
  const r = ROMAINS[degre - 1];
  return (majuscule ? r : r.toLowerCase()) + SUFFIXE_ROMAIN[type];
}

export function listeNotes(notes) { return notes.map(nomFr).join(' '); }

// ---------- Intervalles nommés ----------
export const NOMS_INTERVALLES = {
  P1: 'unisson', m2: 'seconde mineure', M2: 'seconde majeure', m3: 'tierce mineure', M3: 'tierce majeure',
  P4: 'quarte juste', A4: 'quarte augmentée', d5: 'quinte diminuée', P5: 'quinte juste', A5: 'quinte augmentée',
  m6: 'sixte mineure', M6: 'sixte majeure', d7: 'septième diminuée', m7: 'septième mineure', M7: 'septième majeure', P8: 'octave',
};
const RENVERSEMENTS = { P1: 'P8', P8: 'P1', m2: 'M7', M7: 'm2', M2: 'm7', m7: 'M2', m3: 'M6', M6: 'm3', M3: 'm6', m6: 'M3', P4: 'P5', P5: 'P4', A4: 'd5', d5: 'A4', A5: 'd7', d7: 'A5' };
export function renversement(intervalle) { return RENVERSEMENTS[intervalle]; }
export function nomIntervalle(intervalle) { return NOMS_INTERVALLES[intervalle]; }

// Intervalle montant de a vers b (nom court), ou null s'il n'a pas de nom courant (doublement altéré).
export function intervalleEntre(a, b) {
  const pas = (LETTRES.indexOf(b.lettre) - LETTRES.indexOf(a.lettre) + 7) % 7;
  const semis = (classe(b) - classe(a) + 12) % 12;
  for (const [nom, [p, s]] of Object.entries(INTERVALLES)) if (p === pas && s === semis && nom !== 'P8') return nom;
  return null;
}

// Numéro MIDI (do4 = 60). L'octave est celle de la note écrite (si♯3 = 60, do♭4 = 59).
export function midi(n, octave = 4) { return 12 * (octave + 1) + CLASSES[LETTRES.indexOf(n.lettre)] + n.alt; }

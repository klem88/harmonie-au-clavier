// Progression du déchiffrage : un parcours par main (niveau, tempo par niveau), un historique commun
// (chaque pièce dit sa main), déblocage main par main.
// Pur : reçoit toujours `now`. Pas de cartes ni de boîtes : une pièce ne revient jamais.

import { NIVEAUX_PIECE, MAINS } from './piece.js';

export const REGLES_DECHIFFRAGE = { bpmDepart: 60, pasBpm: 6, bpmMin: 50, bpmMax: 96, fenetre: 8, reussitesPourDebloquer: 6, historiqueMax: 100 };
const NB_NIVEAUX_DECH = Object.keys(NIVEAUX_PIECE).length;
const mainDe = (h) => h.main ?? 'droite'; // pièces d'avant la main gauche : main droite

function parcoursInitial() {
  return { niveau: 1, bpm: Object.fromEntries(Object.keys(NIVEAUX_PIECE).map((n) => [n, REGLES_DECHIFFRAGE.bpmDepart])) };
}

export function etatDechiffrageInitial() {
  return { main: 'droite', droite: parcoursInitial(), gauche: parcoursInitial(), historique: [] };
}

function normaliserParcours(source) {
  const base = parcoursInitial();
  if (!source || typeof source !== 'object') return base;
  const niveau = Number.isInteger(source.niveau) && source.niveau >= 1 && source.niveau <= NB_NIVEAUX_DECH ? source.niveau : 1;
  const bpm = { ...base.bpm };
  for (const k of Object.keys(bpm)) {
    if (Number.isFinite(source.bpm?.[k])) bpm[k] = Math.min(REGLES_DECHIFFRAGE.bpmMax, Math.max(REGLES_DECHIFFRAGE.bpmMin, source.bpm[k]));
  }
  return { niveau, bpm };
}

export function normaliserDechiffrage(source) {
  if (!source || typeof source !== 'object') return etatDechiffrageInitial();
  // Ancienne forme (main droite seule) : { niveau, bpm, historique } au premier niveau.
  const droite = normaliserParcours(source.droite ?? (source.niveau !== undefined || source.bpm ? source : null));
  const historique = Array.isArray(source.historique) ? source.historique.slice(-REGLES_DECHIFFRAGE.historiqueMax) : [];
  return { main: MAINS[source.main] ? source.main : 'droite', droite, gauche: normaliserParcours(source.gauche), historique };
}

// Ce qu'il reste à faire pour ouvrir le niveau suivant d'une main ; null au dernier niveau.
export function etatDeblocageDechiffrage(etat, main = 'droite') {
  const d = etat.dechiffrage;
  const p = d[main];
  if (p.niveau >= NB_NIVEAUX_DECH) return null;
  const R = REGLES_DECHIFFRAGE;
  const recentes = d.historique.filter((h) => mainDe(h) === main && h.niveau === p.niveau).slice(-R.fenetre);
  const reussites = recentes.filter((h) => h.reussi).length;
  return { niveau: p.niveau, suivant: p.niveau + 1, reussites, jouees: recentes.length, cible: R.reussitesPourDebloquer, fenetre: R.fenetre, pret: reussites >= R.reussitesPourDebloquer };
}

// À n'appeler que pour une pièce qui compte (ni rejouée, ni inaudible).
export function enregistrerPiece(etat, { main = 'droite', niveau, graine, bpm, resultat }, now) {
  const d = etat.dechiffrage;
  const R = REGLES_DECHIFFRAGE;
  const p = d[main];
  d.historique.push({ date: now, main, niveau, graine, bpm, justes: resultat.justes, total: resultat.total, ecartMs: resultat.ecartMedianMs, arrets: resultat.arrets.length, reussi: resultat.reussi });
  if (d.historique.length > R.historiqueMax) d.historique = d.historique.slice(-R.historiqueMax);
  p.bpm[niveau] = Math.min(R.bpmMax, Math.max(R.bpmMin, bpm + (resultat.reussi ? R.pasBpm : -R.pasBpm)));
  let debloque = null;
  const b = etatDeblocageDechiffrage(etat, main);
  if (b && b.niveau === niveau && b.pret) { p.niveau += 1; debloque = p.niveau; }
  return { debloque, bpmApres: p.bpm[niveau] };
}

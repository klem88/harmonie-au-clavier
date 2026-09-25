// Progression du déchiffrage : niveau, tempo par niveau, historique des pièces, déblocage.
// Pur : reçoit toujours `now`. Pas de cartes ni de boîtes : une pièce ne revient jamais.

import { NIVEAUX_PIECE } from './piece.js';

export const REGLES_DECHIFFRAGE = { bpmDepart: 60, pasBpm: 6, bpmMin: 50, bpmMax: 96, fenetre: 8, reussitesPourDebloquer: 6, historiqueMax: 100 };
const NB_NIVEAUX_DECH = Object.keys(NIVEAUX_PIECE).length;

export function etatDechiffrageInitial() {
  return { niveau: 1, bpm: Object.fromEntries(Object.keys(NIVEAUX_PIECE).map((n) => [n, REGLES_DECHIFFRAGE.bpmDepart])), historique: [] };
}

export function normaliserDechiffrage(source) {
  const base = etatDechiffrageInitial();
  if (!source || typeof source !== 'object') return base;
  const niveau = Number.isInteger(source.niveau) && source.niveau >= 1 && source.niveau <= NB_NIVEAUX_DECH ? source.niveau : 1;
  const bpm = { ...base.bpm };
  for (const k of Object.keys(bpm)) {
    if (Number.isFinite(source.bpm?.[k])) bpm[k] = Math.min(REGLES_DECHIFFRAGE.bpmMax, Math.max(REGLES_DECHIFFRAGE.bpmMin, source.bpm[k]));
  }
  const historique = Array.isArray(source.historique) ? source.historique.slice(-REGLES_DECHIFFRAGE.historiqueMax) : [];
  return { niveau, bpm, historique };
}

// Ce qu'il reste à faire pour ouvrir le niveau suivant ; null au dernier niveau.
export function etatDeblocageDechiffrage(etat) {
  const d = etat.dechiffrage;
  if (d.niveau >= NB_NIVEAUX_DECH) return null;
  const R = REGLES_DECHIFFRAGE;
  const recentes = d.historique.filter((h) => h.niveau === d.niveau).slice(-R.fenetre);
  const reussites = recentes.filter((h) => h.reussi).length;
  return { niveau: d.niveau, suivant: d.niveau + 1, reussites, jouees: recentes.length, cible: R.reussitesPourDebloquer, fenetre: R.fenetre, pret: reussites >= R.reussitesPourDebloquer };
}

// À n'appeler que pour une pièce qui compte (ni rejouée, ni inaudible).
export function enregistrerPiece(etat, { niveau, graine, bpm, resultat }, now) {
  const d = etat.dechiffrage;
  const R = REGLES_DECHIFFRAGE;
  d.historique.push({ date: now, niveau, graine, bpm, justes: resultat.justes, total: resultat.total, ecartMs: resultat.ecartMedianMs, arrets: resultat.arrets.length, reussi: resultat.reussi });
  if (d.historique.length > R.historiqueMax) d.historique = d.historique.slice(-R.historiqueMax);
  d.bpm[niveau] = Math.min(R.bpmMax, Math.max(R.bpmMin, bpm + (resultat.reussi ? R.pasBpm : -R.pasBpm)));
  let debloque = null;
  const b = etatDeblocageDechiffrage(etat);
  if (b && b.niveau === niveau && b.pret) { d.niveau += 1; debloque = d.niveau; }
  return { debloque, bpmApres: d.bpm[niveau] };
}

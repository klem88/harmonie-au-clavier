// Progression du déchiffrage : un parcours par main et un parcours mains ensemble (niveau, tempo par niveau),
// un historique commun (chaque pièce dit sa main), déblocage parcours par parcours.
// Pur : reçoit toujours `now`. Pas de cartes ni de boîtes : une pièce ne revient jamais.

import { NIVEAUX_PIECE } from './piece.js';
import { NIVEAUX_ENSEMBLE } from './ensemble.js';

export const REGLES_DECHIFFRAGE = {
  bpmDepart: 60, bpmDepartEnsemble: 50, pasBpm: 6, bpmMin: 50, bpmMax: 96, fenetre: 8, reussitesPourDebloquer: 6, historiqueMax: 100,
  // Mains ensemble : niveau atteint par CHACUNE des deux mains pour jouer (1) ou ouvrir (2) ce niveau.
  mainsPourEnsemble: { 1: 2, 2: 3 },
};
export const PARCOURS = ['droite', 'gauche', 'ensemble'];
const NIVEAUX_PARCOURS = { droite: NIVEAUX_PIECE, gauche: NIVEAUX_PIECE, ensemble: NIVEAUX_ENSEMBLE };
const nbNiveaux = (main) => Object.keys(NIVEAUX_PARCOURS[main]).length;
const mainDe = (h) => h.main ?? 'droite'; // pièces d'avant la main gauche : main droite

function parcoursInitial(main) {
  const depart = main === 'ensemble' ? REGLES_DECHIFFRAGE.bpmDepartEnsemble : REGLES_DECHIFFRAGE.bpmDepart;
  return { niveau: 1, bpm: Object.fromEntries(Object.keys(NIVEAUX_PARCOURS[main]).map((n) => [n, depart])) };
}

export function etatDechiffrageInitial() {
  return { main: 'droite', droite: parcoursInitial('droite'), gauche: parcoursInitial('gauche'), ensemble: parcoursInitial('ensemble'), historique: [] };
}

function normaliserParcours(source, main) {
  const base = parcoursInitial(main);
  if (!source || typeof source !== 'object') return base;
  const niveau = Number.isInteger(source.niveau) && source.niveau >= 1 && source.niveau <= nbNiveaux(main) ? source.niveau : 1;
  const bpm = { ...base.bpm };
  for (const k of Object.keys(bpm)) {
    if (Number.isFinite(source.bpm?.[k])) bpm[k] = Math.min(REGLES_DECHIFFRAGE.bpmMax, Math.max(REGLES_DECHIFFRAGE.bpmMin, source.bpm[k]));
  }
  return { niveau, bpm };
}

export function normaliserDechiffrage(source) {
  if (!source || typeof source !== 'object') return etatDechiffrageInitial();
  // Ancienne forme (main droite seule) : { niveau, bpm, historique } au premier niveau.
  const droite = normaliserParcours(source.droite ?? (source.niveau !== undefined || source.bpm ? source : null), 'droite');
  const historique = Array.isArray(source.historique) ? source.historique.slice(-REGLES_DECHIFFRAGE.historiqueMax) : [];
  return {
    main: PARCOURS.includes(source.main) ? source.main : 'droite',
    droite, gauche: normaliserParcours(source.gauche, 'gauche'), ensemble: normaliserParcours(source.ensemble, 'ensemble'), historique,
  };
}

// Mains ensemble : ouvert quand chacune des deux mains a atteint le niveau demandé pour le niveau 1.
export function ensembleOuvert(etat) {
  const d = etat.dechiffrage;
  return Math.min(d.droite.niveau, d.gauche.niveau) >= REGLES_DECHIFFRAGE.mainsPourEnsemble[1];
}

// Ce qu'il reste à faire pour ouvrir le niveau suivant d'un parcours ; null au dernier niveau.
// Mains ensemble : il faut aussi que chaque main ait atteint `mainsRequises` (null si rien n'est demandé).
export function etatDeblocageDechiffrage(etat, main = 'droite') {
  const d = etat.dechiffrage;
  const p = d[main];
  if (p.niveau >= nbNiveaux(main)) return null;
  const R = REGLES_DECHIFFRAGE;
  const recentes = d.historique.filter((h) => mainDe(h) === main && h.niveau === p.niveau).slice(-R.fenetre);
  const reussites = recentes.filter((h) => h.reussi).length;
  const mainsRequises = main === 'ensemble' ? R.mainsPourEnsemble[p.niveau + 1] ?? null : null;
  const mainsOk = mainsRequises === null || Math.min(d.droite.niveau, d.gauche.niveau) >= mainsRequises;
  return {
    niveau: p.niveau, suivant: p.niveau + 1, reussites, jouees: recentes.length, cible: R.reussitesPourDebloquer, fenetre: R.fenetre,
    mainsRequises, mainsOk, pret: reussites >= R.reussitesPourDebloquer && mainsOk,
  };
}

// À n'appeler que pour une pièce qui compte (ni rejouée, ni inaudible). Mains ensemble : `resultat.reussi` est le
// verdict confirmé par l'élève, `resultat.propose` celui de l'app.
export function enregistrerPiece(etat, { main = 'droite', niveau, graine, bpm, resultat }, now) {
  const d = etat.dechiffrage;
  const R = REGLES_DECHIFFRAGE;
  const p = d[main];
  const h = { date: now, main, niveau, graine, bpm, justes: resultat.justes, total: resultat.total, ecartMs: resultat.ecartMedianMs, arrets: resultat.arrets.length, reussi: resultat.reussi };
  if (main === 'ensemble') Object.assign(h, { douteuses: resultat.douteuses, propose: resultat.propose });
  d.historique.push(h);
  if (d.historique.length > R.historiqueMax) d.historique = d.historique.slice(-R.historiqueMax);
  p.bpm[niveau] = Math.min(R.bpmMax, Math.max(R.bpmMin, bpm + (resultat.reussi ? R.pasBpm : -R.pasBpm)));
  let debloque = null;
  const b = etatDeblocageDechiffrage(etat, main);
  if (b && b.niveau === niveau && b.pret) { p.niveau += 1; debloque = p.niveau; }
  return { debloque, bpmApres: p.bpm[niveau] };
}

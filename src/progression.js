// Progression de l'élève : répétition espacée par boîtes, déblocage des niveaux,
// composition d'une séance. Pur : reçoit toujours `now` (ms epoch) en paramètre.

import { DIMENSIONS, catalogue, carte, cartesDuNiveau } from './questions.js';
import { etatDechiffrageInitial, normaliserDechiffrage } from './dechiffrage.js';

export const REGLES = {
  boiteMax: 5,
  delaisJours: [0, 1, 3, 7, 16, 35],
  rapideMs: 6000,
  deblocage: { minReponses: 15, tauxMin: 0.85, medianeMaxMs: 4000 },
  // Seuils de vitesse par dimension : reconnaître une armure est un pur réflexe,
  // construire un II-V-I ou identifier un son demande une opération de plus.
  vitesse: {
    A: { rapideMs: 7000, medianeMaxMs: 5500 },
    B: { rapideMs: 7000, medianeMaxMs: 5500 },
    C: { rapideMs: 7000, medianeMaxMs: 5500 },
    D: { rapideMs: 9000, medianeMaxMs: 7000 },
    E: { rapideMs: 7000, medianeMaxMs: 5500 },
    F: { rapideMs: 9000, medianeMaxMs: 7000 },
    // Rythme : niveaux 1-2 = questions (secondes) ; niveaux 3-4 = frappe, le « temps » est
    // l'écart moyen aux attaques en millisecondes, donc des seuils de précision.
    G: { rapideMs: 7000, medianeMaxMs: 5500, parNiveau: { 3: { rapideMs: 80, medianeMaxMs: 70 }, 4: { rapideMs: 90, medianeMaxMs: 80 } } },
    // Chant : le « temps » est l'écart en cents à la note visée (± 50 = juste, ≤ 35 pour monter).
    I: { rapideMs: 35, medianeMaxMs: 30 },
  },
  fenetre: 20,
  tailleSeance: 20,
  partRevision: 0.2,
  reinsertionApres: 5,
  boiteAcquise: 3,
};
const JOUR = 86_400_000;

export function seuils(dim, niveau = null) {
  const v = REGLES.vitesse[dim] || {};
  const n = (niveau && v.parNiveau && v.parNiveau[niveau]) || {};
  return {
    rapideMs: n.rapideMs ?? v.rapideMs ?? REGLES.rapideMs,
    medianeMaxMs: n.medianeMaxMs ?? v.medianeMaxMs ?? REGLES.deblocage.medianeMaxMs,
  };
}

export function etatInitial() {
  return {
    version: 1,
    cartes: {},
    niveaux: Object.fromEntries(Object.keys(DIMENSIONS).map((d) => [d, 1])),
    statsNiveaux: {},
    seances: [],
    prefs: { silence: false, clic: false },
    dechiffrage: etatDechiffrageInitial(),
  };
}

export function normaliser(source) {
  if (!source || typeof source !== 'object' || source.version !== 1) return etatInitial();
  // Copie profonde : la base de l'artefact renvoie des objets gelés, qu'il faut rendre modifiables.
  const etat = JSON.parse(JSON.stringify(source));
  const base = etatInitial();
  return {
    version: 1,
    cartes: typeof etat.cartes === 'object' && etat.cartes ? etat.cartes : base.cartes,
    niveaux: { ...base.niveaux, ...(etat.niveaux || {}) },
    statsNiveaux: etat.statsNiveaux || {},
    seances: Array.isArray(etat.seances) ? etat.seances : [],
    prefs: { ...base.prefs, ...(etat.prefs || {}) },
    dechiffrage: normaliserDechiffrage(etat.dechiffrage),
  };
}

// Import d'une sauvegarde collée par l'élève (export JSON de l'écran Progression).
export function lireSauvegarde(texte) {
  let brut;
  try { brut = JSON.parse(texte); } catch { return { ok: false, erreur: 'Texte illisible : colle l’export complet, du premier { au dernier }.' }; }
  if (!brut || typeof brut !== 'object' || brut.version !== 1 || typeof brut.cartes !== 'object') {
    return { ok: false, erreur: 'Ce texte n’est pas une sauvegarde de l’app.' };
  }
  return { ok: true, etat: normaliser(brut) };
}

export function mediane(nombres) {
  if (!nombres.length) return null;
  const t = [...nombres].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export function estDue(fiche, now) { return fiche.prochaine <= now; }

export function niveauMaitrise(etat, dim, niv) {
  const cs = cartesDuNiveau(dim, niv);
  return cs.length > 0 && cs.every((c) => (etat.cartes[c.id]?.boite ?? 0) >= REGLES.boiteAcquise);
}

// Taux de réussite d'un niveau : sur la fenêtre glissante dès qu'elle est pleine,
// sinon sur le cumul (états d'avant la fenêtre, où `justes` n'existe pas encore).
export function tauxNiveau(s) {
  const j = s.justes || [];
  if (j.length >= REGLES.deblocage.minReponses) return j.filter(Boolean).length / j.length;
  return s.n ? s.ok / s.n : null;
}

export function enregistrerReponse(etat, id, juste, ms, now) {
  const c = carte(id);
  const { rapideMs, medianeMaxMs } = seuils(c.dimension, c.niveau);
  const fiche = etat.cartes[id] ||= { boite: 0, prochaine: now, n: 0, ok: 0, temps: [] };
  const boiteAvant = fiche.boite;
  if (!juste) fiche.boite = 0;
  else if (ms <= rapideMs) fiche.boite = Math.min(REGLES.boiteMax, fiche.boite + 1);
  fiche.prochaine = now + REGLES.delaisJours[fiche.boite] * JOUR;
  fiche.n += 1;
  if (juste) fiche.ok += 1;
  fiche.temps = [...fiche.temps, ms].slice(-5);

  const cle = `${c.dimension}${c.niveau}`;
  const s = etat.statsNiveaux[cle] ||= { n: 0, ok: 0, temps: [], justes: [] };
  s.n += 1;
  if (juste) s.ok += 1;
  s.temps = [...s.temps, ms].slice(-REGLES.fenetre);
  s.justes = [...(s.justes || []), juste].slice(-REGLES.fenetre);

  let debloque = null;
  const { minReponses, tauxMin } = REGLES.deblocage;
  if (etat.niveaux[c.dimension] === c.niveau && c.niveau < DIMENSIONS[c.dimension].niveaux
    && s.n >= minReponses && tauxNiveau(s) >= tauxMin && mediane(s.temps) <= medianeMaxMs) {
    etat.niveaux[c.dimension] = c.niveau + 1;
    debloque = `${c.dimension}${c.niveau + 1}`;
  }
  return { boiteAvant, boiteApres: fiche.boite, debloque };
}

// Ce qu'il reste à faire pour ouvrir le niveau suivant d'une dimension.
// `null` quand le dernier niveau est déjà ouvert.
export function etatDeblocage(etat, dim) {
  const niveau = etat.niveaux[dim];
  if (niveau >= DIMENSIONS[dim].niveaux) return null;
  const { minReponses, tauxMin } = REGLES.deblocage;
  const { medianeMaxMs } = seuils(dim, niveau);
  const s = etat.statsNiveaux[`${dim}${niveau}`] || { n: 0, ok: 0, temps: [], justes: [] };
  const taux = tauxNiveau(s);
  const med = mediane(s.temps);
  const criteres = [
    { cle: 'reponses', valeur: s.n, cible: minReponses, fait: s.n >= minReponses },
    { cle: 'taux', valeur: taux, cible: tauxMin, fait: taux !== null && taux >= tauxMin },
    { cle: 'vitesse', valeur: med, cible: medianeMaxMs, fait: med !== null && med <= medianeMaxMs },
  ];
  return { dim, niveau, suivant: niveau + 1, criteres, pret: criteres.every((x) => x.fait) };
}

function melanger(tab, alea) {
  const t = [...tab];
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

export function composerSeance(etat, now, { taille = REGLES.tailleSeance, dimension = null, niveau = null, sansAudio = false, sansChant = false, alea = Math.random } = {}) {
  const pool = catalogue().filter((c) => {
    if (sansAudio && (c.audio || c.frappe || c.chant)) return false;
    if (sansChant && c.chant) return false;
    if (dimension && c.dimension !== dimension) return false;
    if (niveau) return c.niveau === niveau;
    return c.niveau <= etat.niveaux[c.dimension];
  });
  const maitrises = new Set();
  for (const dim of Object.keys(DIMENSIONS)) {
    for (let n = 1; n <= etat.niveaux[dim]; n++) if (niveauMaitrise(etat, dim, n)) maitrises.add(`${dim}${n}`);
  }
  const estMaitrise = (c) => maitrises.has(`${c.dimension}${c.niveau}`);

  // 1. cartes dues, les plus en retard d'abord
  const dues = pool
    .filter((c) => etat.cartes[c.id] && estDue(etat.cartes[c.id], now))
    .sort((a, b) => etat.cartes[a.id].prochaine - etat.cartes[b.id].prochaine)
    .map((c) => c.id);

  // 2. nouvelles cartes des niveaux non maîtrisés, groupes (dimension, niveau) alternés
  const groupes = new Map();
  for (const c of pool) {
    if (etat.cartes[c.id] || estMaitrise(c)) continue;
    const k = `${c.dimension}${c.niveau}`;
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k).push(c.id);
  }
  const files = [...groupes.values()].map((g) => melanger(g, alea));
  const nouvelles = [];
  for (let i = 0; files.some((f) => f.length); i++) {
    const f = files[i % files.length];
    if (f.length) nouvelles.push(f.shift());
  }

  // 3. révisions des niveaux maîtrisés, même non dues
  const revisions = melanger(pool.filter((c) => estMaitrise(c) && !dues.includes(c.id)).map((c) => c.id), alea);
  const nRev = niveau ? 0 : Math.min(revisions.length, Math.round(taille * REGLES.partRevision));

  const choisis = dues.slice(0, taille);
  const placeNouvelles = Math.max(0, taille - choisis.length - nRev);
  choisis.push(...nouvelles.slice(0, placeNouvelles));
  choisis.push(...revisions.slice(0, Math.max(0, taille - choisis.length)));

  // 4. secours : cartes déjà vues, non dues, les plus proches de l'échéance
  if (choisis.length < taille) {
    const pris = new Set(choisis);
    const reste = pool.filter((c) => !pris.has(c.id)).sort((a, b) => (etat.cartes[a.id]?.prochaine ?? Infinity) - (etat.cartes[b.id]?.prochaine ?? Infinity));
    choisis.push(...reste.slice(0, taille - choisis.length).map((c) => c.id));
  }
  return choisis;
}

export function cloreSeance(etat, { n, ok, medianeMs, dimension = null }, now) {
  etat.seances.push({ date: now, n, ok, medianeMs, dimension });
  if (etat.seances.length > 200) etat.seances = etat.seances.slice(-200);
}

export function bilan(etat) {
  const dimensions = {};
  for (const [dim, d] of Object.entries(DIMENSIONS)) {
    const niveaux = [];
    for (let n = 1; n <= d.niveaux; n++) {
      const cs = cartesDuNiveau(dim, n);
      const acquis = cs.filter((c) => (etat.cartes[c.id]?.boite ?? 0) >= REGLES.boiteAcquise).length;
      const vues = cs.filter((c) => etat.cartes[c.id]).length;
      // Avancement gradué : chaque carte compte pour sa boîte, plafonnée à « acquise ».
      // Une barre en tout ou rien resterait à zéro les premiers jours, le temps que les délais passent.
      const consolide = cs.reduce((t, c) => t + Math.min(etat.cartes[c.id]?.boite ?? 0, REGLES.boiteAcquise), 0);
      let e = 'verrouille';
      if (n <= etat.niveaux[dim]) e = niveauMaitrise(etat, dim, n) ? 'maitrise' : 'ouvert';
      niveaux.push({ niv: n, etat: e, acquis, vues, consolide, consolideMax: cs.length * REGLES.boiteAcquise, total: cs.length });
    }
    dimensions[dim] = {
      nom: d.nom,
      niveauOuvert: etat.niveaux[dim],
      niveaux,
      seuils: seuils(dim),
      deblocage: etatDeblocage(etat, dim),
    };
  }
  return { dimensions, seances: [...etat.seances] };
}

// Jours avant le retour d'une carte qui vient d'arriver dans cette boîte.
export function delaiBoite(boite) { return REGLES.delaisJours[boite]; }

export function cartesDues(etat, now, { sansAudio = false, sansChant = false } = {}) {
  return catalogue().filter((c) => !(sansAudio && (c.audio || c.frappe || c.chant)) && !(sansChant && c.chant) && c.niveau <= etat.niveaux[c.dimension] && etat.cartes[c.id] && estDue(etat.cartes[c.id], now)).length;
}

export class FileSeance {
  constructor(ids) { this.file = [...ids]; this.pos = 0; this.nb = ids.length; this.reinserees = new Set(); }
  suivante() { return this.pos < this.file.length ? this.file[this.pos++] : null; }
  // Une carte ratée revient une seule fois par séance, pour que la séance finisse toujours.
  reinserer(id) {
    if (this.reinserees.has(id)) return false;
    this.reinserees.add(id);
    this.file.splice(Math.min(this.pos + REGLES.reinsertionApres, this.file.length), 0, id);
    this.nb += 1;
    return true;
  }
  restantes() { return this.file.length - this.pos; }
  total() { return this.nb; }
}

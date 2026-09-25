// Écoute d'une pièce jouée au piano : attaques et hauteurs à partir de trames du micro, puis
// comparaison avec la partition. trameDe, detecterAttaques et aligner sont purs et testés ;
// creerEcoute n'existe que dans un navigateur.

import { detecterHauteur, midiDeFrequence } from './voix.js';
import { U } from './rythme.js';

export const REGLES_ECOUTE = {
  seuilRms: 0.01, rapport: 1.5, refractaireMs: 90, fenetreHauteur: [40, 200],
  toleranceDecaleMs: 120, arretTemps: 0.75, tauxReussite: 0.85, decaleesMax: 0.2,
};

function medianeEcoute(t) { const s = [...t].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// Main droite seulement : 180–1000 Hz suffit et allège le calcul sur téléphone.
export function trameDe(buf, sampleRate, tMs) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return { tMs, rms: Math.sqrt(s / buf.length), f0: detecterHauteur(buf, sampleRate, { seuilRms: REGLES_ECOUTE.seuilRms, fMin: 180, fMax: 1000 }) };
}

// Une attaque = un saut d'énergie, ou (legato) une nouvelle hauteur stable sans saut d'énergie.
// Sa hauteur = médiane des hauteurs mesurées entre +40 et +200 ms, avant l'attaque suivante.
// Un bruit sans hauteur (clic, choc) n'est pas une note.
export function detecterAttaques(trames, regles = REGLES_ECOUTE) {
  const { seuilRms, rapport, refractaireMs, fenetreHauteur: [de, a] } = regles;
  const hauteur = trames.map((x) => (x.f0 ? Math.round(midiDeFrequence(x.f0)) : null));
  const stableEn = (k) => (k + 2 < trames.length && hauteur[k] !== null && hauteur[k + 1] === hauteur[k] && hauteur[k + 2] === hauteur[k] ? hauteur[k] : null);
  const debuts = [];
  let dernier = -Infinity;
  let courante = null; // hauteur stable de la note qui sonne
  for (let k = 2; k < trames.length; k++) {
    const t = trames[k];
    const s = stableEn(k);
    if (t.tMs - dernier >= refractaireMs && t.rms >= seuilRms) {
      const ref = Math.min(trames[k - 1].rms, trames[k - 2].rms);
      const sautEnergie = t.rms >= rapport * Math.max(ref, seuilRms / 2);
      // un saut d'octave pendant l'extinction est une erreur de mesure, pas une nouvelle note
      const nouvelleHauteur = s !== null && courante !== null && s !== courante && Math.abs(s - courante) !== 12;
      if (sautEnergie || nouvelleHauteur) { debuts.push(k); dernier = t.tMs; courante = null; }
    }
    if (courante === null && s !== null && t.tMs - dernier >= 30) courante = s;
    if (t.rms < seuilRms) courante = null;
  }
  const attaques = [];
  debuts.forEach((k, i) => {
    const t0 = trames[k].tMs;
    const tFin = i + 1 < debuts.length ? trames[debuts[i + 1]].tMs : Infinity;
    const h = trames.filter((x) => x.f0 && x.tMs >= t0 + de && x.tMs <= Math.min(t0 + a, tFin - 1)).map((x) => midiDeFrequence(x.f0));
    if (h.length >= 2) attaques.push({ tMs: Math.round(t0), midi: Math.round(medianeEcoute(h)) });
  });
  return attaques;
}

// Compare les notes jouées à la partition.
// 1. Alignement par programmation dynamique : l'ordre des notes et leur hauteur comptent d'abord,
//    le temps ne sert qu'à départager (une note répétée, par exemple) ; un arrêt ne casse donc pas l'alignement.
// 2. Retard constant (micro, réaction) : les paires appariées sont divisées en segments (arrêts détectés quand l'écart
//    grandit de plus de ¾ de temps d'une note à la suivante) ; pour chaque segment, base = médiane des écarts des bonnes
//    hauteurs (ou de tous si aucune juste) ; L = base du premier segment, chaque note comparée à la base de son segment.
// 3. Arrêt : enregistré à chaque début de segment après le premier.
export function aligner(attendues, joues, { bpm, regles = REGLES_ECOUTE } = {}) {
  const battement = 60000 / bpm;
  // Décompte : les notes jouées trop tôt (avant le début du morceau) ne sont ni appariées ni « en trop ».
  joues = joues.filter((j) => j.tMs >= -battement / 2);
  const n = attendues.length; const m = joues.length;
  const coutPaire = (a, j) => (a.midi === j.midi ? 0 : 0.9) + 0.1 * Math.min(Math.abs(j.tMs - a.tMs) / battement, 3);
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const P = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 0 paire, 1 manquée, 2 en trop
  for (let i = 1; i <= n; i++) { D[i][0] = i; P[i][0] = 1; }
  for (let j = 1; j <= m; j++) { D[0][j] = j; P[0][j] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const paire = D[i - 1][j - 1] + coutPaire(attendues[i - 1], joues[j - 1]);
      const manquee = D[i - 1][j] + 1;
      const trop = D[i][j - 1] + 1;
      if (paire <= manquee && paire <= trop) { D[i][j] = paire; P[i][j] = 0; }
      else if (manquee <= trop) { D[i][j] = manquee; P[i][j] = 1; }
      else { D[i][j] = trop; P[i][j] = 2; }
    }
  }
  const apparie = new Array(n).fill(null);
  const restes = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    const c = i > 0 && j > 0 ? P[i][j] : i > 0 ? 1 : 2;
    if (c === 0) { apparie[i - 1] = j - 1; i--; j--; }
    else if (c === 1) i--;
    else { restes.push(j - 1); j--; }
  }

  const paires = apparie.map((j, i) => (j === null ? null : { i, a: attendues[i], j: joues[j] })).filter(Boolean);

  // Compute raw offsets and split into segments (stops detected by offset jumps)
  const offsets = paires.map((p) => p.j.tMs - p.a.tMs);
  const segments = [];
  let segmentStart = 0;
  for (let k = 1; k < paires.length; k++) {
    if (offsets[k] - offsets[k - 1] > regles.arretTemps * battement) {
      segments.push({ start: segmentStart, end: k });
      segmentStart = k;
    }
  }
  if (paires.length > 0) segments.push({ start: segmentStart, end: paires.length });

  // Compute base latency for each segment
  const segmentBases = segments.map((seg) => {
    const segPairs = paires.slice(seg.start, seg.end);
    const memes = segPairs.filter((p) => p.a.midi === p.j.midi);
    const baseOffsets = (memes.length ? memes : segPairs).map((p) => p.j.tMs - p.a.tMs);
    return medianeEcoute(baseOffsets);
  });

  const L = segmentBases[0] || 0;

  // Detect stops (new segments after the first one)
  const arrets = [];
  for (let k = 1; k < segments.length; k++) {
    const pIdx = segments[k].start;
    if (!arrets.includes(paires[pIdx].a.mesure + 1)) {
      arrets.push(paires[pIdx].a.mesure + 1);
    }
  }

  // Compute notes with per-segment bases
  const notes = attendues.map(() => ({ etat: 'manquee', jouee: null, ecartMs: null }));
  for (let pIdx = 0; pIdx < paires.length; pIdx++) {
    const p = paires[pIdx];
    const segmentIdx = segments.findIndex((seg) => pIdx >= seg.start && pIdx < seg.end);
    const segmentBase = segmentBases[segmentIdx];
    const ecartMs = Math.round(offsets[pIdx] - segmentBase);
    const bonne = p.a.midi === p.j.midi;
    notes[p.i] = { etat: !bonne ? 'fausse' : Math.abs(ecartMs) > regles.toleranceDecaleMs ? 'decale' : 'juste', jouee: p.j.midi, ecartMs };
  }
  const enTrop = restes.reverse().map((j) => ({ tMs: joues[j].tMs, midi: joues[j].midi, pos: Math.max(0, Math.round(((joues[j].tMs - L) / battement) * U)) }));
  const bons = notes.filter((x) => x.etat === 'juste' || x.etat === 'decale');
  const justes = bons.length;
  const decalees = notes.filter((x) => x.etat === 'decale').length;
  const rienEntendu = m === 0;
  const parasites = enTrop.length > 0.5 * n;
  const compte = !rienEntendu && !parasites;
  return {
    notes, enTrop, justes, decalees, total: n, latenceMs: Math.round(L),
    ecartMedianMs: bons.length ? Math.round(medianeEcoute(bons.map((x) => Math.abs(x.ecartMs)))) : null,
    arrets, compte, rienEntendu, parasites,
    reussi: compte && n > 0 && justes / n >= regles.tauxReussite && arrets.length === 0 && decalees / n <= regles.decaleesMax,
  };
}

// Micro : une trame toutes les 15 ms. Pas de contrôle automatique du gain : il écraserait l'attaque des notes.
export function creerEcoute({ getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices), Contexte = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  if (!getUserMedia || !Contexte) return null;
  let ctx = null; let flux = null; let analyseur = null; let minuteur = null; let trames = [];
  let ouverture = null; // ouvrir() en cours : évite deux contextes/flux si appelé deux fois avant résolution
  return {
    ouvrir() {
      if (analyseur) return Promise.resolve();
      if (!ouverture) {
        ouverture = (async () => {
          // Créer l'AudioContext avant l'await (synchrone, dans le geste de l'élève) : iOS refuse
          // de le laisser démarrer le son plus tard, hors du geste.
          const nouveauCtx = new Contexte();
          let nouveauFlux;
          try {
            nouveauFlux = await getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
          } catch (e) {
            nouveauCtx.close().catch(() => {});
            throw e;
          }
          ctx = nouveauCtx; flux = nouveauFlux;
          if (ctx.state === 'suspended') await ctx.resume();
          analyseur = ctx.createAnalyser();
          analyseur.fftSize = 1024;
          ctx.createMediaStreamSource(flux).connect(analyseur);
        })().finally(() => { ouverture = null; });
      }
      return ouverture;
    },
    demarrer(onTrame = () => {}) {
      this.arreter();
      trames = [];
      const buf = new Float32Array(analyseur.fftSize);
      minuteur = setInterval(() => {
        analyseur.getFloatTimeDomainData(buf);
        const t = trameDe(buf, ctx.sampleRate, performance.now());
        trames.push(t);
        onTrame(t);
      }, 15);
    },
    trames() { return [...trames]; },
    estOuvert() { return !!analyseur; },
    arreter() { if (minuteur) { clearInterval(minuteur); minuteur = null; } return [...trames]; },
    fermer() {
      this.arreter();
      if (flux) for (const p of flux.getTracks()) p.stop();
      flux = null; analyseur = null;
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    },
  };
}

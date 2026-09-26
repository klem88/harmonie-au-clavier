// Déchiffrage mains ensemble : une courte pièce à deux mains sur une grande portée, tirée d'une graine.
// Main droite en clé de sol (règles de piece.js), main gauche en clé de fa, en position de cinq doigts sur la
// tonique à l'octave 3. Une harmonie (I, IV, V) par mesure relie les deux mains. Pur, sans DOM.

import { note, gammeMajeure, armure } from './theorie.js';
import { cellule, U } from './rythme.js';
import { NIVEAUX_PIECE, MESURES_PIECE, generateurAlea, melodieValide, choisirDans, tirerPas, noteDuDegre } from './piece.js';

const P1 = NIVEAUX_PIECE[1]; const P2 = NIVEAUX_PIECE[2]; const P3 = NIVEAUX_PIECE[3];
const GAUCHE_NOIRES = { 4: ['n n n n', 'b n n', 'n n b', 'n b n', 'b b'], 3: ['n n n', 'b n', 'n b', 'b.'] };

// sautMax en degrés (2 = tierce, 3 = quarte, 4 = quinte).
export const NIVEAUX_ENSEMBLE = {
  1: {
    tonalites: ['C'], temps: [4], droite: { rythmes: P1.rythmes, finales: P1.finales, sautMax: 2 },
    gauche: { rythmes: { 4: ['r', 'b b'] }, sautMax: 4 }, basseTemps1: true, complementaire: false,
  },
  2: {
    tonalites: ['C', 'G', 'F', 'D'], temps: [4], droite: { rythmes: P2.rythmes, finales: P2.finales, sautMax: 3 },
    gauche: { rythmes: GAUCHE_NOIRES, sautMax: 2 }, basseTemps1: true, complementaire: false,
  },
  3: {
    tonalites: ['C', 'G', 'F', 'D'], temps: [3, 4],
    droite: { rythmes: { 4: P2.rythmes[4], 3: P3.rythmes[3] }, finales: { 4: P2.finales[4], 3: P3.finales[3] }, sautMax: 3 },
    gauche: { rythmes: GAUCHE_NOIRES, sautMax: 3 }, basseTemps1: false, complementaire: true,
  },
};

// Degrés de chaque accord (modulo 7), sa basse et sa quinte, dans la position de la main gauche.
export const ACCORDS_ENSEMBLE = {
  I: { notes: [0, 2, 4], basse: 0, quinte: 4 },
  IV: { notes: [0, 3, 5], basse: 3, quinte: 0 },
  V: { notes: [1, 4, 6], basse: 4, quinte: 1 },
};
// Demi-tons modulo l'octave permis entre deux attaques simultanées : ni seconde, quarte, triton, septième,
// ni octave ou unisson (la note du haut n'aurait aucun harmonique à elle : l'écoute ne pourrait pas la juger).
export const CONSONANCES = [3, 4, 7, 8, 9];
const mod7 = (d) => ((d % 7) + 7) % 7;
const tempsFort = (pos, temps) => pos % (temps === 4 ? 2 * U : 3 * U) === 0;

function rythmesMain(texteParMesure, temps) {
  const evs = [];
  texteParMesure.forEach((texte, m) => {
    for (const e of cellule(texte, { temps }).evenements) evs.push({ pos: m * temps * U + e.pos, duree: e.d, token: e.token, mesure: m });
  });
  return evs;
}

// Marche aléatoire sur les degrés 0..4 (la position de cinq doigts) ; `permis(i, x)` filtre chaque degré.
function marche(r, n, sautMax, { premier, dernier, permis }) {
  const degres = [choisirDans(r, premier.filter((x) => permis(0, x)))];
  if (degres[0] === undefined) return null;
  for (let i = 1; i < n; i++) {
    if (i === n - 1) { if (!permis(i, dernier)) return null; degres.push(dernier); break; }
    let ok = false;
    for (let k = 0; k < 30; k++) {
      const x = degres[i - 1] + tirerPas(r, sautMax);
      if (x >= 0 && x <= 4 && permis(i, x)) { degres.push(x); ok = true; break; }
    }
    if (!ok) return null;
  }
  return degres;
}

// Complémentaires : hors premier temps, au moins autant de temps où une seule main attaque que de temps où les deux attaquent.
export function mesureComplementaire(texteD, texteG, temps) {
  const attaques = (t) => new Set(cellule(t, { temps }).evenements.map((e) => e.pos));
  const a = attaques(texteD); const b = attaques(texteG);
  let une = 0; let deux = 0;
  for (let p = U; p < temps * U; p += U) {
    if (a.has(p) && b.has(p)) deux++;
    else if (a.has(p) || b.has(p)) une++;
  }
  return une >= deux;
}

// Une cellule rythmique par mesure et par main ; la main gauche tient la tonique dans la dernière mesure.
function rythmesPiece(r, cfg, temps) {
  const textesD = []; const textesG = [];
  for (let m = 0; m < MESURES_PIECE; m++) {
    const derniere = m === MESURES_PIECE - 1;
    let d; let g;
    for (let k = 0; k < 50; k++) {
      d = choisirDans(r, derniere ? cfg.droite.finales[temps] : cfg.droite.rythmes[temps]);
      g = derniere ? (temps === 4 ? 'r' : 'b.') : choisirDans(r, cfg.gauche.rythmes[temps]);
      if (derniere || !cfg.complementaire || mesureComplementaire(d, g, temps)) break;
    }
    textesD.push(d); textesG.push(g);
  }
  return [textesD, textesG];
}

export function genererPieceEnsemble(niveau, graine) {
  const cfg = NIVEAUX_ENSEMBLE[niveau];
  if (!cfg) throw new Error(`Niveau mains ensemble inconnu : ${niveau}`);
  const r = generateurAlea(graine);
  const tonalite = choisirDans(r, cfg.tonalites);
  const temps = choisirDans(r, cfg.temps);
  const tonique = note(tonalite);
  const gamme = gammeMajeure(tonique);
  for (let essai = 0; essai < 500; essai++) {
    const harmonies = ['I', choisirDans(r, ['I', 'IV', 'V']), choisirDans(r, ['IV', 'V']), 'I'];
    const accordDe = (ev) => ACCORDS_ENSEMBLE[harmonies[ev.mesure]];
    const [textesD, textesG] = rythmesPiece(r, cfg, temps);
    const evD = rythmesMain(textesD, temps);
    const evG = rythmesMain(textesG, temps);
    // Main droite : temps forts dans l'accord.
    const degD = marche(r, evD.length, cfg.droite.sautMax, {
      premier: [0, 2, 4], dernier: 0,
      permis: (i, x) => {
        const ev = evD[i];
        if (tempsFort(ev.pos, temps) && !accordDe(ev).notes.includes(mod7(x))) return false;
        // E1, E2 : la main gauche joue la basse au temps 1 ; pas d'octave avec elle
        return !(cfg.basseTemps1 && ev.pos % (temps * U) === 0 && mod7(x) === accordDe(ev).basse);
      },
    });
    if (!degD) continue;
    const droite = degD.map((d, i) => ({ ...noteDuDegre(tonique, gamme, d, 4), ...evD[i], degre: d }));
    if (!melodieValide(degD, droite.map((x) => x.midi), cfg.droite.sautMax)) continue;
    const droiteA = new Map(droite.map((x) => [x.pos, x]));
    // Main gauche : temps 1 = basse (E1, E2) ou note de l'accord (E3), consonance avec la main droite.
    const essaiGauche = () => marche(r, evG.length, cfg.gauche.sautMax, {
      premier: cfg.basseTemps1 ? [accordDe(evG[0]).basse] : accordDe(evG[0]).notes.filter((x) => x <= 4),
      dernier: 0,
      permis: (i, x) => {
        const ev = evG[i]; const acc = accordDe(ev);
        const debutMesure = ev.pos % (temps * U) === 0;
        if (debutMesure && cfg.basseTemps1 && x !== acc.basse) return false;
        if (debutMesure && !acc.notes.includes(mod7(x))) return false;
        if (niveau === 1 && !debutMesure && x !== acc.basse && x !== acc.quinte) return false;
        const d = droiteA.get(ev.pos);
        return !d || CONSONANCES.includes((d.midi - noteDuDegre(tonique, gamme, x, 3).midi) % 12);
      },
    });
    let degG = null;
    for (let k = 0; k < 20 && !degG; k++) {
      degG = essaiGauche();
      if (degG && !melodieValide(degG, degG.map((d) => noteDuDegre(tonique, gamme, d, 3).midi), cfg.gauche.sautMax)) degG = null;
    }
    if (!degG) continue;
    const gauche = degG.map((d, i) => ({ ...noteDuDegre(tonique, gamme, d, 3), ...evG[i], degre: d }));
    return { niveau, graine, main: 'ensemble', tonalite, tonique, armure: armure(tonique).nombre, temps, mesures: MESURES_PIECE, harmonies, droite, gauche };
  }
  throw new Error(`Pièce mains ensemble impossible à générer (niveau ${niveau}, graine ${graine})`);
}

// Notes des deux mains avec leur main, leur instant (en ms) et leur durée (en ms).
export function notesAttenduesEnsemble(piece, bpm) {
  const parUnite = 60000 / bpm / U;
  return ['droite', 'gauche'].flatMap((main) => piece[main].map((n, i) => ({
    main, i, midi: n.midi, pos: n.pos, duree: n.duree, mesure: n.mesure,
    tMs: Math.round(n.pos * parUnite), dureeMs: Math.round(n.duree * parUnite),
  })));
}
// Un instant par position où au moins une main attaque.
export function instantsAttendus(notes) {
  const parPos = new Map();
  for (const n of notes) if (!parPos.has(n.pos)) parPos.set(n.pos, { pos: n.pos, tMs: n.tMs, mesure: n.mesure, midi: 0 });
  return [...parPos.values()].sort((a, b) => a.pos - b.pos);
}

// Lecture de l'exemple (« Écouter la pièce ») : les deux mains superposées.
export function notesAJouer(piece, bpm) {
  return notesAttenduesEnsemble(piece, bpm).map((n) => ({ midi: n.midi, debutMs: n.tMs, dureeMs: n.dureeMs }));
}

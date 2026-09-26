# Déchiffrage mains ensemble · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ajouter à l'app « Harmonie au clavier » un troisième parcours de déchiffrage, mains ensemble : pièces
générées sur une grande portée, écoute au micro qui vérifie les notes attendues, correction indicative confirmée
par l'élève.

**Architecture:** `src/ensemble.js` génère les pièces (harmonie I-IV-V, main gauche en position de cinq doigts à
l'octave 3) ; `src/verification.js` juge chaque note attendue sur la montée de ses harmoniques dans le spectre,
en masquant ceux qu'elle partage avec une note attaquée au même instant ; `ecoute.js` fournit les attaques
d'énergie et l'alignement temporel existant ; `partition.js` dessine la grande portée ; `dechiffrage.js` porte le
parcours `ensemble` ; `interface.js` relie le tout (confirmation avant enregistrement).

**Tech Stack:** JavaScript sans framework (modules ES), Web Audio (`AnalyserNode`), tests `node --test`,
`node build.mjs` → `dist/index.html` (GitHub Pages via `git push` sur `main`).

**Spec:** `docs/2026-09-26-dechiffrage-ensemble-design.md` (à lire avant de commencer).

**Origine du code :** tout le code ci-dessous a été écrit et vérifié dans un prototype (copie de `src/` et
`tests/`) : 148 tests verts, build sans doublon, et une pièce jouée au micro simulé dans le navigateur corrigée
19/19 justes. Recopier exactement ; ne pas « améliorer » en route.

## Global Constraints

- Répertoire de travail : `08-harmonie-app/` (dépôt git, branche `main`). Ne jamais pousser la branche `historique-local`.
- Aucune dépendance : pas de `npm install`, pas de paquet.
- `build.mjs` concatène tous les modules dans une seule portée : **aucun nom de haut niveau (function, const, let,
  class) ne doit apparaître dans deux fichiers de `src/`** (le build échoue sinon). Ordre final :
  `['theorie', 'rythme', 'portee', 'voix', 'piece', 'ensemble', 'partition', 'ecoute', 'verification', 'questions', 'dechiffrage', 'progression', 'stockage', 'clavier', 'audio', 'interface']`.
- Code, commentaires, messages et noms en français, dans le style des fichiers voisins (commentaires courts, `const`, fonctions fléchées).
- Seuils de départ : `REGLES_ECOUTE.ensemble = { montee: 2, domine: 1.5, monteeManquee: 1.3, plancherRelatif: 0.01, harmoniquesMin: 2, douteusesMax: 0.3 }`.
- Parcours ensemble : départ 50 à la noire, bornes 50–96, pas de 6 ; ouvert quand les deux mains sont au niveau 2 ; E2 demande en plus le niveau 3 des deux mains.
- Consonances permises entre attaques simultanées : 3, 4, 7, 8, 9 demi-tons (jamais d'octave ni d'unisson).
- Tests : `node --test tests/*.test.mjs` (tous verts à la fin de chaque tâche). Les tests d'écoute synthétique prennent ~20 s.
- Messages de commit en français, terminés par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Générateur de pièces mains ensemble

**Files:**
- Modify: `src/piece.js` (exporter trois aides)
- Modify: `build.mjs` (ajouter `'ensemble'` après `'piece'` dans `ORDRE`)
- Create: `src/ensemble.js`
- Test: `tests/ensemble.test.mjs`

**Interfaces:**
- Consumes (`src/piece.js`) : `NIVEAUX_PIECE`, `MESURES_PIECE`, `generateurAlea(graine)`, `melodieValide(degres, midis, sautMax)`, et, une fois exportés : `choisirDans(r, tab)`, `tirerPas(r, sautMax)`, `noteDuDegre(tonique, gamme, d, octaveBase) → { note, octave, midi }`.
- Produces :
  - `genererPieceEnsemble(niveau, graine) → { niveau, graine, main: 'ensemble', tonalite, tonique, armure, temps, mesures, harmonies: ['I', …], droite: [note], gauche: [note] }`, note = `{ note, octave, midi, pos, duree, token, mesure, degre }` (`pos`, `duree` en unités de 12 par temps).
  - `NIVEAUX_ENSEMBLE`, `ACCORDS_ENSEMBLE`, `CONSONANCES`, `mesureComplementaire(texteD, texteG, temps) → bool`.
  - `notesAttenduesEnsemble(piece, bpm) → [{ main, i, midi, pos, duree, mesure, tMs, dureeMs }]` (main droite puis main gauche).
  - `instantsAttendus(notes) → [{ pos, tMs, mesure, midi: 0 }]` (une entrée par position attaquée, triée).
  - `notesAJouer(piece, bpm) → [{ midi, debutMs, dureeMs }]`.

- [ ] **Step 1: Écrire le test**

Créer `tests/ensemble.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererPieceEnsemble, NIVEAUX_ENSEMBLE, ACCORDS_ENSEMBLE, CONSONANCES, mesureComplementaire, notesAttenduesEnsemble, instantsAttendus, notesAJouer } from '../src/ensemble.js';
import { U } from '../src/rythme.js';
import { note, midi } from '../src/theorie.js';

const GRAINES = Array.from({ length: 500 }, (_, i) => i * 7919 + 13);
const mod7 = (d) => ((d % 7) + 7) % 7;
const tempsFort = (pos, temps) => pos % (temps === 4 ? 2 * U : 3 * U) === 0;

test('même graine, même pièce ; graines différentes, pièces variées', () => {
  assert.deepEqual(genererPieceEnsemble(2, 42), genererPieceEnsemble(2, 42));
  const formes = new Set(GRAINES.slice(0, 20).map((g) => JSON.stringify(genererPieceEnsemble(1, g).droite.map((n) => [n.midi, n.duree]))));
  assert.ok(formes.size >= 15, `seulement ${formes.size} pièces différentes sur 20`);
});

test('niveau inconnu : erreur', () => {
  assert.throws(() => genererPieceEnsemble(9, 1), /Niveau mains ensemble inconnu/);
});

for (const niveau of [1, 2, 3]) {
  test(`E${niveau} : règles respectées sur 500 graines`, () => {
    const cfg = NIVEAUX_ENSEMBLE[niveau];
    const vus = new Set();
    for (const g of GRAINES) {
      const p = genererPieceEnsemble(niveau, g);
      vus.add(`${p.tonalite}${p.temps}`);
      assert.equal(p.main, 'ensemble');
      assert.ok(cfg.tonalites.includes(p.tonalite) && cfg.temps.includes(p.temps));
      assert.equal(p.harmonies[0], 'I'); assert.equal(p.harmonies[3], 'I');
      assert.ok(['IV', 'V'].includes(p.harmonies[2]));
      const mesureU = p.temps * U;
      const tonique4 = midi(note(p.tonalite), 4); const tonique3 = tonique4 - 12;
      for (const main of ['droite', 'gauche']) {
        for (let m = 0; m < p.mesures; m++) {
          const dans = p[main].filter((n) => n.mesure === m);
          assert.equal(dans.reduce((s, n) => s + n.duree, 0), mesureU, `graine ${g} ${main} mesure ${m} incomplète`);
        }
      }
      // main droite : position, temps forts dans l'accord, fin sur la tonique en valeur longue
      for (const n of p.droite) {
        assert.ok(n.midi >= tonique4 && n.midi <= tonique4 + 7, `graine ${g} : ${n.midi} hors position (droite)`);
        if (tempsFort(n.pos, p.temps)) assert.ok(ACCORDS_ENSEMBLE[p.harmonies[n.mesure]].notes.includes(mod7(n.degre)), `graine ${g} : temps fort hors accord`);
      }
      assert.equal(p.droite.at(-1).midi, tonique4);
      assert.ok(p.droite.at(-1).duree >= 2 * U);
      // main gauche : position de cinq doigts sur la tonique à l'octave 3, au-dessus de do3
      for (const n of p.gauche) {
        assert.ok(n.midi >= tonique3 && n.midi <= tonique3 + 7 && n.midi >= 48, `graine ${g} : ${n.midi} hors position (gauche)`);
        assert.ok(n.duree >= U, `graine ${g} : croche à la main gauche`);
        if (n.pos % mesureU === 0) {
          const acc = ACCORDS_ENSEMBLE[p.harmonies[n.mesure]];
          if (cfg.basseTemps1) assert.equal(n.degre, acc.basse, `graine ${g} : temps 1 sans la basse`);
          else assert.ok(acc.notes.includes(mod7(n.degre)), `graine ${g} : temps 1 hors accord`);
        }
      }
      const derniere = p.gauche.at(-1);
      assert.equal(derniere.midi, tonique3);
      assert.equal(derniere.pos, (p.mesures - 1) * mesureU);
      assert.equal(derniere.duree, mesureU);
      // attaques simultanées : consonance, jamais d'octave
      const droiteA = new Map(p.droite.map((n) => [n.pos, n]));
      for (const n of p.gauche) {
        const d = droiteA.get(n.pos);
        if (d) assert.ok(CONSONANCES.includes((d.midi - n.midi) % 12), `graine ${g} : ${d.midi}/${n.midi} dissonant ou à l'octave`);
      }
      if (niveau === 1) for (const n of p.gauche) assert.ok(['r', 'b'].includes(n.token));
      if (cfg.complementaire) {
        for (let m = 0; m < p.mesures - 1; m++) {
          const texte = (main) => p[main].filter((n) => n.mesure === m).map((n) => n.token).join(' ');
          assert.ok(mesureComplementaire(texte('droite'), texte('gauche'), p.temps), `graine ${g} mesure ${m} : pas complémentaire`);
        }
      }
    }
    assert.ok(vus.size >= Math.min(3, cfg.tonalites.length * cfg.temps.length), `variété : ${[...vus]}`);
  });
}

test('mesureComplementaire : une main tient pendant que l\'autre bouge', () => {
  assert.equal(mesureComplementaire('b b', 'n n n n', 4), true);   // temps 2, 4 : gauche seule ; 3 : les deux
  assert.equal(mesureComplementaire('n n n n', 'n n n n', 4), false);
  assert.equal(mesureComplementaire('b n', 'n n n', 3), true);
});

test('notes attendues, instants et notes à jouer', () => {
  const p = genererPieceEnsemble(1, 13);
  const notes = notesAttenduesEnsemble(p, 60);
  assert.equal(notes.length, p.droite.length + p.gauche.length);
  const g0 = notes.find((n) => n.main === 'gauche' && n.i === 0);
  assert.deepEqual([g0.tMs, g0.midi], [0, p.gauche[0].midi]);
  assert.equal(g0.dureeMs, Math.round(p.gauche[0].duree * 1000 / U));
  const inst = instantsAttendus(notes);
  assert.equal(new Set(inst.map((x) => x.pos)).size, inst.length);
  for (let k = 1; k < inst.length; k++) assert.ok(inst[k].pos > inst[k - 1].pos);
  assert.deepEqual(new Set(inst.map((x) => x.pos)), new Set(notes.map((n) => n.pos)));
  assert.deepEqual(notesAJouer(p, 60)[0], { midi: notes[0].midi, debutMs: notes[0].tMs, dureeMs: notes[0].dureeMs });
});
```

- [ ] **Step 2: Vérifier qu'il échoue**

Run: `node --test tests/ensemble.test.mjs`
Expected: FAIL (`Cannot find module '../src/ensemble.js'`).

- [ ] **Step 3: Exporter les aides de `piece.js`**

Dans `src/piece.js`, ajouter `export` devant trois déclarations (rien d'autre ne change) :

```diff
--- a/src/piece.js
+++ b/src/piece.js
@@ -42,11 +42,11 @@
     return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
 }
-const choisirDans = (r, tab) => tab[Math.floor(r() * tab.length)];
+export const choisirDans = (r, tab) => tab[Math.floor(r() * tab.length)];
 
 // [pas en degrés, poids] : surtout des degrés conjoints, quelques sauts.
 const PAS_MELODIE = [[1, 6], [-1, 6], [0, 1], [2, 3], [-2, 3], [3, 1], [-3, 1], [4, 1], [-4, 1]];
-function tirerPas(r, sautMax) {
+export function tirerPas(r, sautMax) {
   const possibles = PAS_MELODIE.filter(([p]) => Math.abs(p) <= sautMax);
   let x = r() * possibles.reduce((s, [, w]) => s + w, 0);
   for (const [p, w] of possibles) { x -= w; if (x < 0) return p; }
@@ -69,7 +69,7 @@
 export const MAINS = { droite: { cle: 'sol', octave: 4 }, gauche: { cle: 'fa', octave: 3 } };
 
 // Degré 0 = tonique à l'octave de base (4 main droite, 3 main gauche) ; 7 = tonique à l'octave au-dessus.
-function noteDuDegre(tonique, gamme, d, octaveBase) {
+export function noteDuDegre(tonique, gamme, d, octaveBase) {
   const rang = LETTRES_PIECE.indexOf(tonique.lettre) + d;
   const n = gamme[((d % 7) + 7) % 7];
   const octave = octaveBase + Math.floor(rang / 7);
```

- [ ] **Step 4: Créer `src/ensemble.js`**

```js
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
```

- [ ] **Step 5: Ajouter le module au build**

Dans `build.mjs`, `ORDRE` : insérer `'ensemble'` juste après `'piece'`.

- [ ] **Step 6: Vérifier**

Run: `node --test tests/*.test.mjs`
Expected: PASS (tous les tests, dont les 7 de `ensemble.test.mjs`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Déchiffrage mains ensemble : générateur de pièces (grande portée, I-IV-V, consonances)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Écoute : attaques d'énergie, instant joué, capture du spectre

**Files:**
- Modify: `src/ecoute.js`
- Test: `tests/ecoute.test.mjs` (trois tests ajoutés à la fin)

**Interfaces:**
- Produces :
  - `REGLES_ECOUTE.ensemble` (valeurs des Global Constraints).
  - `detecterAttaques(trames, regles = REGLES_ECOUTE, { hauteur = true } = {})` : avec `{ hauteur: false }`, renvoie `[{ tMs, midi: 0 }]` pour chaque saut d'énergie, sans exiger de hauteur (trames `{ tMs, rms }` acceptées).
  - `aligner(...)` : chaque entrée de `notes` gagne `tJoueMs` (instant de l'attaque appariée, `null` si manquée).
  - `creerEcoute().demarrer(onTrame, { fMin, fftSize = 1024, fabriquer = null })` : avec `fabriquer`, lit aussi `getFloatFrequencyData` et appelle `fabriquer(signal, spectreDb, sampleRate, fftSize, tMs)` pour construire la trame.

- [ ] **Step 1: Écrire les tests**

Ajouter à la fin de `tests/ecoute.test.mjs` (partie `+` du correctif ci-dessous) :

```diff
--- a/tests/ecoute.test.mjs
+++ b/tests/ecoute.test.mjs
@@ -240,3 +240,43 @@
   const r = aligner(ATT, bruit, { bpm: 60 });
   assert.equal(r.parasites, true); assert.equal(r.compte, false); assert.equal(r.reussi, false);
 });
+
+test("attaques d'énergie seules (mains ensemble) : une attaque par frappe, sans hauteur", () => {
+  const trames = simuler([300, 800, 1300].map((tMs, i) => ({ tMs, midi: [60, 64, 67][i] }))).map((x) => ({ tMs: x.tMs, rms: x.rms }));
+  assert.equal(detecterAttaques(trames).length, 0, 'sans hauteur, le mode une main ne retient rien');
+  const a = detecterAttaques(trames, REGLES_ECOUTE, { hauteur: false });
+  assert.deepEqual(a.map((x) => x.midi), [0, 0, 0]);
+  a.forEach((x, i) => assert.ok(proche(x.tMs, [300, 800, 1300][i], 15)));
+});
+
+test('aligner : instant réel de chaque note appariée (tJoueMs), null pour une manquée', () => {
+  const attendues = [0, 1000, 2000].map((tMs, i) => ({ tMs, midi: 60, mesure: 0 }));
+  const r = aligner(attendues, [{ tMs: 150, midi: 60 }, { tMs: 2140, midi: 60 }], { bpm: 60 });
+  assert.deepEqual(r.notes.map((n) => n.tJoueMs), [150, null, 2140]);
+});
+
+test("creerEcoute().demarrer({ fftSize, fabriquer }) : spectre lu et trame fabriquée par l'appelant", async () => {
+  const lus = [];
+  const analyseur = {
+    fftSize: 0, smoothingTimeConstant: 0.8,
+    getFloatTimeDomainData(b) { b.fill(0.5); },
+    getFloatFrequencyData(s) { s.fill(-30); lus.push(s.length); },
+  };
+  class FauxContexte {
+    constructor() { this.state = 'running'; this.sampleRate = 48000; }
+    createAnalyser() { return analyseur; }
+    createMediaStreamSource() { return { connect() {} }; }
+    close() { return Promise.resolve(); }
+  }
+  const ecoute = creerEcoute({ getUserMedia: async () => ({ getTracks: () => [] }), Contexte: FauxContexte });
+  await ecoute.ouvrir();
+  const recus = [];
+  ecoute.demarrer((t) => recus.push(t), { fftSize: 4096, fabriquer: (buf, spectre, sr, n, tMs) => ({ tMs, n: buf.length, db: spectre[0], sr, fft: n }) });
+  await new Promise((r) => setTimeout(r, 50));
+  const trames = ecoute.arreter();
+  assert.equal(analyseur.fftSize, 4096);
+  assert.equal(analyseur.smoothingTimeConstant, 0);
+  assert.ok(trames.length >= 1 && recus.length === trames.length);
+  assert.deepEqual([trames[0].n, trames[0].db, trames[0].sr, trames[0].fft], [4096, -30, 48000, 4096]);
+  assert.equal(lus[0], 2048);
+});
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `node --test tests/ecoute.test.mjs`
Expected: FAIL sur les trois nouveaux tests (attaques vides, `tJoueMs` indéfini, `fftSize` resté à 0).

- [ ] **Step 3: Modifier `src/ecoute.js`**

Enregistrer le correctif ci-dessous dans `../tache2-ecoute.patch` (hors du dépôt), puis depuis `08-harmonie-app/` :
`git apply --whitespace=nowarn ../tache2-ecoute.patch` ; en cas de refus, faire les mêmes modifications à la main
(les lignes `-` disparaissent, les lignes `+` apparaissent).

```diff
--- a/src/ecoute.js
+++ b/src/ecoute.js
@@ -11,6 +11,8 @@
   // une plage plus large n'y ajouterait que des erreurs d'octave.
   fMin: { droite: 180, gauche: 100 },
   toleranceDecaleMs: 120, arretTemps: 0.75, tauxReussite: 0.85, decaleesMax: 0.2,
+  // Mains ensemble (verification.js) : montée des harmoniques d'une note après son instant.
+  ensemble: { montee: 2, domine: 1.5, monteeManquee: 1.3, plancherRelatif: 0.01, harmoniquesMin: 2, douteusesMax: 0.3 },
 };
 
 function medianeEcoute(t) { const s = [...t].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
@@ -25,7 +27,8 @@
 // Une attaque = un saut d'énergie, ou (legato) une nouvelle hauteur stable sans saut d'énergie.
 // Sa hauteur = médiane des hauteurs mesurées entre +40 et +200 ms, avant l'attaque suivante.
 // Un bruit sans hauteur (clic, choc) n'est pas une note.
-export function detecterAttaques(trames, regles = REGLES_ECOUTE) {
+// { hauteur: false } : attaques d'énergie seules (mains ensemble), sans hauteur, midi 0.
+export function detecterAttaques(trames, regles = REGLES_ECOUTE, { hauteur: avecHauteur = true } = {}) {
   const { seuilRms, rapport, refractaireMs, fenetreHauteur: [de, a] } = regles;
   const hauteur = trames.map((x) => (x.f0 ? Math.round(midiDeFrequence(x.f0)) : null));
   const stableEn = (k) => (k + 2 < trames.length && hauteur[k] !== null && hauteur[k + 1] === hauteur[k] && hauteur[k + 2] === hauteur[k] ? hauteur[k] : null);
@@ -53,6 +56,7 @@
     if (courante === null && s !== null && t.tMs - dernier >= 30) courante = s;
     if (t.rms < seuilRms) courante = null;
   }
+  if (!avecHauteur) return debuts.map((k) => ({ tMs: Math.round(trames[k].tMs), midi: 0 }));
   const attaques = [];
   debuts.forEach((k, i) => {
     const t0 = trames[k].tMs;
@@ -136,14 +140,14 @@
   }
 
   // Compute notes with per-segment bases
-  const notes = attendues.map(() => ({ etat: 'manquee', jouee: null, ecartMs: null }));
+  const notes = attendues.map(() => ({ etat: 'manquee', jouee: null, ecartMs: null, tJoueMs: null }));
   for (let pIdx = 0; pIdx < paires.length; pIdx++) {
     const p = paires[pIdx];
     const segmentIdx = segments.findIndex((seg) => pIdx >= seg.start && pIdx < seg.end);
     const segmentBase = segmentBases[segmentIdx];
     const ecartMs = Math.round(offsets[pIdx] - segmentBase);
     const bonne = p.a.midi === p.j.midi;
-    notes[p.i] = { etat: !bonne ? 'fausse' : Math.abs(ecartMs) > regles.toleranceDecaleMs ? 'decale' : 'juste', jouee: p.j.midi, ecartMs };
+    notes[p.i] = { etat: !bonne ? 'fausse' : Math.abs(ecartMs) > regles.toleranceDecaleMs ? 'decale' : 'juste', jouee: p.j.midi, ecartMs, tJoueMs: p.j.tMs };
   }
   const enTrop = restes.reverse().map((j) => ({ tMs: joues[j].tMs, midi: joues[j].midi, pos: Math.max(0, Math.round(((joues[j].tMs - L) / battement) * U)) }));
   const bons = notes.filter((x) => x.etat === 'juste' || x.etat === 'decale');
@@ -189,13 +193,22 @@
       }
       return ouverture;
     },
-    demarrer(onTrame = () => {}, { fMin } = {}) {
+    // Une main : trame { tMs, rms, f0 } sur 1024 échantillons. Mains ensemble : `fabriquer(signal, spectreDb,
+    // sampleRate, fftSize, tMs)` construit la trame à partir du signal et du spectre (fftSize 4096).
+    demarrer(onTrame = () => {}, { fMin, fftSize = 1024, fabriquer = null } = {}) {
       this.arreter();
       trames = [];
+      analyseur.fftSize = fftSize;
+      analyseur.smoothingTimeConstant = 0;
       const buf = new Float32Array(analyseur.fftSize);
+      const spectre = fabriquer ? new Float32Array(analyseur.fftSize / 2) : null;
       minuteur = setInterval(() => {
         analyseur.getFloatTimeDomainData(buf);
-        const t = trameDe(buf, ctx.sampleRate, performance.now(), { fMin });
+        let t;
+        if (fabriquer) {
+          analyseur.getFloatFrequencyData(spectre);
+          t = fabriquer(buf, spectre, ctx.sampleRate, analyseur.fftSize, performance.now());
+        } else t = trameDe(buf, ctx.sampleRate, performance.now(), { fMin });
         trames.push(t);
         onTrame(t);
       }, 15);
```

- [ ] **Step 4: Vérifier**

Run: `node --test tests/*.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Écoute : attaques d'énergie seules, instant joué dans l'alignement, capture du spectre

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Vérification des notes attendues (spectre)

**Files:**
- Create: `src/verification.js`
- Create: `tests/son-synthetique.mjs` (outil de test : son de piano synthétique, FFT, trames)
- Test: `tests/verification.test.mjs`
- Modify: `build.mjs` (ajouter `'verification'` après `'ecoute'` dans `ORDRE`)

**Interfaces:**
- Consumes : `detecterAttaques`, `aligner`, `REGLES_ECOUTE` (Task 2) ; `notesAttenduesEnsemble`, `instantsAttendus` (Task 1).
- Produces :
  - `HARMONIQUES = 6`.
  - `candidatsPiece(piece) → number[]` (midis de la pièce ± 1, triés).
  - `trameEnsemble(signal, amplitudes, { sampleRate, fftSize }, candidats, tMs) → { tMs, rms, h: Float32Array(candidats.length × 6) }`.
  - `amplitudesDeDb(db) → Float32Array`.
  - `harmoniquesLibres(midi, autresMidis, largeurHz) → number[]`.
  - `proposer({ justes, decalees, douteuses, total, arrets }, regles?) → 'reussi' | 'pasEncore' | null`.
  - `verifierEnsemble(piece, trames, { bpm, candidats, largeurHz = 48000 / 4096, regles }) → { notes: { droite: [{ etat, ecartMs, montee, voisins }], gauche: [...] }, justes, decalees, fausses, manquees, douteuses, total, latenceMs, ecartMedianMs, arrets, compte, rienEntendu, parasites, propose }` ; `etat` ∈ `juste | decale | fausse | manquee | douteuse`.

- [ ] **Step 1: Créer l'outil de test `tests/son-synthetique.mjs`**

```js
// Outils de test : son de piano synthétique (fondamentale faible, harmoniques, extinction), FFT, trames mains ensemble.
import { trameEnsemble } from '../src/verification.js';

export const SR = 48000;
export const FFT = 4096;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const PARTIELS = [0.35, 1, 0.6, 0.45, 0.3, 0.2]; // le grave du piano et le micro du téléphone rendent mal la fondamentale

// evenements : [{ tMs, midi, dureeMs, gain = 1 }]
export function synthetiser(evenements, dureeMs) {
  const n = Math.round((dureeMs / 1000) * SR);
  const buf = new Float32Array(n);
  for (const e of evenements) {
    const d0 = Math.round((e.tMs / 1000) * SR);
    const fin = Math.min(n, Math.round(((e.tMs + e.dureeMs + 40) / 1000) * SR));
    const g = 0.08 * (e.gain ?? 1);
    for (let i = Math.max(0, d0); i < fin; i++) {
      const t = (i - d0) / SR;
      const attaque = Math.min(1, t / 0.005);
      const relache = t * 1000 > e.dureeMs ? Math.max(0, 1 - (t * 1000 - e.dureeMs) / 40) : 1;
      let v = 0;
      for (let k = 0; k < PARTIELS.length; k++) v += PARTIELS[k] * Math.sin(2 * Math.PI * hz(e.midi) * (k + 1) * t);
      buf[i] += g * attaque * relache * Math.exp(-t / 0.6) * v;
    }
  }
  return buf;
}

// Spectre d'amplitude (fenêtre de Blackman, comme l'AnalyserNode), fftSize / 2 cases.
export function amplitudes(bloc) {
  const N = bloc.length;
  const re = new Float64Array(N); const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = bloc[i] * (0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k); const wi = Math.sin(ang * k);
        const ur = re[i + k]; const ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
  const a = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) a[i] = Math.hypot(re[i], im[i]) / N;
  return a;
}

// Trames toutes les 15 ms, comme creerEcoute en mode mains ensemble.
export function tramesDe(signal, candidats, { pas = 15 } = {}) {
  const trames = [];
  for (let t = 0; ; t += pas) {
    const fin = Math.round((t / 1000) * SR);
    if (fin > signal.length) break;
    const bloc = new Float32Array(FFT);
    const de = fin - FFT;
    for (let i = 0; i < FFT; i++) bloc[i] = de + i >= 0 ? signal[de + i] : 0;
    trames.push(trameEnsemble(bloc, amplitudes(bloc), { sampleRate: SR, fftSize: FFT }, candidats, t));
  }
  return trames;
}
```

- [ ] **Step 2: Écrire le test**

Créer `tests/verification.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatsPiece, amplitudesDeDb, harmoniquesLibres, trameEnsemble, verifierEnsemble, proposer, HARMONIQUES } from '../src/verification.js';
import { genererPieceEnsemble, notesAttenduesEnsemble } from '../src/ensemble.js';
import { synthetiser, tramesDe, amplitudes, SR, FFT } from './son-synthetique.mjs';

const LARGEUR = SR / FFT;
const BPM = 60;
const PIECE = genererPieceEnsemble(1, 13); // droite 67,65,64,62,64,64,64,62,60,62,60,64,60 · gauche 48,48,53,53,48
const CANDIDATS = candidatsPiece(PIECE);

// Joue la pièce (retard constant de 150 ms) ; `modif` change ou retire (null) une note attendue.
function ecouter(piece, modif = (n) => n, { pauseApres = null } = {}) {
  const evs = [];
  for (const n of notesAttenduesEnsemble(piece, BPM)) {
    const m = modif(n);
    if (!m) continue;
    const pause = pauseApres !== null && n.tMs > pauseApres ? 2000 : 0;
    evs.push({ tMs: m.tMs + 650 + pause, midi: m.midi, dureeMs: m.dureeMs });
  }
  const trames = tramesDe(synthetiser(evs, 16000 + 3500), CANDIDATS).map((x) => ({ ...x, tMs: x.tMs - 500 }));
  return verifierEnsemble(piece, trames, { bpm: BPM, candidats: CANDIDATS, largeurHz: LARGEUR });
}
const etats = (l) => l.map((x) => x.etat).join(' ');

test('candidats : notes de la pièce et demi-tons voisins, triés', () => {
  assert.deepEqual(candidatsPiece({ droite: [{ midi: 60 }, { midi: 64 }], gauche: [{ midi: 48 }] }), [47, 48, 49, 59, 60, 61, 63, 64, 65]);
});

test('amplitudesDeDb : dB vers amplitude linéaire, -Infinity vers 0', () => {
  assert.deepEqual([...amplitudesDeDb(new Float32Array([0, -20, -Infinity]))].map((x) => Math.round(x * 1000) / 1000), [1, 0.1, 0]);
});

test('harmoniques utiles : assez aigus pour séparer le demi-ton, sans ceux d\'une note attaquée en même temps', () => {
  assert.deepEqual(harmoniquesLibres(72, [], LARGEUR), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(harmoniquesLibres(48, [], LARGEUR), [4, 5, 6]);      // do3 : les trois premiers sont trop proches du voisin
  assert.deepEqual(harmoniquesLibres(48, [67], LARGEUR), [4, 5]);       // sol4 = 3e harmonique de do3 : 6 (sol5) est pris
  assert.deepEqual(harmoniquesLibres(64, [48], LARGEUR), [3, 4, 5, 6]); // mi5 = 5e harmonique de do3 : 2 est pris
});

test('trameEnsemble : énergie des 1024 derniers échantillons, harmoniques de chaque candidat', () => {
  const sig = synthetiser([{ tMs: 0, midi: 60, dureeMs: 1000 }], 200);
  const bloc = sig.slice(sig.length - FFT);
  const t = trameEnsemble(bloc, amplitudes(bloc), { sampleRate: SR, fftSize: FFT }, [59, 60, 61], 42);
  assert.equal(t.tMs, 42);
  assert.ok(t.rms > 0.01);
  assert.equal(t.h.length, 3 * HARMONIQUES);
  const moy = (c) => t.h.slice(c * HARMONIQUES + 1, (c + 1) * HARMONIQUES).reduce((s, x) => s + x, 0);
  assert.ok(moy(1) > 3 * moy(0) && moy(1) > 3 * moy(2), 'do4 ressort au-dessus de si3 et do♯4');
});

test('pièce jouée juste, avec un retard constant : tout est juste, réussite proposée', () => {
  const r = ecouter(PIECE);
  assert.equal(etats(r.notes.droite), Array(PIECE.droite.length).fill('juste').join(' '));
  assert.equal(etats(r.notes.gauche), Array(PIECE.gauche.length).fill('juste').join(' '));
  assert.ok(Math.abs(r.latenceMs - 150) <= 20, `latence ${r.latenceMs}`);
  assert.deepEqual([r.justes, r.total, r.douteuses, r.arrets.length, r.compte, r.propose], [18, 18, 0, 0, true, 'reussi']);
});

test('fausse note à la main gauche (un demi-ton au-dessus) : fausse', () => {
  const r = ecouter(PIECE, (n) => (n.main === 'gauche' && n.i === 1 ? { ...n, midi: n.midi + 1 } : n));
  assert.equal(r.notes.gauche[1].etat, 'fausse');
  assert.equal(r.notes.gauche[0].etat, 'juste');
  assert.equal(r.fausses, 1);
});

test('note oubliée à la main droite : manquée', () => {
  const r = ecouter(PIECE, (n) => (n.main === 'droite' && n.i === 3 ? null : n));
  assert.equal(r.notes.droite[3].etat, 'manquee');
  assert.equal(r.manquees, 1);
});

test('arrêt de deux secondes au milieu : arrêt signalé, pas de réussite proposée', () => {
  const r = ecouter(PIECE, undefined, { pauseApres: 7000 });
  assert.ok(r.arrets.length >= 1, `arrêts ${r.arrets}`);
  assert.equal(r.propose, 'pasEncore');
});

test('silence : rien entendu, la pièce ne compte pas', () => {
  const trames = tramesDe(new Float32Array(SR * 2), CANDIDATS);
  const r = verifierEnsemble(PIECE, trames, { bpm: BPM, candidats: CANDIDATS, largeurHz: LARGEUR });
  assert.equal(r.rienEntendu, true);
  assert.equal(r.compte, false);
});

test('verdict proposé : douteuses retirées du calcul, aucune proposition au-delà de 30 % de douteuses', () => {
  const base = { justes: 17, decalees: 0, douteuses: 0, total: 20, arrets: [] };
  assert.equal(proposer(base), 'reussi');                                   // 17/20 = 85 %
  assert.equal(proposer({ ...base, justes: 16 }), 'pasEncore');             // 80 %
  assert.equal(proposer({ ...base, justes: 14, douteuses: 3 }), 'pasEncore'); // 14/17 jugées = 82 %
  assert.equal(proposer({ ...base, justes: 15, douteuses: 3 }), 'reussi');  // 15/17 = 88 %
  assert.equal(proposer({ ...base, arrets: [3] }), 'pasEncore');
  assert.equal(proposer({ ...base, decalees: 5 }), 'pasEncore');            // 25 % décalées
  assert.equal(proposer({ ...base, douteuses: 7 }), null);                  // 35 % douteuses
  assert.equal(proposer({ ...base, total: 0 }), null);
});
```

- [ ] **Step 3: Vérifier qu'il échoue**

Run: `node --test tests/verification.test.mjs`
Expected: FAIL (`Cannot find module '../src/verification.js'`).

- [ ] **Step 4: Créer `src/verification.js`**

```js
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
```

- [ ] **Step 5: Ajouter le module au build**

Dans `build.mjs`, `ORDRE` : insérer `'verification'` juste après `'ecoute'`.

- [ ] **Step 6: Vérifier**

Run: `node --test tests/*.test.mjs`
Expected: PASS (les tests de `verification.test.mjs` prennent ~20 s : synthèse et FFT en JavaScript).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Écoute mains ensemble : vérification des notes attendues par leurs harmoniques

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Grande portée

**Files:**
- Modify: `src/partition.js` (remplacé en entier : le rendu à une main est inchangé, découpé en `entetePortee` et `notesPortee`)
- Test: `tests/partition.test.mjs` (import + trois tests ajoutés)

**Interfaces:**
- Consumes : `genererPieceEnsemble` (Task 1).
- Produces :
  - `geometriePartition(piece)` : `basPortee(ligne, main = 'droite')` (`'gauche'` = portée de fa, 100 px sous celle de sol, pour une pièce ensemble) ; champ `ensemble` (booléen).
  - `curseurA(geo, pos)` : couvre les deux portées d'une pièce ensemble.
  - `partitionSvg(piece, { marques })` : `marques` = liste (une main) ou `{ droite: [...], gauche: [...] }` (ensemble) ; classes nouvelles `accolade`, `barre-debut`, `doute` (« ? » d'une note douteuse), `marque-douteuse`.

- [ ] **Step 1: Écrire les tests**

```diff
--- a/tests/partition.test.mjs
+++ b/tests/partition.test.mjs
@@ -1,6 +1,7 @@
 import { test } from 'node:test';
 import assert from 'node:assert/strict';
 import { genererPiece } from '../src/piece.js';
+import { genererPieceEnsemble } from '../src/ensemble.js';
 import { partitionSvg, geometriePartition, curseurA } from '../src/partition.js';
 import { positionPortee, POS_DIESES } from '../src/portee.js';
 import { U } from '../src/rythme.js';
@@ -95,3 +96,39 @@
   assert.equal(y, geo.basPortee(0) - POS_DIESES.fa[0] * 5 + 5);
   assert.ok(x - 4 > 53 + 2.4 + 2, `premier dièse (x ${x}) collé aux points de la clé de fa (x 53)`);
 });
+
+test('mains ensemble : grande portée, deux portées par ligne, une tête par note des deux mains', () => {
+  const p = genererPieceEnsemble(2, 7);
+  const svg = partitionSvg(p);
+  const lignes = Math.ceil(p.mesures / 2);
+  assert.equal(compter(svg, '<ellipse class="tete'), p.droite.length + p.gauche.length);
+  assert.equal(compter(svg, 'class="ligne" x1="6"'), 2 * 5 * lignes, 'cinq lignes par portée, deux portées par ligne');
+  assert.equal(compter(svg, 'class="accolade"'), lignes);
+  assert.equal(compter(svg, 'class="barre-mesure"'), p.mesures);
+  assert.equal(compter(svg, 'class="chiffrage-partition"'), 4, 'chiffrage sur les deux portées de la première ligne');
+  assert.equal(compter(svg, 'class="cle"'), lignes * (1 + 4), 'une clé de sol (1 tracé) et une clé de fa (tracé et 3 points) par ligne');
+});
+
+test('mains ensemble : barres de mesure et curseur traversent les deux portées', () => {
+  const p = genererPieceEnsemble(1, 13);
+  const geo = geometriePartition(p);
+  const sol = geo.basPortee(0, 'droite'); const fa = geo.basPortee(0, 'gauche');
+  assert.ok(fa - sol >= 90, 'la portée de fa est sous celle de sol');
+  const svg = partitionSvg(p);
+  assert.ok(svg.includes(`class="barre-mesure" x1="${geo.systemes[0].mesures[0].x1}" y1="${sol - 40}" x2="${geo.systemes[0].mesures[0].x1}" y2="${fa}"`));
+  const c = curseurA(geo, 0);
+  assert.ok(c.y1 < sol - 40 && c.y2 > fa);
+});
+
+test('mains ensemble : notes de chaque main sur sa portée, marques par main, « ? » sur les douteuses', () => {
+  const p = genererPieceEnsemble(1, 13);
+  const geo = geometriePartition(p);
+  const marques = { droite: p.droite.map((_, i) => ({ etat: i === 0 ? 'douteuse' : 'juste' })), gauche: p.gauche.map(() => ({ etat: 'fausse' })) };
+  const svg = partitionSvg(p, { marques });
+  assert.equal(compter(svg, 'marque-douteuse'), 1);
+  assert.equal(compter(svg, 'class="doute"'), 1);
+  assert.equal(compter(svg, 'marque-fausse'), p.gauche.length);
+  const g0 = p.gauche[0];
+  const y = geo.basPortee(0, 'gauche') - positionPortee(g0.note, g0.octave, 'fa') * 5;
+  assert.ok(svg.includes(`cy="${y}"`), 'la première note de la main gauche est placée en clé de fa, sur la portée du bas');
+});
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `node --test tests/partition.test.mjs`
Expected: FAIL sur les trois tests « mains ensemble » (une seule portée, `piece.notes` indéfini).

- [ ] **Step 3: Remplacer `src/partition.js`**

```js
// Partition d'une pièce de déchiffrage : clé de sol ou de fa, ou grande portée (mains ensemble), hauteurs et
// rythmes, plusieurs mesures sur plusieurs lignes, et le résultat de la correction coloré sur chaque note. Pur, sans DOM.

import { positionPortee, cleSol, cleFa, POS_DIESES, POS_BEMOLS } from './portee.js';
import { U } from './rythme.js';

const PX_UNITE = 3.5;       // largeur d'une unité de temps (12 par temps)
const MARGE_MESURE = 16;    // avant la première note d'une mesure
const FIN_MESURE = 10;      // après la dernière
const DEMI_INTERLIGNE = 5;
const HAUT_SYSTEME = 130;   // hauteur d'une ligne de partition
const BAS_SYSTEME = 100;    // y de la ligne du bas de la portée, dans une ligne
const ECART_PORTEES = 100;  // grande portée : de la ligne du bas (sol) à la ligne du bas (fa)
const HAUT_SYSTEME_ENSEMBLE = BAS_SYSTEME + ECART_PORTEES + 40;
const X_ARMURE = { sol: 56, fa: 66 }; // la clé de fa, avec ses deux points, est plus large

export function geometriePartition(piece, { mesuresParLigne = 2 } = {}) {
  const ensemble = piece.main === 'ensemble';
  const unitesMesure = piece.temps * U;
  const largeurMesure = MARGE_MESURE + unitesMesure * PX_UNITE + FIN_MESURE;
  const entete = X_ARMURE[ensemble ? 'fa' : piece.cle || 'sol'] + Math.abs(piece.armure) * 9 + 4;
  const systemes = [];
  for (let l = 0; l * mesuresParLigne < piece.mesures; l++) {
    const x0 = entete + (l === 0 ? 24 : 0); // la première ligne porte le chiffrage
    const mesures = [];
    for (let k = 0; k < mesuresParLigne && l * mesuresParLigne + k < piece.mesures; k++) {
      mesures.push({ m: l * mesuresParLigne + k, x0: x0 + k * largeurMesure, x1: x0 + (k + 1) * largeurMesure });
    }
    systemes.push({ ligne: l, mesures });
  }
  const largeur = Math.max(...systemes.map((s) => s.mesures.at(-1).x1)) + 8;
  const haut = ensemble ? HAUT_SYSTEME_ENSEMBLE : HAUT_SYSTEME;
  // Grande portée : `main` choisit la portée (droite = sol, en haut ; gauche = fa, en bas).
  const basPortee = (ligne, main = 'droite') => ligne * haut + BAS_SYSTEME + (ensemble && main === 'gauche' ? ECART_PORTEES : 0);
  const ou = (pos) => {
    const m = Math.max(0, Math.min(piece.mesures - 1, Math.floor(pos / unitesMesure)));
    const ligne = Math.floor(m / mesuresParLigne);
    const mes = systemes[ligne].mesures[m % mesuresParLigne];
    return { x: mes.x0 + MARGE_MESURE + (pos - m * unitesMesure) * PX_UNITE, ligne };
  };
  return { largeur, hauteur: systemes.length * haut, systemes, basPortee, ou, entete, ensemble };
}

export function curseurA(geo, pos) {
  const { x, ligne } = geo.ou(pos);
  return { x, ligne, y1: geo.basPortee(ligne) - 60, y2: geo.basPortee(ligne, geo.ensemble ? 'gauche' : 'droite') + 16 };
}

// Lignes, clé, armure et (première ligne) chiffrage d'une portée dont la ligne du bas est à `bas`.
function entetePortee(parts, geo, piece, s, cle, bas) {
  const fin = s.mesures.at(-1).x1;
  const posArm = (piece.armure > 0 ? POS_DIESES : POS_BEMOLS)[cle];
  for (let k = 0; k < 5; k++) parts.push(`<line class="ligne" x1="6" y1="${bas - 10 * k}" x2="${fin}" y2="${bas - 10 * k}" stroke-width="1"/>`);
  parts.push(`<g transform="translate(0 ${bas - 90})">${cle === 'fa' ? cleFa() : cleSol()}</g>`);
  for (let i = 0; i < Math.abs(piece.armure); i++) {
    parts.push(`<text class="alteration" x="${X_ARMURE[cle] + i * 9}" y="${bas - posArm[i] * DEMI_INTERLIGNE + 5}" text-anchor="middle">${piece.armure > 0 ? '♯' : '♭'}</text>`);
  }
  if (s.ligne === 0) {
    const xc = geo.entete + 10;
    parts.push(`<text class="chiffrage-partition" x="${xc}" y="${bas - 21}" text-anchor="middle">${piece.temps}</text>`);
    parts.push(`<text class="chiffrage-partition" x="${xc}" y="${bas - 1}" text-anchor="middle">4</text>`);
  }
}

// Têtes, lignes supplémentaires, points, hampes, crochets et ligatures des notes d'une portée.
function notesPortee(parts, geo, notes, cle, main, marques) {
  const yDePos = (ligne, p) => geo.basPortee(ligne, main) - p * DEMI_INTERLIGNE;
  const infos = notes.map((x) => {
    const { x: px, ligne } = geo.ou(x.pos);
    const p = positionPortee(x.note, x.octave, cle);
    return { px, ligne, p, y: yDePos(ligne, p) };
  });
  // croches liées par deux dans un même temps
  const ligatures = [];
  for (let i = 0; i + 1 < notes.length; i++) {
    if (notes[i].duree === U / 2 && notes[i + 1].duree === U / 2 && notes[i].pos % U === 0 && notes[i + 1].pos === notes[i].pos + U / 2) { ligatures.push([i, i + 1]); i++; }
  }
  const lies = new Set(ligatures.flat());
  notes.forEach((x, i) => {
    const { px, ligne, p, y } = infos[i];
    const bas = geo.basPortee(ligne, main);
    for (let q = -2; q >= p; q -= 2) parts.push(`<line class="ligne" x1="${px - 10}" y1="${yDePos(ligne, q)}" x2="${px + 10}" y2="${yDePos(ligne, q)}" stroke-width="1.2"/>`);
    for (let q = 10; q <= p; q += 2) parts.push(`<line class="ligne" x1="${px - 10}" y1="${yDePos(ligne, q)}" x2="${px + 10}" y2="${yDePos(ligne, q)}" stroke-width="1.2"/>`);
    const marque = marques[i];
    const cls = `tete${x.duree >= 2 * U ? ' vide' : ''}${marque ? ` marque-${marque.etat}` : ''}`;
    parts.push(`<ellipse class="${cls}" cx="${px}" cy="${y}" rx="6.2" ry="4.4" transform="rotate(-20 ${px} ${y})"/>`);
    if (x.token.endsWith('.')) parts.push(`<circle class="point" cx="${px + 10}" cy="${p % 2 === 0 ? y - 4 : y}" r="1.7"/>`);
    if (marque?.joue) parts.push(`<text class="joue" x="${px}" y="${bas + 28}" text-anchor="middle">${marque.joue}</text>`);
    if (marque?.etat === 'douteuse') parts.push(`<text class="doute" x="${px - 12}" y="${y - 6}" text-anchor="middle">?</text>`);
    if (x.duree >= 4 * U || lies.has(i)) return; // ronde : pas de hampe ; croches liées : dessinées plus bas
    const haut = p < 4;
    parts.push(haut
      ? `<line class="hampe" x1="${px + 5.6}" y1="${y - 1}" x2="${px + 5.6}" y2="${y - 30}" stroke-width="1.4"/>`
      : `<line class="hampe" x1="${px - 5.6}" y1="${y + 1}" x2="${px - 5.6}" y2="${y + 30}" stroke-width="1.4"/>`);
    if (x.duree === U / 2) {
      parts.push(haut
        ? `<path class="crochet" d="M${px + 5.6} ${y - 30} q8 6 6 16" fill="none" stroke-width="1.6"/>`
        : `<path class="crochet" d="M${px - 5.6} ${y + 30} q8 -6 6 -16" fill="none" stroke-width="1.6"/>`);
    }
  });
  for (const [a, b] of ligatures) {
    const A = infos[a]; const B = infos[b];
    const haut = (A.p + B.p) / 2 < 4;
    const yb = haut ? Math.min(A.y, B.y) - 30 : Math.max(A.y, B.y) + 30;
    const dx = haut ? 5.6 : -5.6;
    for (const I of [A, B]) parts.push(`<line class="hampe" x1="${I.px + dx}" y1="${I.y}" x2="${I.px + dx}" y2="${yb}" stroke-width="1.4"/>`);
    parts.push(`<line class="ligature" x1="${A.px + dx}" y1="${yb}" x2="${B.px + dx}" y2="${yb}" stroke-width="4"/>`);
  }
}

// marques : une liste (une main) ou { droite: [...], gauche: [...] } (mains ensemble).
export function partitionSvg(piece, { mesuresParLigne = 2, marques = [], enTrop = [] } = {}) {
  const geo = geometriePartition(piece, { mesuresParLigne });
  const parts = [];
  const portees = geo.ensemble
    ? [{ main: 'droite', cle: 'sol', notes: piece.droite, marques: marques.droite || [] }, { main: 'gauche', cle: 'fa', notes: piece.gauche, marques: marques.gauche || [] }]
    : [{ main: 'droite', cle: piece.cle || 'sol', notes: piece.notes, marques }];
  for (const s of geo.systemes) {
    for (const p of portees) entetePortee(parts, geo, piece, s, p.cle, geo.basPortee(s.ligne, p.main));
    const haut = geo.basPortee(s.ligne) - 40;
    const bas = geo.basPortee(s.ligne, portees.at(-1).main);
    // grande portée : accolade et trait qui relient les deux portées au début de la ligne
    if (geo.ensemble) parts.push(`<line class="accolade" x1="3" y1="${haut}" x2="3" y2="${bas}" stroke-width="3"/><line class="barre-debut" x1="6" y1="${haut}" x2="6" y2="${bas}" stroke-width="1.2"/>`);
    for (const m of s.mesures) {
      const derniere = m.m === piece.mesures - 1;
      const xb = derniere ? m.x1 - 5 : m.x1;
      parts.push(`<line class="barre-mesure" x1="${xb}" y1="${haut}" x2="${xb}" y2="${bas}" stroke-width="1.2"/>`);
      if (derniere) parts.push(`<line class="barre-finale" x1="${m.x1}" y1="${haut}" x2="${m.x1}" y2="${bas}" stroke-width="3.5"/>`);
    }
  }
  for (const p of portees) notesPortee(parts, geo, p.notes, p.cle, p.main, p.marques);
  for (const e of enTrop) {
    const { x, ligne } = geo.ou(e.pos);
    parts.push(`<text class="en-trop" x="${x}" y="${geo.basPortee(ligne) - 62}" text-anchor="middle">×</text>`);
  }
  parts.push('<line class="curseur" x1="0" y1="0" x2="0" y2="0" stroke-width="2" visibility="hidden"/>');
  return `<svg class="partition" viewBox="0 0 ${geo.largeur} ${geo.hauteur}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="partition à déchiffrer">${parts.join('')}</svg>`;
}
```

- [ ] **Step 4: Vérifier**

Run: `node --test tests/*.test.mjs`
Expected: PASS (les 8 tests de partition existants inchangés, plus les 3 nouveaux).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Partition : grande portée pour les pièces mains ensemble, marque des notes douteuses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Parcours mains ensemble dans la progression

**Files:**
- Modify: `src/dechiffrage.js` (remplacé en entier)
- Test: `tests/dechiffrage.test.mjs`

**Interfaces:**
- Consumes : `NIVEAUX_ENSEMBLE` (Task 1).
- Produces :
  - `REGLES_DECHIFFRAGE.bpmDepartEnsemble = 50`, `REGLES_DECHIFFRAGE.mainsPourEnsemble = { 1: 2, 2: 3 }`, `PARCOURS = ['droite', 'gauche', 'ensemble']`.
  - `etatDechiffrageInitial()` et `normaliserDechiffrage()` portent `ensemble: { niveau, bpm: { 1: 50, 2: 50, 3: 50 } }` ; `main` accepte `'ensemble'`.
  - `ensembleOuvert(etat) → bool`.
  - `etatDeblocageDechiffrage(etat, main)` renvoie aussi `mainsRequises` (nombre ou `null`) et `mainsOk`.
  - `enregistrerPiece(etat, { main: 'ensemble', …, resultat }, now)` : `resultat.reussi` = verdict confirmé ; l'historique garde aussi `douteuses` et `propose`.

- [ ] **Step 1: Écrire les tests**

```diff
--- a/tests/dechiffrage.test.mjs
+++ b/tests/dechiffrage.test.mjs
@@ -1,6 +1,6 @@
 import { test } from 'node:test';
 import assert from 'node:assert/strict';
-import { REGLES_DECHIFFRAGE, etatDechiffrageInitial, normaliserDechiffrage, enregistrerPiece, etatDeblocageDechiffrage } from '../src/dechiffrage.js';
+import { REGLES_DECHIFFRAGE, etatDechiffrageInitial, normaliserDechiffrage, enregistrerPiece, etatDeblocageDechiffrage, ensembleOuvert } from '../src/dechiffrage.js';
 
 const J0 = Date.UTC(2026, 8, 25, 9);
 const resultat = (reussi) => ({ justes: reussi ? 16 : 10, total: 16, ecartMedianMs: 40, arrets: reussi ? [] : [3], reussi });
@@ -8,11 +8,12 @@
 const jouer = (etat, niveau, reussi, main = 'droite') => enregistrerPiece(etat, { main, niveau, graine: 1, bpm: etat.dechiffrage[main].bpm[niveau], resultat: resultat(reussi) }, J0);
 
 const parcours = (niveau = 1, bpm = {}) => ({ niveau, bpm: { 1: 60, 2: 60, 3: 60, ...bpm } });
+const parcoursEnsemble = (niveau = 1, bpm = {}) => ({ niveau, bpm: { 1: 50, 2: 50, 3: 50, ...bpm } });
 
 test('état initial et normalisation', () => {
-  assert.deepEqual(etatDechiffrageInitial(), { main: 'droite', droite: parcours(), gauche: parcours(), historique: [] });
+  assert.deepEqual(etatDechiffrageInitial(), { main: 'droite', droite: parcours(), gauche: parcours(), ensemble: parcoursEnsemble(), historique: [] });
   assert.deepEqual(normaliserDechiffrage(undefined), etatDechiffrageInitial());
-  assert.deepEqual(normaliserDechiffrage({ droite: { niveau: 9, bpm: { 2: 72 } }, historique: 'x' }), { main: 'droite', droite: parcours(1, { 2: 72 }), gauche: parcours(), historique: [] });
+  assert.deepEqual(normaliserDechiffrage({ droite: { niveau: 9, bpm: { 2: 72 } }, historique: 'x' }), { main: 'droite', droite: parcours(1, { 2: 72 }), gauche: parcours(), ensemble: parcoursEnsemble(), historique: [] });
   assert.equal(normaliserDechiffrage({ gauche: { niveau: 2, bpm: {} }, main: 'gauche', historique: [] }).gauche.niveau, 2);
   assert.equal(normaliserDechiffrage({ main: 'gauche' }).main, 'gauche');
   assert.equal(normaliserDechiffrage({ main: 'pied' }).main, 'droite');
@@ -21,7 +22,7 @@
 test('ancienne progression (main droite seule) : reprise dans le parcours main droite', () => {
   const h = { date: J0, niveau: 2, graine: 5, bpm: 66, justes: 16, total: 16, ecartMs: 40, arrets: 0, reussi: true };
   const n = normaliserDechiffrage({ niveau: 2, bpm: { 1: 72, 2: 66 }, historique: [h] });
-  assert.deepEqual(n, { main: 'droite', droite: parcours(2, { 1: 72, 2: 66 }), gauche: parcours(), historique: [h] });
+  assert.deepEqual(n, { main: 'droite', droite: parcours(2, { 1: 72, 2: 66 }), gauche: parcours(), ensemble: parcoursEnsemble(), historique: [h] });
   assert.equal(etatDeblocageDechiffrage({ dechiffrage: n }).reussites, 1, 'pièce ancienne comptée pour la main droite');
   assert.equal(etatDeblocageDechiffrage({ dechiffrage: n }, 'gauche').jouees, 0);
 });
@@ -54,7 +55,7 @@
   const e = etatNeuf();
   jouer(e, 1, false); jouer(e, 1, false);
   for (let i = 0; i < 5; i++) assert.equal(jouer(e, 1, true).debloque, null);
-  assert.deepEqual(etatDeblocageDechiffrage(e), { niveau: 1, suivant: 2, reussites: 5, jouees: 7, cible: 6, fenetre: 8, pret: false });
+  assert.deepEqual(etatDeblocageDechiffrage(e), { niveau: 1, suivant: 2, reussites: 5, jouees: 7, cible: 6, fenetre: 8, mainsRequises: null, mainsOk: true, pret: false });
   assert.equal(jouer(e, 1, true).debloque, 2);
   assert.equal(e.dechiffrage.droite.niveau, 2);
   assert.equal(etatDeblocageDechiffrage(e).reussites, 0, 'le niveau 2 repart de zéro');
@@ -72,3 +73,37 @@
   for (let i = 0; i < 105; i++) assert.equal(jouer(e, 3, true).debloque, null);
   assert.equal(e.dechiffrage.historique.length, REGLES_DECHIFFRAGE.historiqueMax);
 });
+
+const resultatEnsemble = (reussi, propose = reussi ? 'reussi' : 'pasEncore') => ({ justes: 20, total: 24, douteuses: 3, ecartMedianMs: 50, arrets: [], propose, reussi });
+const jouerEnsemble = (etat, niveau, reussi, propose) => enregistrerPiece(etat, { main: 'ensemble', niveau, graine: 1, bpm: etat.dechiffrage.ensemble.bpm[niveau], resultat: resultatEnsemble(reussi, propose) }, J0);
+
+test('mains ensemble : ouvert quand les deux mains ont atteint le niveau 2', () => {
+  const e = etatNeuf();
+  assert.equal(ensembleOuvert(e), false);
+  e.dechiffrage.droite.niveau = 2;
+  assert.equal(ensembleOuvert(e), false);
+  e.dechiffrage.gauche.niveau = 2;
+  assert.equal(ensembleOuvert(e), true);
+  assert.equal(normaliserDechiffrage({ main: 'ensemble' }).main, 'ensemble');
+  assert.deepEqual(normaliserDechiffrage({ ensemble: { niveau: 3, bpm: { 1: 44, 2: 62 } } }).ensemble, parcoursEnsemble(3, { 1: 50, 2: 62 }));
+});
+
+test('mains ensemble : tempo de départ 50, verdict confirmé enregistré avec la proposition', () => {
+  const e = etatNeuf();
+  const r = jouerEnsemble(e, 1, true, 'pasEncore'); // l'élève a confirmé une réussite que l'app ne proposait pas
+  assert.equal(r.bpmApres, 56);
+  const h = e.dechiffrage.historique.at(-1);
+  assert.deepEqual([h.main, h.reussi, h.propose, h.douteuses], ['ensemble', true, 'pasEncore', 3]);
+  assert.equal(etatDeblocageDechiffrage(e, 'droite').jouees, 0, 'les pièces mains ensemble ne comptent pas pour une main seule');
+});
+
+test('mains ensemble : E2 demande aussi le niveau 3 des deux mains', () => {
+  const e = etatNeuf();
+  e.dechiffrage.droite.niveau = 2; e.dechiffrage.gauche.niveau = 3;
+  for (let i = 0; i < 6; i++) assert.equal(jouerEnsemble(e, 1, true).debloque, null);
+  const b = etatDeblocageDechiffrage(e, 'ensemble');
+  assert.deepEqual([b.reussites, b.mainsRequises, b.mainsOk, b.pret], [6, 3, false, false]);
+  e.dechiffrage.droite.niveau = 3;
+  assert.equal(jouerEnsemble(e, 1, true).debloque, 2);
+  assert.equal(etatDeblocageDechiffrage(e, 'ensemble').mainsRequises, null, 'E3 ne demande rien de plus aux mains');
+});
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `node --test tests/dechiffrage.test.mjs`
Expected: FAIL (`ensembleOuvert` n'existe pas ; état initial sans `ensemble`).

- [ ] **Step 3: Remplacer `src/dechiffrage.js`**

```js
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
```

- [ ] **Step 4: Vérifier**

Run: `node --test tests/*.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Progression : parcours mains ensemble (ouverture, déblocage, verdict confirmé)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Interface : troisième parcours, écoute, confirmation

**Files:**
- Modify: `src/audio.js` (`jouerNotes`)
- Modify: `index.html` (troisième bouton)
- Modify: `src/style.css`
- Modify: `src/interface.js`

**Interfaces:**
- Consumes : tout ce qui précède.
- Produces : écran Déchiffrage à trois parcours ; `creerLecteur().jouerNotes([{ midi, debutMs, dureeMs }])`.

Pas de test unitaire (DOM, Web Audio) : vérification dans le navigateur au Step 6.

- [ ] **Step 1: `src/audio.js`**

```diff
--- a/src/audio.js
+++ b/src/audio.js
@@ -78,6 +78,14 @@
       }
       return dureeTotaleMs(sequence);
     },
+    // Notes superposées (mains ensemble) : [{ midi, debutMs, dureeMs }] ; renvoie la durée totale en ms.
+    jouerNotes(notes) {
+      this.arreter();
+      const c = assurer();
+      const t0 = c.currentTime + 0.05;
+      for (const n of notes) noteA(n.midi, t0 + n.debutMs / 1000, n.dureeMs / 1000, 0.35);
+      return Math.max(0, ...notes.map((n) => n.debutMs + n.dureeMs));
+    },
     arreter() {
       for (const o of enCours) { try { o.stop(); } catch { /* déjà arrêté */ } }
       enCours = [];
```

- [ ] **Step 2: `index.html`**

```diff
--- a/index.html
+++ b/index.html
@@ -104,6 +104,7 @@
     <div class="choix-main" id="dech-main" role="group" aria-label="Main">
       <button class="btn" type="button" data-main="droite" aria-pressed="true">Main droite<br><span class="sous">clé de sol</span></button>
       <button class="btn" type="button" data-main="gauche" aria-pressed="false">Main gauche<br><span class="sous">clé de fa</span></button>
+      <button class="btn" type="button" data-main="ensemble" aria-pressed="false">Mains ensemble<br><span class="sous" id="dech-ensemble-sous">grande portée</span></button>
     </div>
     <div class="partition-boite" id="dech-partition"></div>
     <div class="pulsation" id="dech-pulsation" hidden><i></i></div>
```

- [ ] **Step 3: `src/style.css`**

```diff
--- a/src/style.css
+++ b/src/style.css
@@ -248,11 +248,17 @@
 .partition .joue { font-family: var(--police); font-size: 11px; font-weight: 700; fill: var(--ko); }
 .partition .en-trop { font-family: var(--police); font-size: 16px; font-weight: 700; fill: var(--texte-2); }
 .partition .curseur { stroke: var(--accent); }
+.partition .accolade, .partition .barre-debut { stroke: var(--texte); }
+.partition .tete.marque-douteuse { fill: var(--texte-2); stroke: var(--texte-2); opacity: .6; }
+.partition .tete.vide.marque-douteuse { fill: none; stroke-width: 2.2; }
+.partition .doute { font-family: var(--police); font-size: 12px; font-weight: 700; fill: var(--texte-2); }
+.confirmation { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
 .pulsation { display: flex; justify-content: center; }
 .pulsation i { width: 22px; height: 22px; border-radius: 50%; background: var(--surface-2); }
 .pulsation.actif i { background: var(--accent); }
 .dech-actions { display: grid; gap: 10px; }
-.choix-main { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
+.choix-main { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
+.choix-main .btn:disabled { opacity: .55; }
 .choix-main .btn { min-height: 52px; padding: 6px 10px; line-height: 1.25; background: var(--surface-2); border-color: transparent; }
 .choix-main .btn[aria-pressed="true"] { background: var(--accent-doux); border-color: var(--accent); color: var(--accent); font-weight: 600; }
 .choix-main[hidden] { display: none; }
```

- [ ] **Step 4: `src/interface.js`**

Enregistrer le correctif ci-dessous dans `../tache6-interface.patch` (hors du dépôt), puis depuis `08-harmonie-app/` :
`git apply --whitespace=nowarn ../tache6-interface.patch` ; en cas de refus, faire les mêmes modifications à la main
(les lignes `-` disparaissent, les lignes `+` apparaissent).

Résumé : imports ; `NOMS_MAIN`/`CLE_MAIN` ; carte d'accueil et écran Progression à trois parcours ; bouton
« Mains ensemble » grisé tant que `ensembleOuvert` est faux ; préparation de 60 s et départ des deux mains ;
capture `fftSize: 4096` + `fabriquer` ; nouvelle fonction `terminerPieceEnsemble` (correction, diagnostic,
confirmation avant `enregistrerPiece`) ; « Écouter la pièce » avec `jouerNotes`.

```diff
--- a/src/interface.js
+++ b/src/interface.js
@@ -12,9 +12,11 @@
 import { creerMicro, evaluerChant, commentaireChant, midiDeFrequence } from './voix.js';
 import { nomFr } from './theorie.js';
 import { genererPiece, notesAttendues, sequencePiece, dureePieceMs } from './piece.js';
+import { genererPieceEnsemble, notesAJouer } from './ensemble.js';
 import { partitionSvg, geometriePartition, curseurA } from './partition.js';
 import { creerEcoute, detecterAttaques, aligner, REGLES_ECOUTE } from './ecoute.js';
-import { enregistrerPiece, etatDeblocageDechiffrage } from './dechiffrage.js';
+import { candidatsPiece, trameEnsemble, amplitudesDeDb, verifierEnsemble, HARMONIQUES } from './verification.js';
+import { enregistrerPiece, etatDeblocageDechiffrage, ensembleOuvert, PARCOURS } from './dechiffrage.js';
 
 const $ = (id) => document.getElementById(id);
 const ECRANS = ['accueil', 'seance', 'bilan', 'progression', 'dechiffrage', 'test-micro'];
@@ -28,7 +30,8 @@
 // le chant est alors mis de côté (ni séance, ni cartes dues) plutôt que de bloquer la séance sur une erreur.
 const politique = document.permissionsPolicy || document.featurePolicy;
 const MICRO_PERMIS = politique?.allowsFeature ? politique.allowsFeature('microphone') : globalThis.top === globalThis.self;
-const NOMS_MAIN = { droite: 'Main droite', gauche: 'Main gauche' };
+const NOMS_MAIN = { droite: 'Main droite', gauche: 'Main gauche', ensemble: 'Mains ensemble' };
+const CLE_MAIN = { droite: 'clé de sol', gauche: 'clé de fa', ensemble: 'grande portée' };
 const NOMS_CLASSE = ['do', 'do♯', 'ré', 'mi♭', 'mi', 'fa', 'fa♯', 'sol', 'la♭', 'la', 'si♭', 'si'];
 let dech = null;       // pièce de déchiffrage en cours
 let ecoute = null;     // micro du déchiffrage, ouvert à la première pièce jouée
@@ -125,10 +128,10 @@
       el('span', { class: 'detail manque' }, sansMicro ? 'Micro indisponible dans la page claude.ai : chant mis de côté' : muet ? 'Mise de côté en mode silencieux' : manque)));
   }
   // Déchiffrage : pas de cartes, sa propre carte d'accueil
-  // Déchiffrage : la carte montre la main choisie en dernier ; l'autre main en une ligne.
+  // Déchiffrage : la carte montre le parcours choisi en dernier ; les autres en une ligne.
   const dd = etat.dechiffrage;
   const main = dd.main;
-  const autre = main === 'droite' ? 'gauche' : 'droite';
+  const autres = PARCOURS.filter((m) => m !== main && (m !== 'ensemble' || ensembleOuvert(etat)));
   const bloque = etatDeblocageDechiffrage(etat, main);
   const muetJ = !MICRO_PERMIS || silence;
   const nbPieces = dd.historique.filter((h) => (h.main ?? 'droite') === main).length;
@@ -136,7 +139,7 @@
     el('span', { class: 'nom' }, `Déchiffrage · ${NOMS_MAIN[main]}`),
     el('span', { class: 'niveau' }, `niv. ${dd[main].niveau}`),
     el('span', { class: 'barre' }, el('i', { style: `width:${bloque ? pourcent(bloque.reussites, bloque.cible) : 100}%` })),
-    el('span', { class: 'detail' }, `${nbPieces} pièce${nbPieces > 1 ? 's' : ''} jouée${nbPieces > 1 ? 's' : ''} · ${dd[main].bpm[dd[main].niveau]} à la noire · ${NOMS_MAIN[autre]} : niv. ${dd[autre].niveau}`),
+    el('span', { class: 'detail' }, `${nbPieces} pièce${nbPieces > 1 ? 's' : ''} jouée${nbPieces > 1 ? 's' : ''} · ${dd[main].bpm[dd[main].niveau]} à la noire · ${autres.map((m) => `${NOMS_MAIN[m]} : niv. ${dd[m].niveau}`).join(' · ')}`),
     el('span', { class: 'detail manque' }, !MICRO_PERMIS ? 'Micro indisponible ici : déchiffrage mis de côté'
       : silence ? 'Mise de côté en mode silencieux'
         : bloque ? `Niv. ${bloque.suivant} : ${bloque.reussites}/${bloque.cible} réussites sur les ${bloque.fenetre} dernières pièces` : 'Tous les niveaux ouverts')));
@@ -533,17 +536,20 @@
   const parcours = (main) => {
     const p = dd[main];
     const bloque = etatDeblocageDechiffrage(etat, main);
-    return el('p', { class: 'sous' }, el('b', {}, `${NOMS_MAIN[main]} (clé de ${main === 'droite' ? 'sol' : 'fa'}) · niveau ${p.niveau}`),
+    if (main === 'ensemble' && !ensembleOuvert(etat)) return el('p', { class: 'sous' }, el('b', {}, `${NOMS_MAIN[main]} (${CLE_MAIN[main]})`), ' : s’ouvre au niveau 2 des deux mains.');
+    const mains = bloque?.mainsRequises ? ` et le niveau ${bloque.mainsRequises} des deux mains${bloque.mainsOk ? ' ✓' : ''}` : '';
+    return el('p', { class: 'sous' }, el('b', {}, `${NOMS_MAIN[main]} (${CLE_MAIN[main]}) · niveau ${p.niveau}`),
       ` · tempo ${Object.entries(p.bpm).map(([n, v]) => `niv. ${n} : ${v}`).join(', ')}. `,
-      bloque ? `Pour ouvrir le niveau ${bloque.suivant} : ${bloque.reussites}/${bloque.cible} réussites sur les ${bloque.fenetre} dernières pièces (${bloque.jouees} jouée${bloque.jouees > 1 ? 's' : ''}).` : 'Tous les niveaux sont ouverts.');
+      bloque ? `Pour ouvrir le niveau ${bloque.suivant} : ${bloque.reussites}/${bloque.cible} réussites sur les ${bloque.fenetre} dernières pièces (${bloque.jouees} jouée${bloque.jouees > 1 ? 's' : ''})${mains}.` : 'Tous les niveaux sont ouverts.');
   };
   $('prog-dechiffrage').replaceChildren(
     el('h3', {}, 'Déchiffrage au piano'),
     parcours('droite'),
     parcours('gauche'),
+    parcours('ensemble'),
     recentes.length
       ? el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Main'), el('th', {}, 'Niv.'), el('th', {}, 'Justes'), el('th', {}, 'Tempo'))),
-        el('tbody', {}, ...recentes.map((h) => el('tr', {}, el('td', {}, date(h.date)), el('td', {}, (h.main ?? 'droite') === 'gauche' ? 'MG' : 'MD'), el('td', {}, String(h.niveau)), el('td', {}, `${h.justes}/${h.total}${h.reussi ? ' ✓' : ''}`), el('td', {}, String(h.bpm))))))
+        el('tbody', {}, ...recentes.map((h) => el('tr', {}, el('td', {}, date(h.date)), el('td', {}, { droite: 'MD', gauche: 'MG', ensemble: '2M' }[h.main ?? 'droite']), el('td', {}, String(h.niveau)), el('td', {}, `${h.justes}/${h.total}${h.reussi ? ' ✓' : ''}`), el('td', {}, String(h.bpm))))))
       : el('p', { class: 'sous' }, 'Aucune pièce jouée pour l’instant.'),
   );
   $('btn-exporter').textContent = 'Copier ma progression';
@@ -595,6 +601,7 @@
 function actionsDech(...boutons) { $('dech-actions').replaceChildren(...boutons); }
 
 function ouvrirDechiffrage() {
+  if (etat.dechiffrage.main === 'ensemble' && !ensembleOuvert(etat)) etat.dechiffrage.main = 'droite';
   $('opt-clic').checked = !!etat.prefs.clic;
   montrer('dechiffrage');
   garderEcranAllume();
@@ -613,17 +620,23 @@
   const { niveau, bpm } = d[main];
   const graine = Math.floor(Math.random() * 2 ** 31);
   arreterDechiffrage(); // sinon le compte à rebours de la pièce remplacée continue et relance le jeu
-  dech = { piece: genererPiece(niveau, graine, { main }), graine, main, niveau, bpm: bpm[niveau], rejoue: false, phase: null, minuteur: null, raf: null, origine: 0 };
+  const piece = main === 'ensemble' ? genererPieceEnsemble(niveau, graine) : genererPiece(niveau, graine, { main });
+  dech = { piece, graine, main, niveau, bpm: bpm[niveau], rejoue: false, phase: null, minuteur: null, raf: null, origine: 0 };
   preparerPiece();
 }
 
 // Choix de la main : visible en préparation et après la correction, caché pendant le jeu.
 function montrerChoixMain(visible) {
   $('dech-main').hidden = !visible;
-  for (const b of $('dech-main').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.main === etat.dechiffrage.main));
+  for (const b of $('dech-main').querySelectorAll('button')) {
+    b.setAttribute('aria-pressed', String(b.dataset.main === etat.dechiffrage.main));
+    if (b.dataset.main === 'ensemble') b.disabled = !ensembleOuvert(etat);
+  }
+  $('dech-ensemble-sous').textContent = ensembleOuvert(etat) ? 'grande portée' : 's’ouvre au niveau 2 des deux mains';
 }
 function choisirMain(main) {
   if (!dech || dech.phase === 'jeu' || etat.dechiffrage.main === main) return;
+  if (main === 'ensemble' && !ensembleOuvert(etat)) return;
   etat.dechiffrage.main = main;
   sauver();
   nouvellePiece();
@@ -646,9 +659,12 @@
   montrerChoixMain(true);
   $('dech-partition').innerHTML = partitionSvg(piece);
   $('dech-correction').hidden = true;
-  const depart = `${nomFr(piece.notes[0].note)}${piece.notes[0].octave}`;
-  let reste = 45;
-  const texte = () => `${nomFr(piece.tonique)} majeur · ${piece.temps} temps · départ sur ${depart}. Repère le passage difficile et décide de ne pas t’arrêter. ${reste} s`;
+  const nomNote = (n) => `${nomFr(n.note)}${n.octave}`;
+  const depart = dech.main === 'ensemble'
+    ? `départ : ${nomNote(piece.droite[0])} à droite, ${nomNote(piece.gauche[0])} à gauche`
+    : `départ sur ${nomNote(piece.notes[0])}`;
+  let reste = dech.main === 'ensemble' ? 60 : 45;
+  const texte = () => `${nomFr(piece.tonique)} majeur · ${piece.temps} temps · ${depart}. Repère le passage difficile et décide de ne pas t’arrêter. ${reste} s`;
   $('dech-etat').textContent = texte();
   const minuteur = setInterval(() => {
     // Minuteur d'une préparation abandonnée (autre pièce, écran quitté) : il s'arrête lui-même.
@@ -697,7 +713,18 @@
     }
   }
   dech.origine = origine;
-  ecoute.demarrer(undefined, { fMin: REGLES_ECOUTE.fMin[dech.main] });
+  if (dech.main === 'ensemble') {
+    // Mains ensemble : spectre (fftSize 4096) et harmoniques des notes candidates à chaque trame.
+    const candidats = candidatsPiece(piece);
+    dech.candidats = candidats;
+    ecoute.demarrer(undefined, {
+      fftSize: 4096,
+      fabriquer: (buf, db, sampleRate, fftSize, tMs) => {
+        dech.largeurHz = sampleRate / fftSize;
+        return trameEnsemble(buf, amplitudesDeDb(db), { sampleRate, fftSize }, candidats, tMs);
+      },
+    });
+  } else ecoute.demarrer(undefined, { fMin: REGLES_ECOUTE.fMin[dech.main] });
   const geo = geometriePartition(piece);
   const curseur = $('dech-partition').querySelector('.curseur');
   const pulsation = $('dech-pulsation');
@@ -713,7 +740,7 @@
       const c = curseurA(geo, (Math.min(t, dureeMs) / battement) * U);
       for (const [k, v] of [['x1', c.x], ['x2', c.x], ['y1', c.y1], ['y2', c.y2], ['visibility', 'visible']]) curseur.setAttribute(k, v);
     }
-    if (t > dureeMs + 800) { terminerPiece(); return; }
+    if (t > dureeMs + 800) { if (dech.main === 'ensemble') terminerPieceEnsemble(); else terminerPiece(); return; }
     dech.raf = requestAnimationFrame(boucle);
   };
   dech.raf = requestAnimationFrame(boucle);
@@ -781,6 +808,69 @@
     boutonDech('Copier le détail pour Claude', copierDiagnostic, 'btn-lien'));
 }
 
+// Mains ensemble : correction indicative ; l'élève confirme le verdict avant qu'il compte.
+function terminerPieceEnsemble() {
+  const trames = ecoute.arreter().map((x) => ({ ...x, tMs: x.tMs - dech.origine }));
+  arreterDechiffrage();
+  dech.phase = 'correction';
+  montrerChoixMain(true);
+  const r = verifierEnsemble(dech.piece, trames, { bpm: dech.bpm, candidats: dech.candidats, largeurHz: dech.largeurHz });
+  // Trames compactées : [temps ms, énergie × 1000, puis pour chaque candidat la moyenne de ses harmoniques × 10⁴].
+  const moyenneH = (h, c) => { let s = 0; for (let k = 0; k < HARMONIQUES; k++) s += h[c * HARMONIQUES + k]; return s / HARMONIQUES; };
+  dech.diagnostic = JSON.stringify({
+    main: 'ensemble', niveau: dech.niveau, graine: dech.graine, bpm: dech.bpm, latenceMs: r.latenceMs, propose: r.propose, candidats: dech.candidats,
+    notes: ['droite', 'gauche'].flatMap((main) => dech.piece[main].map((n, i) => [main, n.midi, r.notes[main][i].etat, r.notes[main][i].montee, r.notes[main][i].voisins])),
+    trames: trames.map((x) => [Math.round(x.tMs), Math.round(x.rms * 1000), ...dech.candidats.map((_, c) => Math.round(moyenneH(x.h, c) * 1e4))]),
+  });
+  $('dech-partition').innerHTML = partitionSvg(dech.piece, { marques: r.notes });
+  $('dech-etat').textContent = '';
+  const zone = $('dech-correction');
+  zone.replaceChildren();
+  zone.hidden = false;
+  zone.className = `correction ${r.propose === 'reussi' ? 'juste' : r.propose === 'pasEncore' ? 'faux' : ''}`;
+  const boutonsFin = () => actionsDech(
+    boutonDech('Suivante', nouvellePiece, 'btn-principal'),
+    boutonDech('▶ Écouter la pièce', ecouterPiece),
+    boutonDech(r.compte ? '↻ Réessayer (sans compter)' : '↻ Réessayer', () => { dech.rejoue = r.compte; preparerPiece(); }),
+    boutonDech('Copier le détail pour Claude', copierDiagnostic, 'btn-lien'));
+  if (!r.compte) {
+    zone.append(
+      el('p', { class: 'explication' }, r.rienEntendu
+        ? 'Je n’ai rien entendu : rapproche le téléphone du piano ou monte le volume, puis réessaie.'
+        : 'Beaucoup de sons parasites : je ne peux pas corriger cette fois. Coupe le clic sonore ou le bruit autour, puis réessaie.'),
+      el('p', { class: 'boite-info' }, 'Cette pièce ne compte pas.'));
+    boutonsFin();
+    return;
+  }
+  const jugees = r.total - r.douteuses;
+  const arrets = r.arrets.length ? `arrêt${r.arrets.length > 1 ? 's' : ''} mesure${r.arrets.length > 1 ? 's' : ''} ${r.arrets.join(', ')}` : 'aucun arrêt';
+  zone.append(
+    el('div', { class: 'verdict' },
+      el('span', {}, r.propose === 'reussi' ? 'Réussie ?' : r.propose === 'pasEncore' ? 'Pas encore ?' : 'Je n’ai pas bien entendu : à toi de juger'),
+      el('span', {}, `${r.justes}/${jugees} justes`)),
+    el('p', { class: 'explication' }, `${r.douteuses} douteuse${r.douteuses > 1 ? 's' : ''} · régularité : ${r.ecartMedianMs === null ? '–' : `${r.ecartMedianMs} ms d’écart médian`} · ${arrets}.`),
+    el('p', { class: 'sous' }, 'Vert : juste · orange : décalée · rouge : fausse probable · gris « ? » : douteuse (le micro ne sait pas) · pointillé : manquée.'));
+  if (dech.rejoue) {
+    zone.append(el('p', { class: 'boite-info' }, 'Pièce rejouée : elle ne compte pas.'));
+    boutonsFin();
+    return;
+  }
+  // Rien n'est enregistré avant le choix de l'élève.
+  const choix = el('div', { class: 'confirmation' });
+  const confirmer = (reussi) => {
+    const e = enregistrerPiece(etat, { main: 'ensemble', niveau: dech.niveau, graine: dech.graine, bpm: dech.bpm, resultat: { ...r, reussi } }, Date.now());
+    sauver();
+    choix.replaceWith(el('p', { class: 'boite-info' }, `${reussi ? 'Réussie' : 'Pas encore'} : prochaine pièce à ${e.bpmApres} à la noire.`));
+    if (e.debloque) zone.append(el('div', { class: 'debloque' }, `Niveau débloqué : Déchiffrage mains ensemble, niveau ${e.debloque}`));
+    boutonsFin();
+  };
+  choix.append(
+    boutonDech('✓ Réussie', () => confirmer(true), r.propose === 'reussi' ? 'btn-principal' : 'btn-second'),
+    boutonDech('✗ Pas encore', () => confirmer(false), r.propose === 'pasEncore' ? 'btn-principal' : 'btn-second'));
+  zone.append(choix);
+  actionsDech(boutonDech('▶ Écouter la pièce', ecouterPiece), boutonDech('Copier le détail pour Claude', copierDiagnostic, 'btn-lien'));
+}
+
 async function copierDiagnostic(ev) {
   const bouton = ev.currentTarget;
   try { await navigator.clipboard.writeText(dech.diagnostic); bouton.textContent = 'Détail copié ✓ : colle-le à Claude'; }
@@ -789,7 +879,9 @@
 
 function ecouterPiece() {
   lecteur ||= creerLecteur();
-  if (lecteur) lecteur.jouer(sequencePiece(dech.piece, dech.bpm));
+  if (!lecteur) return;
+  if (dech.main === 'ensemble') lecteur.jouerNotes(notesAJouer(dech.piece, dech.bpm));
+  else lecteur.jouer(sequencePiece(dech.piece, dech.bpm));
 }
 
 function quitterDechiffrage() {
```

- [ ] **Step 5: Tests et build**

Run: `node --test tests/*.test.mjs && node build.mjs`
Expected: PASS, puis `dist/harmonie.html : ~217 Ko`.

- [ ] **Step 6: Vérifier dans le navigateur (micro simulé)**

1. Servir `08-harmonie-app/` en HTTP local (preview du Browser pane ou `python -m http.server` depuis
   `08-harmonie-app/`) et ouvrir `/dist/index.html`.
2. Mettre les deux mains au niveau 2, puis recharger :
   ```js
   localStorage.setItem('harmonie.etat.v1', JSON.stringify({ version: 1, dechiffrage: { main: 'droite', droite: { niveau: 2, bpm: {} }, gauche: { niveau: 2, bpm: {} }, historique: [] } })); location.reload();
   ```
3. Installer un micro simulé qui joue la pièce de la graine `2^30` (niveau 1, 50 à la noire) dès que « Joue » s'affiche :
   ```js
   const EVS = [[0,64,2400],[2400,64,1200],[3600,67,1200],[4800,67,1200],[6000,65,1200],[7200,64,1200],[8400,60,1200],[9600,60,1200],[10800,62,1200],[12000,60,2400],[14400,64,2400],[16800,60,2400],[0,48,2400],[2400,48,2400],[4800,48,2400],[7200,55,2400],[9600,53,2400],[12000,53,2400],[14400,48,4800]];
   window.__fctx = new AudioContext(); window.__dest = __fctx.createMediaStreamDestination();
   { const o = __fctx.createOscillator(); const g = __fctx.createGain(); g.gain.value = 0.0005; o.frequency.value = 3000; o.connect(g).connect(__dest); o.start(); }
   document.addEventListener('click', () => __fctx.resume(), true);
   window.__jouer = () => { const t0 = __fctx.currentTime + 0.05; for (const [t, m, d] of EVS) { const f = 440 * 2 ** ((m - 69) / 12); const g = __fctx.createGain(); g.connect(__dest); const debut = t0 + t / 1000; g.gain.setValueAtTime(0, debut); g.gain.linearRampToValueAtTime(0.08, debut + 0.005); g.gain.exponentialRampToValueAtTime(0.08 * Math.exp(-d / 600), debut + d / 1000); g.gain.linearRampToValueAtTime(0, debut + d / 1000 + 0.04); [0.35, 1, 0.6, 0.45, 0.3, 0.2].forEach((a, k) => { const o = __fctx.createOscillator(); o.frequency.value = f * (k + 1); const ga = __fctx.createGain(); ga.gain.value = a; o.connect(ga).connect(g); o.start(debut); o.stop(debut + d / 1000 + 0.05); }); } };
   navigator.mediaDevices.getUserMedia = async () => __dest.stream;
   window.__vu = false;
   new MutationObserver(() => { if (!__vu && document.getElementById('dech-etat').textContent.startsWith('Joue')) { __vu = true; __jouer(); } }).observe(document.getElementById('dech-etat'), { childList: true, characterData: true, subtree: true });
   Math.random = () => 0.5;
   ```
4. Par de **vrais clics** (pas `element.click()` : l'audio exige un geste) : carte « Déchiffrage », bouton « Mains
   ensemble », « Je suis prêt ». Attendre ~30 s.
5. Attendu : grande portée, préparation « 60 s » et « départ : mi4 à droite, do3 à gauche », puis correction
   « Réussie ? · 19/19 justes », boutons « ✓ Réussie » (mis en avant) et « ✗ Pas encore », **pas** de « Suivante ».
   Cliquer « ✗ Pas encore » : « Pas encore : prochaine pièce à 50 à la noire. », puis Suivante / Écouter /
   Réessayer / Copier ; `historique` porte `main: 'ensemble', propose: 'reussi', reussi: false`.
6. Remettre `localStorage` à `{}` (ou vider) et vérifier que « Mains ensemble » est grisé avec « s'ouvre au
   niveau 2 des deux mains ». Vérifier aussi qu'une pièce main droite se joue et se corrige comme avant.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Interface : déchiffrage mains ensemble (troisième parcours, écoute, confirmation du verdict)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Documentation et publication

**Files:**
- Modify: `docs/2026-09-25-dechiffrage-design.md` (paragraphe « Étape 3 faite »)

- [ ] **Step 1: Noter l'étape 3**

Sous le paragraphe « **Étape 2 faite (2026-09-26)** » de `docs/2026-09-25-dechiffrage-design.md`, ajouter :

```markdown
**Étape 3 faite (2026-09-26)** : mains ensemble sur une grande portée, niveaux E1–E3, écoute qui vérifie les
notes attendues par leurs harmoniques et verdict confirmé par l'élève ; conception
`2026-09-26-dechiffrage-ensemble-design.md`, plan `2026-09-26-dechiffrage-ensemble-plan.md`.
```

- [ ] **Step 2: Tests, build, commit**

Run: `node --test tests/*.test.mjs && node build.mjs` → PASS.

```bash
git add -A
git commit -m "Conception : étape 3 du déchiffrage (mains ensemble) terminée

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Publier (après accord de l'élève)**

Demander l'accord, puis `git push origin main` (l'action GitHub teste, construit et publie
https://klem88.github.io/harmonie-au-clavier/). Rappeler à l'élève de recharger la page, et de coller
« Copier le détail pour Claude » après ses premières pièces mains ensemble pour régler les seuils
(`REGLES_ECOUTE.ensemble`).

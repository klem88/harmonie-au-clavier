# Déchiffrage au micro · Plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** ajouter à l'app « Harmonie au clavier » une dimension Déchiffrage (main droite) où l'élève joue au piano
une pièce de 4 mesures générée, corrigée au micro du téléphone, et héberger toute l'app sur GitHub Pages.

**Architecture :** trois modules purs et testés (`piece.js` génère la pièce, `partition.js` la dessine,
`ecoute.js` détecte les notes jouées et les aligne sur la partition), un module de progression
(`dechiffrage.js`), puis l'écran dans `interface.js`. Le build concatène tout en une page ; GitHub Actions la
publie sur Pages.

**Tech Stack :** JavaScript ES modules sans dépendance, SVG, Web Audio (AnalyserNode), `node --test`
(Node ≥ 20, local : 24), GitHub Pages via GitHub Actions, `gh` (connecté au compte `klem88`).

**Spec :** [2026-09-25-dechiffrage-design.md](2026-09-25-dechiffrage-design.md)

## Global Constraints

- Aucune dépendance npm ; tout le code est en français (noms, commentaires, textes), comme le reste de l'app.
- `build.mjs` concatène les modules dans une seule portée : **aucun nom de premier niveau ne doit exister deux
  fois** entre modules (le build échoue sinon). Les noms proposés ci-dessous ont été vérifiés.
- Pièces : 4 mesures, clé de sol, main droite ; J1 do majeur do4–sol4, noires/blanches ; J2 do/sol/fa/ré,
  + croches ; J3 3/4 et 4/4, + noire pointée-croche et ronde, changement de position mesure 3.
- Tempo de départ 60, ±6, bornes 50–96, un tempo par niveau. Réussite : ≥ 85 % de notes justes et aucun arrêt.
  Déblocage : 6 réussites sur les 8 dernières pièces du niveau. Pièces rejouées et pièces non comptées
  (rien entendu, > 50 % de notes en trop) n'entrent pas dans la progression.
- Note « décalée » au-delà de 120 ms ; arrêt = l'écart grandit de plus de ¾ de temps d'une note à la suivante.
- La page doit rester lisible sur téléphone : largeur de la partition ≤ 520 unités SVG (2 mesures par ligne).
- Le dépôt GitHub est **public** et ne contient que `08-harmonie-app/` ; la progression reste dans le navigateur.
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 0 : dépôt Git local

**Files :**
- Create : `.gitignore`

- [ ] **Step 1 : initialiser le dépôt** (dans `08-harmonie-app/`)

```bash
git init -b main
printf 'dist/\n' > .gitignore
node --test tests/*.test.mjs
```
Expected : `ℹ fail 0`.

- [ ] **Step 2 : premier commit**

```bash
git add -A
git commit -m "Harmonie au clavier : état de départ" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1 : générer une pièce (`piece.js`)

**Files :**
- Create : `src/piece.js`
- Test : `tests/piece.test.mjs`

**Interfaces :**
- Consumes : `note`, `gammeMajeure`, `armure`, `midi` (`theorie.js`) ; `cellule`, `U` (`rythme.js`, 12 unités par temps).
- Produces :
  - `NIVEAUX_PIECE` : `{ 1|2|3: { tonalites, temps, sautMax, changement, rythmes, finales } }`
  - `MESURES_PIECE = 4`
  - `genererPiece(niveau, graine)` → `{ niveau, graine, tonalite: 'C'|'G'|'F'|'D', tonique: {lettre, alt}, armure: int, temps: 3|4, mesures: 4, notes: [{ note: {lettre, alt}, octave, midi, pos, duree, token, mesure, degre }] }` (`pos`/`duree` en unités, `mesure` de 0 à 3)
  - `notesAttendues(piece, bpm)` → `[{ midi, tMs, mesure }]`
  - `dureePieceMs(piece, bpm)` → int
  - `sequencePiece(piece, bpm)` → `[{ midis: [midi], dureeMs }]` (format de `lecteur.jouer`)
  - `melodieValide(degres, midis, sautMax)` → bool
  - `generateurAlea(graine)` → `() => float [0,1)`

- [ ] **Step 1 : écrire les tests**

```js
// tests/piece.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererPiece, notesAttendues, sequencePiece, dureePieceMs, melodieValide, NIVEAUX_PIECE } from '../src/piece.js';
import { U } from '../src/rythme.js';
import { note, midi, gammeMajeure, classe } from '../src/theorie.js';

const GRAINES = Array.from({ length: 500 }, (_, i) => i * 7919 + 13);
const SAUT_MAX_DEMI_TONS = { 1: 4, 2: 5, 3: 7 };

test('même graine, même pièce ; graines différentes, pièces variées', () => {
  assert.deepEqual(genererPiece(2, 42), genererPiece(2, 42));
  const formes = new Set(GRAINES.slice(0, 20).map((g) => JSON.stringify(genererPiece(1, g).notes.map((n) => [n.midi, n.duree]))));
  assert.ok(formes.size >= 15, `seulement ${formes.size} pièces différentes sur 20`);
});

for (const niveau of [1, 2, 3]) {
  test(`niveau ${niveau} : règles respectées sur 500 graines`, () => {
    const cfg = NIVEAUX_PIECE[niveau];
    const vus = { temps: new Set(), tonalites: new Set(), croches: false };
    for (const g of GRAINES) {
      const p = genererPiece(niveau, g);
      vus.temps.add(p.temps); vus.tonalites.add(p.tonalite);
      assert.ok(cfg.tonalites.includes(p.tonalite));
      const mesureU = p.temps * U;
      for (let m = 0; m < p.mesures; m++) {
        const dans = p.notes.filter((n) => n.mesure === m);
        assert.equal(dans.reduce((s, n) => s + n.duree, 0), mesureU, `graine ${g} mesure ${m} incomplète`);
        for (const n of dans) assert.ok(n.pos + n.duree <= (m + 1) * mesureU, `graine ${g} : note à cheval sur la barre`);
      }
      const toniqueMidi = midi(note(p.tonalite), 4);
      const midis = p.notes.map((n) => n.midi);
      const haut = niveau === 3 ? 14 : 7;
      for (const x of midis) assert.ok(x >= toniqueMidi && x <= toniqueMidi + haut, `graine ${g} : ${x} hors position`);
      for (let i = 1; i < midis.length; i++) {
        const d = midis[i] - midis[i - 1];
        assert.ok(Math.abs(d) <= SAUT_MAX_DEMI_TONS[niveau], `graine ${g} : saut de ${d}`);
        assert.notEqual(Math.abs(d), 6, `graine ${g} : triton`);
        if (i >= 2) {
          const a = midis[i - 1] - midis[i - 2];
          if (Math.abs(d) >= 3 && Math.abs(a) >= 3) assert.notEqual(Math.sign(d), Math.sign(a), `graine ${g} : deux sauts de suite dans le même sens`);
        }
      }
      const gamme = gammeMajeure(note(p.tonalite)).map(classe);
      assert.ok([gamme[0], gamme[2], gamme[4]].includes(midis[0] % 12), `graine ${g} : départ hors I-III-V`);
      const der = p.notes.at(-1);
      assert.equal(der.midi % 12, toniqueMidi % 12, `graine ${g} : ne finit pas sur la tonique`);
      assert.ok(der.duree >= 2 * U, `graine ${g} : fin trop courte`);
      if (niveau === 3) assert.equal(der.midi, toniqueMidi + 12, `graine ${g} : J3 finit après le changement de position`);
      if (p.notes.some((n) => n.duree === U / 2)) vus.croches = true;
    }
    if (niveau === 1) { assert.deepEqual([...vus.tonalites], ['C']); assert.equal(vus.croches, false); }
    if (niveau >= 2) { assert.equal(vus.tonalites.size, 4); assert.ok(vus.croches); }
    if (niveau === 3) assert.deepEqual([...vus.temps].sort(), [3, 4]);
  });
}

test('notes attendues, durée et séquence de lecture au tempo', () => {
  const p = genererPiece(1, 7);
  const a = notesAttendues(p, 60);
  assert.equal(a.length, p.notes.length);
  assert.deepEqual(a.map((x) => x.tMs), p.notes.map((n) => (n.pos * 1000) / U));
  assert.deepEqual(a.map((x) => x.mesure), p.notes.map((n) => n.mesure));
  assert.equal(dureePieceMs(p, 60), 16000);
  const s = sequencePiece(p, 120);
  assert.equal(s.reduce((t, e) => t + e.dureeMs, 0), 8000);
  assert.deepEqual(s[0].midis, [p.notes[0].midi]);
});

test('melodieValide refuse deux sauts de suite dans le même sens et le triton', () => {
  assert.equal(melodieValide([0, 2, 4], [60, 64, 67], 4), false);
  assert.equal(melodieValide([0, 2, 1], [60, 64, 62], 4), true);
  assert.equal(melodieValide([3, 6], [65, 71], 4), false);
  assert.equal(melodieValide([0, 3], [60, 65], 2), false, 'saut trop grand pour le niveau');
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `node --test tests/piece.test.mjs`
Expected : FAIL, `Cannot find module '../src/piece.js'`.

- [ ] **Step 3 : écrire `src/piece.js`**

```js
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
```

- [ ] **Step 4 : lancer, vérifier le succès**

Run : `node --test tests/piece.test.mjs`
Expected : PASS (6 tests). Si « Pièce impossible à générer » apparaît pour une graine, augmenter le nombre
d'essais (500 → 2000) plutôt que d'assouplir les règles.

- [ ] **Step 5 : commit**

```bash
git add src/piece.js tests/piece.test.mjs
git commit -m "Déchiffrage : génération de pièces reproductibles" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : dessiner la partition (`partition.js`)

**Files :**
- Modify : `src/portee.js` (exporter `POS_DIESES`, `POS_BEMOLS`, `cleSol`)
- Create : `src/partition.js`
- Test : `tests/partition.test.mjs`

**Interfaces :**
- Consumes : pièce de `genererPiece` (Task 1) ; `positionPortee(n, octave, 'sol')`, `cleSol()`, `POS_DIESES.sol`, `POS_BEMOLS.sol` (`portee.js`, clé dessinée pour une ligne du bas à y = 90).
- Produces :
  - `geometriePartition(piece, { mesuresParLigne = 2 })` → `{ largeur, hauteur, systemes: [{ ligne, mesures: [{ m, x0, x1 }] }], basPortee(ligne) → y, ou(pos) → { x, ligne }, entete }`
  - `curseurA(geo, pos)` → `{ x, ligne, y1, y2 }`
  - `partitionSvg(piece, { mesuresParLigne = 2, marques = [], enTrop = [] })` → chaîne `<svg class="partition" …>` ; `marques[i] = { etat: 'juste'|'decale'|'fausse'|'manquee', joue?: 'fa4' }` ; `enTrop = [{ pos }]` ; contient une `<line class="curseur" visibility="hidden">` que l'interface déplace.

- [ ] **Step 1 : exporter ce qu'il faut de `portee.js`**

Dans `src/portee.js`, remplacer :
```js
const POS_DIESES = { sol: [8, 5, 9, 6, 3, 7, 4], fa: [6, 3, 7, 4, 1, 5, 2] };
const POS_BEMOLS = { sol: [4, 7, 3, 6, 2, 5, 1], fa: [2, 5, 1, 4, 0, 3, -1] };
```
par :
```js
export const POS_DIESES = { sol: [8, 5, 9, 6, 3, 7, 4], fa: [6, 3, 7, 4, 1, 5, 2] };
export const POS_BEMOLS = { sol: [4, 7, 3, 6, 2, 5, 1], fa: [2, 5, 1, 4, 0, 3, -1] };
```
et `function cleSol() {` par `export function cleSol() {`.

- [ ] **Step 2 : écrire les tests**

```js
// tests/partition.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererPiece } from '../src/piece.js';
import { partitionSvg, geometriePartition, curseurA } from '../src/partition.js';
import { U } from '../src/rythme.js';

const compter = (s, motif) => s.split(motif).length - 1;
function pieceOu(niveau, condition) {
  for (let g = 1; g < 5000; g++) { const p = genererPiece(niveau, g); if (condition(p)) return p; }
  throw new Error('aucune pièce trouvée');
}

test('une tête par note, une barre par mesure, barre finale, chiffrage, curseur', () => {
  const p = genererPiece(1, 3);
  const svg = partitionSvg(p);
  assert.ok(svg.startsWith('<svg class="partition"'));
  assert.equal(compter(svg, '<ellipse class="tete'), p.notes.length);
  assert.equal(compter(svg, 'class="barre-mesure"'), p.mesures);
  assert.equal(compter(svg, 'class="barre-finale"'), 1);
  assert.equal(compter(svg, 'class="chiffrage-partition"'), 2);
  assert.equal(compter(svg, 'class="curseur"'), 1);
});

test('armure répétée sur chaque ligne : dièses, bémols, rien en do', () => {
  assert.equal(compter(partitionSvg(pieceOu(2, (p) => p.tonalite === 'G')), '♯'), 2);
  assert.equal(compter(partitionSvg(pieceOu(2, (p) => p.tonalite === 'D')), '♯'), 4);
  assert.equal(compter(partitionSvg(pieceOu(2, (p) => p.tonalite === 'F')), '♭'), 2);
  const doMaj = partitionSvg(pieceOu(2, (p) => p.tonalite === 'C'));
  assert.equal(compter(doMaj, '♯') + compter(doMaj, '♭'), 0);
});

test('géométrie : 2 lignes de 2 mesures, x croissants, curseur qui avance, largeur téléphone', () => {
  const p = genererPiece(2, 11);
  const geo = geometriePartition(p);
  assert.equal(geo.systemes.length, 2);
  const places = p.notes.map((n) => geo.ou(n.pos));
  p.notes.forEach((n, i) => assert.equal(places[i].ligne, n.mesure < 2 ? 0 : 1));
  for (let i = 1; i < places.length; i++) if (places[i].ligne === places[i - 1].ligne) assert.ok(places[i].x > places[i - 1].x);
  const c1 = curseurA(geo, 0); const c2 = curseurA(geo, U);
  assert.ok(c2.x > c1.x && c1.ligne === 0);
  assert.equal(curseurA(geo, 2 * p.temps * U).ligne, 1);
  for (const t of ['C', 'D']) {
    const large = geometriePartition(pieceOu(2, (x) => x.tonalite === t));
    assert.ok(large.largeur <= 520, `trop large pour un téléphone : ${large.largeur}`);
  }
});

test('marques de correction et notes en trop', () => {
  const p = genererPiece(1, 5);
  const marques = p.notes.map(() => ({ etat: 'juste' }));
  marques[1] = { etat: 'fausse', joue: 'fa4' };
  marques[2] = { etat: 'manquee' };
  const svg = partitionSvg(p, { marques, enTrop: [{ pos: 6 }] });
  assert.equal(compter(svg, 'marque-juste'), p.notes.length - 2);
  assert.ok(svg.includes('marque-fausse') && svg.includes('>fa4<') && svg.includes('marque-manquee'));
  assert.equal(compter(svg, 'class="en-trop"'), 1);
});

test('croches liées par deux, noire pointée avec son point, ronde sans hampe', () => {
  const avecCroches = pieceOu(2, (p) => p.notes.some((n, i) => n.duree === U / 2 && n.pos % U === 0 && p.notes[i + 1]?.duree === U / 2));
  assert.ok(partitionSvg(avecCroches).includes('class="ligature"'));
  const pointee = pieceOu(3, (p) => p.notes.some((n) => n.token === 'n.'));
  assert.ok(partitionSvg(pointee).includes('class="point"'));
  const ronde = pieceOu(3, (p) => p.notes.at(-1).token === 'r');
  const svg = partitionSvg(ronde);
  assert.ok(svg.includes('tete vide'));
});
```

- [ ] **Step 3 : lancer, vérifier l'échec**

Run : `node --test tests/partition.test.mjs`
Expected : FAIL, `Cannot find module '../src/partition.js'`.

- [ ] **Step 4 : écrire `src/partition.js`**

```js
// Partition d'une pièce de déchiffrage : clé de sol, hauteurs et rythmes, plusieurs mesures sur
// plusieurs lignes, et le résultat de la correction coloré sur chaque note. Pur, sans DOM.

import { positionPortee, cleSol, POS_DIESES, POS_BEMOLS } from './portee.js';
import { U } from './rythme.js';

const PX_UNITE = 3.5;       // largeur d'une unité de temps (12 par temps)
const MARGE_MESURE = 16;    // avant la première note d'une mesure
const FIN_MESURE = 10;      // après la dernière
const DEMI_INTERLIGNE = 5;
const HAUT_SYSTEME = 130;   // hauteur d'une ligne de partition
const BAS_SYSTEME = 100;    // y de la ligne du bas de la portée, dans une ligne
const X_ARMURE = 56;

export function geometriePartition(piece, { mesuresParLigne = 2 } = {}) {
  const unitesMesure = piece.temps * U;
  const largeurMesure = MARGE_MESURE + unitesMesure * PX_UNITE + FIN_MESURE;
  const entete = X_ARMURE + Math.abs(piece.armure) * 9 + 4;
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
  const basPortee = (ligne) => ligne * HAUT_SYSTEME + BAS_SYSTEME;
  const ou = (pos) => {
    const m = Math.max(0, Math.min(piece.mesures - 1, Math.floor(pos / unitesMesure)));
    const ligne = Math.floor(m / mesuresParLigne);
    const mes = systemes[ligne].mesures[m % mesuresParLigne];
    return { x: mes.x0 + MARGE_MESURE + (pos - m * unitesMesure) * PX_UNITE, ligne };
  };
  return { largeur, hauteur: systemes.length * HAUT_SYSTEME, systemes, basPortee, ou, entete };
}

export function curseurA(geo, pos) {
  const { x, ligne } = geo.ou(pos);
  const bas = geo.basPortee(ligne);
  return { x, ligne, y1: bas - 60, y2: bas + 16 };
}

export function partitionSvg(piece, { mesuresParLigne = 2, marques = [], enTrop = [] } = {}) {
  const geo = geometriePartition(piece, { mesuresParLigne });
  const yDePos = (ligne, p) => geo.basPortee(ligne) - p * DEMI_INTERLIGNE;
  const parts = [];
  const posArm = (piece.armure > 0 ? POS_DIESES : POS_BEMOLS).sol;
  for (const s of geo.systemes) {
    const bas = geo.basPortee(s.ligne);
    const fin = s.mesures.at(-1).x1;
    for (let k = 0; k < 5; k++) parts.push(`<line class="ligne" x1="6" y1="${bas - 10 * k}" x2="${fin}" y2="${bas - 10 * k}" stroke-width="1"/>`);
    parts.push(`<g transform="translate(0 ${bas - 90})">${cleSol()}</g>`);
    for (let i = 0; i < Math.abs(piece.armure); i++) {
      parts.push(`<text class="alteration" x="${X_ARMURE + i * 9}" y="${yDePos(s.ligne, posArm[i]) + 5}" text-anchor="middle">${piece.armure > 0 ? '♯' : '♭'}</text>`);
    }
    if (s.ligne === 0) {
      const xc = geo.entete + 10;
      parts.push(`<text class="chiffrage-partition" x="${xc}" y="${bas - 21}" text-anchor="middle">${piece.temps}</text>`);
      parts.push(`<text class="chiffrage-partition" x="${xc}" y="${bas - 1}" text-anchor="middle">4</text>`);
    }
    for (const m of s.mesures) {
      const derniere = m.m === piece.mesures - 1;
      const xb = derniere ? m.x1 - 5 : m.x1;
      parts.push(`<line class="barre-mesure" x1="${xb}" y1="${bas - 40}" x2="${xb}" y2="${bas}" stroke-width="1.2"/>`);
      if (derniere) parts.push(`<line class="barre-finale" x1="${m.x1}" y1="${bas - 40}" x2="${m.x1}" y2="${bas}" stroke-width="3.5"/>`);
    }
  }

  const notes = piece.notes;
  const infos = notes.map((x) => {
    const { x: px, ligne } = geo.ou(x.pos);
    const p = positionPortee(x.note, x.octave, 'sol');
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
    const bas = geo.basPortee(ligne);
    for (let q = -2; q >= p; q -= 2) parts.push(`<line class="ligne" x1="${px - 10}" y1="${yDePos(ligne, q)}" x2="${px + 10}" y2="${yDePos(ligne, q)}" stroke-width="1.2"/>`);
    for (let q = 10; q <= p; q += 2) parts.push(`<line class="ligne" x1="${px - 10}" y1="${yDePos(ligne, q)}" x2="${px + 10}" y2="${yDePos(ligne, q)}" stroke-width="1.2"/>`);
    const marque = marques[i];
    const cls = `tete${x.duree >= 2 * U ? ' vide' : ''}${marque ? ` marque-${marque.etat}` : ''}`;
    parts.push(`<ellipse class="${cls}" cx="${px}" cy="${y}" rx="6.2" ry="4.4" transform="rotate(-20 ${px} ${y})"/>`);
    if (x.token.endsWith('.')) parts.push(`<circle class="point" cx="${px + 10}" cy="${p % 2 === 0 ? y - 4 : y}" r="1.7"/>`);
    if (marque?.joue) parts.push(`<text class="joue" x="${px}" y="${bas + 28}" text-anchor="middle">${marque.joue}</text>`);
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
  for (const e of enTrop) {
    const { x, ligne } = geo.ou(e.pos);
    parts.push(`<text class="en-trop" x="${x}" y="${geo.basPortee(ligne) - 50}" text-anchor="middle">×</text>`);
  }
  parts.push('<line class="curseur" x1="0" y1="0" x2="0" y2="0" stroke-width="2" visibility="hidden"/>');
  return `<svg class="partition" viewBox="0 0 ${geo.largeur} ${geo.hauteur}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="partition à déchiffrer">${parts.join('')}</svg>`;
}
```

- [ ] **Step 5 : lancer tous les tests**

Run : `node --test tests/*.test.mjs`
Expected : PASS (les tests de `portee` existants aussi).

- [ ] **Step 6 : commit**

```bash
git add src/portee.js src/partition.js tests/partition.test.mjs
git commit -m "Déchiffrage : partition avec hauteurs, rythmes et correction" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : entendre les notes jouées (`ecoute.js`, détection)

**Files :**
- Create : `src/ecoute.js`
- Test : `tests/ecoute.test.mjs`

**Interfaces :**
- Consumes : `detecterHauteur(buf, sampleRate, { fMin, fMax })`, `midiDeFrequence` (`voix.js`).
- Produces :
  - `REGLES_ECOUTE` : `{ seuilRms: 0.01, rapport: 1.5, refractaireMs: 90, fenetreHauteur: [40, 200], toleranceDecaleMs: 120, arretTemps: 0.75, tauxReussite: 0.85 }`
  - `trameDe(buf, sampleRate, tMs)` → `{ tMs, rms, f0: Hz | null }`
  - `detecterAttaques(trames)` → `[{ tMs, midi }]` (triées)
  - `creerEcoute()` → `null` hors navigateur, sinon `{ ouvrir(): Promise, demarrer(onTrame?), trames(): [...], arreter(): [...], fermer() }` (temps en `performance.now()`)

- [ ] **Step 1 : écrire les tests**

```js
// tests/ecoute.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trameDe, detecterAttaques, creerEcoute } from '../src/ecoute.js';

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// Trames simulées toutes les 15 ms. Un son de piano monte d'un coup puis décroît ; une note liée
// (legato: true) change de hauteur sans nouveau saut d'énergie. Pas de hauteur mesurable pendant 20 ms après l'attaque.
function simuler(notes, { finMs = notes.at(-1).tMs + 1200, pas = 15 } = {}) {
  const trames = [];
  for (let t = 0; t <= finMs; t += pas) {
    const avant = notes.filter((n) => n.tMs <= t);
    if (!avant.length) { trames.push({ tMs: t, rms: 0.002, f0: null }); continue; }
    const n = avant.at(-1);
    const frappe = [...avant].reverse().find((x) => !x.legato);
    const rms = 0.2 * Math.exp(-(t - frappe.tMs) / 700);
    trames.push({ tMs: t, rms, f0: rms >= 0.01 && t - n.tMs >= 20 ? hz(n.midi) : null });
  }
  return trames;
}
const proche = (a, b, tol) => Math.abs(a - b) <= tol;

test('trameDe : énergie et hauteur de sons de piano simulés, silence', () => {
  const sr = 48000; const n = 2048;
  for (const m of [60, 67, 72, 79]) {
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = [1, 0.5, 0.3, 0.2].reduce((s, a, k) => s + 0.1 * a * Math.sin((2 * Math.PI * hz(m) * (k + 1) * i) / sr), 0);
    const t = trameDe(buf, sr, 123);
    assert.equal(t.tMs, 123);
    assert.ok(t.rms > 0.05);
    assert.ok(Math.abs(t.f0 - hz(m)) / hz(m) < 0.01, `midi ${m} : f0 ${t.f0}`);
  }
  const muet = trameDe(new Float32Array(n), sr, 0);
  assert.equal(muet.rms, 0);
  assert.equal(muet.f0, null);
});

test('notes détachées : une attaque par note, à la bonne hauteur', () => {
  const notes = [300, 800, 1300, 1800].map((tMs, i) => ({ tMs, midi: [60, 62, 64, 65][i] }));
  const a = detecterAttaques(simuler(notes));
  assert.deepEqual(a.map((x) => x.midi), [60, 62, 64, 65]);
  a.forEach((x, i) => assert.ok(proche(x.tMs, notes[i].tMs, 15), `${x.tMs} au lieu de ${notes[i].tMs}`));
});

test('notes répétées : chaque frappe compte', () => {
  const a = detecterAttaques(simuler([300, 700, 1100, 1500].map((tMs) => ({ tMs, midi: 67 }))));
  assert.equal(a.length, 4);
  assert.ok(a.every((x) => x.midi === 67));
});

test('legato : un changement de hauteur sans saut d’énergie est une attaque', () => {
  const a = detecterAttaques(simuler([{ tMs: 300, midi: 60 }, { tMs: 800, midi: 62, legato: true }]));
  assert.deepEqual(a.map((x) => x.midi), [60, 62]);
  assert.ok(proche(a[1].tMs, 800, 30));
});

test('bruits sans hauteur et souffle faible : rien', () => {
  const trames = simuler([{ tMs: 0, midi: 60 }], { finMs: 2000 }).map((t) => ({ tMs: t.tMs, rms: 0.002, f0: null }));
  trames[60] = { tMs: trames[60].tMs, rms: 0.3, f0: null }; // clic : fort mais sans hauteur
  trames[61] = { tMs: trames[61].tMs, rms: 0.3, f0: null };
  assert.deepEqual(detecterAttaques(trames), []);
  const souffle = trames.map((t) => ({ ...t, rms: 0.006, f0: hz(60) }));
  assert.deepEqual(detecterAttaques(souffle), []);
});

test('creerEcoute hors navigateur : null', () => {
  assert.equal(creerEcoute({ getUserMedia: undefined, Contexte: undefined }), null);
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `node --test tests/ecoute.test.mjs`
Expected : FAIL, `Cannot find module '../src/ecoute.js'`.

- [ ] **Step 3 : écrire `src/ecoute.js`** (la fonction `aligner` viendra à la Task 4, dans ce même fichier)

```js
// Écoute d'une pièce jouée au piano : attaques et hauteurs à partir de trames du micro, puis
// comparaison avec la partition. trameDe, detecterAttaques et aligner sont purs et testés ;
// creerEcoute n'existe que dans un navigateur.

import { detecterHauteur, midiDeFrequence } from './voix.js';

export const REGLES_ECOUTE = {
  seuilRms: 0.01, rapport: 1.5, refractaireMs: 90, fenetreHauteur: [40, 200],
  toleranceDecaleMs: 120, arretTemps: 0.75, tauxReussite: 0.85,
};

function medianeEcoute(t) { const s = [...t].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// Main droite seulement : 180–1000 Hz suffit et allège le calcul sur téléphone.
export function trameDe(buf, sampleRate, tMs) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return { tMs, rms: Math.sqrt(s / buf.length), f0: detecterHauteur(buf, sampleRate, { fMin: 180, fMax: 1000 }) };
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

// Micro : une trame toutes les 15 ms. Pas de contrôle automatique du gain : il écraserait l'attaque des notes.
export function creerEcoute({ getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices), Contexte = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  if (!getUserMedia || !Contexte) return null;
  let ctx = null; let flux = null; let analyseur = null; let minuteur = null; let trames = [];
  return {
    async ouvrir() {
      if (analyseur) return;
      flux = await getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      ctx = new Contexte();
      if (ctx.state === 'suspended') await ctx.resume();
      analyseur = ctx.createAnalyser();
      analyseur.fftSize = 2048;
      ctx.createMediaStreamSource(flux).connect(analyseur);
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
    arreter() { if (minuteur) { clearInterval(minuteur); minuteur = null; } return [...trames]; },
    fermer() {
      this.arreter();
      if (flux) for (const p of flux.getTracks()) p.stop();
      flux = null; analyseur = null;
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    },
  };
}
```

- [ ] **Step 4 : lancer, vérifier le succès**

Run : `node --test tests/ecoute.test.mjs`
Expected : PASS (6 tests).

- [ ] **Step 5 : commit**

```bash
git add src/ecoute.js tests/ecoute.test.mjs
git commit -m "Déchiffrage : détection des notes jouées au micro" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : comparer avec la partition (`aligner`)

**Files :**
- Modify : `src/ecoute.js` (ajout de `aligner`)
- Test : `tests/ecoute.test.mjs` (ajout)

**Interfaces :**
- Consumes : `notesAttendues(piece, bpm)` (Task 1) → `[{ midi, tMs, mesure }]` ; `detecterAttaques` (Task 3) → `[{ tMs, midi }]`, les deux mesurés depuis le début de la mesure 1 ; `U` (`rythme.js`).
- Produces : `aligner(attendues, joues, { bpm })` →
  `{ notes: [{ etat: 'juste'|'decale'|'fausse'|'manquee', jouee: midi|null, ecartMs: int|null }], enTrop: [{ tMs, midi, pos }], justes, total, latenceMs, ecartMedianMs: int|null, arrets: [numéros de mesure à partir de 1], compte, rienEntendu, parasites, reussi }`.
  `justes` compte les notes justes **et** décalées (bonne hauteur).

- [ ] **Step 1 : ajouter les tests** à la fin de `tests/ecoute.test.mjs` (et `aligner` à l'import du haut)

```js
const MELODIE = [60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 64, 62];
const ATT = MELODIE.map((midi, i) => ({ midi, tMs: i * 1000, mesure: Math.floor(i / 4) })); // 60 à la noire, 3 mesures
const jouer = (decal = 150) => ATT.map((a) => ({ midi: a.midi, tMs: a.tMs + decal }));
const etats = (r) => r.notes.map((n) => n.etat);

test('aligner : jeu parfait avec le retard du micro', () => {
  const r = aligner(ATT, jouer(150), { bpm: 60 });
  assert.deepEqual(etats(r), ATT.map(() => 'juste'));
  assert.equal(r.latenceMs, 150);
  assert.equal(r.ecartMedianMs, 0);
  assert.deepEqual(r.arrets, []);
  assert.equal(r.justes, 12); assert.equal(r.total, 12);
  assert.equal(r.reussi, true); assert.equal(r.compte, true);
});

test('aligner : note manquée', () => {
  const j = jouer(); j.splice(3, 1);
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.notes[3].etat, 'manquee');
  assert.equal(r.notes[3].jouee, null);
  assert.equal(r.justes, 11);
  assert.equal(r.reussi, true, '11/12 ≥ 85 %');
});

test('aligner : note en trop, placée sur la partition', () => {
  const j = jouer(); j.splice(3, 0, { midi: 71, tMs: 2650 });
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.enTrop.length, 1);
  assert.equal(r.enTrop[0].midi, 71);
  assert.equal(r.enTrop[0].pos, 30);
  assert.equal(r.justes, 12);
});

test('aligner : fausse note', () => {
  const j = jouer(); j[2].midi = 65;
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.notes[2].etat, 'fausse');
  assert.equal(r.notes[2].jouee, 65);
  assert.equal(r.justes, 11);
});

test('aligner : note décalée, toujours juste de hauteur', () => {
  const j = jouer(); j[5].tMs += 250;
  const r = aligner(ATT, j, { bpm: 60 });
  assert.equal(r.notes[5].etat, 'decale');
  assert.equal(r.notes[5].ecartMs, 250);
  assert.equal(r.justes, 12);
  assert.deepEqual(r.arrets, []);
});

test('aligner : arrêt au milieu, la suite reste juste', () => {
  const j = jouer(); for (let i = 6; i < j.length; i++) j[i].tMs += 2000;
  const r = aligner(ATT, j, { bpm: 60 });
  assert.deepEqual(r.arrets, [2]);
  assert.deepEqual(etats(r), ATT.map(() => 'juste'));
  assert.equal(r.reussi, false);
});

test('aligner : rien entendu, sons parasites', () => {
  const vide = aligner(ATT, [], { bpm: 60 });
  assert.equal(vide.rienEntendu, true); assert.equal(vide.compte, false); assert.equal(vide.reussi, false);
  assert.deepEqual(etats(vide), ATT.map(() => 'manquee'));
  assert.equal(vide.ecartMedianMs, null);
  const bruit = [...jouer(), ...Array.from({ length: 8 }, (_, i) => ({ midi: 90, tMs: 300 + i * 1300 }))].sort((a, b) => a.tMs - b.tMs);
  const r = aligner(ATT, bruit, { bpm: 60 });
  assert.equal(r.parasites, true); assert.equal(r.compte, false); assert.equal(r.reussi, false);
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `node --test tests/ecoute.test.mjs`
Expected : FAIL, `aligner` n'est pas exporté.

- [ ] **Step 3 : ajouter `aligner` dans `src/ecoute.js`**

Ajouter `import { U } from './rythme.js';` sous l'import de `voix.js`, puis, après `detecterAttaques` :

```js
// Compare les notes jouées à la partition.
// 1. Alignement par programmation dynamique : l'ordre des notes et leur hauteur comptent d'abord,
//    le temps ne sert qu'à départager (une note répétée, par exemple) ; un arrêt ne casse donc pas l'alignement.
// 2. Retard constant (micro, réaction) : médiane des écarts des premières notes justes, retirée partout.
// 3. Arrêt : l'écart grandit de plus de ¾ de temps d'une note à la suivante ; on repart de ce nouvel écart.
export function aligner(attendues, joues, { bpm, regles = REGLES_ECOUTE } = {}) {
  const battement = 60000 / bpm;
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
  const memes = paires.filter((p) => p.a.midi === p.j.midi);
  const base = (memes.length ? memes : paires).slice(0, 4);
  const L = base.length ? medianeEcoute(base.map((p) => p.j.tMs - p.a.tMs)) : 0;

  const notes = attendues.map(() => ({ etat: 'manquee', jouee: null, ecartMs: null }));
  const arrets = [];
  let derive = 0; let precedent = null;
  for (const p of paires) {
    const ecart = p.j.tMs - p.a.tMs - L;
    if (precedent !== null && ecart - precedent > regles.arretTemps * battement) {
      if (!arrets.includes(p.a.mesure + 1)) arrets.push(p.a.mesure + 1);
      derive = ecart;
    }
    precedent = ecart;
    const local = Math.round(ecart - derive);
    const bonne = p.a.midi === p.j.midi;
    notes[p.i] = { etat: !bonne ? 'fausse' : Math.abs(local) > regles.toleranceDecaleMs ? 'decale' : 'juste', jouee: p.j.midi, ecartMs: local };
  }
  const enTrop = restes.reverse().map((j) => ({ tMs: joues[j].tMs, midi: joues[j].midi, pos: Math.max(0, Math.round(((joues[j].tMs - L) / battement) * U)) }));
  const bons = notes.filter((x) => x.etat === 'juste' || x.etat === 'decale');
  const justes = bons.length;
  const rienEntendu = m === 0;
  const parasites = enTrop.length > 0.5 * n;
  const compte = !rienEntendu && !parasites;
  return {
    notes, enTrop, justes, total: n, latenceMs: Math.round(L),
    ecartMedianMs: bons.length ? Math.round(medianeEcoute(bons.map((x) => Math.abs(x.ecartMs)))) : null,
    arrets, compte, rienEntendu, parasites,
    reussi: compte && n > 0 && justes / n >= regles.tauxReussite && arrets.length === 0,
  };
}
```

- [ ] **Step 4 : lancer, vérifier le succès**

Run : `node --test tests/ecoute.test.mjs`
Expected : PASS (13 tests).

- [ ] **Step 5 : commit**

```bash
git add src/ecoute.js tests/ecoute.test.mjs
git commit -m "Déchiffrage : comparaison du jeu avec la partition" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : progression du déchiffrage et sauvegardes (`dechiffrage.js`, `progression.js`)

**Files :**
- Create : `src/dechiffrage.js`
- Modify : `src/progression.js` (`etatInitial`, `normaliser`, nouvelle `lireSauvegarde`)
- Test : `tests/dechiffrage.test.mjs`, `tests/progression.test.mjs` (ajout)

**Interfaces :**
- Consumes : `NIVEAUX_PIECE` (Task 1) ; résultat de `aligner` (Task 4) : `{ justes, total, ecartMedianMs, arrets: [], reussi }`.
- Produces :
  - `REGLES_DECHIFFRAGE = { bpmDepart: 60, pasBpm: 6, bpmMin: 50, bpmMax: 96, fenetre: 8, reussitesPourDebloquer: 6, historiqueMax: 100 }`
  - `etatDechiffrageInitial()` → `{ niveau: 1, bpm: { 1: 60, 2: 60, 3: 60 }, historique: [] }`
  - `normaliserDechiffrage(source)` → même forme
  - `enregistrerPiece(etat, { niveau, graine, bpm, resultat }, now)` → `{ debloque: niveau|null, bpmApres }` (modifie `etat.dechiffrage`)
  - `etatDeblocageDechiffrage(etat)` → `{ niveau, suivant, reussites, jouees, cible, fenetre, pret }` ou `null` au dernier niveau
  - dans `progression.js` : `etat.dechiffrage`, `etat.prefs.clic` (false par défaut), `lireSauvegarde(texte)` → `{ ok: true, etat }` ou `{ ok: false, erreur }`

- [ ] **Step 1 : écrire `tests/dechiffrage.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGLES_DECHIFFRAGE, etatDechiffrageInitial, normaliserDechiffrage, enregistrerPiece, etatDeblocageDechiffrage } from '../src/dechiffrage.js';

const J0 = Date.UTC(2026, 8, 25, 9);
const resultat = (reussi) => ({ justes: reussi ? 16 : 10, total: 16, ecartMedianMs: 40, arrets: reussi ? [] : [3], reussi });
const etatNeuf = () => ({ dechiffrage: etatDechiffrageInitial() });
const jouer = (etat, niveau, reussi) => enregistrerPiece(etat, { niveau, graine: 1, bpm: etat.dechiffrage.bpm[niveau], resultat: resultat(reussi) }, J0);

test('état initial et normalisation', () => {
  assert.deepEqual(etatDechiffrageInitial(), { niveau: 1, bpm: { 1: 60, 2: 60, 3: 60 }, historique: [] });
  assert.deepEqual(normaliserDechiffrage(undefined), etatDechiffrageInitial());
  assert.deepEqual(normaliserDechiffrage({ niveau: 9, bpm: { 2: 72 }, historique: 'x' }), { niveau: 1, bpm: { 1: 60, 2: 72, 3: 60 }, historique: [] });
  assert.equal(normaliserDechiffrage({ niveau: 2, bpm: {}, historique: [] }).niveau, 2);
});

test('tempo : +6 après une réussite, −6 après un échec, bornes 50–96', () => {
  const e = etatNeuf();
  assert.equal(jouer(e, 1, true).bpmApres, 66);
  assert.equal(jouer(e, 1, false).bpmApres, 60);
  e.dechiffrage.bpm[1] = 94; assert.equal(jouer(e, 1, true).bpmApres, 96);
  e.dechiffrage.bpm[1] = 52; assert.equal(jouer(e, 1, false).bpmApres, 50);
  assert.equal(e.dechiffrage.historique.length, 4);
  assert.deepEqual(e.dechiffrage.historique[0], { date: J0, niveau: 1, graine: 1, bpm: 60, justes: 16, total: 16, ecartMs: 40, arrets: 0, reussi: true });
});

test('déblocage : 6 réussites sur les 8 dernières pièces du niveau', () => {
  const e = etatNeuf();
  jouer(e, 1, false); jouer(e, 1, false);
  for (let i = 0; i < 5; i++) assert.equal(jouer(e, 1, true).debloque, null);
  assert.deepEqual(etatDeblocageDechiffrage(e), { niveau: 1, suivant: 2, reussites: 5, jouees: 7, cible: 6, fenetre: 8, pret: false });
  assert.equal(jouer(e, 1, true).debloque, 2);
  assert.equal(e.dechiffrage.niveau, 2);
  assert.equal(etatDeblocageDechiffrage(e).reussites, 0, 'le niveau 2 repart de zéro');
});

test('trois échecs dans la fenêtre : pas de déblocage', () => {
  const e = etatNeuf();
  for (const r of [true, false, true, false, true, false, true, true]) jouer(e, 1, r);
  assert.equal(e.dechiffrage.niveau, 1);
});

test('dernier niveau : plus rien à débloquer ; historique plafonné', () => {
  const e = etatNeuf(); e.dechiffrage.niveau = 3;
  assert.equal(etatDeblocageDechiffrage(e), null);
  for (let i = 0; i < 105; i++) assert.equal(jouer(e, 3, true).debloque, null);
  assert.equal(e.dechiffrage.historique.length, REGLES_DECHIFFRAGE.historiqueMax);
});
```

- [ ] **Step 2 : ajouter à `tests/progression.test.mjs`** (et `lireSauvegarde` à l'import depuis `../src/progression.js`)

```js
test('état : déchiffrage et préférence du clic, y compris depuis un ancien état', () => {
  const e = etatInitial();
  assert.equal(e.dechiffrage.niveau, 1);
  assert.equal(e.prefs.clic, false);
  const ancien = normaliser({ version: 1, cartes: {}, niveaux: { A: 2 }, seances: [], prefs: { silence: true } });
  assert.deepEqual(ancien.dechiffrage, etatInitial().dechiffrage);
  assert.equal(ancien.prefs.silence, true);
  assert.equal(ancien.prefs.clic, false);
  const garde = normaliser({ ...etatInitial(), dechiffrage: { niveau: 2, bpm: { 1: 72, 2: 60, 3: 60 }, historique: [{ niveau: 1 }] } });
  assert.equal(garde.dechiffrage.niveau, 2);
  assert.equal(garde.dechiffrage.historique.length, 1);
});

test('lireSauvegarde : accepte un export, refuse le reste', () => {
  const e = etatInitial(); e.niveaux.B = 3;
  const ok = lireSauvegarde(JSON.stringify(e));
  assert.equal(ok.ok, true);
  assert.equal(ok.etat.niveaux.B, 3);
  assert.equal(lireSauvegarde('pas du json').ok, false);
  assert.equal(lireSauvegarde('{"version":2}').ok, false);
  assert.match(lireSauvegarde('[]').erreur, /sauvegarde/);
});
```

- [ ] **Step 3 : lancer, vérifier l'échec**

Run : `node --test tests/dechiffrage.test.mjs tests/progression.test.mjs`
Expected : FAIL (module `dechiffrage.js` absent, `lireSauvegarde` non exportée).

- [ ] **Step 4 : écrire `src/dechiffrage.js`**

```js
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
  for (const k of Object.keys(bpm)) if (Number.isFinite(source.bpm?.[k])) bpm[k] = source.bpm[k];
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
```

- [ ] **Step 5 : modifier `src/progression.js`**

Ajouter l'import en tête :
```js
import { etatDechiffrageInitial, normaliserDechiffrage } from './dechiffrage.js';
```
Dans `etatInitial()`, remplacer `prefs: { silence: false },` par :
```js
    prefs: { silence: false, clic: false },
    dechiffrage: etatDechiffrageInitial(),
```
Dans `normaliser()`, après la ligne `prefs: { ...base.prefs, ...(etat.prefs || {}) },` ajouter :
```js
    dechiffrage: normaliserDechiffrage(etat.dechiffrage),
```
Après `normaliser`, ajouter :
```js
// Import d'une sauvegarde collée par l'élève (export JSON de l'écran Progression).
export function lireSauvegarde(texte) {
  let brut;
  try { brut = JSON.parse(texte); } catch { return { ok: false, erreur: 'Texte illisible : colle l’export complet, du premier { au dernier }.' }; }
  if (!brut || typeof brut !== 'object' || brut.version !== 1 || typeof brut.cartes !== 'object') {
    return { ok: false, erreur: 'Ce texte n’est pas une sauvegarde de l’app.' };
  }
  return { ok: true, etat: normaliser(brut) };
}
```

- [ ] **Step 6 : lancer tous les tests**

Run : `node --test tests/*.test.mjs`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add src/dechiffrage.js src/progression.js tests/dechiffrage.test.mjs tests/progression.test.mjs
git commit -m "Déchiffrage : progression, tempo, déblocage ; import de sauvegarde" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : build

**Files :**
- Modify : `build.mjs:8` (ordre des modules) et écriture de `dist/index.html`
- Test : `tests/build.test.mjs`

**Interfaces :**
- Produces : `dist/index.html` = la page complète (identique à `dist/harmonie.html`), publiée par la Task 8.

- [ ] **Step 1 : étendre le test** — à la fin du test existant de `tests/build.test.mjs`, ajouter :

```js
  const index = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.equal(index, page);
  for (const f of ['genererPiece', 'partitionSvg', 'detecterAttaques', 'aligner', 'enregistrerPiece']) assert.ok(page.includes(`function ${f}(`), `${f} absent de la page`);
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run : `node --test tests/build.test.mjs`
Expected : FAIL (`dist/index.html` absent).

- [ ] **Step 3 : modifier `build.mjs`**

Remplacer la ligne `const ORDRE = …` par :
```js
const ORDRE = ['theorie', 'rythme', 'portee', 'voix', 'piece', 'partition', 'ecoute', 'questions', 'dechiffrage', 'progression', 'stockage', 'clavier', 'audio', 'interface'];
```
et, après `writeFileSync(join(racine, 'dist/harmonie.html'), page);`, ajouter :
```js
  writeFileSync(join(racine, 'dist/index.html'), page); // page publiée sur GitHub Pages
```

- [ ] **Step 4 : lancer tous les tests**

Run : `node --test tests/*.test.mjs && node build.mjs`
Expected : PASS, puis `dist/harmonie.html : … Ko`. Une erreur « Déclarations en double entre modules » signale un nom de premier niveau à renommer.

- [ ] **Step 5 : commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "Build : modules du déchiffrage et page index.html" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : écrans (déchiffrage, test du micro, sauvegarde)

**Files :**
- Modify : `index.html`, `src/style.css`, `src/interface.js`

**Interfaces :**
- Consumes : tout ce qui précède — `genererPiece`, `notesAttendues`, `sequencePiece`, `dureePieceMs` ; `partitionSvg`, `geometriePartition`, `curseurA` ; `creerEcoute`, `detecterAttaques`, `aligner` ; `enregistrerPiece`, `etatDeblocageDechiffrage` ; `lireSauvegarde` ; `midiDeFrequence` ; `U`.
- Produces : écrans `dechiffrage` et `test-micro`, carte « Déchiffrage au piano » sur l'accueil, bloc Déchiffrage et « Sauvegarde et bilan » sur l'écran Progression.

Pas de test automatique (le DOM n'est pas testé dans ce projet) : vérification à la main au Step 6.

- [ ] **Step 1 : `index.html`**

a. Texte du mode silencieux : remplacer
`Aucune question sonore : Oreille, Chant et les niveaux sonores du Rythme sont mis de côté.`
par
`Aucune question sonore : Oreille, Chant, Déchiffrage et les niveaux sonores du Rythme sont mis de côté.`

b. Écran Progression : après `<div id="prog-dimensions" style="display:flex;flex-direction:column;gap:12px"></div>` ajouter
```html
    <div class="bloc" id="prog-dechiffrage"></div>
```
et remplacer le bloc
```html
    <div class="bloc">
      <h3>Pour le prof</h3>
      <button class="btn btn-second" id="btn-exporter">Afficher l'export JSON</button>
      <textarea id="export-zone" hidden readonly></textarea>
    </div>
```
par
```html
    <div class="bloc">
      <h3>Sauvegarde et bilan</h3>
      <p class="sous">« Copier » met toute ta progression dans le presse-papiers : colle-la à Claude avant une leçon, ou garde-la comme sauvegarde.</p>
      <button class="btn btn-second" id="btn-exporter">Copier ma progression</button>
      <textarea id="export-zone" hidden readonly></textarea>
      <button class="btn btn-lien" id="btn-importer">Importer une sauvegarde</button>
      <div id="import-zone" hidden style="display:flex;flex-direction:column;gap:8px">
        <textarea id="import-texte" placeholder="Colle ici une sauvegarde"></textarea>
        <button class="btn btn-second" id="btn-importer-valider">Remplacer ma progression</button>
        <p class="sous" id="import-message"></p>
      </div>
    </div>
```

c. Deux écrans, juste après la fermeture `</section>` de `ecran-progression` :
```html
  <section id="ecran-dechiffrage" hidden>
    <div class="entete">
      <div>
        <p class="eyebrow" id="dech-niveau"></p>
        <h2>Déchiffrage</h2>
      </div>
      <button class="btn btn-lien" id="btn-dech-accueil" style="width:auto">Accueil</button>
    </div>
    <div class="partition-boite" id="dech-partition"></div>
    <div class="pulsation" id="dech-pulsation" hidden><i></i></div>
    <p class="sous centre" id="dech-etat"></p>
    <div id="dech-correction" hidden></div>
    <div class="dech-actions" id="dech-actions"></div>
    <label class="option" for="opt-clic">
      <input type="checkbox" id="opt-clic">
      <span><b>Clic sonore</b><br><span class="sous">Le micro l'entend aussi : garde-le coupé si le point qui clignote te suffit.</span></span>
    </label>
    <button class="btn btn-lien" id="btn-test-micro">Tester le micro</button>
  </section>

  <section id="ecran-test-micro" hidden>
    <div class="entete">
      <h2>Test du micro</h2>
      <button class="btn btn-lien" id="btn-test-retour" style="width:auto">Retour</button>
    </div>
    <p class="sous">Pose le téléphone sur le piano et joue quelques notes, lentement puis plus vite, détachées puis liées. L'app affiche ce qu'elle entend.</p>
    <div class="note-chantee" id="test-note">–</div>
    <div class="jauge"><i id="test-niveau"></i></div>
    <p class="sous" id="test-fil"></p>
  </section>
```

- [ ] **Step 2 : `src/style.css`** — ajouter à la fin

```css
/* Déchiffrage */
.partition-boite { background: var(--surface); border: 1px solid var(--bord); border-radius: 12px; padding: 8px 4px; }
.partition { width: 100%; height: auto; display: block; }
.partition .ligne { stroke: var(--texte-2); }
.partition .cle { stroke: var(--texte); fill: var(--texte); }
.partition path.cle { fill: none; }
.partition .alteration { font-family: var(--police); font-size: 17px; fill: var(--texte); }
.partition .chiffrage-partition { font-family: var(--police-titre); font-size: 20px; font-weight: 600; fill: var(--texte); }
.partition .barre-mesure, .partition .barre-finale { stroke: var(--texte); }
.partition .tete, .partition .point { fill: var(--texte); stroke: var(--texte); }
.partition .tete.vide { fill: none; stroke-width: 1.6; }
.partition .hampe, .partition .ligature, .partition .crochet { stroke: var(--texte); }
.partition .tete.marque-juste { fill: var(--ok); stroke: var(--ok); }
.partition .tete.marque-decale { fill: var(--laiton); stroke: var(--laiton); }
.partition .tete.marque-fausse { fill: var(--ko); stroke: var(--ko); }
.partition .tete.vide.marque-juste, .partition .tete.vide.marque-decale, .partition .tete.vide.marque-fausse { fill: none; stroke-width: 2.2; }
.partition .tete.marque-manquee { fill: none; stroke: var(--ko); stroke-width: 1.8; stroke-dasharray: 3 2; }
.partition .joue { font-family: var(--police); font-size: 11px; font-weight: 700; fill: var(--ko); }
.partition .en-trop { font-family: var(--police); font-size: 16px; font-weight: 700; fill: var(--texte-2); }
.partition .curseur { stroke: var(--accent); }
.pulsation { display: flex; justify-content: center; }
.pulsation i { width: 22px; height: 22px; border-radius: 50%; background: var(--surface-2); }
.pulsation.actif i { background: var(--accent); }
.dech-actions { display: grid; gap: 10px; }
```

- [ ] **Step 3 : `src/interface.js` — imports, écrans, état**

Remplacer les imports de `progression.js`, `rythme.js`, `voix.js` par :
```js
import {
  REGLES, seuils, delaiBoite, normaliser, composerSeance, enregistrerReponse, cloreSeance, bilan, cartesDues,
  FileSeance, mediane, lireSauvegarde,
} from './progression.js';
import { cellule, onsetsMs, notationSvg, evaluerFrappe, commentaireFrappe, frappeSvg, U } from './rythme.js';
import { creerMicro, evaluerChant, commentaireChant, midiDeFrequence } from './voix.js';
import { genererPiece, notesAttendues, sequencePiece, dureePieceMs } from './piece.js';
import { partitionSvg, geometriePartition, curseurA } from './partition.js';
import { creerEcoute, detecterAttaques, aligner } from './ecoute.js';
import { enregistrerPiece, etatDeblocageDechiffrage } from './dechiffrage.js';
```
Remplacer `const ECRANS = ['accueil', 'seance', 'bilan', 'progression'];` par :
```js
const ECRANS = ['accueil', 'seance', 'bilan', 'progression', 'dechiffrage', 'test-micro'];
```
Après la ligne `const NOMS_CLASSE = …`, ajouter :
```js
let dech = null;       // pièce de déchiffrage en cours
let ecoute = null;     // micro du déchiffrage, ouvert à la première pièce jouée
let testMicro = null;  // minuteur de l'écran « Test du micro »
const nomMidi = (m) => `${NOMS_CLASSE[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
```

- [ ] **Step 4 : `src/interface.js` — accueil et progression**

Dans `rendreAccueil()`, juste après la boucle `for (const [dim, d] of Object.entries(b.dimensions)) { … }`, ajouter :
```js
  // Déchiffrage : pas de cartes, sa propre carte d'accueil
  const dd = etat.dechiffrage;
  const bloque = etatDeblocageDechiffrage(etat);
  const muetJ = !MICRO_PERMIS || silence;
  const nbPieces = dd.historique.length;
  conteneur.append(el('button', { class: `dim${muetJ ? ' inactif' : ''}`, type: 'button', disabled: muetJ ? '' : undefined, onclick: ouvrirDechiffrage },
    el('span', { class: 'nom' }, 'Déchiffrage au piano'),
    el('span', { class: 'niveau' }, `niv. ${dd.niveau}`),
    el('span', { class: 'barre' }, el('i', { style: `width:${bloque ? pourcent(bloque.reussites, bloque.cible) : 100}%` })),
    el('span', { class: 'detail' }, `${nbPieces} pièce${nbPieces > 1 ? 's' : ''} jouée${nbPieces > 1 ? 's' : ''} · ${dd.bpm[dd.niveau]} à la noire`),
    el('span', { class: 'detail manque' }, !MICRO_PERMIS ? 'Micro indisponible ici : déchiffrage mis de côté'
      : silence ? 'Mise de côté en mode silencieux'
        : bloque ? `Niv. ${bloque.suivant} : ${bloque.reussites}/${bloque.cible} réussites sur les ${bloque.fenetre} dernières pièces` : 'Tous les niveaux ouverts')));
```
Dans `rendreProgression()`, juste avant `rendreExplicationBoites();`, ajouter :
```js
  const dd = etat.dechiffrage;
  const bloque = etatDeblocageDechiffrage(etat);
  const recentes = dd.historique.slice(-5).reverse();
  const date = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  $('prog-dechiffrage').replaceChildren(
    el('h3', {}, 'Déchiffrage au piano'),
    el('p', { class: 'sous' }, `Niveau ${dd.niveau} · tempo ${Object.entries(dd.bpm).map(([n, v]) => `niv. ${n} : ${v}`).join(', ')}`),
    el('p', { class: 'sous' }, bloque ? `Pour ouvrir le niveau ${bloque.suivant} : ${bloque.reussites}/${bloque.cible} réussites sur les ${bloque.fenetre} dernières pièces (${bloque.jouees} jouée${bloque.jouees > 1 ? 's' : ''}).` : 'Tous les niveaux sont ouverts.'),
    recentes.length
      ? el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Niv.'), el('th', {}, 'Justes'), el('th', {}, 'Tempo'))),
        el('tbody', {}, ...recentes.map((h) => el('tr', {}, el('td', {}, date(h.date)), el('td', {}, String(h.niveau)), el('td', {}, `${h.justes}/${h.total}${h.reussi ? ' ✓' : ''}`), el('td', {}, String(h.bpm))))))
      : el('p', { class: 'sous' }, 'Aucune pièce jouée pour l’instant.'),
  );
  $('btn-exporter').textContent = 'Copier ma progression';
  $('import-zone').hidden = true;
```

- [ ] **Step 5 : `src/interface.js` — déchiffrage, test du micro, sauvegarde**

Avant la section `// ---------- Démarrage ----------`, ajouter :
```js
// ---------- Déchiffrage : préparer, jouer au piano, corriger au micro ----------
function boutonDech(texte, action, classe = 'btn-second') { return el('button', { class: `btn ${classe}`, type: 'button', onclick: action }, texte); }
function actionsDech(...boutons) { $('dech-actions').replaceChildren(...boutons); }

function ouvrirDechiffrage() {
  $('opt-clic').checked = !!etat.prefs.clic;
  montrer('dechiffrage');
  nouvellePiece();
}

function nouvellePiece() {
  const d = etat.dechiffrage;
  const graine = Math.floor(Math.random() * 2 ** 31);
  dech = { piece: genererPiece(d.niveau, graine), graine, niveau: d.niveau, bpm: d.bpm[d.niveau], rejoue: false, phase: null, minuteur: null, raf: null, origine: 0 };
  preparerPiece();
}

function arreterDechiffrage() {
  if (!dech) return;
  clearInterval(dech.minuteur); dech.minuteur = null;
  cancelAnimationFrame(dech.raf); dech.raf = null;
  if (ecoute) ecoute.arreter();
  if (lecteur) { lecteur.arreter(); if (lecteur.arreterPercussions) lecteur.arreterPercussions(); }
  $('dech-pulsation').hidden = true;
}

function preparerPiece() {
  arreterDechiffrage();
  dech.phase = 'preparation';
  const { piece } = dech;
  $('dech-niveau').textContent = `Niveau ${dech.niveau} · ${dech.bpm} à la noire${dech.rejoue ? ' · rejouée, ne compte pas' : ''}`;
  $('dech-partition').innerHTML = partitionSvg(piece);
  $('dech-correction').hidden = true;
  const depart = `${nomFr(piece.notes[0].note)}${piece.notes[0].octave}`;
  let reste = 45;
  const texte = () => `${nomFr(piece.tonique)} majeur · ${piece.temps} temps · départ sur ${depart}. Repère le passage difficile et décide de ne pas t’arrêter. ${reste} s`;
  $('dech-etat').textContent = texte();
  dech.minuteur = setInterval(() => { reste -= 1; if (reste <= 0) jouerPiece(); else $('dech-etat').textContent = texte(); }, 1000);
  actionsDech(boutonDech('▶ Je suis prêt', jouerPiece, 'btn-principal'));
}

async function jouerPiece() {
  arreterDechiffrage();
  dech.phase = 'jeu';
  actionsDech();
  ecoute ||= creerEcoute();
  if (!ecoute) { $('dech-etat').textContent = 'Micro indisponible sur cet appareil.'; actionsDech(boutonDech('Retour à la préparation', preparerPiece)); return; }
  $('dech-etat').textContent = 'Micro…';
  try { await ecoute.ouvrir(); } catch {
    ecoute = null;
    $('dech-etat').textContent = 'Le micro a été refusé. Autorise-le pour ce site dans les réglages du navigateur, puis réessaie.';
    actionsDech(boutonDech('Réessayer', preparerPiece));
    return;
  }
  if (!dech || dech.phase !== 'jeu') return; // quitté pendant la demande d'autorisation
  const { piece, bpm } = dech;
  const battement = 60000 / bpm;
  const decompteMs = piece.temps * battement;
  const dureeMs = dureePieceMs(piece, bpm);
  let origine = performance.now() + 300 + decompteMs; // début de la mesure 1, après une mesure de décompte
  if (etat.prefs.clic) {
    lecteur ||= creerLecteur();
    if (lecteur) {
      if (!lecteur.jouerPercussions) equiperPercussions(lecteur);
      const seq = sequencePercussions({ bpm, temps: piece.temps, mesures: piece.mesures, decompte: 1 });
      origine = lecteur.jouerPercussions(seq.evenements) + seq.origineMs;
    }
  }
  dech.origine = origine;
  ecoute.demarrer();
  const geo = geometriePartition(piece);
  const curseur = $('dech-partition').querySelector('.curseur');
  const pulsation = $('dech-pulsation');
  pulsation.hidden = false;
  const boucle = () => {
    if (!dech || dech.phase !== 'jeu') return;
    const t = performance.now() - origine;
    const depuis = t + decompteMs;
    pulsation.classList.toggle('actif', depuis >= 0 && depuis % battement < 150);
    if (t < 0) $('dech-etat').textContent = depuis < 0 ? 'Prépare-toi…' : `Décompte : ${Math.floor(depuis / battement) + 1}`;
    else {
      $('dech-etat').textContent = 'Joue, sans t’arrêter !';
      const c = curseurA(geo, (Math.min(t, dureeMs) / battement) * U);
      for (const [k, v] of [['x1', c.x], ['x2', c.x], ['y1', c.y1], ['y2', c.y2], ['visibility', 'visible']]) curseur.setAttribute(k, v);
    }
    if (t > dureeMs + 800) { terminerPiece(); return; }
    dech.raf = requestAnimationFrame(boucle);
  };
  dech.raf = requestAnimationFrame(boucle);
}

function terminerPiece() {
  const trames = ecoute.arreter().map((x) => ({ ...x, tMs: x.tMs - dech.origine }));
  arreterDechiffrage();
  dech.phase = 'correction';
  const r = aligner(notesAttendues(dech.piece, dech.bpm), detecterAttaques(trames), { bpm: dech.bpm });
  const marques = r.notes.map((n) => ({ etat: n.etat, joue: n.etat === 'fausse' ? nomMidi(n.jouee) : null }));
  $('dech-partition').innerHTML = partitionSvg(dech.piece, { marques, enTrop: r.enTrop });
  $('dech-etat').textContent = '';
  const zone = $('dech-correction');
  zone.replaceChildren();
  zone.hidden = false;
  zone.className = `correction ${r.reussi ? 'juste' : 'faux'}`;
  if (!r.compte) {
    zone.append(
      el('p', { class: 'explication' }, r.rienEntendu
        ? 'Je n’ai rien entendu : rapproche le téléphone du piano ou monte le volume, puis réessaie.'
        : 'Beaucoup de sons parasites : je ne peux pas corriger cette fois. Coupe le clic sonore ou le bruit autour, puis réessaie.'),
      el('p', { class: 'boite-info' }, 'Cette pièce ne compte pas.'));
  } else {
    const arrets = r.arrets.length ? `arrêt mesure ${r.arrets.join(', ')}` : 'aucun arrêt';
    const trop = r.enTrop.length ? ` · ${r.enTrop.length} note${r.enTrop.length > 1 ? 's' : ''} en trop` : '';
    zone.append(
      el('div', { class: 'verdict' }, el('span', {}, r.reussi ? 'Réussi !' : 'Pas encore'), el('span', {}, `${r.justes}/${r.total} justes`)),
      el('p', { class: 'explication' }, `Régularité : ${r.ecartMedianMs === null ? '–' : `${r.ecartMedianMs} ms d’écart médian`} · ${arrets}${trop}.`),
      el('p', { class: 'sous' }, 'Vert : juste · orange : juste mais décalée · rouge : fausse (note jouée dessous) · pointillé : manquée · × : en trop.'));
    if (dech.rejoue) zone.append(el('p', { class: 'boite-info' }, 'Pièce rejouée : elle ne compte pas.'));
    else {
      const e = enregistrerPiece(etat, { niveau: dech.niveau, graine: dech.graine, bpm: dech.bpm, resultat: r }, Date.now());
      sauver();
      zone.append(el('p', { class: 'boite-info' }, `Prochaine pièce à ${e.bpmApres} à la noire.`));
      if (e.debloque) zone.append(el('div', { class: 'debloque' }, `Niveau débloqué : Déchiffrage, niveau ${e.debloque}`));
    }
  }
  actionsDech(
    boutonDech('Suivante', nouvellePiece, 'btn-principal'),
    boutonDech('▶ Écouter la pièce', ecouterPiece),
    boutonDech('↻ Réessayer (sans compter)', () => { dech.rejoue = true; preparerPiece(); }));
}

function ecouterPiece() {
  lecteur ||= creerLecteur();
  if (lecteur) lecteur.jouer(sequencePiece(dech.piece, dech.bpm));
}

function quitterDechiffrage() {
  arreterDechiffrage();
  dech = null;
  if (ecoute) { ecoute.fermer(); ecoute = null; }
  rendreAccueil();
}

async function ouvrirTestMicro() {
  arreterDechiffrage();
  if (dech) dech.phase = 'test';
  montrer('test-micro');
  $('test-note').textContent = '–';
  $('test-fil').textContent = '';
  ecoute ||= creerEcoute();
  if (!ecoute) { $('test-fil').textContent = 'Micro indisponible sur cet appareil.'; return; }
  try { await ecoute.ouvrir(); } catch { ecoute = null; $('test-fil').textContent = 'Le micro a été refusé. Autorise-le pour ce site dans les réglages du navigateur.'; return; }
  ecoute.demarrer((tr) => {
    $('test-niveau').style.width = `${Math.min(100, Math.round(tr.rms * 400))}%`;
    $('test-note').textContent = tr.f0 ? nomMidi(Math.round(midiDeFrequence(tr.f0))) : '…';
  });
  clearInterval(testMicro);
  testMicro = setInterval(() => {
    const att = detecterAttaques(ecoute.trames().slice(-400));
    $('test-fil').textContent = att.length ? `Notes entendues : ${att.slice(-12).map((a) => nomMidi(a.midi)).join(' · ')}` : 'Aucune note détectée pour l’instant.';
  }, 500);
}

function quitterTestMicro() {
  clearInterval(testMicro); testMicro = null;
  if (ecoute) ecoute.arreter();
  montrer('dechiffrage');
  preparerPiece();
}
```

Remplacer la ligne `document.addEventListener('visibilitychange', () => { if (document.hidden) mettreEnPause(); });` par :
```js
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  mettreEnPause();
  // une pièce en cours est abandonnée : on revient à la préparation
  if (dech && (dech.phase === 'jeu' || dech.phase === 'preparation') && !$('ecran-dechiffrage').hidden) preparerPiece();
});
```
Remplacer le gestionnaire `$('btn-exporter').addEventListener('click', () => { … });` par :
```js
$('btn-exporter').addEventListener('click', async () => {
  const texte = JSON.stringify(etat);
  const z = $('export-zone');
  z.value = texte;
  z.hidden = false;
  try { await navigator.clipboard.writeText(texte); $('btn-exporter').textContent = 'Copié ✓'; } catch { z.focus(); z.select(); }
});
$('btn-importer').addEventListener('click', () => { $('import-zone').hidden = false; $('import-texte').focus(); });
$('btn-importer-valider').addEventListener('click', () => {
  const r = lireSauvegarde($('import-texte').value);
  if (!r.ok) { $('import-message').textContent = r.erreur; return; }
  if (!confirm('Remplacer toute ta progression actuelle par cette sauvegarde ?')) return;
  etat = r.etat;
  sauver();
  $('import-texte').value = '';
  rendreProgression();
  $('import-message').textContent = 'Sauvegarde importée.';
});
$('btn-dech-accueil').addEventListener('click', quitterDechiffrage);
$('btn-test-micro').addEventListener('click', ouvrirTestMicro);
$('btn-test-retour').addEventListener('click', quitterTestMicro);
$('opt-clic').addEventListener('change', (ev) => { etat.prefs.clic = ev.target.checked; sauver(); });
```

- [ ] **Step 6 : construire et vérifier dans le navigateur**

Run : `node --test tests/*.test.mjs && node build.mjs`
Expected : PASS, pas de doublon.

Puis ouvrir `dist/index.html` dans le panneau navigateur (`preview_start` avec l'URL `file:///…/08-harmonie-app/dist/index.html`), en largeur téléphone (`resize_window` preset `mobile`) :
1. Accueil : la carte « Déchiffrage au piano » est présente, niveau 1, 60 à la noire ; pas d'erreur dans la console (`read_console_messages`).
2. Clic sur la carte : partition sur 2 lignes de 2 mesures, lisible, compte à rebours qui décroît.
3. Thème sombre (`resize_window` `colorScheme: 'dark'`) : portée, notes, clé visibles.
4. « Tester le micro » puis « Retour » : pas d'erreur (le micro peut être indisponible dans le panneau ; le message doit être clair).
5. Progression : bloc « Déchiffrage au piano » ; « Copier ma progression » remplit la zone ; « Importer » d'un texte invalide affiche l'erreur sans rien changer.
Corriger dans `src/`, reconstruire, revérifier. Capture d'écran de la partition à joindre au compte rendu.

- [ ] **Step 7 : commit**

```bash
git add index.html src/style.css src/interface.js
git commit -m "Déchiffrage : écrans de jeu, correction, test du micro ; copier/importer la progression" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : hébergement sur GitHub Pages

**Files :**
- Create : `.github/workflows/pages.yml`
- Modify : `README.md` (section « Utiliser » et « Publier »)

- [ ] **Step 1 : workflow**

```yaml
# .github/workflows/pages.yml
name: Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploiement.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node --test tests/*.test.mjs
      - run: node build.mjs
      - run: mkdir site && cp dist/index.html site/index.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deploiement
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2 : README** — remplacer la section « Utiliser » par :

```markdown
## Utiliser

- **Téléphone** : https://klem88.github.io/harmonie-au-clavier/ (HTTPS : le micro fonctionne pour le chant et
  le déchiffrage). La progression est enregistrée dans le navigateur du téléphone ; « Voir ma progression →
  Copier ma progression » sert de sauvegarde et de bilan à coller à Claude.
- **Ordinateur** : ouvrir `dist/harmonie.html` après `node build.mjs`.
```
et la section « Publier une nouvelle version » par :
```markdown
## Publier une nouvelle version

`git push` sur `main` : GitHub Actions lance les tests, construit la page et la publie sur Pages.
```
Ajouter au tableau des fichiers :
```markdown
| `src/piece.js` | Déchiffrage : génération de pièces reproductibles (graine) |
| `src/partition.js` | Déchiffrage : partition SVG avec rythmes et correction colorée |
| `src/ecoute.js` | Déchiffrage : attaques et hauteurs au micro, alignement avec la partition |
| `src/dechiffrage.js` | Déchiffrage : niveau, tempo, historique, déblocage |
```

- [ ] **Step 3 : commit**

```bash
git add .github/workflows/pages.yml README.md
git commit -m "Publication sur GitHub Pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4 : ⚠️ demander l'accord de l'élève avant de publier.** Le dépôt `klem88/harmonie-au-clavier` sera
public : code, tests et `docs/` (conception, plans) visibles par tous ; aucune donnée de progression. Attendre un
« oui » explicite.

- [ ] **Step 5 : créer le dépôt, pousser, activer Pages**

```bash
gh repo create harmonie-au-clavier --public --source . --push --description "Harmonie au clavier : réflexes d'harmonie et déchiffrage au piano"
gh api -X POST repos/klem88/harmonie-au-clavier/pages -f build_type=workflow
gh workflow run Pages --repo klem88/harmonie-au-clavier
gh run watch --repo klem88/harmonie-au-clavier --exit-status
```
Expected : le run se termine en succès. (Si le premier push a déjà lancé un run qui a échoué faute de Pages
activé, le `workflow run` le relance.)

- [ ] **Step 6 : vérifier en ligne** — ouvrir https://klem88.github.io/harmonie-au-clavier/ dans le panneau
navigateur : l'accueil s'affiche, la note de stockage dit « Progression enregistrée dans ce navigateur. », la carte
Chant n'est plus grisée, aucune erreur console.

---

### Task 9 : migration de la progression, documentation, essai réel

**Files :**
- Modify : `docs/conception.md` (dimension J, hébergement), `07-harmonie-impro/_index.md` ou `00-pilotage/progres.md` (nouveau lien), mémoire `app-harmonie.md`

- [ ] **Step 1 : guider l'élève pour transférer sa progression** (sur le téléphone) :
1. ouvrir l'ancienne app sur claude.ai → « Voir ma progression » → « Afficher l'export JSON » → tout copier ;
2. ouvrir https://klem88.github.io/harmonie-au-clavier/ → « Voir ma progression » → « Importer une sauvegarde »
   → coller → « Remplacer ma progression ».
Si la copie est pénible sur téléphone : lire `etat/eleve` avec `ArtifactData get` (collection `etat`, doc
`eleve`, artefact de l’ancienne app claude.ai), l'enregistrer dans un fichier `.json` et
l'envoyer à l'élève avec `SendUserFile`.

- [ ] **Step 2 : essai réel, guidé par Claude** — l'élève, téléphone posé sur le piano :
1. « Tester le micro » : jouer do-ré-mi-fa-sol détaché, puis lié, puis une note répétée ; noter ce qui est
   mal entendu ;
2. trois pièces J1 à 60 ; rapporter pour chacune ce que l'app a compté faux à tort, ou raté.
Si la détection se trompe, ajuster `REGLES_ECOUTE` (seuil, rapport) avec un test qui reproduit le cas,
avant d'aller plus loin.

- [ ] **Step 3 : documentation**
- `docs/conception.md` : ajouter la dimension J au tableau des dimensions (renvoi vers
  `2026-09-25-dechiffrage-design.md`), et dans « Publication » : GitHub Pages remplace claude.ai.
- Mettre à jour le lien de l'app dans le vault (là où l'URL de l'ancienne app claude.ai est citée).
- Mémoire `app-harmonie.md` : nouvelle URL, progression dans le navigateur, bilan par « Copier ma progression »
  collé par l'élève (ArtifactData ne sert plus).

- [ ] **Step 4 : commit et publication**

```bash
git add -A
git commit -m "Documentation : déchiffrage et hébergement GitHub Pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

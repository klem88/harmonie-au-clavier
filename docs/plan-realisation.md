# Harmonie · Plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'app de quiz d'harmonie décrite dans `conception.md`, testée, assemblée en une seule page et publiée.

**Architecture:** Quatre modules JavaScript purs (théorie → questions → progression, + stockage) et un module d'interface qui seul touche le DOM. Un script Node concatène le tout en `dist/harmonie.html`. Les tests tournent avec `node --test`.

**Tech Stack:** JavaScript ES2022 (modules), Node 24 (`node:test`, `node:fs`), HTML/CSS sans framework, aucune dépendance npm.

**Spec:** `08-harmonie-app/docs/conception.md`

## Global Constraints

- Aucune dépendance npm ; `node --test tests/` doit passer sans installation.
- Notes en français (do, ré, mi♭…), accords en lettres (B♭maj7, Dm7♭5, C°7). Symboles Unicode ♭ ♯ ° dans l'affichage.
- Orthographe exacte des notes : le moteur manipule `{lettre, alt}`, jamais un simple numéro de demi-ton.
- Chaque carte a un identifiant stable `<dim><niv>:<clé>`, 4 choix distincts, 1 seule bonne réponse, une explication non vide.
- Règles de progression (copiées de la spec) : boîtes 0–5 ; faux → 0 ; juste ≤ 6000 ms → +1 ; juste > 6000 ms → inchangé ; délais 0, 1, 3, 7, 16, 35 jours ; déblocage sur ≥ 15 réponses du niveau, ≥ 85 % et médiane ≤ 4000 ms ; carte ratée réinsérée au plus 5 questions plus loin ; séance du jour = 20 questions dont ~4 de révision des niveaux maîtrisés.
- Pas de dépôt git : pas de commit, on remplace l'étape « commit » par « cocher la case ».

## Fondamentales utilisées

- **Courantes (7)** : C, F, G, B♭, E♭, D, A.
- **Toutes (12)** : C, D♭, D, E♭, E, F, F♯, G, A♭, A, B♭, B.
- **Tonalités majeures (15)** : C G D A E B F♯ C♯ F B♭ E♭ A♭ D♭ G♭ C♭.

---

### Task 1 : Moteur musical `src/theorie.js`

**Files:**
- Create: `src/theorie.js`
- Test: `tests/theorie.test.mjs`

**Interfaces (produit) :**
```js
// Note = { lettre: 'A'..'G', alt: -2..2 }
export function note(texte)                 // 'Bb' | 'B♭' | 'F#' | 'F♯' | 'C' → Note
export function nomFr(n)                    // → 'si♭'
export function nomLettre(n)                // → 'B♭'
export function classe(n)                   // → 0..11 (do = 0)
export function memeNote(a, b)              // même lettre et même altération
export function enharmonique(n)             // Note de même classe avec l'autre lettre voisine et |alt| ≤ 1, ou null
export function transposer(n, intervalle)   // intervalle ∈ 'P1 m2 M2 m3 M3 P4 A4 d5 P5 A5 m6 M6 d7 m7 M7'
export const TYPES_ACCORD = { maj:{suffixe:'',intervalles:['P1','M3','P5'],libelle:'majeur'}, min:{suffixe:'m',...}, dim:{'°'}, aug:{'+'}, maj7, '7', m7, m7b5:{suffixe:'m7♭5'}, dim7:{suffixe:'°7'} }
export function notesAccord(fond, type)     // → Note[]
export function nomAccord(fond, type)       // → 'B♭maj7'
export function gammeMajeure(tonique)       // → Note[7]
export function gammeMineureNaturelle(tonique)
export function armure(tonique, mode='majeur')  // → { nombre: -7..7, alterations: Note[] }  (négatif = bémols)
export function relativeMineure(toniqueMajeure) // → Note ; relativeMajeure(toniqueMineure)
export function quinteSup(n), quinteInf(n)
export const DEGRES_MAJEUR = ['I','ii','iii','IV','V','vi','vii°']
export function accordDegre(tonique, degre /*1..7*/, { septieme=false, mode='majeur' }={})
   // majeur : I maj/maj7, ii min/m7, iii min/m7, IV maj/maj7, V maj/7, vi min/m7, vii dim/m7b5
   // mineur (pour IIø–V7–i) : 2 → m7b5, 5 → '7', 1 → min
   // → { fond: Note, type: string }
export function chiffreRomain(degre, mode='majeur', septieme=false) // 'ii' | 'V7' | 'iiø' ...
export function demiTons(intervalle)        // 'M3' → 4
```

- [ ] **Step 1 : tests d'orthographe exhaustifs** — écrire `tests/theorie.test.mjs` avec, entre autres :
  - `notesAccord(note('Ab'),'7')` → `['la♭','do','mi♭','sol♭']` (via `nomFr`)
  - `notesAccord(note('F#'),'m7b5')` → `['fa♯','la','do','mi']`
  - `notesAccord(note('B'),'dim7')` → `['si','ré','fa','la♭']`
  - `notesAccord(note('Db'),'maj7')` → `['ré♭','fa','la♭','do']`
  - `notesAccord(note('E'),'aug')` → `['mi','sol♯','si♯']`
  - table complète des 15 armures majeures : `armure(note('Gb')).nombre === -6`, alterations `['si♭','mi♭','la♭','ré♭','sol♭','do♭']`
  - `relativeMineure(note('Eb'))` → `do` ; `armure(note('F#'),'mineur').nombre === 3`
  - `accordDegre(note('Ab'),5,{septieme:true})` → `{E♭, '7'}` ; `accordDegre(note('C'),2,{septieme:true,mode:'mineur'})` → `{D, 'm7b5'}`
  - `enharmonique(note('F#'))` → `sol♭` ; `enharmonique(note('B'))` → `do♭` ; `enharmonique(note('D'))` → `null`
  - `quinteSup(note('Bb'))` → `fa`, `quinteInf(note('C'))` → `fa`
  - `transposer(note('B'),'M3')` → `ré♯`
- [ ] **Step 2 : lancer** `node --test tests/` → échec (module absent).
- [ ] **Step 3 : implémenter** `src/theorie.js` : lettres `C D E F G A B`, classes `[0,2,4,5,7,9,11]`, table intervalles `{pas de lettre, demi-tons}` ; `transposer` avance la lettre puis ajuste `alt` pour tomber sur la bonne classe (modulo 12, altération choisie dans −2..2 la plus proche). Armure : compter les altérations de la gamme majeure ; ordre des dièses F C G D A E B, des bémols B E A D G C F.
- [ ] **Step 4 : lancer** `node --test tests/` → tout passe.

### Task 2 : Catalogue de cartes `src/questions.js`

**Files:**
- Create: `src/questions.js`
- Test: `tests/questions.test.mjs`

**Interfaces (produit) :**
```js
// Carte = { id, dimension:'A'|'B'|'C'|'D', niveau:1..4, enonce, reponse, pieges:[3], explication, notes: Note[]|null }
export const DIMENSIONS = { A:{nom:'Armures et quintes', niveaux:3}, B:{nom:'Accords', niveaux:4}, C:{nom:'Notes guides', niveaux:3}, D:{nom:'Degrés et II-V-I', niveaux:4} }
export function catalogue()                 // → Carte[] (mémoïsé, déterministe)
export function carte(id)                   // → Carte | undefined
export function cartesDuNiveau(dim, niv)    // → Carte[]
export function melangerChoix(carte, alea=Math.random) // → string[4]
```

Contenu par niveau (voir conception §3) ; pièges construits par des fonctions dédiées, complétés au besoin par un vivier de même nature, toujours distincts et ≠ réponse :

| Niveau | Cartes | Pièges |
|---|---|---|
| A1 | 7 tonalités ≤ 3 alt. × (tonalité→armure, armure→tonalité) | nombre ±1, signe inversé |
| A2 | 8 tonalités 4–7 alt. × 2 sens + relatives mineures des 15 tonalités (« relative mineure de E♭ ? ») + armure de 8 tonalités mineures | tonalité voisine sur le cycle, relative de la voisine |
| A3 | quinte sup/inf de 12 notes + IV et V (notes) de 12 tonalités | quarte à la place de quinte, enharmonique, note voisine |
| B1 | 7 fond. courantes × maj/min × 2 sens | autre qualité, enharmonique d'une note, quinte altérée |
| B2 | 12 fond. × dim/aug × 2 sens + maj/min sur les 5 fond. restantes × 2 sens | idem |
| B3 | 12 fond. × maj7/7/m7 × 2 sens | autre 7e, autre tierce, enharmonique |
| B4 | 12 fond. × m7b5/dim7 × 2 sens + renversements : 7 fond. × maj/min × {1er, 2e} (notes→nom, réponse « C (1er renversement) ») | accord bâti sur la basse, autre renversement |
| C1 | 7 fond. courantes × maj7/7/m7 × {tierce, septième} | autre qualité de 3ce/7e, quinte, sixte, enharmonique |
| C2 | 5 fond. restantes × maj7/7/m7 × 2 + 12 fond. × m7b5 × 2 | idem |
| C3 | 12 tonalités × { « IIm7 → V7 : la 7e de IIm7 va vers ? », « V7 → Imaj7 : la 7e de V7 va vers ? » } | note de départ, ton au-dessus, enharmonique |
| D1 | 7 tonalités courantes × degrés 2..7 → triade | degré voisin, autre qualité |
| D2 | 12 tonalités × {ii, IV, V, vi} → accord de 7e ; 7 tonalités × {ii, iii, IV, V, vi} accord → degré | degré voisin, autre qualité |
| D3 | 12 tonalités × { II-V-I complet, « le II de X ? », « IIm7–V7 résout vers ? », « IIm7–V7–Imaj7 : quelle tonalité ? » } | tonalité à la quinte, II/V inversés, qualité fausse |
| D4 | 12 tonalités mineures × { II-V-i complet, « le II du II-V-i en X mineur ? », « IIø–V7 résout vers ? » } | II en m7 au lieu de m7♭5, V en m7, i majeur |

- [ ] **Step 1 : test générique** sur tout le catalogue : ids uniques, `pieges.length === 3`, 4 chaînes distinctes, `explication.length > 10`, `notes` non vide pour B et C, chaque (dim, niv) déclaré dans `DIMENSIONS` a ≥ 12 cartes. Plus quelques cartes précises : `carte('C1:G:7:tierce')` → réponse `si`, explication contient `sol si ré fa` ; `carte('B3:Ab:7:notes')` → `la♭ do mi♭ sol♭` ; `carte('D4:C:complet')` → `Dm7♭5 – G7 – Cm` ; `carte('A1:D:armure')` → `2 ♯`.
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : implémenter** générateurs par niveau (`genA1()`, … `genD4()`), `piegesDistincts(candidats, reponse, vivier)`, formatage des listes de notes (`'sol si ré fa'`), énoncés en français.
- [ ] **Step 4 : lancer** → tout passe. Afficher le nombre de cartes par niveau dans un test de log.

### Task 3 : Progression `src/progression.js`

**Files:**
- Create: `src/progression.js`
- Test: `tests/progression.test.mjs`

**Interfaces (produit) :**
```js
export const REGLES = { boiteMax:5, delaisJours:[0,1,3,7,16,35], rapideMs:6000, deblocage:{ minReponses:15, tauxMin:0.85, medianeMaxMs:4000 }, tailleSeance:20, partRevision:0.2, reinsertionApres:5 }
export function etatInitial()  // { version:1, cartes:{}, niveaux:{A:1,B:1,C:1,D:1}, statsNiveaux:{}, seances:[] }
export function normaliser(etat)  // état inconnu/corrompu → etatInitial(), version 1 → tel quel
export function estDue(fiche, now)
export function niveauMaitrise(etat, dim, niv)        // toutes les cartes du niveau en boîte ≥ 3
export function composerSeance(etat, now, { taille=20, dimension=null, niveau=null }={}) // → string[] ids
export function enregistrerReponse(etat, id, juste, ms, now) // → { boiteAvant, boiteApres, debloque: 'B2'|null }
export function cloreSeance(etat, { n, ok, medianeMs, dimension }, now)
export function bilan(etat)  // → { dimensions:{A:{niveauOuvert, niveaux:[{niv, etat:'verrouille'|'ouvert'|'maitrise', acquis, total}]},…}, seances:[…] }
export class FileSeance { constructor(ids); suivante(); reinserer(id); restantes(); total() }
export function mediane(nombres)
```

Fiche carte : `{ boite, prochaine (ms epoch), n, ok, temps:[≤5] }`. `statsNiveaux['B2'] = { n, ok, temps:[≤20] }`.

- [ ] **Step 1 : tests** avec `now` simulé (jour J = `Date.UTC(2026,8,22)`) :
  - faux → boîte 0 et `prochaine === now` ; juste 3000 ms → boîte 1, `prochaine = now + 1 jour` ; juste 8000 ms → boîte inchangée ; boîte plafonnée à 5.
  - déblocage : 15 justes rapides sur des cartes B1 → `debloque === 'B2'`, `etat.niveaux.B === 2` ; 14 justes → `null` ; 15 dont 3 fausses → `null` ; dernier niveau → `null`.
  - `composerSeance` : état vide → 20 ids, tous de niveau 1, dimensions alternées (les 4 présentes dans les 8 premières) ; avec 3 cartes dues → elles sont en tête, la plus en retard d'abord ; avec `dimension:'C'` → uniquement des `C` ; niveau maîtrisé → 4 de ses cartes en révision.
  - `FileSeance` : `reinserer` place la carte au plus 5 positions plus loin (ou à la fin si moins de 5 restantes).
  - `normaliser({})` → état initial ; `normaliser(etatValide)` → identique.
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** → tout passe.

### Task 4 : Stockage `src/stockage.js`

**Files:**
- Create: `src/stockage.js`
- Test: `tests/stockage.test.mjs` (avec un faux `localStorage` et un faux `db`)

**Interfaces (produit) :**
```js
export function creerStockage({ local=globalThis.localStorage, db=globalThis.claude?.db }={})
// → { mode:'artefact'|'local'|'memoire', charger(): Promise<object|null>, sauver(etat): Promise<void> }
// clé locale 'harmonie.etat.v1' ; en artefact : collection 'etat', document 'eleve'
```
Avant d'écrire, charger le skill `artifact-capabilities` pour l'API exacte de la base de l'artefact ; adapter la signature du faux `db` en conséquence.

- [ ] **Step 1 : tests** : sans `local` ni `db` → mode `memoire`, `charger()` → null, `sauver` puis `charger` → l'objet ; avec `local` → JSON dans la clé ; `local` qui lève → bascule `memoire` sans erreur ; avec `db` → appels de lecture/écriture ; JSON corrompu → null.
- [ ] **Step 2–4 :** échec, implémentation, succès.

### Task 5 : Interface `src/interface.js`, `src/style.css`, `index.html`

**Files:**
- Create: `index.html`, `src/style.css`, `src/interface.js`, `src/clavier.js` (SVG du clavier 2 octaves, `export function clavierSvg(notes)`)
- Test: `tests/clavier.test.mjs` (le SVG contient une touche `data-classe="1"` marquée pour do♯ ; 24 touches)

**Écrans** (un `<section>` par écran, un seul visible) : accueil, séance, bilan, progression. Boucle de séance :
1. `composerSeance` → `new FileSeance(ids)` ; 2. afficher la carte, `performance.now()` au rendu ; 3. clic sur un choix → `enregistrerReponse` ; juste : bandeau vert + temps, `setTimeout(700)` ; faux : bandeau rouge + explication + `clavierSvg(carte.notes)` + bouton Continuer, et `file.reinserer(id)` ; 4. fin : `cloreSeance`, `sauver`, écran bilan (score, médiane, cartes montées, niveaux débloqués, « Encore 10 » relance avec `taille:10`).

Style : variables sur `:root`, mode sombre via `prefers-color-scheme`, boutons de réponse ≥ 56 px, largeur max 480 px centrée, gouttière 16 px.

- [ ] **Step 1 :** test du clavier, échec, implémentation, succès.
- [ ] **Step 2 :** écrire `index.html` (charge `src/interface.js` en module), `style.css`, `interface.js`.
- [ ] **Step 3 :** vérification manuelle dans le navigateur intégré : séance complète, réponse fausse → explication + clavier, bilan, écran progression, rechargement → état conservé.

### Task 6 : Assemblage `build.mjs` et publication

**Files:**
- Create: `build.mjs`, `dist/harmonie.html` (généré), `README.md`

`build.mjs` : lit `index.html`, remplace `<link rel="stylesheet" href="src/style.css">` par le CSS inline et `<script type="module" src="src/interface.js">` par un `<script>` contenant, dans l'ordre theorie → questions → progression → stockage → clavier → interface, le contenu des fichiers avec les lignes `import … from '…'` supprimées et le mot-clé `export ` retiré. Les noms de fonctions sont uniques entre modules (vérifié par un test : aucune déclaration `function X` en double).

- [ ] **Step 1 :** test `tests/build.test.mjs` : après `node build.mjs`, `dist/harmonie.html` existe, ne contient ni `import ` ni `export `, contient `<title>`.
- [ ] **Step 2 :** implémenter, lancer, ouvrir `dist/harmonie.html` dans le navigateur intégré et rejouer une séance.
- [ ] **Step 3 :** charger `artifact-design` puis publier `dist/harmonie.html` (icône `music`, capacité base de données) ; ouvrir la page publiée et vérifier une séance.
- [ ] **Step 4 :** `README.md` du dossier : lancer les tests, construire, publier ; lien vers `conception.md`.

### Task 7 : Lien avec le vault

**Files:**
- Modify: `README.md` (racine) : ajouter la ligne `08-harmonie-app/` dans la liste.
- Modify: `07-harmonie-impro/_index.md` : ajouter une ligne « Prérequis app » (voir conception §3).
- Modify: `07-harmonie-impro/notes-guides.md` : une ligne « Avant : app niveaux B3 et C1 ».
- Modify: mémoire `projet-apprentissage-piano.md` : noter l'existence de l'app et l'URL publiée.

- [ ] **Step 1 :** faire les modifications, relire.

# Déchiffrage mains ensemble · Conception

*2026-09-26 · étape 3 du déchiffrage (voir `2026-09-25-dechiffrage-design.md` pour les étapes 1 et 2)*

## 1. But

Lire à vue une courte pièce **mains ensemble**, clé de sol et clé de fa sur une grande portée, sans s'arrêter :
c'est le jalon de fin de cycle de `04-dechiffrage/_index.md` et l'épreuve de l'examen (« lecture des deux clés »).
Le micro du téléphone entend mal deux notes simultanées : la correction est donc **indicative** et l'élève
**confirme** le verdict avant qu'il compte.

## 2. Hors périmètre

- Accords à la main gauche (quintes, accords de trois sons).
- Changement de position à deux mains (celui de J3).
- Pédale, nuances, articulations, doigtés.
- Transcription libre de ce qui est joué : l'écoute ne vérifie que les notes attendues.

## 3. Les pièces

**Commun.** 4 mesures, grande portée. Main droite en clé de sol, selon les règles actuelles (départ sur tonique,
tierce ou quinte ; fin sur la tonique en valeur longue ; sauts bornés ; pas deux sauts de suite dans le même sens).
Main gauche en clé de fa, **en position de cinq doigts sur la tonique à l'octave 3** (do3–sol3, ré3–la3,
fa3–do4, sol3–ré4) : toujours au-dessus de ~130 Hz, là où le micro du téléphone entend encore. Dans la
dernière mesure, la main gauche tient la tonique à l'octave 3 toute la mesure (ronde en 4/4, blanche pointée
en 3/4), sous la fin de la main droite.

**Harmonie.** Une harmonie par mesure, tirée avant les notes :
mesure 1 = I ; mesure 2 ∈ {I, IV, V} ; mesure 3 ∈ {IV, V} ; mesure 4 = I.
- Main droite : les notes attaquées sur les temps forts (1 et 3 en 4/4, 1 en 3/4) appartiennent à l'accord.
  Génération par tirages successifs rejetés tant que la contrainte n'est pas tenue (comme aujourd'hui pour
  les sauts), 500 essais au plus.
- Main gauche : dans la position, I = degrés {0, 2, 4}, IV = {0, 3}, V = {1, 4}. La note du temps 1 est la
  **basse** de l'accord (degré 0, 3 ou 4) aux niveaux E1 et E2, une note de l'accord en E3.
- **Consonance** : quand les deux mains attaquent en même temps, l'intervalle (modulo l'octave) vaut
  0, 3, 4, 7, 8 ou 9 demi-tons ; jamais de seconde, quarte seule, triton ni septième.

| Niveau | Main droite | Main gauche |
|---|---|---|
| **E1** | règles de J1 : do majeur, 4/4, noires et blanches | rondes ou blanches (`r`, `b b`) : la basse de l'accord ; en `b b`, la seconde blanche est la basse ou la quinte de l'accord |
| **E2** | règles de J2 : do, sol, fa, ré majeur, 4/4, paires de croches | noires et blanches (`n n n n`, `b n n`, `n n b`, `n b n`, `b b`), degrés conjoints surtout, sauts ≤ tierce ; jamais de croches |
| **E3** | rythmes de J2 en 4/4, rythmes 3/4 de J3 ; 3/4 ou 4/4 | petite mélodie en noires, blanches (et blanche pointée ou ronde pour finir), sauts ≤ quarte ; **au plus la moitié** des attaques de la main gauche tombent en même temps qu'une attaque de la main droite (rythmes complémentaires) |

Même niveau + même graine = même pièce. La pièce a la forme
`{ niveau, graine, main: 'ensemble', tonalite, tonique, armure, temps, mesures, harmonies: ['I', …], droite: [notes], gauche: [notes] }`,
chaque note ayant la forme actuelle `{ note, octave, midi, pos, duree, token, mesure, degre }`.

**Préparation** 60 s (au lieu de 45). **Écouter la pièce** joue les deux mains ensemble.

## 4. Partition

- Chaque ligne (deux mesures) devient un **système** de deux portées : sol en haut, fa en bas, accolade à gauche,
  barres de mesure traversant les deux portées, armure et chiffrage sur chacune.
- Main gauche : hampes vers le bas quand la note est sur ou au-dessus de la ligne du milieu, vers le haut sinon
  (règle habituelle), rien de plus ; les deux portées sont assez écartées pour que les hampes ne se croisent pas.
- Le curseur couvre les deux portées du système.
- `partition.js` est découpé : une fonction dessine **une portée à une hauteur donnée** (lignes, clé, armure,
  chiffrage, notes, marques) ; `partitionSvg` l'appelle une fois (une main) ou deux fois par système (ensemble).
  Le rendu d'une pièce à une main ne change pas.
- `geometriePartition` renvoie, pour une pièce ensemble, la hauteur d'un système plus grande et `basPortee(ligne, portee)`.

## 5. Écoute à deux mains

### 5.1 Capture

En mode ensemble, `creerEcoute().demarrer(onTrame, { spectre: { midis } })` règle l'analyseur à `fftSize = 4096`
(~85 ms à 48 kHz, `smoothingTimeConstant = 0`) et, toutes les 15 ms, lit l'énergie (domaine temporel) et le
spectre natif (`getFloatFrequencyData`). La trame devient `{ tMs, rms, s: [saillance de chaque midi candidat] }`.
Candidats : toutes les notes de la pièce et leurs demi-tons voisins (~30 au plus), fixés au lancement.
Le mode une main reste inchangé (`fftSize = 1024`, `f0`).

### 5.2 Saillance d'une note (pur, `src/verification.js`)

`saillance(spectreLineaire, { sampleRate, fftSize }, midi)` = somme, pour h = 1 à 5, du maximum d'amplitude
dans les cases à ± un quart de ton de h × f(midi). Les harmoniques sont indispensables : à do3 deux demi-tons
sont à 8 Hz l'un de l'autre, bien moins que la résolution ; au 3ᵉ harmonique ils sont à 23 Hz. La conversion dB →
amplitude linéaire se fait avant (`10^(dB/20)`).

### 5.3 Temps et continuité

Attaques = sauts d'énergie, par la partie énergie de `detecterAttaques` (sans hauteur ; sortie `{ tMs }`).
Instants attendus = attaques des deux mains fusionnées (un instant par position où au moins une main attaque).
`aligner` actuel, appelé avec une même hauteur factice pour tous (seul le temps compte), donne le retard
constant, l'écart de chaque instant et les arrêts. Rien n'est changé dans `aligner`.

### 5.4 Verdict par note attendue

Pour chaque note de chaque main, à son instant `t` (retard retiré) :
- `avant` = médiane de la saillance de la note entre `t − 120` et `t − 20` ms ;
- `apres` = maximum de la saillance entre `t + 40` et `t + min(250, durée de la note)` ms ;
- `montee = apres / max(avant, plancher)` ; idem pour les deux voisins (± 1 demi-ton).
- Un voisin est **ignoré** si sa hauteur est sonnée par une autre note attendue au même moment (attaquée ou
  tenue), ou si sa fondamentale tombe (à un quart de ton près) sur un harmonique 2 à 5 d'une telle note.

| Verdict | Condition (seuils de départ, dans `REGLES_ECOUTE.ensemble`) |
|---|---|
| **juste** | `montee ≥ 2` et `apres ≥ 1,5 ×` l'`apres` de chaque voisin retenu |
| **fausse probable** | un voisin retenu a `montee ≥ 2` et un `apres ≥ 1,5 ×` celui de la note |
| **manquée** | aucune attaque appariée à cet instant et `montee < 1,3` |
| **douteuse** | tous les autres cas |

Une note juste dont l'instant est décalé de plus de 120 ms devient **décalée** (règle actuelle).
Les seuils (2 ; 1,5 ; 1,3 ; plancher) sont des valeurs de départ, à régler sur les premiers essais réels.

### 5.5 Résultat

`verifierEnsemble(piece, trames, { bpm })` →
`{ notes: { droite: [{ etat, ecartMs }], gauche: [...] }, justes, decalees, fausses, manquees, douteuses, total,
   latenceMs, ecartMedianMs, arrets, compte, rienEntendu, parasites, propose }`.
- `jugees = total − douteuses`.
- `propose` = `'reussi'` si `jugees > 0`, `justes / jugees ≥ 0,85`, aucun arrêt, `decalees / jugees ≤ 0,2` ;
  `null` (pas de proposition) si `douteuses / total > 0,3` ; `'pasEncore'` sinon.
- `compte` : faux si rien entendu (aucune attaque) ou parasites (attaques non appariées > 50 % des instants),
  comme aujourd'hui.

## 6. Correction et confirmation

- Marques sur les deux portées : vert juste, orange décalée, rouge fausse probable (sans nom de note), **gris
  avec « ? » douteuse**, pointillé manquée. Résumé : justes / jugées, douteuses, régularité, arrêts.
- Verdict proposé : « Réussie ? », « Pas encore ? », ou « Je n'ai pas bien entendu : à toi de juger ».
- Deux boutons **✓ Réussie** / **✗ Pas encore**, celui de la proposition mis en avant (aucun si pas de
  proposition). **Rien n'est enregistré avant le choix.** Ensuite : tempo suivant, déblocage éventuel,
  boutons habituels (Suivante, Écouter, Réessayer sans compter, Copier le détail pour Claude).
- Pièce rejouée ou qui ne compte pas : pas de confirmation, rien d'enregistré (règles actuelles).
- « Copier le détail pour Claude » : en plus des champs actuels, les candidats, les trames
  `[tMs, rms×1000, saillances arrondies]` et, par note, `[main, midi, etat, montee, voisins]`.

## 7. Progression

- `etat.dechiffrage.ensemble` : troisième parcours `{ niveau, bpm: {1, 2, 3} }`, **départ 50** à la noire,
  pas de 6, bornes 50–96. `etat.dechiffrage.main` accepte `'ensemble'`. Un ancien état reçoit un parcours vide.
- Niveaux `NIVEAUX_ENSEMBLE` (E1–E3), distincts de `NIVEAUX_PIECE`.
- **Accès** : le parcours est ouvert quand `droite.niveau ≥ 2` **et** `gauche.niveau ≥ 2`. Sinon le bouton
  « Mains ensemble » est grisé : « S'ouvre au niveau 2 des deux mains ».
- **Déblocage** : règle actuelle (6 réussites sur les 8 dernières pièces du niveau) ; en plus, E2 demande
  `droite.niveau ≥ 3` et `gauche.niveau ≥ 3` (l'écran de progression dit ce qui manque).
- Historique : `{ date, main: 'ensemble', niveau, graine, bpm, justes, total, douteuses, ecartMs, arrets,
  propose, reussi }`, où `reussi` est le **verdict confirmé** par l'élève (c'est lui qui fait bouger tempo et
  déblocage).

## 8. Architecture

| Fichier | Rôle | Pur / testé |
|---|---|---|
| `src/ensemble.js` (nouveau) | `NIVEAUX_ENSEMBLE`, `genererPieceEnsemble(niveau, graine)`, `notesAttenduesEnsemble(piece, bpm)` (notes avec `main`), `instantsAttendus`, `sequencePieceEnsemble`. Réutilise `generateurAlea`, `melodieValide`, les tonalités et cellules de `piece.js` (exportées au besoin). | oui |
| `src/verification.js` (nouveau) | `saillance`, `candidatsPiece`, `verifierEnsemble` (§ 5.2–5.5). | oui |
| `src/ecoute.js` | `detecterAttaques` accepte des trames sans `f0` (attaques d'énergie seules) ; `creerEcoute().demarrer` gagne l'option `spectre` (§ 5.1) ; `REGLES_ECOUTE.ensemble`. | oui (partie pure) |
| `src/partition.js` | Portée à une hauteur donnée ; grande portée pour une pièce ensemble ; marque « douteuse ». | oui |
| `src/dechiffrage.js` | Parcours `ensemble`, accès, déblocage avec condition sur les mains, `enregistrerPiece` accepte `propose`/`douteuses`. | oui |
| `src/interface.js`, `src/style.css` | Troisième bouton, préparation 60 s, confirmation, marque grise. | non (vérifié dans le navigateur) |
| `build.mjs` | Ajoute `ensemble` et `verification` à l'ordre de concaténation. | test existant |

## 9. Tests et validation

- `ensemble.test.mjs` : sur 500 graines par niveau — main gauche dans sa position et ≥ do3, temps forts de la
  main droite dans l'accord, basse au temps 1 (E1, E2), consonance des attaques simultanées, mesures complètes
  dans chaque main, fin sur la tonique aux deux mains, rythmes permis par niveau, E3 complémentaire,
  même graine = même pièce.
- `verification.test.mjs` : sons de piano synthétiques (fondamentale faible, harmoniques 2 à 6, extinction),
  spectre calculé par une FFT de test, puis : deux mains justes ; fausse note à gauche (voisin) ; note tenue de
  la mesure précédente non recomptée ; harmonique trompeur (mi4 à droite, voisin de la main gauche ignoré) ;
  note oubliée → manquée ; bruit seul → douteuse ou rien entendu ; `propose` sur des cas fabriqués.
- `partition.test.mjs` : pièce ensemble → deux portées par système, une tête par note des deux mains, barres
  traversantes ; pièce à une main inchangée.
- `progression`/`dechiffrage` : accès, déblocage E2 conditionné aux mains, historique avec `reussi` confirmé,
  normalisation d'un ancien état.
- Validation réelle : quelques pièces E1 au piano ; l'élève colle « Copier le détail pour Claude » pour régler
  les seuils (§ 5.4) avant d'aller plus loin ; juger la hauteur de la grande portée sur le téléphone.

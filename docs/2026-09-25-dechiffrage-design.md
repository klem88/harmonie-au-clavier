# Déchiffrage au micro · Conception

*2026-09-25 · étape 1 : main droite seule*

## 1. But

Préparer l'épreuve de déchiffrage de l'examen de fin de 1er cycle (lire une courte pièce inconnue, sans
s'arrêter, dans les deux clés — voir `00-pilotage/examen-1er-cycle.md` et `04-dechiffrage/_index.md`).
L'app propose une courte pièce inédite, l'élève la joue sur son piano électrique, le téléphone posé sur le
pupitre écoute au micro et corrige : notes justes, fausses, manquées, en trop, régularité, arrêts.

Étapes : **1. main droite seule** (ce document) · 2. main gauche seule · 3. mains ensemble (correction indicative).
Les étapes 2 et 3 feront l'objet de leur propre conception.

## 2. Hors périmètre (étape 1)

- Main gauche, clé de fa, accords, mains ensemble.
- Nuances, articulations, doigtés.
- MIDI (le piano pourrait se brancher, l'élève préfère l'éviter).
- Stockage de la progression hors du téléphone.

## 3. Hébergement : toute l'app quitte claude.ai

Sur claude.ai, la page tourne dans un cadre qui n'a pas le droit d'ouvrir le micro. Toute l'app passe donc
sur **GitHub Pages** (HTTPS, gratuit), une seule app, une seule progression.

- Dépôt GitHub **public, qui ne contient que l'app** (pas le vault). Le code est visible ; la progression,
  elle, reste dans le navigateur et n'est jamais publiée.
- Stockage : mode `local` de `stockage.js` (localStorage), déjà existant. Ajouts sur l'écran Progression :
  **Exporter** (copie l'état JSON, sert de sauvegarde et de bilan à coller à Claude) et **Importer**
  (colle un JSON, validé par `normaliser`, remplace l'état après confirmation).
- Migration : l'état actuel (`etat/eleve` de l'artefact claude.ai) est lu par Claude et fourni à l'élève
  pour un import unique.
- Le chant (dimension I) redevient disponible : `MICRO_PERMIS` est vrai hors cadre.
- L'artefact claude.ai reste en place jusqu'à la migration, puis n'est plus mis à jour.
- Build : `node build.mjs` produit en plus `dist/index.html` (page complète) ; c'est ce fichier qui est
  poussé dans le dépôt Pages.

## 4. Contenu : dimension J « Déchiffrage »

Les pièces sont **générées** (une pièce déjà vue ne se lit plus à vue) : pas de cartes, pas de boîtes.
Chaque pièce vient d'un **numéro de tirage** (graine) : même tirage, même pièce.

| Niveau | Tonalités | Mesures | Rythmes | Mélodie |
|---|---|---|---|---|
| **J1** | do majeur, position do4–sol4 | 4/4 | noire, blanche | degrés conjoints surtout, sauts ≤ tierce |
| **J2** | do, sol, fa, ré majeur, position de 5 doigts sur la tonique | 4/4 | + paires de croches | sauts ≤ quarte |
| **J3** | do, sol, fa, ré majeur | 3/4 et 4/4 | + noire pointée-croche, ronde (4/4) | un changement de position au début de la mesure 3 (la main monte d'une quarte ou d'une quinte, la pièce finit sur la tonique à l'octave), sauts ≤ quinte |

Règles communes : 4 mesures, clé de sol ; première note sur la tonique, la tierce ou la quinte ; dernière
note = tonique, valeur longue (blanche ou plus, ou blanche pointée en 3/4) ; pas de silence ; pas deux sauts
de suite dans le même sens.

**Tempo** : départ 60 à la noire ; +6 après une réussite, −6 après un échec ; bornes 50–96. Un tempo par
niveau (`bpm` par niveau), conservé entre les séances.

**Réussite d'une pièce** : ≥ 85 % de notes justes (justes / notes attendues) **et** aucun arrêt.

**Déblocage** : niveau suivant ouvert après 6 réussites sur les 8 dernières pièces jouées au niveau courant.
Les pièces rejouées (« Réessayer ») ne comptent pas.

## 5. Déroulé d'une pièce

1. **Préparation** : la pièce s'affiche (2 lignes de 2 mesures pour tenir sur un téléphone), avec un
   compte à rebours de 45 s qu'on peut écourter. Rappel de méthode en une ligne : tonalité, note de départ,
   repérer le passage difficile, choisir de ne pas s'arrêter.
2. **Jouer** : une mesure de décompte, puis un **curseur avance au tempo sans attendre**. Pulsation
   visuelle (un point qui clignote sur chaque temps). Clic sonore **désactivé par défaut** (le micro
   l'entendrait) ; une option l'active. Le clic est bref (< 50 ms) et aigu : l'analyse, qui mesure la
   hauteur entre +40 et +200 ms après chaque attaque, ne lui trouve pas de note et l'écarte ; un clic mal
   écarté finit au pire en « note en trop ».
3. **Correction** : notes colorées sur la partition — vert juste, orange juste mais décalée (> 120 ms),
   rouge fausse (croix rouge + nom de la note jouée) ou manquée (tête vide rouge), « × » gris pour une note
   en trop. Résumé : « 14/16 justes · régularité 60 ms · arrêt mesure 3 ». Boutons : **Écouter la pièce**
   (jouée par l'app), **Réessayer (sans compter)**, **Suivante**.
4. **Test du micro** (écran à part, depuis la dimension J) : l'élève joue ce qu'il veut, l'app affiche en
   direct la note détectée et un fil des attaques. Sert à valider la fiabilité sur son piano et son téléphone.

Pause automatique (changement d'application, appel) : la pièce en cours est abandonnée, on revient à la
préparation.

## 6. Architecture

| Fichier | Rôle | Pur / testé |
|---|---|---|
| `src/piece.js` | `genererPiece(niveau, graine)` → `{ niveau, graine, tonalite, armure, temps, notes: [{ note, octave, midi, pos, duree }] }` (`pos`, `duree` en unités de `rythme.js`, 12 par temps). Générateur pseudo-aléatoire à graine (mulberry32). `attendus(piece, bpm)` → `[{ midi, tMs }]`. | oui |
| `src/partition.js` | `partitionSvg(piece, { lignes, marques })` : portée avec hauteurs et rythmes (têtes pleines/vides, hampes selon la position, croches ligaturées par deux, point, barres de mesure, armure, chiffrage). Reprend `positionPortee`, les clés et les positions d'armure de `portee.js`. `marques` colore chaque note après correction. Expose la position x de chaque note (pour le curseur). | oui (tests de structure) |
| `src/ecoute.js` | **(a)** `detecterAttaques(trames)` : trames `{ tMs, rms, f0 }` prises toutes les ~15 ms → `[{ tMs, midi }]` (attaque = saut d'énergie au-dessus d'un seuil, période réfractaire 90 ms ; hauteur = médiane des f0 entre +40 et +200 ms). **(b)** `aligner(attendus, joues, { tempsMs })` : alignement par programmation dynamique (coûts : note différente, écart de temps, manquée, en trop), retrait du retard constant (médiane des écarts des notes appariées), détection d'arrêt (l'écart relatif augmente de plus de ¾ de temps entre deux notes appariées consécutives). Retourne le détail par note et le résumé `{ justes, total, ecartMedianMs, arrets: [numéros de mesure], reussi }`. **(c)** `trameDe(buf, sampleRate, tMs)` (pur : énergie + `detecterHauteur` de `voix.js` limité à 180–1000 Hz, main droite seulement, pour alléger le calcul sur téléphone) et `creerEcoute()` : capture micro toutes les 15 ms, sans contrôle automatique du gain, navigateur seulement. | (a)(b) oui |
| `src/dechiffrage.js` | Progression propre au déchiffrage (J n'entre pas dans `DIMENSIONS`, qui décrit des catalogues de cartes) : `etat.dechiffrage = { niveau, bpm: {1: 60, …}, historique: [...] }` (100 dernières pièces : date, niveau, graine, bpm, justes, total, ecartMs, arrets, reussi). `enregistrerPiece(etat, { niveau, graine, bpm, resultat }, now)` → `{ debloque, bpmApres }` ; `etatDeblocageDechiffrage(etat)`. | oui |
| `src/progression.js` | `etatInitial` et `normaliser` portent `etat.dechiffrage` et `prefs.clic` ; `lireSauvegarde(texte)` valide un import. | oui |
| `src/interface.js` | Carte J sur l'accueil (ouvre l'écran Déchiffrage au lieu d'une séance), écrans Préparation / Jeu / Correction, Test du micro, Exporter / Importer. | non (vérifié à la main) |
| `build.mjs` | Ajoute `piece`, `partition`, `ecoute` à l'ordre de concaténation ; écrit `dist/index.html`. | test existant étendu |

Mode silencieux : la dimension J est mise de côté comme Oreille et Chant.

## 7. Erreurs

- Micro refusé ou indisponible : message clair, la pièce reste lisible, bouton « Écouter la pièce » actif.
- Rien entendu (aucune attaque) : « Je n'ai rien entendu : rapproche le téléphone ou monte le volume du
  piano », la pièce ne compte pas.
- Plus de 50 % de notes en trop : « Beaucoup de sons parasites », la pièce ne compte pas.
- Import d'un JSON invalide : refusé avec un message, l'état n'est pas touché.

## 8. Tests et validation

- `piece.test.mjs` : sur 500 graines par niveau — hauteurs dans la position du niveau, mesures complètes,
  sauts bornés, fin sur la tonique en valeur longue, même graine = même pièce, graines différentes = pièces
  différentes.
- `partition.test.mjs` : SVG valide, une tête par note, bon nombre de barres, armure présente, x croissants.
- `ecoute.test.mjs` : trames synthétiques (sons de piano simulés : harmoniques + décroissance) → attaques et
  hauteurs retrouvées, notes répétées séparées ; alignement sur cas fabriqués : parfait, retard constant de
  150 ms, note manquée, note en trop, fausse note, arrêt au milieu.
- `progression.test.mjs` : tempo ±6 et bornes, déblocage 6/8, réessais ignorés, `normaliser` d'un ancien état.
- Validation réelle : écran Test du micro sur le téléphone de l'élève, à son piano, puis quelques pièces J1.
  Si la détection n'est pas fiable, on ajuste les seuils avant d'aller plus loin.

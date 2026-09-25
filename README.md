# 08 — Harmonie au clavier (app d'entraînement)

Petite web app de questions rapides pour installer les réflexes d'harmonie : armures, accords,
notes guides, degrés et II-V-I, intervalles, oreille, rythme, lecture sur portée, chant au micro. Conception : [docs/conception.md](docs/conception.md) ·
plan : [docs/plan-realisation.md](docs/plan-realisation.md).

## Utiliser

- **Téléphone** : https://klem88.github.io/harmonie-au-clavier/ (HTTPS : le micro fonctionne pour le chant et
  le déchiffrage). La progression est enregistrée dans le navigateur du téléphone ; « Voir ma progression →
  Copier ma progression » sert de sauvegarde et de bilan à coller à Claude.
- **Ordinateur** : ouvrir `dist/harmonie.html` après `node build.mjs`.

## Développer

Aucune dépendance. Node ≥ 20.

```bash
node --test            # tests (moteur musical, catalogue, progression, stockage, clavier, build)
node build.mjs         # assemble dist/harmonie.html
```

| Fichier | Rôle |
|---|---|
| `src/theorie.js` | Notes orthographiées, intervalles, accords, gammes, armures, degrés |
| `src/questions.js` | Catalogue des cartes (énoncé, réponse, 3 pièges, explication, notes) |
| `src/progression.js` | Boîtes de répétition espacée, déblocage des niveaux, composition de séance |
| `src/stockage.js` | Sauvegarde : base de l'artefact claude.ai, sinon localStorage, sinon mémoire |
| `src/clavier.js` | Clavier SVG 2 octaves qui surligne des notes |
| `src/audio.js` | Séquences audio, métronome et percussions, lecteur Web Audio |
| `src/rythme.js` | Cellules rythmiques, comptage, notation SVG, évaluation des frappes |
| `src/portee.js` | Portée en clé de sol / fa, armures, dessin SVG |
| `src/voix.js` | Détection de hauteur, évaluation du chant, micro |
| `src/piece.js` | Déchiffrage : génération de pièces reproductibles (graine) |
| `src/partition.js` | Déchiffrage : partition SVG avec rythmes et correction colorée |
| `src/ecoute.js` | Déchiffrage : attaques et hauteurs au micro, alignement avec la partition |
| `src/dechiffrage.js` | Déchiffrage : niveau, tempo, historique, déblocage |
| `src/interface.js` | Écrans : accueil, séance, bilan, progression |
| `build.mjs` | Concatène le tout en une page |

## Publier une nouvelle version

`git push` sur `main` : GitHub Actions lance les tests, construit la page et la publie sur Pages.

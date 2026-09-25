# Harmonie · Conception de l'app d'entraînement

*Rédigé le 2026-09-22. Statut : validé par l'élève, en construction.*

## 1. But

Une petite web app de questions rapides pour installer les **réflexes de l'harmonie de base au piano** :
armures, accords, notes guides, degrés et II-V-I. Elle complète les fiches de `07-harmonie-impro/`
(qui se travaillent au piano) en automatisant ce qui doit devenir instantané.

- Élève : pianiste amateur, fin de 1er cycle, répertoire jazz/bossa et classique. Oreille : point faible déclaré par l'élève (corrigé le 2026-09-22).
- Usage : séances de ~5 minutes, surtout sur téléphone, parfois sur ordinateur.
- Le prof (Claude) lit la progression pour adapter les leçons du vault.

## 2. Hors périmètre (V1)

- Voicings, impro, toucher : c'est le travail au piano avec les fiches.
- Saisie libre au clavier : toutes les réponses sont des choix à toucher.

## 3. Contenu : 9 dimensions × niveaux

Au départ, le niveau 1 de chaque dimension est ouvert. Un niveau suivant se débloque par la maîtrise (§5).

| Dimension | Niv. 1 | Niv. 2 | Niv. 3 | Niv. 4 |
|---|---|---|---|---|
| **A. Armures et quintes** | Armures majeures jusqu'à 3 ♯/♭, dans les deux sens (tonalité → armure, armure → tonalité) | Jusqu'à 7 ♯/♭ + relatives mineures | Cycle : quinte au-dessus / en dessous ; IV et V d'une tonalité | — |
| **B. Accords** | Triades majeures et mineures, nom → notes et notes → nom | + diminuées et augmentées, toutes fondamentales | Accords de 7e : maj7, 7, m7 | + m7♭5, °7 ; renversements (notes → nom avec basse ≠ fondamentale) |
| **C. Notes guides** | Tierce et 7e de maj7, 7, m7 dans les tonalités courantes (C F G B♭ E♭ D A) | Toutes fondamentales + m7♭5 | Enchaînement : « Dm7 → G7 : où va la 7e ? » (résolution 7e → 3ce) | — |
| **D. Degrés et II-V-I** | Degré → triade (« IV de sol ? ») en majeur | Accords de 7e sur chaque degré, dans les deux sens (« Am7 en do = ? ») | II-V-I majeur dans toutes les tonalités (« le V de A♭ ? », « le II-V-I en E ? ») | II-V-I mineur : IIø – V7 – i |
| **E. Intervalles** *(ajouté le 2026-09-22)* | Nom → note et note → nom depuis do, sol, fa (3ce, 4te, 5te, 6te, 7e) | Toutes fondamentales, secondes à septièmes | Renversements ; quarte augmentée / quinte diminuée (piège enharmonique) | — |
| **F. Oreille** *(ajouté le 2026-09-22)* | Intervalles mélodiques joués par le navigateur (Web Audio) | Triades : majeur, mineur, diminué, augmenté | Accords de 7e : maj7, 7, m7, m7♭5, °7 | Cadences : II-V-I majeur, II-V-i mineur, I-IV-V-I, I-vi-IV-V |
| **G. Rythme** *(ajouté le 2026-09-23)* | Lecture : compter une cellule (« 1 et (2) et 3 4 »), valeurs, compléter une mesure, chiffrage | Dictée : la cellule est jouée deux fois sur le clic, on choisit l'écriture (choix en images) | Frappe : métronome, décompte d'une mesure, on frappe la cellule deux fois ; critère = écart moyen aux attaques (≤ 80 ms pour monter, médiane ≤ 70 ms pour débloquer) | Patterns à deux mains (deux zones sur l'écran) : bossa nova, swing, stride, 3 contre 2, valse, syncope, à 72 et 96 |
| **H. Lecture** *(ajouté le 2026-09-24)* | Clé de sol, notes naturelles de do4 à sol5 ; on répond en **touchant la touche** sur le clavier (classe de hauteur, l'octave est expliquée) | Clé de fa, mi2 à do4 | Armures jusqu'à 3 altérations (la note lue doit tenir compte de l'armure) et altérations accidentelles | Lignes supplémentaires éloignées ; intervalles lus sur la portée (4 choix) |
| **I. Chant** *(ajouté le 2026-09-24)* | Reproduire la note jouée (référence à l'octave 3, octave libre à l'évaluation) | Chanter un intervalle au-dessus de la note jouée | Chanter la fondamentale, la tierce ou la quinte d'un accord joué | Reproduire une mélodie de 3 notes (3 fenêtres d'écoute) |

Prévu plus tard, hors V1 : **D niv. 5** dominantes secondaires (V/V, V/II…) et substitution tritonique,
quand l'élève aborde les fiches 4 et 6 de la roadmap.

### Lien avec les fiches du vault

| Fiche `07-harmonie-impro` | Prérequis app |
|---|---|
| 2. notes-guides | B3 + C1 ouverts |
| 3. boucle I-vi-ii-V | D2 |
| 4. dominantes secondaires | D3 |
| 5. II-V mineur | D4 |

### Notation

- Accords en **lettres** (C, F♯m7, B♭maj7, Dø ou Dm7♭5, C°7).
- Notes en **français** (do, ré, mi♭, fa♯…).
- **Orthographe exacte** : la 7e de A♭7 est *sol♭*, jamais *fa♯*. Le moteur travaille en (lettre, altération), pas en demi-tons seuls.

## 4. Une question

Chaque question est une **carte** identifiée de façon stable (ex. `B3:G7:tierce`). Une carte a :

- un énoncé court (« Tierce de G7 ? »),
- **4 choix**, dont 1 juste et 3 **pièges plausibles** (même note mal orthographiée, tierce mineure au lieu de majeure, la 5te à la place de la 7e, l'accord voisin sur le cycle…),
- une **explication** affichée en cas d'erreur (« G7 = sol si ré fa : 3ce majeure (4 ½ tons) + 7e mineure (10 ½ tons) »),
- pour les dimensions B, C, E et F, les **notes à surligner** sur un petit clavier de 2 octaves ;
- pour la dimension F, une **séquence audio** (`src/audio.js`, Web Audio, son synthétique doux) : bouton « Écouter », lecture automatique dès que le son a été autorisé par un premier geste, le chrono ne part qu'à la fin de la première écoute, bouton « Réécouter » dans la correction.

Le générateur de questions est **déterministe** à partir de l'identifiant de carte (les choix sont mélangés au tirage, pas le contenu).

## 5. Progression (répétition espacée)

- Chaque carte a une **boîte** de 0 à 5 et une **date de prochaine révision**.
- Réponse **fausse** → boîte 0, la carte revient **dans la même séance** (au plus tard 5 questions après).
- Réponse **juste et rapide** → boîte +1 ; **juste mais lente** → boîte inchangée.
- Délai avant retour selon la boîte : 0 (même jour), 1, 3, 7, 16, 35 jours.
- On enregistre aussi, par carte, le nombre de réponses, de réussites et le **temps médian** récent (5 dernières).

**Seuils de vitesse, par dimension** : reconnaître une armure est un pur réflexe, construire un II-V-I ou
identifier un son demande une opération de plus. D'où deux régimes (`REGLES.vitesse`) :

| Dimensions | « Rapide » (boîte +1) | Médiane visée (déblocage) |
|---|---|---|
| A armures · B accords · C notes guides · E intervalles | ≤ 7 s | ≤ 5,5 s |
| D degrés et II-V-I · F oreille | ≤ 9 s | ≤ 7 s |

**Déblocage d'un niveau** : au moins **15 réponses** du niveau (toutes cartes confondues), **≥ 85 %** de réussite
et **temps médian** sous le seuil de la dimension. Réussite et médiane se lisent sur une **fenêtre glissante des
20 dernières réponses** du niveau : un mauvais départ finit par sortir de la fenêtre et ne bloque pas pour
toujours. Le déblocage est annoncé en fin de séance et n'est jamais retiré.

**Ce qui manque est affiché** : `etatDeblocage(etat, dim)` rend les trois critères avec valeur atteinte et cible ;
l'accueil montre le premier verrou restant, l'écran Progression les trois.

**Niveau « maîtrisé »** : toutes ses cartes en boîte ≥ 3. Sert au bilan et au dosage des révisions.

**Avancement affiché** : gradué, pas binaire. Chaque carte compte pour sa boîte plafonnée à `boiteAcquise`
(`consolide / consolideMax` dans `bilan`), à côté du nombre de cartes vues. Une barre « acquises / total »
reste structurellement à zéro les quatre premiers jours — le temps que les délais de 1 puis 3 jours passent —
et laisse croire que rien ne bouge. L'écran Progression explique en toutes lettres le cycle des boîtes
(`rendreExplicationBoites`, construit depuis `REGLES` pour ne jamais diverger du code), et chaque correction
en séance annonce la boîte atteinte et la date de retour.

## 6. Une séance

Deux entrées :

- **Séance du jour** (20 questions), composée dans cet ordre :
  1. cartes dont la révision est due (boîte ≥ 1, date dépassée), les plus en retard d'abord ;
  2. cartes **nouvelles** des niveaux ouverts non maîtrisés, dimensions alternées ;
  3. ~20 % (4 questions) tirées des niveaux maîtrisés, même si non dues.
  Les cartes ratées en cours de séance sont réinsérées (§5). Une séance peut donc dépasser légèrement 20.
- **Entraîner une dimension** : même mécanique, limitée à une dimension et au niveau le plus haut ouvert (ou un niveau choisi).

Déroulé d'une question : énoncé + 4 boutons → touche → correction immédiate.

- Juste : bandeau vert, temps affiché, explication et information sur la boîte, bouton **Continuer** *(depuis le 2026-09-24 : plus de passage automatique, l'élève veut le temps de lire)*.
- Faux : bandeau rouge, bonne réponse, explication, clavier avec les notes, bouton **Continuer**.

Fin de séance : score, temps médian, cartes montées de boîte, niveaux débloqués, bouton « Encore 10 ».

**Pause** *(ajouté le 2026-09-22)* : bouton « Pause » pendant une séance, et pause automatique quand la page passe en
arrière-plan (appel, autre application, écran verrouillé). Un voile cache la question ; à la reprise, le chrono de la
question en cours repart d'où il était (t0 décalé de la durée de la pause). Une lecture audio en cours est arrêtée et
la prochaine écoute relance le chrono à sa fin.

**Chant** *(ajouté le 2026-09-24)* : la référence est jouée, puis l'élève appuie sur « Chanter » ; le micro écoute
2,4 s (1,7 s par note pour les mélodies), une jauge et la note détectée s'affichent en direct. Critère : écart en cents à la
classe de hauteur visée, ± 50 = juste, ≤ 35 pour monter de boîte, médiane ≤ 30 pour débloquer. Le micro est fermé en
fin de séance. Le refus du micro est expliqué, avec renvoi vers le mode silencieux.

**Mode silencieux** *(ajouté le 2026-09-22)* : case à cocher sur l'accueil, enregistrée dans l'état (`prefs.silence`),
donc commune à tous les appareils. Les cartes sonores (dimension F) sont exclues des séances et la dimension Oreille
est grisée sur l'accueil.

## 7. Écrans

1. **Accueil** : bouton « Séance du jour » (avec le nombre de cartes dues), liste des 4 dimensions avec niveau ouvert et % de cartes acquises, lien « Progression ».
2. **Séance** : compteur (7/20), énoncé, 4 boutons larges, correction.
3. **Bilan de séance**.
4. **Progression** : par dimension, niveaux (verrouillé / ouvert / maîtrisé) et barre de cartes acquises ; historique des séances (date, score, temps médian) ; bouton **Exporter** (JSON) pour le prof.

Ergonomie téléphone : boutons ≥ 56 px de haut, une main, pas de défilement pendant une question, thème clair/sombre automatique.

## 8. Architecture

Dossier `08-harmonie-app/`, **JavaScript sans framework**, un fichier par rôle :

| Fichier | Rôle | Dépend de |
|---|---|---|
| `src/theorie.js` | Notes (lettre + altération), intervalles, accords, gammes majeures/mineures, armures, cycle des quintes, degrés. Pur, sans DOM. | — |
| `src/questions.js` | Catalogue des cartes par dimension/niveau ; génération énoncé + choix + explication + notes à afficher. Pur. | theorie |
| `src/progression.js` | État de l'élève (boîtes, dates, stats, séances), règles de répétition espacée, déblocage, composition d'une séance. Pur, reçoit `now` en paramètre. | questions (catalogue) |
| `src/stockage.js` | Lecture/écriture de l'état : `localStorage` en local, base de l'artefact quand la page est publiée sur claude.ai. Même interface dans les deux cas. | — |
| `src/clavier.js` | Clavier SVG de 2 octaves. | theorie |
| `src/audio.js` | Séquences audio des cartes d'oreille, métronome et percussions (pures, testées) et lecteur Web Audio. | theorie |
| `src/rythme.js` | Cellules rythmiques (12 unités par temps), comptage, notation SVG, évaluation d'une frappe. Pur. | — |
| `src/portee.js` | Position d'une note sur la portée (clé de sol / fa), armure, dessin SVG de la portée. Pur. | theorie |
| `src/voix.js` | Détection de hauteur par autocorrélation (premier pic, pour éviter l'octave en dessous), évaluation d'une note chantée en cents (octave libre), accès au micro. Partie pure testée. | — |
| `src/interface.js` | Écrans, minuterie de réponse, son. Seul fichier qui touche le DOM. | tous |
| `src/style.css`, `index.html` | Page de développement (charge les fichiers séparément). | — |
| `build.mjs` | Concatène tout en une seule page `dist/harmonie.html` (script Node, sans dépendance). | — |
| `tests/*.test.mjs` | Tests avec `node:test` : théorie (exhaustifs sur l'orthographe), questions (chaque carte a 1 bonne réponse, 3 choix distincts, explication non vide), progression (boîtes, déblocage, composition de séance). | — |

Flux de données : `interface` demande une séance à `progression`, qui pioche dans le catalogue de `questions` ;
chaque réponse est renvoyée à `progression`, qui met à jour l'état et le confie à `stockage`.

### Publication

- **Téléphone** : `dist/harmonie.html` publié comme page claude.ai privée, avec la capacité de base de données
  de l'artefact pour que la progression suive l'élève et soit lisible par le prof (via `ArtifactData`).
- **Ordinateur** : ouvrir `dist/harmonie.html` ou `index.html` directement ; progression en `localStorage`.
- Format d'état versionné (`version: 1`) pour permettre les migrations.

### Gestion des erreurs

- Stockage indisponible (navigation privée, base inaccessible) : l'app fonctionne en mémoire et l'affiche discrètement.
- État corrompu ou d'une version inconnue : on repart d'un état vide après sauvegarde de l'ancien sous une autre clé.
- Aucune carte disponible (tout maîtrisé et rien de dû) : la séance du jour propose des révisions quand même.

## 9. Tests et validation

- Le moteur musical est testé de façon **exhaustive** : les 12 (ou 15) fondamentales × tous les types d'accords,
  toutes les armures, tous les degrés, avec l'orthographe attendue écrite à la main dans les tests.
- Chaque carte du catalogue est validée automatiquement (bonne réponse unique, pièges distincts, explication).
- La progression est testée avec des dates simulées.
- Validation manuelle finale sur téléphone et ordinateur (navigateur intégré) avant publication.

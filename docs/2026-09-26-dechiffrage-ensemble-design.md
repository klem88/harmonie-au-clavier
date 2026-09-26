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
  3, 4, 7, 8 ou 9 demi-tons ; jamais de seconde, quarte seule, triton ni septième, **ni octave ou unisson** :
  tous les harmoniques de la note du haut seraient aussi ceux de la note du bas, l'écoute ne pourrait pas la
  juger (constaté en simulation). En E1 et E2, la note de la main droite au temps 1 n'est donc jamais la basse.
- Génération : harmonies, rythmes, main droite puis main gauche sont retirés ensemble tant que les règles ne
  tiennent pas (500 essais ; 20 essais de main gauche par main droite). Prototype : 0 échec sur 500 graines
  à chaque niveau.

| Niveau | Main droite | Main gauche |
|---|---|---|
| **E1** | règles de J1 : do majeur, 4/4, noires et blanches | rondes ou blanches (`r`, `b b`) : la basse de l'accord ; en `b b`, la seconde blanche est la basse ou la quinte de l'accord |
| **E2** | règles de J2 : do, sol, fa, ré majeur, 4/4, paires de croches | noires et blanches (`n n n n`, `b n n`, `n n b`, `n b n`, `b b`), degrés conjoints surtout, sauts ≤ tierce ; jamais de croches |
| **E3** | rythmes de J2 en 4/4, rythmes 3/4 de J3 ; 3/4 ou 4/4 | petite mélodie en noires, blanches (et blanche pointée), sauts ≤ quarte ; **rythmes complémentaires** : dans chaque mesure sauf la dernière, hors premier temps, au moins autant de temps où une seule main attaque que de temps où les deux attaquent |

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

En mode ensemble, `creerEcoute().demarrer(onTrame, { fftSize: 4096, fabriquer })` règle l'analyseur à
`fftSize = 4096` (~85 ms à 48 kHz, `smoothingTimeConstant = 0`) et, toutes les 15 ms, lit le signal et le
spectre natif (`getFloatFrequencyData`, en dB) puis appelle `fabriquer` (fourni par l'interface, qui appelle
`trameEnsemble` : `ecoute.js` n'importe pas `verification.js`). La trame est `{ tMs, rms, h }` :
- `rms` sur les 1024 derniers échantillons, pour garder des attaques nettes ;
- `h` : pour chaque candidat, l'amplitude de ses harmoniques 1 à 6.

Candidats : toutes les notes de la pièce et leurs demi-tons voisins (~30 au plus), fixés au lancement.
Le mode une main reste inchangé (`fftSize = 1024`, `f0`).

### 5.2 Amplitude d'une note (pur, `src/verification.js`)

- Amplitude d'un harmonique = spectre linéaire (`10^(dB/20)`) **interpolé à la fréquence exacte** h × f(midi).
  Prendre le maximum sur ± un quart de ton, comme prévu d'abord, laissait le voisin « voir » la note juste :
  la fenêtre de Blackman étale chaque raie sur ± 35 Hz.
- Harmoniques **utiles** d'une note : ceux où le demi-ton voisin est à au moins deux cases du spectre
  (h × f × 0,0595 ≥ 2 × sampleRate / fftSize, soit h × f ≥ ~390 Hz), et qui ne tombent (à un quart de ton près)
  sur aucun harmonique 1 à 8 d'une **autre note attaquée au même instant**. Les notes tenues ne sont pas
  masquées : elles ne montent pas, la comparaison avant / après les neutralise.
- Valeur d'une note dans une trame = **moyenne** de ses harmoniques utiles ; moins de 2 harmoniques utiles →
  la note ne peut pas être jugée.

### 5.3 Temps et continuité

Attaques = sauts d'énergie, par la partie énergie de `detecterAttaques` (sans hauteur ; sortie `{ tMs }`).
Instants attendus = attaques des deux mains fusionnées (un instant par position où au moins une main attaque).
`aligner` actuel, appelé avec une même hauteur factice pour tous (seul le temps compte), donne le retard
constant, l'écart de chaque instant et les arrêts. Rien n'est changé dans `aligner`.

### 5.4 Verdict par note attendue

Pour chaque note de chaque main, à son instant `t` (retard retiré) :
- `avant` = médiane de la saillance de la note entre `t − 120` et `t − 20` ms ;
- `apres` = maximum de la saillance entre `t + 40` et `t + min(250, durée de la note)` ms ;
- `montee = apres / max(avant, plancher)`, avec `plancher` = 1 % du maximum de tout l'enregistrement ;
  idem pour les deux voisins (± 1 demi-ton), dont les harmoniques utiles excluent aussi ceux de la note.
- Un voisin qui ne peut pas être jugé (moins de 2 harmoniques utiles) est ignoré.
- L'instant réel d'une position = l'attaque appariée par `aligner` (`tJoueMs`, ajouté à son résultat), sinon
  l'instant attendu + le dernier décalage connu.

| Verdict | Condition (seuils de départ, dans `REGLES_ECOUTE.ensemble`) |
|---|---|
| **juste** | `montee ≥ 2` et `apres ≥ 1,5 ×` l'`apres` de chaque voisin retenu |
| **fausse probable** | sinon, un voisin retenu a `montee ≥ 2` et un `apres ≥ 1,5 ×` celui de la note |
| **manquée** | sinon, `montee < 1,3` et aucun voisin retenu n'a `montee ≥ 2` |
| **douteuse** | tous les autres cas, et toute note qui ne peut pas être jugée |

Une note juste dont l'instant est décalé de plus de 120 ms devient **décalée** (règle actuelle).
Les seuils (2 ; 1,5 ; 1,3 ; 1 %) sont des valeurs de départ, à régler sur les premiers essais réels.

**Prototype (simulation, 24 pièces, décalages ±40 ms, nuances variées, main gauche plus douce) :**

| Cas | Résultat |
|---|---|
| notes justes, main droite | 99 % justes, 1 % douteuses |
| notes justes, main gauche | 82 % justes, 16 % douteuses, 2 % fausses ou manquées à tort |
| fausse note jouée (± 1 demi-ton) | 96 % fausses, 4 % douteuses |
| note oubliée | 75 % manquées, 13 % fausses, 12 % douteuses |

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
  `[tMs, rms×1000, puis pour chaque candidat la moyenne de ses harmoniques × 10⁴, arrondie]` et, par note,
  `[main, midi, etat, montee, voisins]`.

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
| `src/ensemble.js` (nouveau) | `NIVEAUX_ENSEMBLE`, `genererPieceEnsemble(niveau, graine)`, `notesAttenduesEnsemble(piece, bpm)` (notes avec `main`), `instantsAttendus`, `notesAJouer` (lecture de l'exemple). Réutilise `generateurAlea`, `melodieValide`, `choisirDans`, `tirerPas`, `noteDuDegre` de `piece.js` (exportés). | oui |
| `src/verification.js` (nouveau) | `candidatsPiece`, `trameEnsemble`, `amplitudesDeDb`, `harmoniquesLibres`, `verifierEnsemble` (§ 5.1–5.5). | oui |
| `src/ecoute.js` | `detecterAttaques(trames, regles, { hauteur: false })` : attaques d'énergie seules ; `aligner` renvoie aussi `tJoueMs` par note ; `creerEcoute().demarrer` gagne les options `fftSize` et `fabriquer` (§ 5.1) ; `REGLES_ECOUTE.ensemble`. | oui (partie pure) |
| `src/audio.js` | `creerLecteur().jouerNotes([{ midi, debutMs, dureeMs }])` : notes superposées (les deux mains), pour « Écouter la pièce ». | non (Web Audio) |
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

// Catalogue des cartes de questions : une carte = énoncé, réponse, 3 pièges, explication.
// Tout est déterministe ; seul l'ordre des choix est mélangé au tirage.

import {
  note, nomFr, nomLettre, enharmonique, transposer, demiTons, TYPES_ACCORD, classe,
  notesAccord, nomAccord, gammeMajeure, gammeMineureNaturelle, armure,
  relativeMineure, quinteSup, quinteInf, accordDegre, chiffreRomain, listeNotes,
  nomIntervalle, renversement, intervalleEntre,
} from './theorie.js';
import { cellule, onsets, onsetsMs, compter, notationSvg, nomValeur, tempsValeur, TOKENS } from './rythme.js';
import { porteeSvg, positionPortee, noteAPosition, decrirePosition, REGLES_LECTURE } from './portee.js';

export const DIMENSIONS = {
  A: { nom: 'Armures et quintes', niveaux: 3 },
  B: { nom: 'Accords', niveaux: 4 },
  C: { nom: 'Notes guides', niveaux: 3 },
  D: { nom: 'Degrés et II-V-I', niveaux: 4 },
  E: { nom: 'Intervalles', niveaux: 3 },
  F: { nom: 'Oreille', niveaux: 4 },
  G: { nom: 'Rythme', niveaux: 4 },
  H: { nom: 'Lecture', niveaux: 4 },
  I: { nom: 'Chant', niveaux: 4 },
};

const COURANTES = ['C', 'F', 'G', 'Bb', 'Eb', 'D', 'A'];
const TOUTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const RESTANTES = TOUTES.filter((r) => !COURANTES.includes(r));
const TONALITES = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
const MINEURES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

const SEP = ' – ';
const LETTRES_PORTEE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const N = (t) => note(t);
const fr = nomFr;
const tonMaj = (t) => `${fr(N(t))} majeur`;
const tonMin = (t) => `${fr(N(t))} mineur`;
const romain = (d) => chiffreRomain(d, 'majeur', false);

function texteArmure(n) {
  if (n === 0) return 'aucune';
  return n > 0 ? `${n} ♯` : `${-n} ♭`;
}
function detailArmure(t, mode = 'majeur') {
  const a = armure(N(t), mode);
  if (a.nombre === 0) return 'aucune altération';
  return `${texteArmure(a.nombre)} (${listeNotes(a.alterations)})`;
}

// Prend jusqu'à 3 candidats distincts, ≠ réponse, puis complète avec le vivier.
function piegesDistincts(candidats, reponse, vivier = []) {
  const out = [];
  for (const c of [...candidats, ...vivier]) {
    if (c && c !== reponse && !out.includes(c)) out.push(c);
    if (out.length === 3) break;
  }
  if (out.length < 3) throw new Error(`Pas assez de pièges pour « ${reponse} »`);
  return out;
}

const VIVIER_NOTES = TOUTES.map((r) => fr(N(r)));
const VIVIER_TONALITES = TONALITES.map(tonMaj);
const VIVIER_ARMURES = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7].map(texteArmure);
const enh = (n) => { const e = enharmonique(n); return e ? fr(e) : null; };
const tons = (i) => {
  const d = demiTons(i); const t = Math.floor(d / 2); const s = t ? `${t} ton${t > 1 ? 's' : ''}` : '';
  return d % 2 ? (s ? `${s} ½` : '½ ton') : s;
};

const cartes = [];
function ajouter(c) { cartes.push(c); }

// ---------- A. Armures et quintes ----------
function cartesArmure(niv, t) {
  const n = armure(N(t)).nombre;
  ajouter({
    id: `A${niv}:${t}:armure`, dimension: 'A', niveau: niv,
    enonce: `Armure de ${tonMaj(t)} ?`,
    reponse: texteArmure(n),
    pieges: piegesDistincts([texteArmure(n + 1), texteArmure(n - 1), texteArmure(-n)], texteArmure(n), VIVIER_ARMURES),
    explication: `${tonMaj(t)} : ${detailArmure(t)}. Ordre des dièses : fa do sol ré la mi si ; des bémols : si mi la ré sol do fa.`,
    notes: null,
  });
  const voisins = TONALITES.filter((x) => Math.abs(armure(N(x)).nombre - n) === 1 || armure(N(x)).nombre === -n);
  let regle;
  if (n > 0) regle = `la tonique est un demi-ton au-dessus du dernier dièse (${fr(armure(N(t)).alterations.at(-1))} → ${fr(N(t))})`;
  else if (n < -1) regle = `la tonique est l'avant-dernier bémol (${fr(armure(N(t)).alterations.at(-2))})`;
  else if (n === -1) regle = 'un seul bémol = fa majeur, à retenir';
  else regle = 'aucune altération = do majeur';
  ajouter({
    id: `A${niv}:${t}:tonalite`, dimension: 'A', niveau: niv,
    enonce: n === 0 ? 'Aucune altération : quelle tonalité majeure ?' : `${texteArmure(n)} : quelle tonalité majeure ?`,
    reponse: tonMaj(t),
    pieges: piegesDistincts(voisins.map(tonMaj), tonMaj(t), VIVIER_TONALITES),
    explication: `${detailArmure(t)} = ${tonMaj(t)} : ${regle}.`,
    notes: null,
  });
}
for (const t of TONALITES) cartesArmure(Math.abs(armure(N(t)).nombre) <= 3 ? 1 : 2, t);

for (const t of TONALITES) {
  const rel = relativeMineure(N(t));
  const n = armure(N(t)).nombre;
  const voisins = TONALITES.filter((x) => Math.abs(armure(N(x)).nombre - n) === 1).map((x) => `${fr(relativeMineure(N(x)))} mineur`);
  ajouter({
    id: `A2:${t}:relative`, dimension: 'A', niveau: 2,
    enonce: `Relative mineure de ${tonMaj(t)} ?`,
    reponse: `${fr(rel)} mineur`,
    pieges: piegesDistincts([tonMin(t), ...voisins], `${fr(rel)} mineur`, MINEURES.map(tonMin)),
    explication: `La relative mineure est une tierce mineure sous la tonique (le VIe degré) : ${fr(N(t))} → ${fr(rel)}. Même armure : ${detailArmure(t)}.`,
    notes: null,
  });
}
for (const t of ['A', 'E', 'B', 'F#', 'D', 'G', 'C', 'F']) {
  const n = armure(N(t), 'mineur').nombre;
  const relMaj = transposer(N(t), 'm3');
  ajouter({
    id: `A2:${t}m:armure`, dimension: 'A', niveau: 2,
    enonce: `Armure de ${tonMin(t)} ?`,
    reponse: texteArmure(n),
    pieges: piegesDistincts([texteArmure(n + 1), texteArmure(n - 1), texteArmure(-n), texteArmure(armure(N(t)).nombre)], texteArmure(n), VIVIER_ARMURES),
    explication: `${tonMin(t)} est la relative de ${fr(relMaj)} majeur (une tierce mineure au-dessus) : ${detailArmure(t, 'mineur')}.`,
    notes: null,
  });
}

for (const r of TOUTES) {
  const n = N(r);
  const sup = quinteSup(n); const inf = quinteInf(n);
  ajouter({
    id: `A3:${r}:quinteSup`, dimension: 'A', niveau: 3,
    enonce: `Quinte au-dessus de ${fr(n)} ?`,
    reponse: fr(sup),
    pieges: piegesDistincts([fr(transposer(n, 'P4')), enh(sup), fr(transposer(n, 'd5')), fr(transposer(n, 'A5'))], fr(sup), VIVIER_NOTES),
    explication: `Quinte juste = 3 tons ½ : ${fr(n)} → ${fr(sup)}. Sur le cycle des quintes, on avance d'un cran (un ♯ de plus ou un ♭ de moins).`,
    notes: null,
  });
  ajouter({
    id: `A3:${r}:quinteInf`, dimension: 'A', niveau: 3,
    enonce: `Quinte en dessous de ${fr(n)} ?`,
    reponse: fr(inf),
    pieges: piegesDistincts([fr(sup), enh(inf), fr(transposer(n, 'A4')), fr(transposer(n, 'M3'))], fr(inf), VIVIER_NOTES),
    explication: `Une quinte en dessous = une quarte au-dessus : ${fr(n)} → ${fr(inf)}. Sur le cycle, on recule d'un cran (un ♭ de plus ou un ♯ de moins).`,
    notes: null,
  });
  const g = gammeMajeure(n);
  for (const [deg, nom] of [[4, 'IV (sous-dominante)'], [5, 'V (dominante)']]) {
    const rep = fr(g[deg - 1]);
    ajouter({
      id: `A3:${r}:${deg === 4 ? 'IV' : 'V'}`, dimension: 'A', niveau: 3,
      enonce: `${nom} de ${tonMaj(r)} : quelle note ?`,
      reponse: rep,
      pieges: piegesDistincts([fr(g[deg === 4 ? 4 : 3]), enh(g[deg - 1]), fr(g[1]), fr(g[5])], rep, VIVIER_NOTES),
      explication: `Gamme de ${tonMaj(r)} : ${listeNotes(g)}. Le ${deg === 4 ? 'IV est une quinte en dessous' : 'V est une quinte au-dessus'} de la tonique : ${rep}.`,
      notes: null,
    });
  }
}

// ---------- B. Accords ----------
const AUTRES_TYPES = {
  maj: ['min', 'aug', 'dim'], min: ['maj', 'dim', 'aug'], dim: ['min', 'm7b5', 'maj'], aug: ['maj', 'min', 'dim'],
  maj7: ['7', 'm7', 'min'], 7: ['maj7', 'm7', 'm7b5'], m7: ['7', 'maj7', 'm7b5'], m7b5: ['m7', 'dim7', '7'], dim7: ['m7b5', 'm7', 'dim'],
};
function explicationAccord(fond, type) {
  const notes = notesAccord(fond, type);
  const iv = TYPES_ACCORD[type].intervalles;
  const parts = [];
  parts.push(`tierce ${iv[1] === 'M3' ? 'majeure (2 tons)' : 'mineure (1 ton ½)'}`);
  parts.push(`quinte ${iv[2] === 'P5' ? 'juste' : iv[2] === 'd5' ? 'diminuée' : 'augmentée'}`);
  if (iv[3]) parts.push(`7e ${iv[3] === 'M7' ? 'majeure (½ ton sous l’octave)' : iv[3] === 'm7' ? 'mineure (1 ton sous l’octave)' : 'diminuée (= sixte)'}`);
  return `${nomAccord(fond, type)} = ${listeNotes(notes)} : ${parts.join(' + ')}.`;
}
function notesMalOrthographiees(notes) {
  for (let i = notes.length - 1; i >= 1; i--) {
    const e = enharmonique(notes[i]);
    if (e) return listeNotes(notes.map((n, j) => (j === i ? e : n)));
  }
  return null;
}
function cartesAccord(niv, r, type) {
  const fond = N(r);
  const notes = notesAccord(fond, type);
  const rep = listeNotes(notes);
  const autres = AUTRES_TYPES[type].map((t) => listeNotes(notesAccord(fond, t)));
  const vivierNotes = TOUTES.map((x) => listeNotes(notesAccord(N(x), type)));
  ajouter({
    id: `B${niv}:${r}:${type}:notes`, dimension: 'B', niveau: niv,
    enonce: `Notes de ${nomAccord(fond, type)} ?`,
    reponse: rep,
    pieges: piegesDistincts([autres[0], notesMalOrthographiees(notes), autres[1], autres[2]], rep, vivierNotes),
    explication: `${explicationAccord(fond, type)} ${nomAccord(fond, AUTRES_TYPES[type][0])} aurait ${listeNotes(notesAccord(fond, AUTRES_TYPES[type][0]))}.`,
    notes,
  });
  const nom = nomAccord(fond, type);
  const relatif = type === 'maj' ? nomAccord(transposer(fond, 'M6'), 'min') : type === 'min' ? nomAccord(transposer(fond, 'm3'), 'maj') : null;
  ajouter({
    id: `B${niv}:${r}:${type}:nom`, dimension: 'B', niveau: niv,
    enonce: `${rep} = ?`,
    reponse: nom,
    pieges: piegesDistincts([nomAccord(fond, AUTRES_TYPES[type][0]), relatif, ...AUTRES_TYPES[type].slice(1).map((t) => nomAccord(fond, t))], nom, TOUTES.map((x) => nomAccord(N(x), type))),
    explication: `${explicationAccord(fond, type)} C'est un accord ${TYPES_ACCORD[type].libelle}.`,
    notes,
  });
}
for (const r of COURANTES) for (const t of ['maj', 'min']) cartesAccord(1, r, t);
for (const r of TOUTES) for (const t of ['dim', 'aug']) cartesAccord(2, r, t);
for (const r of RESTANTES) for (const t of ['maj', 'min']) cartesAccord(2, r, t);
for (const r of TOUTES) for (const t of ['maj7', '7', 'm7']) cartesAccord(3, r, t);
for (const r of TOUTES) for (const t of ['m7b5', 'dim7']) cartesAccord(4, r, t);

const ORDINAL = { 1: '1er', 2: '2e' };
for (const r of COURANTES) {
  for (const type of ['maj', 'min']) {
    const fond = N(r);
    const notes = notesAccord(fond, type);
    for (const renv of [1, 2]) {
      const ordre = [...notes.slice(renv), ...notes.slice(0, renv)];
      const basse = ordre[0];
      const rep = `${nomAccord(fond, type)} (${ORDINAL[renv]} renversement)`;
      const autre = `${nomAccord(fond, type)} (${ORDINAL[3 - renv]} renversement)`;
      ajouter({
        id: `B4:${r}:${type}:renv${renv}`, dimension: 'B', niveau: 4,
        enonce: `${listeNotes(ordre)} = ?`,
        reponse: rep,
        pieges: piegesDistincts([nomAccord(basse, type), autre, nomAccord(basse, type === 'maj' ? 'min' : 'maj'), `${nomAccord(fond, type)} (position fondamentale)`], rep),
        explication: `Remis en tierces : ${listeNotes(notes)} = ${nomAccord(fond, type)}. La basse est ${fr(basse)}, la ${renv === 1 ? 'tierce' : 'quinte'} : ${ORDINAL[renv]} renversement (${nomAccord(fond, type)}/${nomLettre(basse)}).`,
        notes: ordre,
      });
    }
  }
}

// ---------- C. Notes guides ----------
function cartesGuides(niv, r, type) {
  const fond = N(r);
  const notes = notesAccord(fond, type);
  const [, tierce, quinte, septieme] = notes;
  const iv = TYPES_ACCORD[type].intervalles;
  const autreTierce = transposer(fond, iv[1] === 'M3' ? 'm3' : 'M3');
  const autreSept = transposer(fond, iv[3] === 'M7' ? 'm7' : 'M7');
  const sixte = transposer(fond, 'M6');
  const nom = nomAccord(fond, type);
  const typeTierce = AUTRES_TYPES[type].find((t) => TYPES_ACCORD[t].intervalles[1] !== iv[1]);
  const typeSept = AUTRES_TYPES[type].find((t) => TYPES_ACCORD[t].intervalles[3] && TYPES_ACCORD[t].intervalles[3] !== iv[3]);
  ajouter({
    id: `C${niv}:${r}:${type}:tierce`, dimension: 'C', niveau: niv,
    enonce: `Tierce de ${nom} ?`,
    reponse: fr(tierce),
    pieges: piegesDistincts([fr(autreTierce), fr(quinte), enh(tierce), fr(septieme)], fr(tierce), VIVIER_NOTES),
    explication: `${nom} = ${listeNotes(notes)}. Tierce ${iv[1] === 'M3' ? 'majeure = 2 tons' : 'mineure = 1 ton ½'} au-dessus de ${fr(fond)} : ${fr(tierce)}.${typeTierce ? ` ${nomAccord(fond, typeTierce)} aurait ${fr(autreTierce)}.` : ''}`,
    notes,
  });
  ajouter({
    id: `C${niv}:${r}:${type}:septieme`, dimension: 'C', niveau: niv,
    enonce: `Septième de ${nom} ?`,
    reponse: fr(septieme),
    pieges: piegesDistincts([fr(autreSept), fr(sixte), enh(septieme), fr(quinte)], fr(septieme), VIVIER_NOTES),
    explication: `${nom} = ${listeNotes(notes)}. 7e ${iv[3] === 'M7' ? 'majeure = ½ ton' : 'mineure = 1 ton'} sous l'octave de ${fr(fond)} : ${fr(septieme)}.${typeSept ? ` ${nomAccord(fond, typeSept)} aurait ${fr(autreSept)}.` : ''}`,
    notes,
  });
}
for (const r of COURANTES) for (const t of ['maj7', '7', 'm7']) cartesGuides(1, r, t);
for (const r of RESTANTES) for (const t of ['maj7', '7', 'm7']) cartesGuides(2, r, t);
for (const r of TOUTES) cartesGuides(2, r, 'm7b5');

for (const t of TOUTES) {
  const ii = accordDegre(N(t), 2, { septieme: true });
  const v = accordDegre(N(t), 5, { septieme: true });
  const i = { fond: N(t), type: 'maj7' };
  const paires = [
    { cle: 'ii-V', de: ii, vers: v },
    { cle: 'V-I', de: v, vers: i },
  ];
  for (const p of paires) {
    const nDe = notesAccord(p.de.fond, p.de.type); const nVers = notesAccord(p.vers.fond, p.vers.type);
    const sept = nDe[3]; const cible = nVers[1];
    ajouter({
      id: `C3:${t}:${p.cle}`, dimension: 'C', niveau: 3,
      enonce: `${nomAccord(p.de.fond, p.de.type)} → ${nomAccord(p.vers.fond, p.vers.type)} : la 7e de ${nomAccord(p.de.fond, p.de.type)} (${fr(sept)}) va vers ?`,
      reponse: fr(cible),
      pieges: piegesDistincts([fr(sept), fr(transposer(sept, 'M2')), enh(cible), fr(transposer(cible, 'm2'))], fr(cible), VIVIER_NOTES),
      explication: `La 7e de ${nomAccord(p.de.fond, p.de.type)} (${fr(sept)}) descend d'un demi-ton vers la 3ce de ${nomAccord(p.vers.fond, p.vers.type)} (${fr(cible)}). C'est la ligne des notes guides : 7e → 3ce, et la 3ce reste pour devenir la 7e suivante.`,
      notes: [...nDe, cible],
    });
  }
}

// ---------- D. Degrés et II-V-I ----------
const nomDeg = (t, d, sept = false, mode = 'majeur') => { const a = accordDegre(N(t), d, { septieme: sept, mode }); return nomAccord(a.fond, a.type); };
const gammeHarmonisee = (t, sept) => [1, 2, 3, 4, 5, 6, 7].map((d) => nomDeg(t, d, sept)).join(' ');

for (const t of COURANTES) {
  const g = gammeMajeure(N(t));
  for (let d = 2; d <= 7; d++) {
    const a = accordDegre(N(t), d);
    const rep = nomAccord(a.fond, a.type);
    ajouter({
      id: `D1:${t}:${d}`, dimension: 'D', niveau: 1,
      enonce: `Degré ${romain(d)} de ${tonMaj(t)} : quel accord ?`,
      reponse: rep,
      pieges: piegesDistincts([nomDeg(t, d === 7 ? 6 : d + 1), nomDeg(t, d - 1), nomAccord(a.fond, AUTRES_TYPES[a.type][0])], rep, [1, 2, 3, 4, 5, 6, 7].map((x) => nomDeg(t, x))),
      explication: `Gamme de ${tonMaj(t)} : ${listeNotes(g)}. Le ${romain(d)} est bâti sur ${fr(g[d - 1])}, accord ${TYPES_ACCORD[a.type].libelle} : ${rep} (${listeNotes(notesAccord(a.fond, a.type))}). Gamme harmonisée : ${gammeHarmonisee(t, false)}.`,
      notes: notesAccord(a.fond, a.type),
    });
  }
}

for (const t of TOUTES) {
  for (const d of [2, 4, 5, 6]) {
    const a = accordDegre(N(t), d, { septieme: true });
    const rep = nomAccord(a.fond, a.type);
    ajouter({
      id: `D2:${t}:${d}:accord`, dimension: 'D', niveau: 2,
      enonce: `${chiffreRomain(d, 'majeur', true)} de ${tonMaj(t)} : quel accord ?`,
      reponse: rep,
      pieges: piegesDistincts([nomAccord(a.fond, AUTRES_TYPES[a.type][0]), nomDeg(t, d + 1, true), nomDeg(t, d - 1, true)], rep, [1, 2, 3, 4, 5, 6, 7].map((x) => nomDeg(t, x, true))),
      explication: `Gamme harmonisée de ${tonMaj(t)} : ${gammeHarmonisee(t, true)}. ${chiffreRomain(d, 'majeur', true)} = ${rep}.`,
      notes: notesAccord(a.fond, a.type),
    });
  }
}
for (const t of COURANTES) {
  for (const d of [2, 3, 4, 5, 6]) {
    const rep = romain(d);
    ajouter({
      id: `D2:${t}:${d}:degre`, dimension: 'D', niveau: 2,
      enonce: `${nomDeg(t, d, true)} en ${tonMaj(t)} : quel degré ?`,
      reponse: rep,
      pieges: piegesDistincts([romain(d === 6 ? 2 : d + 1), romain(d === 2 ? 6 : d - 1), romain(d === 5 ? 4 : 5)], rep, [2, 3, 4, 5, 6, 7, 1].map(romain)),
      explication: `Gamme harmonisée de ${tonMaj(t)} : ${gammeHarmonisee(t, true)}. ${nomDeg(t, d, true)} est bâti sur ${fr(gammeMajeure(N(t))[d - 1])}, le ${rep}.`,
      notes: null,
    });
  }
}

const iiVI = (t) => [nomDeg(t, 2, true), nomDeg(t, 5, true), nomAccord(N(t), 'maj7')].join(SEP);
for (const t of TOUTES) {
  const rep = iiVI(t);
  const [ii, v, i] = rep.split(SEP);
  const haut = nomLettre(quinteSup(N(t))); const bas = nomLettre(quinteInf(N(t)));
  const cleHaut = TOUTES.find((x) => nomLettre(N(x)) === haut) || enhCle(quinteSup(N(t)));
  const cleBas = TOUTES.find((x) => nomLettre(N(x)) === bas) || enhCle(quinteInf(N(t)));
  ajouter({
    id: `D3:${t}:complet`, dimension: 'D', niveau: 3,
    enonce: `II-V-I en ${tonMaj(t)} ?`,
    reponse: rep,
    pieges: piegesDistincts([
      [nomDeg(t, 2, true).replace(/m7$/, '7'), v.replace(/7$/, 'm7'), i].join(SEP),
      [ii, v, nomAccord(N(t), 'm7')].join(SEP),
      iiVI(cleHaut), iiVI(cleBas),
    ], rep),
    explication: `En ${tonMaj(t)} : ii = ${ii}, V = ${v}, I = ${i}. Le V est une quinte au-dessus de la tonique, le II un ton au-dessus de la tonique (et une quinte au-dessus du V).`,
    notes: null,
  });
  ajouter({
    id: `D3:${t}:II`, dimension: 'D', niveau: 3,
    enonce: `Le II (IIm7) de ${tonMaj(t)} ?`,
    reponse: ii,
    pieges: piegesDistincts([ii.replace(/m7$/, '7'), ii.replace(/m7$/, 'maj7'), nomDeg(cleHaut, 2, true), nomDeg(cleBas, 2, true)], ii),
    explication: `Le II est un ton au-dessus de la tonique ${fr(N(t))} : ${fr(gammeMajeure(N(t))[1])}, accord mineur 7 : ${ii}. II-V-I en ${tonMaj(t)} : ${rep}.`,
    notes: null,
  });
  ajouter({
    id: `D3:${t}:resout`, dimension: 'D', niveau: 3,
    enonce: `${ii} – ${v} résout vers ?`,
    reponse: i,
    pieges: piegesDistincts([nomDeg(t, 4, true), v.replace(/7$/, 'maj7'), nomAccord(N(t), 'm7'), nomAccord(quinteSup(N(t)), 'maj7')], i),
    explication: `${v} est le V de ${tonMaj(t)} (${fr(N(t))} est une quinte en dessous de ${fr(quinteSup(N(t)))}) : il résout sur ${i}. ${ii} – ${v} – ${i} = II-V-I en ${tonMaj(t)}.`,
    notes: null,
  });
  ajouter({
    id: `D3:${t}:tonalite`, dimension: 'D', niveau: 3,
    enonce: `${rep} : quelle tonalité ?`,
    reponse: tonMaj(t),
    pieges: piegesDistincts([tonMaj(cleHaut), tonMaj(cleBas), `${fr(gammeMajeure(N(t))[1])} mineur`, tonMin(t)], tonMaj(t)),
    explication: `Le dernier accord, ${i}, est le I : ${tonMaj(t)}. Vérification : ${v} en est le V (quinte au-dessus), ${ii} le II.`,
    notes: null,
  });
}
function enhCle(n) {
  const e = enharmonique(n);
  return TOUTES.find((x) => nomLettre(N(x)) === nomLettre(e));
}

const iiVi = (t) => [nomDeg(t, 2, true, 'mineur'), nomDeg(t, 5, true, 'mineur'), nomDeg(t, 1, false, 'mineur')].join(SEP);
for (const t of MINEURES) {
  const rep = iiVi(t);
  const [ii, v, i] = rep.split(SEP);
  const gm = gammeMineureNaturelle(N(t));
  ajouter({
    id: `D4:${t}:complet`, dimension: 'D', niveau: 4,
    enonce: `II-V-i en ${tonMin(t)} ?`,
    reponse: rep,
    pieges: piegesDistincts([
      [ii.replace(/m7♭5$/, 'm7'), v, nomAccord(N(t), 'maj7')].join(SEP),
      [ii.replace(/m7♭5$/, 'm7'), v, i].join(SEP),
      [ii, v.replace(/7$/, 'm7'), i].join(SEP),
    ], rep),
    explication: `En ${tonMin(t)} : ii = ${ii} (${listeNotes(notesAccord(gm[1], 'm7b5'))}, quinte diminuée car ${fr(gm[5])} est dans la gamme), V = ${v} (avec ${fr(transposer(N(t), 'M7'))}, la sensible haussée), i = ${i}. Le ø et la sensible font la couleur du II-V mineur.`,
    notes: null,
  });
  ajouter({
    id: `D4:${t}:II`, dimension: 'D', niveau: 4,
    enonce: `Le II du II-V-i en ${tonMin(t)} ?`,
    reponse: ii,
    pieges: piegesDistincts([ii.replace(/m7♭5$/, 'm7'), ii.replace(/m7♭5$/, '°7'), ii.replace(/m7♭5$/, '7')], ii),
    explication: `En mineur, le II est demi-diminué (m7♭5, ou ø) : sa quinte ${fr(gm[5])} est le VIe degré abaissé de la gamme. ${rep}.`,
    notes: null,
  });
  ajouter({
    id: `D4:${t}:resout`, dimension: 'D', niveau: 4,
    enonce: `${ii} – ${v} résout vers ?`,
    reponse: i,
    pieges: piegesDistincts([nomAccord(N(t), 'maj'), nomDeg(t, 4, false, 'mineur'), nomAccord(quinteSup(N(t)), 'min')], i),
    explication: `${v} est le V de ${tonMin(t)} ; le II demi-diminué (${ii}) annonce le mode mineur : résolution sur ${i} (souvent joué ${i}6 ou ${i}(maj7)). C'est la couleur de Blue Bossa et de Black Orpheus.`,
    notes: null,
  });
}

// ---------- E. Intervalles ----------
const INTERVALLES_E1 = ['m3', 'M3', 'P4', 'P5', 'M6', 'm7'];
const INTERVALLES_E2 = ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'm6', 'M6', 'm7', 'M7'];
const AUTRE_QUALITE = { m2: 'M2', M2: 'm2', m3: 'M3', M3: 'm3', P4: 'A4', A4: 'P4', d5: 'P5', P5: 'd5', m6: 'M6', M6: 'm6', m7: 'M7', M7: 'm7', P8: 'M7' };
const VOISIN_INTERVALLE = { m2: 'm3', M2: 'M3', m3: 'M2', M3: 'P4', P4: 'M3', A4: 'P5', d5: 'P4', P5: 'm6', m6: 'P5', M6: 'm7', m7: 'M6', M7: 'P8', P8: 'M7' };
const VIVIER_INTERVALLES = INTERVALLES_E2.map(nomIntervalle);
const nbNoms = (i) => ({ P1: 1, m2: 2, M2: 2, m3: 3, M3: 3, P4: 4, A4: 4, d5: 5, P5: 5, A5: 5, m6: 6, M6: 6, d7: 7, m7: 7, M7: 7, P8: 8 })[i];
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const REPERES = {
  m2: 'les deux notes des « Dents de la mer »', M2: 'le début de « Joyeux anniversaire »', m3: 'le début de « Greensleeves »',
  M3: 'le début de « Oh When the Saints »', P4: '« Al-lons » de La Marseillaise', A4: 'le début du thème des Simpson',
  P5: 'les deux premières notes de Star Wars', m6: 'le début du thème de Love Story', M6: 'le début de « My Bonnie »',
  m7: '« Some-where » de West Side Story', M7: 'le refrain de « Take On Me »', P8: '« Some-where » d’Over the Rainbow',
};

function cartesIntervalle(niv, r, iv, sens) {
  const a = N(r); const b = transposer(a, iv);
  const enonceNomNote = `${majuscule(nomIntervalle(iv))} au-dessus de ${fr(a)} ?`;
  const compte = `on compte ${nbNoms(iv)} noms de notes (${fr(a)} → ${fr(b)})`;
  if (sens === 'note') {
    ajouter({
      id: `E${niv}:${r}:${iv}:note`, dimension: 'E', niveau: niv,
      enonce: enonceNomNote,
      reponse: fr(b),
      pieges: piegesDistincts([fr(transposer(a, AUTRE_QUALITE[iv])), enh(b), fr(transposer(a, VOISIN_INTERVALLE[iv])), fr(transposer(a, 'P5'))], fr(b), VIVIER_NOTES),
      explication: `${majuscule(nomIntervalle(iv))} = ${tons(iv)} (${demiTons(iv)} demi-tons) : ${fr(a)} → ${fr(b)} ; ${compte}. ${majuscule(nomIntervalle(AUTRE_QUALITE[iv]))} : ${fr(transposer(a, AUTRE_QUALITE[iv]))}.`,
      notes: [a, b],
    });
  } else {
    ajouter({
      id: `E${niv}:${r}:${iv}:nom`, dimension: 'E', niveau: niv,
      enonce: `${fr(a)} → ${fr(b)} : quel intervalle ?`,
      reponse: nomIntervalle(iv),
      pieges: piegesDistincts([nomIntervalle(AUTRE_QUALITE[iv]), nomIntervalle(renversement(iv)), nomIntervalle(VOISIN_INTERVALLE[iv])], nomIntervalle(iv), VIVIER_INTERVALLES),
      explication: `${fr(a)} → ${fr(b)} : ${compte}, donc une ${nomIntervalle(iv).split(' ')[0]} ; ${tons(iv)} (${demiTons(iv)} demi-tons), donc ${nomIntervalle(iv).split(' ')[1]}. ${majuscule(nomIntervalle(iv))}.`,
      notes: [a, b],
    });
  }
}
for (const r of ['C', 'G', 'F']) for (const iv of INTERVALLES_E1) { cartesIntervalle(1, r, iv, 'note'); cartesIntervalle(1, r, iv, 'nom'); }
for (const r of TOUTES) for (const iv of INTERVALLES_E2) {
  if (['C', 'G', 'F'].includes(r) && INTERVALLES_E1.includes(iv)) continue;
  cartesIntervalle(2, r, iv, 'note');
  if (['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(r)) cartesIntervalle(2, r, iv, 'nom');
}
for (const iv of ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7']) {
  const rep = nomIntervalle(renversement(iv));
  ajouter({
    id: `E3:renv:${iv}`, dimension: 'E', niveau: 3,
    enonce: `Renversement d'une ${nomIntervalle(iv)} ?`,
    reponse: rep,
    pieges: piegesDistincts([nomIntervalle(AUTRE_QUALITE[renversement(iv)]), nomIntervalle(iv), nomIntervalle(VOISIN_INTERVALLE[renversement(iv)])], rep, VIVIER_INTERVALLES),
    explication: `Renverser = mettre la note du bas à l'octave. Les chiffres s'additionnent à 9 (${nbNoms(iv)} + ${nbNoms(renversement(iv))}) et la qualité s'inverse (majeur ↔ mineur, augmenté ↔ diminué, juste reste juste) : ${nomIntervalle(iv)} → ${rep}.`,
    notes: [N('C'), transposer(N('C'), iv)],
  });
}
for (const r of TOUTES) for (const iv of ['A4', 'd5']) {
  const a = N(r); const b = transposer(a, iv);
  if (Math.abs(b.alt) > 1) continue;
  cartesIntervalle(3, r, iv, 'note');
  ajouter({
    id: `E3:${r}:${iv}:nom`, dimension: 'E', niveau: 3,
    enonce: `${fr(a)} → ${fr(b)} : quel intervalle ?`,
    reponse: nomIntervalle(iv),
    pieges: piegesDistincts([nomIntervalle(renversement(iv)), 'quarte juste', 'quinte juste'], nomIntervalle(iv), VIVIER_INTERVALLES),
    explication: `Même son (3 tons, le triton) mais pas le même nom : ${fr(a)} → ${fr(b)} compte ${nbNoms(iv)} noms de notes, c'est une ${nomIntervalle(iv)} ; ${fr(a)} → ${fr(transposer(a, renversement(iv)))} en compterait ${nbNoms(renversement(iv))} : ${nomIntervalle(renversement(iv))}.`,
    notes: [a, b],
  });
}

// ---------- F. Oreille ----------
const RACINES_F = ['C', 'Eb', 'F', 'G', 'A', 'Bb'];
const INTERVALLES_F1 = ['m3', 'M3', 'P4', 'P5', 'M6', 'm7', 'M7', 'P8'];
function proches(iv, liste) {
  return liste.filter((x) => x !== iv).sort((x, y) => Math.abs(demiTons(x) - demiTons(iv)) - Math.abs(demiTons(y) - demiTons(iv))).slice(0, 3).map(nomIntervalle);
}
for (const r of RACINES_F) for (const iv of INTERVALLES_F1) {
  const a = N(r); const b = transposer(a, iv);
  ajouter({
    id: `F1:${r}:${iv}`, dimension: 'F', niveau: 1,
    enonce: 'Quel intervalle entends-tu ?',
    reponse: nomIntervalle(iv),
    pieges: proches(iv, INTERVALLES_F1),
    explication: `C'était une ${nomIntervalle(iv)} (${tons(iv)}) : ${fr(a)} → ${fr(b)}. Repère : ${REPERES[iv]}.`,
    notes: [a, b],
    audio: { mode: 'melodique', notes: [a, b] },
  });
}
const LIBELLES_F = { maj: 'majeur', min: 'mineur', dim: 'diminué', aug: 'augmenté', maj7: 'maj7', 7: '7 (dominante)', m7: 'm7', m7b5: 'm7♭5 (ø)', dim7: '°7' };
const PIEGES_F = { maj: ['min', 'aug', 'dim'], min: ['maj', 'dim', 'aug'], dim: ['min', 'aug', 'maj'], aug: ['maj', 'min', 'dim'], maj7: ['7', 'm7', 'm7b5'], 7: ['maj7', 'm7', 'm7b5'], m7: ['7', 'm7b5', 'maj7'], m7b5: ['m7', 'dim7', '7'], dim7: ['m7b5', 'm7', '7'] };
const INDICES_F = {
  maj: 'tierce majeure, son ouvert et stable', min: 'tierce mineure, plus sombre', dim: 'quinte diminuée : tendu, instable',
  aug: 'quinte augmentée : flottant, sans repos', maj7: '7e majeure, doux et suspendu', 7: '7e mineure sur tierce majeure : appelle une résolution',
  m7: 'tierce et 7e mineures : rond, mélancolique', m7b5: 'mineur avec quinte diminuée : voilé', dim7: 'empilement de tierces mineures : symétrique, dramatique',
};
for (const r of RACINES_F) {
  for (const [niv, types] of [[2, ['maj', 'min', 'dim', 'aug']], [3, ['maj7', '7', 'm7', 'm7b5', 'dim7']]]) {
    for (const type of types) {
      const fond = N(r); const notes = notesAccord(fond, type);
      ajouter({
        id: `F${niv}:${r}:${type}`, dimension: 'F', niveau: niv,
        enonce: 'Quel accord entends-tu ?',
        reponse: LIBELLES_F[type],
        pieges: PIEGES_F[type].map((t) => LIBELLES_F[t]),
        explication: `C'était ${nomAccord(fond, type)} (${listeNotes(notes)}) : ${INDICES_F[type]}. ${nomAccord(fond, PIEGES_F[type][0])} aurait donné ${listeNotes(notesAccord(fond, PIEGES_F[type][0]))}.`,
        notes,
        audio: { mode: 'accord', notes },
      });
    }
  }
}
const CADENCES = {
  'II-V-I majeur': (t) => [[2, true, 'majeur'], [5, true, 'majeur'], [1, true, 'majeur']],
  'II-V-i mineur': (t) => [[2, true, 'mineur'], [5, true, 'mineur'], [1, false, 'mineur']],
  'I-IV-V-I': (t) => [[1, false, 'majeur'], [4, false, 'majeur'], [5, false, 'majeur'], [1, false, 'majeur']],
  'I-vi-IV-V': (t) => [[1, false, 'majeur'], [6, false, 'majeur'], [4, false, 'majeur'], [5, false, 'majeur']],
};
const INDICES_CADENCE = {
  'II-V-I majeur': 'trois accords de 7e, repos sur un accord majeur lumineux',
  'II-V-i mineur': 'accord demi-diminué au départ, repos sur un accord mineur',
  'I-IV-V-I': 'quatre triades, aller-retour classique vers la tonique',
  'I-vi-IV-V': 'quatre triades, le tour de la chanson pop et du doo-wop, sans retour au I',
};
for (const t of RACINES_F) {
  for (const [nom, degres] of Object.entries(CADENCES)) {
    const accords = degres(t).map(([d, sept, mode]) => accordDegre(N(t), d, { septieme: sept, mode }));
    const noms = accords.map((a) => nomAccord(a.fond, a.type)).join(SEP);
    ajouter({
      id: `F4:${t}:${nom.replace(/\s/g, '_')}`, dimension: 'F', niveau: 4,
      enonce: 'Quelle cadence entends-tu ?',
      reponse: nom,
      pieges: Object.keys(CADENCES).filter((x) => x !== nom),
      explication: `C'était ${nom} en ${nom.includes('mineur') ? tonMin(t) : tonMaj(t)} : ${noms}. ${majuscule(INDICES_CADENCE[nom])}.`,
      notes: notesAccord(accords.at(-1).fond, accords.at(-1).type),
      audio: { mode: 'cadence', accords: accords.map((a) => notesAccord(a.fond, a.type)) },
    });
  }
}

// ---------- G. Rythme ----------
// Listes en ordre stable : l'index sert d'identifiant de carte, on n'insère qu'à la fin.
const CELLULES_4 = [
  ['n n n n', 'la pulsation : une attaque par clic'],
  ['c c c c c c c c', 'croches : deux attaques égales par clic, « 1 et 2 et »'],
  ['n c c n c c', 'noire puis deux croches : la 2e croche tombe sur « et »'],
  ['-c c -c c -c c -c c', 'contretemps : silence sur le clic, attaque sur « et »'],
  ['c n c n n', 'syncope : la noire tombe sur « et » et se tient à travers le temps 2'],
  ['n. c n. c', 'noire pointée + croche : la croche tombe sur le « et » du 2e temps'],
  ['n c d d n c c', 'doubles-croches : « 2 e et a » se divise en quatre'],
  ['n c _c n c c', 'liaison : la croche liée ne se rejoue pas, on tient'],
  ['t t t t t t n n', 'triolet : trois croches égales par temps, « 1 tri o »'],
  ['c c c c c c c c', 'croches swinguées : la 2e croche vient tard, aux 2/3 du temps', { swing: true }],
  ['-n c c -c c n', 'silence sur le 1er temps : on compte « (1) » dans sa tête'],
  ['c. d c. d n n', 'croche pointée + double : le « a » juste avant le temps suivant'],
  ['n -c c n -c c', 'demi-soupir puis croche : attaque sur « et »'],
  ['d d c c c d d c n', 'mélange doubles et croches sur un même temps'],
  ['b n n', 'blanche : deux temps tenus'],
  ['n b n', 'blanche au milieu : le temps 3 est tenu'],
  ['b. n', 'blanche pointée : trois temps'],
  ['n n b', 'blanche finale'],
  ['n. c b', 'noire pointée, croche, blanche'],
  ['c c n b', 'deux croches, noire, blanche'],
  ['r', 'ronde : quatre temps'],
];
const CELLULES_3 = [
  ['n n n', 'trois temps, une attaque par clic'],
  ['n. c n', 'noire pointée + croche à trois temps'],
  ['c c c c c c', 'croches à trois temps'],
  ['b n', 'blanche puis noire'],
  ['n b', 'noire puis blanche'],
  ['b.', 'blanche pointée : toute la mesure'],
  ['c c n n', 'deux croches puis deux noires'],
  ['n -n n', 'soupir au milieu'],
];
const CELLULES_2 = [
  ['n n', 'deux noires'], ['c c n', 'deux croches puis noire'], ['n c c', 'noire puis deux croches'], ['b', 'blanche : toute la mesure'], ['c c c c', 'quatre croches'],
];
const TOUTES_CELLULES = [
  ...CELLULES_4.map(([texte, indice, opts], i) => ({ cle: `c4-${i}`, temps: 4, indice, cell: cellule(texte, { temps: 4, ...(opts || {}) }) })),
  ...CELLULES_3.map(([texte, indice], i) => ({ cle: `c3-${i}`, temps: 3, indice, cell: cellule(texte, { temps: 3 }) })),
  ...CELLULES_2.map(([texte, indice], i) => ({ cle: `c2-${i}`, temps: 2, indice, cell: cellule(texte, { temps: 2 }) })),
];
const etiquetteCellule = (x) => `${x.cell.texte}${x.cell.swing ? ' (swing)' : ''} · ${x.temps}/4`;

// pièges : mêmes temps, même nombre de mesures, de préférence même nombre d'attaques
function cellulesProches(x, n = 3) {
  const autres = TOUTES_CELLULES.filter((y) => y !== x && y.temps === x.temps && y.cell.mesures === x.cell.mesures && compter(y.cell) !== compter(x.cell));
  autres.sort((a, b) => Math.abs(onsets(a.cell).length - onsets(x.cell).length) - Math.abs(onsets(b.cell).length - onsets(x.cell).length));
  const out = []; const vus = new Set([compter(x.cell)]);
  for (const y of autres) { if (!vus.has(compter(y.cell))) { vus.add(compter(y.cell)); out.push(y); } if (out.length === n) break; }
  return out;
}

// G1 a. compter
for (const x of TOUTES_CELLULES) {
  if (x.temps === 2) continue;
  const proches = cellulesProches(x);
  if (proches.length < 3) continue;
  ajouter({
    id: `G1:${x.cle}:compter`, dimension: 'G', niveau: 1,
    enonce: 'Comment compter cette cellule ?',
    svg: notationSvg(x.cell),
    reponse: compter(x.cell),
    pieges: proches.map((y) => compter(y.cell)),
    explication: `${majuscule(x.indice)}. Les temps entre parenthèses ne sont pas attaqués : ${compter(x.cell)}.`,
    svgCorrection: notationSvg(x.cell, { compte: true }),
    notes: null,
  });
}
// G1 b. valeurs
for (const tok of TOKENS) {
  const rep = tempsValeur(tok);
  ajouter({
    id: `G1:valeur:${tok.replace('.', 'p')}`, dimension: 'G', niveau: 1,
    enonce: `Combien de temps dure une ${nomValeur(tok)} (à la noire) ?`,
    reponse: rep,
    pieges: piegesDistincts(TOKENS.filter((t) => t !== tok).map(tempsValeur), rep),
    explication: `${majuscule(nomValeur(tok))} = ${rep}.${tok.endsWith('.') ? ' Le point ajoute la moitié de la valeur.' : ''}${tok === 't' || tok === 'T' ? ' Le triolet met trois notes dans la durée de deux.' : ''}`,
    notes: null,
  });
}
// G1 c. compléter la mesure
for (const x of TOUTES_CELLULES) {
  const ev = x.cell.evenements;
  const dernier = ev.at(-1);
  if (ev.length < 2 || dernier.silence || dernier.lie || dernier.triolet || x.cell.mesures > 1) continue;
  const tronque = { ...x.cell, evenements: ev.slice(0, -1), duree: dernier.pos, texte: x.cell.texte };
  const rep = nomValeur(dernier.token);
  const autres = TOKENS.filter((t) => t !== dernier.token && !['t', 'T'].includes(t)).map(nomValeur);
  ajouter({
    id: `G1:${x.cle}:completer`, dimension: 'G', niveau: 1,
    enonce: `Mesure à ${x.temps} temps : quelle figure manque à la fin ?`,
    svg: notationSvg(tronque),
    reponse: rep,
    pieges: piegesDistincts(autres, rep),
    explication: `Il reste ${tempsValeur(dernier.token)} à remplir : une ${rep}. Cellule complète : ${compter(x.cell)}.`,
    svgCorrection: notationSvg(x.cell, { compte: true }),
    notes: null,
  });
}
// G1 d. quelle mesure ?
for (const x of TOUTES_CELLULES) {
  if (x.cell.mesures > 1 || x.cell.swing) continue;
  const rep = `${x.temps}/4`;
  ajouter({
    id: `G1:${x.cle}:mesure`, dimension: 'G', niveau: 1,
    enonce: 'Combien de temps dans cette mesure ?',
    svg: notationSvg({ ...x.cell, chiffrage: false }),
    reponse: rep,
    pieges: piegesDistincts(['4/4', '3/4', '2/4', '6/8'], rep),
    explication: `On additionne les durées : ${x.cell.duree / 12} temps, donc ${rep}. Cellule : ${compter(x.cell)}.`,
    svgCorrection: notationSvg(x.cell, { compte: true }),
    notes: null,
  });
}
// G2 dictée rythmique : on entend la cellule deux fois sur le clic, on choisit l'écriture
const BPM_DICTEE = 80;
for (const x of TOUTES_CELLULES) {
  if (x.temps === 2 || x.cell.mesures > 1) continue;
  const proches = cellulesProches(x);
  if (proches.length < 3) continue;
  const rep = etiquetteCellule(x);
  const rendus = Object.fromEntries([x, ...proches].map((y) => [etiquetteCellule(y), notationSvg(y.cell)]));
  const o = onsetsMs(x.cell, BPM_DICTEE);
  const mesureMs = Math.round((x.cell.duree * 60000) / BPM_DICTEE / 12);
  ajouter({
    id: `G2:${x.cle}`, dimension: 'G', niveau: 2,
    enonce: 'Quelle cellule entends-tu ?',
    reponse: rep,
    pieges: proches.map(etiquetteCellule),
    rendus,
    explication: `C'était : ${compter(x.cell)}. ${majuscule(x.indice)}.`,
    svgCorrection: notationSvg(x.cell, { compte: true }),
    notes: null,
    audio: { mode: 'rythme', bpm: BPM_DICTEE, temps: x.temps, mesures: 2, onsetsMs: [...o, ...o.map((t) => t + mesureMs)] },
  });
}
// G3 frappe : le clic tourne, on frappe la cellule deux fois
const CONSEILS_FRAPPE = {
  'c4-0': 'Frappe pile sur le clic ; écoute si tu es devant ou derrière.',
  'c4-1': 'Subdivise : dis « 1 et 2 et » et frappe chaque syllabe.',
  'c4-3': 'Les clics sont tes silences : frappe entre deux clics, exactement au milieu.',
  'c4-4': 'La noire syncopée tombe sur « et » et se tient : ne frappe pas sur le clic 2.',
  'c4-8': 'Pense « 1 tri o » à vitesse égale : trois frappes par clic.',
  'c4-9': 'Swing : la 2e croche vient tard, comme la 3e note d’un triolet.',
};
for (const x of TOUTES_CELLULES) {
  if (x.temps === 2 || x.cell.mesures > 1 || ['c4-14', 'c4-15', 'c4-16', 'c4-17', 'c4-18', 'c4-19', 'c4-20', 'c3-3', 'c3-4', 'c3-5'].includes(x.cle)) continue;
  ajouter({
    id: `G3:${x.cle}`, dimension: 'G', niveau: 3,
    enonce: 'Frappe cette cellule deux fois de suite, sur le clic',
    reponse: 'frappe', pieges: [],
    frappe: { bpm: 80, temps: x.temps, mesures: 2, mains: [{ texte: x.cell.texte, swing: x.cell.swing, temps: x.temps }] },
    explication: `${CONSEILS_FRAPPE[x.cle] || majuscule(x.indice) + '.'} Comptage : ${compter(x.cell)}.`,
    svgCorrection: notationSvg(x.cell, { compte: true }),
    notes: null,
  });
}
// G4 patterns du répertoire, deux mains : zone gauche / zone droite
const PATTERNS = [
  { cle: 'bossa', nom: 'Bossa nova (Blue Bossa, Desafinado)', temps: 4, gauche: 'n. c n. c n. c n. c', droite: 'n -c c n -n -c n. n n',
    conseil: 'Main gauche : basse sur 1 et sur le « et » de 2, comme une noire pointée + croche. Main droite : les accords tombent souvent entre les temps ; garde la gauche imperturbable.' },
  { cle: 'swing', nom: 'Swing : walking et Charleston', temps: 4, gauche: 'n n n n', droite: 'n. c -b', swing: true,
    conseil: 'La gauche marche en noires régulières ; la droite pose l’accord sur 1 puis sur le « et » de 2, et se tait.' },
  { cle: 'stride', nom: 'Stride : basse-accord et contretemps', temps: 4, gauche: 'n n n n', droite: '-c c -c c -c c -c c',
    conseil: 'Gauche sur chaque temps, droite entre les temps : c’est le ragtime et le stride, la droite en contretemps.' },
  { cle: '3contre2', nom: 'Trois contre deux', temps: 3, gauche: 'n. n.', droite: 'n n n',
    conseil: 'Deux frappes égales à gauche pendant trois à droite. Repère : « pas-sez-le-thé » ou compte 6 : gauche sur 1 et 4, droite sur 1, 3, 5.' },
  { cle: 'valse', nom: 'Valse : basse puis accompagnement', temps: 3, gauche: 'n n n', droite: '-n c c n',
    conseil: 'Gauche « basse, accord, accord » sur les trois temps ; la droite entre après le premier temps, comme une mélodie de valse.' },
  { cle: 'syncope', nom: 'Gauche en noires, droite syncopée', temps: 4, gauche: 'n n n n', droite: 'c n c n n',
    conseil: 'La gauche tient la pulsation ; la droite anticipe le 2e temps et se tient. Ne laisse pas la gauche suivre la droite.' },
];
for (const p of PATTERNS) {
  const g = cellule(p.gauche, { temps: p.temps, swing: !!p.swing });
  const d = cellule(p.droite, { temps: p.temps, swing: !!p.swing });
  for (const bpm of [72, 96]) {
    ajouter({
      id: `G4:${p.cle}:${bpm}`, dimension: 'G', niveau: 4,
      enonce: `${p.nom} à ${bpm} : main gauche à gauche de l'écran, main droite à droite`,
      reponse: 'frappe', pieges: [],
      frappe: { bpm, temps: p.temps, mesures: 2, mains: [{ nom: 'Main gauche', texte: g.texte, swing: g.swing, temps: p.temps }, { nom: 'Main droite', texte: d.texte, swing: d.swing, temps: p.temps }] },
      explication: `${p.conseil} Gauche : ${compter(g)} · Droite : ${compter(d)}.`,
      svgCorrection: notationSvg(g, { compte: true }) + notationSvg(d, { compte: true }),
      notes: null,
    });
  }
}

// ---------- H. Lecture sur portée ----------
// Réponse en touchant le clavier : on compare la classe de hauteur (l'octave est expliquée, pas exigée).
const NOMS_CLE = { sol: 'clé de sol', fa: 'clé de fa' };
function carteLecture(id, niv, cle, n, octave, { accidentel = null, armure = 0, tonalite = null } = {}) {
  const p = positionPortee(n, octave, cle);
  const nom = `${fr(n)}${octave}`;
  let expl = `${REGLES_LECTURE[cle]} Cette note est sur la ${decrirePosition(p)} : ${nom}.`;
  if (tonalite) expl += n.alt ? ` L'armure de ${tonalite} altère ${fr({ lettre: n.lettre, alt: 0 })} : on joue ${fr(n)}.` : ` L'armure de ${tonalite} ne touche pas cette note.`;
  if (accidentel) expl += ` L'altération accidentelle vaut jusqu'à la fin de la mesure.`;
  ajouter({
    id, dimension: 'H', niveau: niv,
    enonce: `${majuscule(NOMS_CLE[cle])} : quelle note ? Touche-la sur le clavier.`,
    svg: porteeSvg({ cle, notes: [{ note: n, octave, accidentel }], armure }),
    svgCorrection: porteeSvg({ cle, notes: [{ note: n, octave, accidentel }], armure, etiquettes: true }),
    clavierReponse: true,
    reponseClasse: classe(n),
    reponse: nom, pieges: [],
    explication: expl,
    notes: [n],
  });
}
for (let p = -2; p <= 9; p++) { const { lettre, octave } = noteAPosition(p, 'sol'); carteLecture(`H1:sol:${p}`, 1, 'sol', { lettre, alt: 0 }, octave); }
for (let p = -2; p <= 10; p++) { const { lettre, octave } = noteAPosition(p, 'fa'); carteLecture(`H2:fa:${p}`, 2, 'fa', { lettre, alt: 0 }, octave); }
// H3 : armures jusqu'à 3 altérations, et altérations accidentelles
for (const t of ['G', 'D', 'A', 'F', 'Bb', 'Eb']) {
  const arm = armure(N(t));
  const alterees = arm.alterations;
  for (const cle of ['sol', 'fa']) {
    const [pMin, pMax] = cle === 'sol' ? [-1, 9] : [0, 9];
    let k = 0;
    for (let p = pMin; p <= pMax && k < 3; p++) {
      const { lettre, octave } = noteAPosition(p, cle);
      const a = alterees.find((x) => x.lettre === lettre);
      // deux notes altérées par l'armure, une note non altérée
      if ((a && k < 2) || (!a && k === 2)) {
        carteLecture(`H3:${t}:${cle}:${p}`, 3, cle, { lettre, alt: a ? a.alt : 0 }, octave, { armure: arm.nombre, tonalite: tonMaj(t) });
        k++;
      }
    }
  }
}
for (const [cle, p, alt] of [['sol', 1, 1], ['sol', 3, -1], ['sol', 6, 1], ['sol', 4, -1], ['sol', 0, -1], ['sol', 8, 1], ['fa', 2, 1], ['fa', 5, -1], ['fa', 7, 1], ['fa', 3, -1], ['fa', 6, 1], ['fa', 1, -1]]) {
  const { lettre, octave } = noteAPosition(p, cle);
  carteLecture(`H3:acc:${cle}:${p}${alt > 0 ? 's' : 'b'}`, 3, cle, { lettre, alt }, octave, { accidentel: alt > 0 ? '#' : 'b' });
}
// H4 : lignes supplémentaires éloignées, et intervalles lus sur la portée
for (const [cle, p] of [['sol', 10], ['sol', 11], ['sol', 12], ['sol', -3], ['sol', -4], ['fa', 11], ['fa', 12], ['fa', -3], ['fa', -4], ['fa', 13]]) {
  const { lettre, octave } = noteAPosition(p, cle);
  carteLecture(`H4:${cle}:${p}`, 4, cle, { lettre, alt: 0 }, octave);
}
const INTERVALLES_H4 = ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
for (const cle of ['sol', 'fa']) {
  const bases = cle === 'sol' ? [['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4], ['A', 4]] : [['G', 2], ['A', 2], ['B', 2], ['C', 3], ['D', 3], ['E', 3]];
  INTERVALLES_H4.forEach((iv, k) => {
    const [l, o] = bases[k % bases.length];
    const a = { lettre: l, alt: 0 }; const b = transposer(a, iv);
    if (b.alt !== 0) return;
    const oB = o + (LETTRES_PORTEE.indexOf(b.lettre) < LETTRES_PORTEE.indexOf(a.lettre) || iv === 'P8' ? 1 : 0);
    const rep = nomIntervalle(iv);
    ajouter({
      id: `H4:int:${cle}:${iv}`, dimension: 'H', niveau: 4,
      enonce: `${majuscule(NOMS_CLE[cle])} : quel intervalle entre ces deux notes ?`,
      svg: porteeSvg({ cle, notes: [{ note: a, octave: o }, { note: b, octave: oB }] }),
      svgCorrection: porteeSvg({ cle, notes: [{ note: a, octave: o }, { note: b, octave: oB }], etiquettes: true }),
      reponse: rep,
      pieges: proches(iv, INTERVALLES_H4),
      explication: `${fr(a)}${o} → ${fr(b)}${oB} : on compte ${nbNoms(iv)} noms de notes, ${tons(iv)} : ${rep}. Sur la portée, ${nbNoms(iv) % 2 ? 'ligne à ligne ou interligne à interligne' : 'ligne à interligne'}.`,
      notes: [a, b],
    });
  });
}

// ---------- I. Chant ----------
// La référence est jouée à l'octave 3 (voix d'homme) ; l'évaluation ignore l'octave.
const MIDI_C3 = 48;
const midiDe = (n, octave = 3) => MIDI_C3 + (octave - 3) * 12 + classe(n);
for (const r of TOUTES) {
  const n = N(r); const m = midiDe(n);
  ajouter({
    id: `I1:${r}`, dimension: 'I', niveau: 1,
    enonce: 'Écoute la note, puis chante-la (sur « la »)',
    reponse: 'chant', pieges: [],
    audio: { mode: 'midis', midis: [m], dureeMs: 1500 },
    chant: { cibles: [m], noms: [fr(n)] },
    explication: `La note était ${fr(n)}. Écoute-la intérieurement avant de chanter : l'oreille guide la voix, pas l'inverse.`,
    notes: [n],
  });
}
const INTERVALLES_I2 = ['M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'];
for (const r of ['C', 'D', 'E', 'F', 'G']) for (const iv of INTERVALLES_I2) {
  const a = N(r); const b = transposer(a, iv); const m = midiDe(a);
  ajouter({
    id: `I2:${r}:${iv}`, dimension: 'I', niveau: 2,
    enonce: `Écoute la note, puis chante la ${nomIntervalle(iv)} au-dessus`,
    reponse: 'chant', pieges: [],
    audio: { mode: 'midis', midis: [m], dureeMs: 1500 },
    chant: { cibles: [m + demiTons(iv)], noms: [fr(b)] },
    explication: `${majuscule(nomIntervalle(iv))} au-dessus de ${fr(a)} : ${fr(b)}. Repère : ${REPERES[iv]}.`,
    notes: [a, b],
  });
}
const CIBLES_I3 = [['fondamentale', 0], ['tierce', 1], ['quinte', 2]];
for (const r of ['C', 'D', 'Eb', 'F', 'G', 'A']) for (const type of ['maj', 'min']) for (const [nomCible, idx] of CIBLES_I3) {
  const fond = N(r); const notes = notesAccord(fond, type);
  const midis = notes.map((x, i) => midiDe(fond) + demiTons(TYPES_ACCORD[type].intervalles[i]));
  ajouter({
    id: `I3:${r}:${type}:${nomCible}`, dimension: 'I', niveau: 3,
    enonce: `Écoute l'accord, puis chante sa ${nomCible}`,
    reponse: 'chant', pieges: [],
    audio: { mode: 'accordMidis', midis, dureeMs: 1800 },
    chant: { cibles: [midis[idx]], noms: [fr(notes[idx])] },
    explication: `${nomAccord(fond, type)} = ${listeNotes(notes)} : la ${nomCible} est ${fr(notes[idx])}. ${idx === 1 ? 'La tierce est la note qui dit majeur ou mineur.' : idx === 2 ? 'La quinte est la plus stable après la fondamentale.' : 'La fondamentale est la note la plus grave de l’accord en position fondamentale.'}`,
    notes,
  });
}
const MELODIES_I4 = [[0, 2, 4], [0, 4, 7], [0, 2, 0], [0, -1, 0], [0, 5, 4], [0, 7, 5], [0, 4, 2], [0, -2, -4], [0, 3, 7], [0, 7, 12], [0, 5, 2], [0, 9, 7]];
MELODIES_I4.forEach((pas, i) => {
  const racine = MIDI_C3 + [0, 2, 4, 5, 7][i % 5];
  const midis = pas.map((s) => racine + s);
  const noms = midis.map((m) => fr(N(TOUTES[((m - MIDI_C3) % 12 + 12) % 12])));
  ajouter({
    id: `I4:${i}`, dimension: 'I', niveau: 4,
    enonce: 'Écoute les trois notes, puis chante-les l’une après l’autre',
    reponse: 'chant', pieges: [],
    audio: { mode: 'midis', midis, dureeMs: 800 },
    chant: { cibles: midis, noms },
    explication: `La mélodie était ${noms.join(' – ')}. Chante-la d'abord dans ta tête, puis à voix haute, une note par temps.`,
    notes: midis.map((m) => N(TOUTES[((m - MIDI_C3) % 12 + 12) % 12])),
  });
});

// ---------- API ----------
const index = new Map(cartes.map((c) => [c.id, c]));
export function catalogue() { return cartes; }
export function carte(id) { return index.get(id); }
export function cartesDuNiveau(dim, niv) { return cartes.filter((c) => c.dimension === dim && c.niveau === niv); }
export function melangerChoix(c, alea = Math.random) {
  const choix = [c.reponse, ...c.pieges];
  for (let i = choix.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [choix[i], choix[j]] = [choix[j], choix[i]];
  }
  return choix;
}

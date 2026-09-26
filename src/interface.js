// Écrans et interactions. Seul module qui touche le DOM.

import { DIMENSIONS, carte, melangerChoix } from './questions.js';
import {
  REGLES, seuils, delaiBoite, normaliser, composerSeance, enregistrerReponse, cloreSeance, bilan, cartesDues,
  FileSeance, mediane, lireSauvegarde,
} from './progression.js';
import { creerStockage } from './stockage.js';
import { clavierSvg } from './clavier.js';
import { creerLecteur, sequenceAudio, sequencePercussions, equiperPercussions } from './audio.js';
import { cellule, onsetsMs, notationSvg, evaluerFrappe, commentaireFrappe, frappeSvg, U } from './rythme.js';
import { creerMicro, evaluerChant, commentaireChant, midiDeFrequence } from './voix.js';
import { nomFr } from './theorie.js';
import { genererPiece, notesAttendues, sequencePiece, dureePieceMs } from './piece.js';
import { partitionSvg, geometriePartition, curseurA } from './partition.js';
import { creerEcoute, detecterAttaques, aligner, REGLES_ECOUTE } from './ecoute.js';
import { enregistrerPiece, etatDeblocageDechiffrage } from './dechiffrage.js';

const $ = (id) => document.getElementById(id);
const ECRANS = ['accueil', 'seance', 'bilan', 'progression', 'dechiffrage', 'test-micro'];

let etat = null;
let stockage = null;
let seance = null;
let lecteur = null; // créé au premier geste de l'utilisateur (règle des navigateurs pour le son)
let micro = null;   // ouvert à la première carte de chant (demande d'autorisation)
// Dans la page claude.ai, l'app tourne dans un cadre qui n'a pas le droit d'ouvrir le micro :
// le chant est alors mis de côté (ni séance, ni cartes dues) plutôt que de bloquer la séance sur une erreur.
const politique = document.permissionsPolicy || document.featurePolicy;
const MICRO_PERMIS = politique?.allowsFeature ? politique.allowsFeature('microphone') : globalThis.top === globalThis.self;
const NOMS_MAIN = { droite: 'Main droite', gauche: 'Main gauche' };
const NOMS_CLASSE = ['do', 'do♯', 'ré', 'mi♭', 'mi', 'fa', 'fa♯', 'sol', 'la♭', 'la', 'si♭', 'si'];
let dech = null;       // pièce de déchiffrage en cours
let ecoute = null;     // micro du déchiffrage, ouvert à la première pièce jouée
let testMicro = null;  // minuteur de l'écran « Test du micro »
let verrouEcran = null;
// Téléphone posé sur le piano : garder l'écran allumé tant que Déchiffrage (ou Test du micro) est ouvert.
async function garderEcranAllume() {
  try { if (navigator.wakeLock && !verrouEcran) { verrouEcran = await navigator.wakeLock.request('screen'); verrouEcran.addEventListener('release', () => { verrouEcran = null; }); } } catch { /* refusé : tant pis */ }
}
function libererEcran() { if (verrouEcran) { verrouEcran.release().catch(() => {}); verrouEcran = null; } }
const nomMidi = (m) => `${NOMS_CLASSE[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

function montrer(nom) {
  for (const e of ECRANS) $(`ecran-${e}`).hidden = e !== nom;
  window.scrollTo(0, 0);
}
function secondes(ms) { return `${(ms / 1000).toFixed(1).replace('.', ',')} s`; }
// Les niveaux de frappe mesurent un écart en ms, les autres un temps de réponse en s.
function duree(ms, cible, dim = null) { return cible < 1000 ? `${Math.round(ms)} ${dim === 'I' ? 'cents' : 'ms'}` : secondes(ms); }
function pourcent(a, b) { return b ? Math.round((100 * a) / b) : 0; }
function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined) e.setAttribute(k, v);
  }
  for (const c of enfants) e.append(c);
  return e;
}
function sauver() { stockage.sauver(etat).catch(() => {}); }

// Un critère de déblocage, formulé pour l'élève : où il en est, ce qui est visé.
function texteCritere(c) {
  if (c.cle === 'reponses') return `${c.valeur} / ${c.cible} réponses`;
  if (c.cle === 'taux') {
    const v = c.valeur === null ? '–' : `${Math.round(100 * c.valeur)} %`;
    return `${v} de justes (≥ ${Math.round(100 * c.cible)} %)`;
  }
  const v = c.valeur === null ? '–' : duree(c.valeur, c.cible, c.dim);
  return `${c.cible < 1000 ? 'écart médian' : 'médiane'} ${v} (≤ ${duree(c.cible, c.cible, c.dim)})`;
}

// « demain », « dans 3 jours »… pour dire quand une carte revient.
function quandRevient(jours) {
  if (jours === 0) return 'revue dans cette séance';
  if (jours === 1) return 'revue demain';
  return `revue dans ${jours} jours`;
}

// Avancement gradué d'un niveau : chaque carte compte pour sa boîte, sur 3.
// Contrairement à « acquises », ça bouge dès la première bonne réponse.
function consolidation(n) { return pourcent(n.consolide, n.consolideMax); }

// Version courte, pour la ligne d'accueil : ce qui bloque, en quelques mots.
function texteVerrou(c) {
  if (c.cle === 'reponses') return `encore ${c.cible - c.valeur} réponse${c.cible - c.valeur > 1 ? 's' : ''}`;
  if (c.cle === 'taux') return `${Math.round(100 * c.valeur)} % de justes, il en faut ${Math.round(100 * c.cible)} %`;
  if (c.cible < 1000) return `plus précis : ${duree(c.valeur, c.cible, c.dim)} d'écart médian, il faut ${duree(c.cible, c.cible, c.dim)}`;
  return `plus vite : ${secondes(c.valeur)} de médiane, il faut ${secondes(c.cible)}`;
}

// ---------- Accueil ----------
function rendreAccueil() {
  const silence = !!etat.prefs.silence;
  $('opt-silence').checked = silence;
  const dues = cartesDues(etat, Date.now(), { sansAudio: silence, sansChant: !MICRO_PERMIS });
  $('accueil-dues').textContent = dues
    ? `${dues} carte${dues > 1 ? 's' : ''} à revoir aujourd'hui, puis des nouveautés.`
    : 'Rien à revoir : la séance apporte des nouveautés.';
  const b = bilan(etat);
  const conteneur = $('accueil-dimensions');
  conteneur.replaceChildren();
  for (const [dim, d] of Object.entries(b.dimensions)) {
    const ouverts = d.niveaux.filter((n) => n.etat !== 'verrouille');
    const consolide = ouverts.reduce((s, n) => s + n.consolide, 0);
    const max = ouverts.reduce((s, n) => s + n.consolideMax, 0);
    const vues = ouverts.reduce((s, n) => s + n.vues, 0);
    const total = ouverts.reduce((s, n) => s + n.total, 0);
    const p = pourcent(consolide, max);
    // Sur l'accueil, une seule ligne : le premier verrou qui reste. Le détail est dans « Progression ».
    if (d.deblocage) for (const c of d.deblocage.criteres) c.dim = d.deblocage.dim;
    const verrou = d.deblocage && d.deblocage.criteres.find((c) => !c.fait);
    const manque = verrou ? `Niv. ${d.deblocage.suivant} : ${texteVerrou(verrou)}`
      : d.deblocage ? `Niv. ${d.deblocage.suivant} prêt à s'ouvrir` : 'Tous les niveaux ouverts';
    const sansMicro = dim === 'I' && !MICRO_PERMIS;
    const muet = sansMicro || (silence && (dim === 'F' || dim === 'I'));
    conteneur.append(el('button', { class: `dim${muet ? ' inactif' : ''}`, type: 'button', disabled: muet ? '' : undefined, onclick: () => demarrerSeance({ dimension: dim }) },
      el('span', { class: 'nom' }, d.nom),
      el('span', { class: 'niveau' }, `niv. ${d.niveauOuvert}`),
      el('span', { class: 'barre' }, el('i', { style: `width:${p}%` })),
      el('span', { class: 'detail' }, `${vues}/${total} cartes vues · ${p} % consolidé`),
      el('span', { class: 'detail manque' }, sansMicro ? 'Micro indisponible dans la page claude.ai : chant mis de côté' : muet ? 'Mise de côté en mode silencieux' : manque)));
  }
  // Déchiffrage : pas de cartes, sa propre carte d'accueil
  // Déchiffrage : la carte montre la main choisie en dernier ; l'autre main en une ligne.
  const dd = etat.dechiffrage;
  const main = dd.main;
  const autre = main === 'droite' ? 'gauche' : 'droite';
  const bloque = etatDeblocageDechiffrage(etat, main);
  const muetJ = !MICRO_PERMIS || silence;
  const nbPieces = dd.historique.filter((h) => (h.main ?? 'droite') === main).length;
  conteneur.append(el('button', { class: `dim${muetJ ? ' inactif' : ''}`, type: 'button', disabled: muetJ ? '' : undefined, onclick: ouvrirDechiffrage },
    el('span', { class: 'nom' }, `Déchiffrage · ${NOMS_MAIN[main]}`),
    el('span', { class: 'niveau' }, `niv. ${dd[main].niveau}`),
    el('span', { class: 'barre' }, el('i', { style: `width:${bloque ? pourcent(bloque.reussites, bloque.cible) : 100}%` })),
    el('span', { class: 'detail' }, `${nbPieces} pièce${nbPieces > 1 ? 's' : ''} jouée${nbPieces > 1 ? 's' : ''} · ${dd[main].bpm[dd[main].niveau]} à la noire · ${NOMS_MAIN[autre]} : niv. ${dd[autre].niveau}`),
    el('span', { class: 'detail manque' }, !MICRO_PERMIS ? 'Micro indisponible ici : déchiffrage mis de côté'
      : silence ? 'Mise de côté en mode silencieux'
        : bloque ? `Niv. ${bloque.suivant} : ${bloque.reussites}/${bloque.cible} réussites sur les ${bloque.fenetre} dernières pièces` : 'Tous les niveaux ouverts')));
  const notes = { artefact: 'Progression enregistrée en ligne.', local: 'Progression enregistrée dans ce navigateur.', memoire: 'Stockage indisponible : la progression ne sera pas conservée.' };
  $('note-stockage').textContent = notes[stockage.mode];
  montrer('accueil');
}

// ---------- Séance ----------
function demarrerSeance(options = {}) {
  options = { ...options, sansAudio: !!etat.prefs.silence, sansChant: !MICRO_PERMIS };
  const ids = composerSeance(etat, Date.now(), options);
  if (!ids.length) { rendreAccueil(); return; }
  seance = { file: new FileSeance(ids), options, n: 0, ok: 0, temps: [], montees: 0, debloques: [], carteId: null, t0: 0, pauseDepuis: null, suivanteEnAttente: false };
  $('voile-pause').hidden = true;
  montrer('seance');
  prochaineQuestion();
}

function prochaineQuestion() {
  const id = seance.file.suivante();
  if (!id) { finSeance(); return; }
  const c = carte(id);
  seance.carteId = id;
  $('seance-compteur').textContent = `${seance.n + 1} / ${seance.file.total()}`;
  $('seance-barre').style.width = `${pourcent(seance.n, seance.file.total())}%`;
  const enonce = $('seance-enonce');
  enonce.replaceChildren(el('span', {}, c.enonce));
  if (c.svg) enonce.append(el('div', { class: 'notation-boite', html: c.svg }));
  if (c.audio) {
    enonce.append(el('button', { class: 'btn btn-ecouter', type: 'button', id: 'btn-ecouter', onclick: () => ecouter(c) }, '▶ Écouter'));
    if (lecteur) setTimeout(() => ecouter(c), 150);
  }
  $('seance-correction').hidden = true;
  $('btn-continuer').hidden = true;
  seance.ecoute = false;
  seance.t0 = performance.now();
  if (c.frappe) { preparerFrappe(c); return; }
  if (c.chant) { preparerChant(c); return; }
  if (c.clavierReponse) { preparerClavier(c); return; }
  const choix = melangerChoix(c);
  const zone = $('seance-choix');
  zone.replaceChildren();
  zone.className = `choix${!c.rendus && choix.every((t) => t.length <= 10) ? ' deux' : ''}${c.rendus ? ' images' : ''}`;
  for (const t of choix) {
    const b = el('button', { class: 'btn', type: 'button', 'data-choix': t, onclick: (ev) => repondre(t, ev.currentTarget) });
    if (c.rendus) b.innerHTML = c.rendus[t]; else b.textContent = t;
    zone.append(b);
  }
}

// ---------- Frappe (rythme, niveaux 3-4) ----------
function cellulesFrappe(c) {
  return c.frappe.mains.map((m) => {
    const cell = cellule(m.texte, { temps: m.temps, swing: !!m.swing });
    const o = onsetsMs(cell, c.frappe.bpm);
    const mesureMs = (cell.duree * 60000) / c.frappe.bpm / 12;
    const attendus = [];
    for (let r = 0; r < c.frappe.mesures / cell.mesures; r++) attendus.push(...o.map((t) => Math.round(t + r * mesureMs)));
    return { nom: m.nom || null, cell, attendus };
  });
}
function preparerFrappe(c) {
  annulerFrappe();
  const mains = cellulesFrappe(c);
  const enonce = $('seance-enonce');
  for (const m of mains) {
    enonce.append(el('div', { class: 'notation-boite' }, ...(m.nom ? [el('span', { class: 'eyebrow' }, m.nom)] : []), el('div', { html: notationSvg(m.cell) })));
  }
  const zone = $('seance-choix');
  zone.className = 'choix';
  zone.replaceChildren(
    el('p', { class: 'sous centre', id: 'frappe-etat' }, `${c.frappe.bpm} à la noire · une mesure de décompte, puis ${c.frappe.mesures} mesures à frapper`),
    el('button', { class: 'btn btn-principal', type: 'button', onclick: () => lancerFrappe(c, mains) }, '▶ Démarrer'),
  );
}
function lancerFrappe(c, mains) {
  lecteur ||= creerLecteur();
  if (!lecteur) { $('frappe-etat').textContent = 'Son indisponible sur cet appareil : cette carte a besoin du métronome.'; return; }
  if (!lecteur.jouerPercussions) equiperPercussions(lecteur);
  const { bpm, temps, mesures } = c.frappe;
  const seq = sequencePercussions({ bpm, temps, mesures, decompte: 1 });
  const origine = lecteur.jouerPercussions(seq.evenements) + seq.origineMs;
  const taps = mains.map(() => []);
  const zone = $('seance-choix');
  zone.className = `choix pads${mains.length > 1 ? ' deux' : ''}`;
  const etatEl = el('p', { class: 'sous centre', id: 'frappe-etat' }, 'Décompte…');
  zone.replaceChildren(etatEl);
  mains.forEach((m, i) => {
    const pad = el('button', { class: 'pad', type: 'button' }, m.nom || 'Frappe ici');
    pad.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      taps[i].push(Math.round(performance.now() - origine));
      pad.classList.add('touche'); setTimeout(() => pad.classList.remove('touche'), 90);
    });
    zone.append(pad);
  });
  const battement = 60000 / bpm;
  const minuteurs = [];
  for (let t = 0; t < temps; t++) minuteurs.push(setTimeout(() => { etatEl.textContent = `Décompte : ${t + 1}`; }, seq.origineMs - (temps - t) * battement));
  minuteurs.push(setTimeout(() => { etatEl.textContent = 'Frappe !'; }, seq.origineMs));
  minuteurs.push(setTimeout(() => terminerFrappe(c, mains, taps), seq.dureeMs + 300));
  seance.frappe = { minuteurs, c, mains };
}
function annulerFrappe() {
  if (!seance?.frappe) return;
  for (const t of seance.frappe.minuteurs) clearTimeout(t);
  if (lecteur?.arreterPercussions) lecteur.arreterPercussions();
  seance.frappe = null;
}
function terminerFrappe(c, mains, taps) {
  seance.frappe = null;
  const resultats = mains.map((m, i) => evaluerFrappe(m.attendus, taps[i]));
  const juste = resultats.every((r) => r.juste);
  const ms = Math.max(...resultats.map((r) => r.ecartMoyen ?? 999));
  const r = enregistrer(c, juste, ms);
  const zone = $('seance-correction');
  zone.replaceChildren();
  zone.className = `correction ${juste ? 'juste' : 'faux'}`;
  zone.hidden = false;
  const { rapideMs } = seuils(c.dimension, c.niveau);
  const rapide = ms <= rapideMs;
  zone.append(el('div', { class: 'verdict' },
    el('span', {}, juste ? (rapide ? 'Juste !' : `Juste, mais pas assez précis pour monter (visez ≤ ${rapideMs} ms)`) : 'Pas encore'),
    el('span', {}, `${ms} ms`)));
  mains.forEach((m, i) => {
    const longueur = (c.frappe.mesures * m.cell.temps * 60000) / c.frappe.bpm;
    zone.append(el('p', { class: 'explication' }, `${m.nom ? m.nom + ' : ' : ''}${commentaireFrappe(resultats[i])}`), el('div', { html: frappeSvg(resultats[i], longueur, taps[i]) }));
  });
  $('seance-choix').replaceChildren();
  if (juste) {
    zone.append(el('p', { class: 'explication' }, c.explication),
      el('p', { class: 'boite-info' },
        rapide ? `Boîte ${r.boiteAvant} → ${r.boiteApres} sur ${REGLES.boiteMax} · ${quandRevient(delaiBoite(r.boiteApres))}`
          : `Carte maintenue en boîte ${r.boiteApres} · ${quandRevient(delaiBoite(r.boiteApres))}`));
    $('btn-continuer').hidden = false;
  } else {
    seance.file.reinserer(c.id);
    zone.append(el('p', { class: 'explication' }, c.explication), el('div', { html: c.svgCorrection }),
      el('p', { class: 'boite-info' }, 'Carte remise en boîte 0 · elle revient dans cette séance'),
      el('button', { class: 'btn btn-second', type: 'button', onclick: () => { zone.hidden = true; $('btn-continuer').hidden = true; $('seance-enonce').replaceChildren(el('span', {}, c.enonce)); preparerFrappe(c); } }, '↻ Réessayer (sans compter)'));
    $('btn-continuer').hidden = false;
  }
}

// ---------- Chant : référence jouée, puis micro ----------
function preparerChant(c) {
  const zone = $('seance-choix');
  zone.className = 'choix';
  zone.replaceChildren(
    el('p', { class: 'sous centre', id: 'chant-etat' }, c.chant.cibles.length > 1 ? 'Écoute, puis chante les trois notes, une par temps.' : 'Écoute, puis chante la note demandée et tiens-la deux secondes.'),
    el('button', { class: 'btn btn-principal', type: 'button', onclick: () => lancerChant(c) }, '🎤 Chanter'),
  );
}
async function lancerChant(c) {
  micro ||= creerMicro();
  if (!micro) { $('chant-etat').textContent = 'Micro indisponible sur cet appareil.'; return; }
  if (lecteur) { lecteur.arreter(); }
  const zone = $('seance-choix');
  zone.className = 'choix';
  const etatEl = el('p', { class: 'sous centre', id: 'chant-etat' }, 'Micro…');
  const jauge = el('div', { class: 'jauge' }, el('i', {}));
  const note = el('div', { class: 'note-chantee' }, '–');
  zone.replaceChildren(etatEl, note, jauge);
  const jeton = (seance.chantJeton = (seance.chantJeton || 0) + 1);
  const resultats = [];
  try {
    for (let i = 0; i < c.chant.cibles.length; i++) {
      const cible = c.chant.cibles[i];
      etatEl.textContent = c.chant.cibles.length > 1 ? `Note ${i + 1} sur ${c.chant.cibles.length} : chante !` : 'Chante !';
      const frames = await micro.ecouter(c.chant.cibles.length > 1 ? 1700 : 2400, (m, avancement) => {
        jauge.firstChild.style.width = `${Math.round(avancement * 100)}%`;
        if (m === null) { note.textContent = '…'; return; }
        let e = ((m - cible) % 12 + 12) % 12; if (e > 6) e -= 12;
        const cents = Math.round(e * 100);
        note.textContent = `${NOMS_CLASSE[((Math.round(m) % 12) + 12) % 12]} ${cents > 0 ? '+' : ''}${cents}`;
        note.className = `note-chantee ${Math.abs(cents) <= 35 ? 'bonne' : Math.abs(cents) <= 50 ? 'moyenne' : 'loin'}`;
      });
      if (seance.chantJeton !== jeton || seance.pauseDepuis !== null) return; // annulé (pause, arrêt)
      resultats.push(evaluerChant(frames, cible));
    }
  } catch (e) {
    // Dans la page claude.ai, l'app tourne dans un cadre qui n'a pas le droit d'ouvrir le micro : ce n'est pas un réglage du téléphone.
    const dansCadre = globalThis.top !== globalThis.self;
    etatEl.textContent = dansCadre
      ? 'Ici, dans la page claude.ai, le micro n’est pas accessible : la page qui affiche l’app ne l’autorise pas. Le chant est mis de côté ici.'
      : 'Le micro a été refusé. Autorise-le pour ce site dans le navigateur, ou active le mode silencieux.';
    zone.append(el('button', { class: 'btn btn-second', type: 'button', onclick: () => preparerChant(c) }, 'Réessayer'));
    return;
  }
  terminerChant(c, resultats);
}
function terminerChant(c, resultats) {
  const juste = resultats.every((r) => r.juste);
  const ecarts = resultats.map((r) => (r.cents === null ? 200 : Math.abs(r.cents)));
  const ms = Math.round(ecarts.reduce((s, x) => s + x, 0) / ecarts.length);
  const r = enregistrer(c, juste, ms);
  const zone = $('seance-correction');
  zone.replaceChildren();
  zone.className = `correction ${juste ? 'juste' : 'faux'}`;
  zone.hidden = false;
  const { rapideMs } = seuils(c.dimension, c.niveau);
  const rapide = ms <= rapideMs;
  zone.append(el('div', { class: 'verdict' },
    el('span', {}, juste ? (rapide ? 'Juste !' : `Juste, mais pas assez centré pour monter (visez ≤ ${rapideMs} cents)`) : 'Pas encore'),
    el('span', {}, `${ms} cents`)));
  resultats.forEach((res, i) => {
    const nomChante = res.chante === null ? null : NOMS_CLASSE[((Math.round(res.chante) % 12) + 12) % 12];
    zone.append(el('p', { class: 'explication' }, `${resultats.length > 1 ? `Note ${i + 1} : ` : ''}${commentaireChant(res, c.chant.noms[i], nomChante)}`));
  });
  zone.append(el('p', { class: 'explication' }, c.explication));
  if (c.notes) zone.append(el('div', { html: clavierSvg(c.notes) }));
  zone.append(el('button', { class: 'btn btn-second', type: 'button', onclick: () => ecouter(c) }, '▶ Réécouter la référence'));
  $('seance-choix').replaceChildren();
  if (juste) {
    zone.append(el('p', { class: 'boite-info' },
      rapide ? `Boîte ${r.boiteAvant} → ${r.boiteApres} sur ${REGLES.boiteMax} · ${quandRevient(delaiBoite(r.boiteApres))}`
        : `Carte maintenue en boîte ${r.boiteApres} · ${quandRevient(delaiBoite(r.boiteApres))}`));
  } else {
    seance.file.reinserer(c.id);
    zone.append(el('p', { class: 'boite-info' }, 'Carte remise en boîte 0 · elle revient dans cette séance'),
      el('button', { class: 'btn btn-second', type: 'button', onclick: () => { zone.hidden = true; $('btn-continuer').hidden = true; preparerChant(c); } }, '↻ Réessayer (sans compter)'));
  }
  $('btn-continuer').hidden = false;
}

// Enregistre une réponse dans la progression et les compteurs de séance.
function enregistrer(c, juste, ms) {
  const r = enregistrerReponse(etat, c.id, juste, ms, Date.now());
  seance.n += 1;
  if (juste) seance.ok += 1;
  seance.temps.push(ms);
  if (r.boiteApres > r.boiteAvant) seance.montees += 1;
  if (r.debloque) seance.debloques.push(r.debloque);
  sauver();
  return r;
}

function ecouter(c) {
  lecteur ||= creerLecteur();
  if (!lecteur) { $('btn-ecouter').textContent = 'Son indisponible'; return; }
  let duree;
  if (c.audio.mode === 'rythme') {
    if (!lecteur.jouerPercussions) equiperPercussions(lecteur);
    const seq = sequencePercussions({ bpm: c.audio.bpm, temps: c.audio.temps, mesures: c.audio.mesures, onsetsMs: c.audio.onsetsMs, decompte: 1 });
    lecteur.jouerPercussions(seq.evenements);
    duree = seq.dureeMs;
  } else duree = lecteur.jouer(sequenceAudio(c.audio));
  // le chrono ne démarre qu'à la fin de l'écoute (première écoute seulement)
  if (!seance.ecoute) { seance.t0 = performance.now() + duree; seance.ecoute = true; }
}

function repondre(texte, bouton) {
  const ms = Math.max(0, Math.round(performance.now() - seance.t0));
  const c = carte(seance.carteId);
  const juste = texte === c.reponse;
  for (const b of $('seance-choix').querySelectorAll('button')) {
    b.disabled = true;
    if (b.dataset.choix === c.reponse) b.classList.add('juste');
  }
  if (!juste) bouton.classList.add('faux');
  afficherCorrection(c, juste, ms, enregistrer(c, juste, ms));
}

// ---------- Lecture : réponse en touchant le clavier ----------
function preparerClavier(c) {
  const zone = $('seance-choix');
  zone.className = 'choix';
  zone.replaceChildren(el('div', { class: 'clavier-reponse', html: clavierSvg([], { interactif: true }) }));
  for (const touche of zone.querySelectorAll('.touche')) {
    touche.addEventListener('pointerdown', (ev) => { ev.preventDefault(); repondreClavier(Number(touche.dataset.classe)); }, { once: false });
  }
}
function repondreClavier(classe) {
  const c = carte(seance.carteId);
  if (!c.clavierReponse || $('seance-correction').hidden === false) return;
  const ms = Math.max(0, Math.round(performance.now() - seance.t0));
  const juste = classe === c.reponseClasse;
  const zone = $('seance-choix');
  for (const t of zone.querySelectorAll(`.touche[data-classe="${c.reponseClasse}"]`)) t.classList.add('juste');
  if (!juste) for (const t of zone.querySelectorAll(`.touche[data-classe="${classe}"]`)) t.classList.add('faux');
  zone.querySelector('.clavier')?.classList.remove('cliquable');
  const texteChoisi = NOMS_CLASSE[classe];
  afficherCorrection(c, juste, ms, enregistrer(c, juste, ms), { reponseDonnee: texteChoisi });
}

function afficherCorrection(c, juste, ms, r, { reponseDonnee = null } = {}) {
  const zone = $('seance-correction');
  zone.replaceChildren();
  zone.className = `correction ${juste ? 'juste' : 'faux'}`;
  zone.hidden = false;
  if (juste) {
    const rapide = ms <= seuils(c.dimension, c.niveau).rapideMs;
    zone.append(el('div', { class: 'verdict' },
      el('span', {}, rapide ? 'Juste !' : `Juste, mais trop lent pour monter (visez ${secondes(seuils(c.dimension, c.niveau).rapideMs)})`),
      el('span', {}, secondes(ms))));
    // Rendre la mécanique visible : où en est cette carte, et quand elle revient.
    // Même déroulé que pour une erreur : on lit, puis on continue quand on veut.
    zone.append(el('p', { class: 'explication' }, c.explication));
    if (c.svgCorrection) zone.append(el('div', { class: 'notation-boite', html: c.svgCorrection }));
    zone.append(el('p', { class: 'boite-info' },
      rapide ? `Boîte ${r.boiteAvant} → ${r.boiteApres} sur ${REGLES.boiteMax} · ${quandRevient(delaiBoite(r.boiteApres))}`
        : `Carte maintenue en boîte ${r.boiteApres} · ${quandRevient(delaiBoite(r.boiteApres))}`));
    $('btn-continuer').hidden = false;
    $('btn-continuer').focus();
  } else {
    seance.file.reinserer(c.id);
    zone.append(
      el('div', { class: 'verdict' }, el('span', {}, `Non : ${c.reponse}${reponseDonnee ? ` (tu as touché ${reponseDonnee})` : ''}`), el('span', {}, secondes(ms))),
      el('p', { class: 'explication' }, c.explication),
      el('p', { class: 'boite-info' }, `Carte remise en boîte 0 · elle revient dans cette séance`),
    );
    if (c.notes) zone.append(el('div', { html: clavierSvg(c.notes) }));
    if (c.svgCorrection) zone.append(el('div', { class: 'notation-boite', html: c.svgCorrection }));
    if (c.audio) zone.append(el('button', { class: 'btn btn-second', type: 'button', onclick: () => ecouter(c) }, '▶ Réécouter'));
    $('btn-continuer').hidden = false;
    $('btn-continuer').focus();
  }
}

// ---------- Pause ----------
// Le chrono de la question en cours est gelé : à la reprise, on décale t0 de la durée de la pause.
function mettreEnPause() {
  if (!seance || seance.pauseDepuis !== null || $('ecran-seance').hidden) return;
  seance.pauseDepuis = performance.now();
  if (seance.minuteur) { clearTimeout(seance.minuteur); seance.minuteur = null; seance.suivanteEnAttente = true; }
  if (lecteur) { lecteur.arreter(); if (lecteur.arreterPercussions) lecteur.arreterPercussions(); }
  if (carte(seance.carteId)?.audio) seance.ecoute = false; // la prochaine écoute relancera le chrono à sa fin
  // une frappe en cours est abandonnée : on repartira du bouton Démarrer
  if (seance.frappe) { const c = seance.frappe.c; annulerFrappe(); $('seance-enonce').replaceChildren(el('span', {}, c.enonce)); preparerFrappe(c); }
  if (carte(seance.carteId)?.chant && $('chant-etat')) { seance.chantJeton = (seance.chantJeton || 0) + 1; preparerChant(carte(seance.carteId)); }
  $('voile-pause').hidden = false;
}
function reprendre() {
  if (!seance || seance.pauseDepuis === null) return;
  seance.t0 += performance.now() - seance.pauseDepuis;
  seance.pauseDepuis = null;
  $('voile-pause').hidden = true;
  if (seance.suivanteEnAttente) { seance.suivanteEnAttente = false; prochaineQuestion(); }
}

function finSeance() {
  clearTimeout(seance.minuteur);
  seance.pauseDepuis = null;
  $('voile-pause').hidden = true;
  annulerFrappe();
  seance.chantJeton = (seance.chantJeton || 0) + 1;
  if (micro) { micro.fermer(); micro = null; }
  if (lecteur) { lecteur.arreter(); if (lecteur.arreterPercussions) lecteur.arreterPercussions(); }
  const med = mediane(seance.temps);
  cloreSeance(etat, { n: seance.n, ok: seance.ok, medianeMs: med, dimension: seance.options.dimension || null }, Date.now());
  sauver();
  const tuiles = $('bilan-tuiles');
  tuiles.replaceChildren(
    el('div', { class: 'tuile' }, el('b', {}, `${seance.ok} / ${seance.n}`), el('span', {}, 'réponses justes')),
    el('div', { class: 'tuile' }, el('b', {}, med === null ? '–' : secondes(med)), el('span', {}, 'temps médian')),
    el('div', { class: 'tuile' }, el('b', {}, String(seance.montees)), el('span', {}, 'cartes montées de boîte')),
    el('div', { class: 'tuile' }, el('b', {}, `${pourcent(seance.ok, seance.n)} %`), el('span', {}, 'réussite')),
  );
  const d = $('bilan-debloques');
  d.replaceChildren();
  for (const niv of seance.debloques) {
    d.append(el('div', { class: 'debloque' }, `Niveau débloqué : ${DIMENSIONS[niv[0]].nom}, niveau ${niv.slice(1)}`));
  }
  montrer('bilan');
}

// ---------- Progression ----------
function rendreProgression() {
  const b = bilan(etat);
  const zone = $('prog-dimensions');
  zone.replaceChildren();
  const libelle = { verrouille: 'verrouillé', ouvert: 'ouvert', maitrise: 'maîtrisé' };
  for (const d of Object.values(b.dimensions)) {
    const lignes = d.niveaux.map((n) => el('div', { class: 'niv' },
      el('span', { class: `chip ${n.etat}` }, `${libelle[n.etat]}`),
      el('span', { class: 'barre' }, el('i', { style: `width:${consolidation(n)}%` })),
      el('span', { class: 'n' }, `niv. ${n.niv} · ${n.vues}/${n.total} vues · ${consolidation(n)} %`)));
    const bloc = el('div', { class: 'bloc' }, el('h3', {}, d.nom), el('div', { class: 'niveaux' }, ...lignes));
    if (d.deblocage) {
      for (const c of d.deblocage.criteres) c.dim = d.deblocage.dim;
      bloc.append(el('div', { class: 'deblocage' },
        el('p', { class: 'eyebrow' }, `Pour ouvrir le niveau ${d.deblocage.suivant}`),
        ...d.deblocage.criteres.map((c) => el('div', { class: `critere ${c.fait ? 'fait' : 'manque'}` },
          el('span', { class: 'coche' }, c.fait ? '✓' : '•'),
          el('span', {}, texteCritere(c)))),
        el('p', { class: 'sous' }, `Une bonne réponse ne fait monter la carte d'une boîte qu'en ${secondes(d.seuils.rapideMs)} ou moins.`)));
    }
    zone.append(bloc);
  }
  const dd = etat.dechiffrage;
  const recentes = dd.historique.slice(-6).reverse();
  const date = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const parcours = (main) => {
    const p = dd[main];
    const bloque = etatDeblocageDechiffrage(etat, main);
    return el('p', { class: 'sous' }, el('b', {}, `${NOMS_MAIN[main]} (clé de ${main === 'droite' ? 'sol' : 'fa'}) · niveau ${p.niveau}`),
      ` · tempo ${Object.entries(p.bpm).map(([n, v]) => `niv. ${n} : ${v}`).join(', ')}. `,
      bloque ? `Pour ouvrir le niveau ${bloque.suivant} : ${bloque.reussites}/${bloque.cible} réussites sur les ${bloque.fenetre} dernières pièces (${bloque.jouees} jouée${bloque.jouees > 1 ? 's' : ''}).` : 'Tous les niveaux sont ouverts.');
  };
  $('prog-dechiffrage').replaceChildren(
    el('h3', {}, 'Déchiffrage au piano'),
    parcours('droite'),
    parcours('gauche'),
    recentes.length
      ? el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Main'), el('th', {}, 'Niv.'), el('th', {}, 'Justes'), el('th', {}, 'Tempo'))),
        el('tbody', {}, ...recentes.map((h) => el('tr', {}, el('td', {}, date(h.date)), el('td', {}, (h.main ?? 'droite') === 'gauche' ? 'MG' : 'MD'), el('td', {}, String(h.niveau)), el('td', {}, `${h.justes}/${h.total}${h.reussi ? ' ✓' : ''}`), el('td', {}, String(h.bpm))))))
      : el('p', { class: 'sous' }, 'Aucune pièce jouée pour l’instant.'),
  );
  $('btn-exporter').textContent = 'Copier ma progression';
  $('import-zone').hidden = true;
  rendreExplicationBoites();
  const s = $('prog-seances');
  s.replaceChildren();
  if (!b.seances.length) s.append(el('p', { class: 'sous' }, 'Aucune séance pour l’instant.'));
  else {
    const corps = b.seances.slice(-10).reverse().map((x) => el('tr', {},
      el('td', {}, new Date(x.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })),
      el('td', {}, x.dimension ? DIMENSIONS[x.dimension].nom : 'Séance du jour'),
      el('td', {}, `${x.ok}/${x.n}`),
      el('td', {}, x.medianeMs === null ? '–' : secondes(x.medianeMs))));
    s.append(el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Contenu'), el('th', {}, 'Score'), el('th', {}, 'Médiane'))), el('tbody', {}, ...corps)));
  }
  $('export-zone').hidden = true;
  montrer('progression');
}

// Le fonctionnement des boîtes, écrit noir sur blanc et calculé depuis les règles
// pour ne jamais dire autre chose que ce que fait le code.
function rendreExplicationBoites() {
  const zone = $('prog-explication');
  zone.replaceChildren(
    el('h3', {}, 'Comment une carte progresse'),
    el('p', { class: 'sous' }, 'Chaque question est une carte. Chaque carte vit dans une boîte, de 0 à '
      + `${REGLES.boiteMax}. Plus la boîte est haute, plus la carte est solide et plus elle se fait rare.`),
    el('div', { class: 'regles-boite' },
      el('div', {}, el('b', {}, 'Bonne réponse, dans les temps'), el('span', {}, 'la carte monte d’une boîte')),
      el('div', {}, el('b', {}, 'Bonne réponse, trop lente'), el('span', {}, 'la carte reste dans sa boîte')),
      el('div', {}, el('b', {}, 'Mauvaise réponse'), el('span', {}, 'la carte retombe en boîte 0')),
    ),
    el('p', { class: 'eyebrow' }, 'Quand la carte revient'),
    el('div', { class: 'echelle' }, ...REGLES.delaisJours.map((j, b) => el('div', { class: `pas${b >= REGLES.boiteAcquise ? ' acquise' : ''}` },
      el('b', {}, `Boîte ${b}`),
      el('span', {}, j === 0 ? 'tout de suite' : j === 1 ? 'le lendemain' : `${j} jours après`)))),
    el('p', { class: 'sous' }, `À partir de la boîte ${REGLES.boiteAcquise}, la carte est comptée comme acquise ; `
      + 'un niveau est « maîtrisé » quand toutes ses cartes le sont.'),
    el('p', { class: 'sous' }, 'Le pourcentage affiché plus haut est le remplissage de ces boîtes : il bouge dès '
      + `la première bonne réponse, sans attendre la boîte ${REGLES.boiteAcquise}. Comme les délais sont en jours, `
      + 'une carte ne peut pas devenir acquise le jour où on la découvre : revenir demain fait plus avancer '
      + 'que rallonger la séance du jour.'),
  );
}

// ---------- Déchiffrage : préparer, jouer au piano, corriger au micro ----------
function boutonDech(texte, action, classe = 'btn-second') { return el('button', { class: `btn ${classe}`, type: 'button', onclick: action }, texte); }
function actionsDech(...boutons) { $('dech-actions').replaceChildren(...boutons); }

function ouvrirDechiffrage() {
  $('opt-clic').checked = !!etat.prefs.clic;
  montrer('dechiffrage');
  garderEcranAllume();
  // Geste de l'élève (toucher la carte) : réveiller le son et ouvrir le micro tout de suite,
  // pour que l'autorisation soit demandée dès l'ouverture de l'écran plutôt qu'à la fin du décompte.
  lecteur ||= creerLecteur();
  if (lecteur) lecteur.jouer([]);
  ecoute ||= creerEcoute();
  if (ecoute) ecoute.ouvrir().catch(() => { ecoute = null; });
  nouvellePiece();
}

function nouvellePiece() {
  const d = etat.dechiffrage;
  const main = d.main;
  const { niveau, bpm } = d[main];
  const graine = Math.floor(Math.random() * 2 ** 31);
  dech = { piece: genererPiece(niveau, graine, { main }), graine, main, niveau, bpm: bpm[niveau], rejoue: false, phase: null, minuteur: null, raf: null, origine: 0 };
  preparerPiece();
}

// Choix de la main : visible en préparation et après la correction, caché pendant le jeu.
function montrerChoixMain(visible) {
  $('dech-main').hidden = !visible;
  for (const b of $('dech-main').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.main === etat.dechiffrage.main));
}
function choisirMain(main) {
  if (!dech || dech.phase === 'jeu' || etat.dechiffrage.main === main) return;
  etat.dechiffrage.main = main;
  sauver();
  nouvellePiece();
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
  $('dech-niveau').textContent = `${NOMS_MAIN[dech.main]} · niveau ${dech.niveau} · ${dech.bpm} à la noire${dech.rejoue ? ' · rejouée, ne compte pas' : ''}`;
  montrerChoixMain(true);
  $('dech-partition').innerHTML = partitionSvg(piece);
  $('dech-correction').hidden = true;
  const depart = `${nomFr(piece.notes[0].note)}${piece.notes[0].octave}`;
  let reste = 45;
  const texte = () => `${nomFr(piece.tonique)} majeur · ${piece.temps} temps · départ sur ${depart}. Repère le passage difficile et décide de ne pas t’arrêter. ${reste} s`;
  $('dech-etat').textContent = texte();
  dech.minuteur = setInterval(() => {
    reste -= 1;
    if (reste > 0) { $('dech-etat').textContent = texte(); return; }
    // Fin du compte à rebours : ne lancer automatiquement que si le micro est déjà ouvert
    // (sinon l'AudioContext ne serait pas créé dans un geste de l'élève, ce qu'iOS refuse).
    if (ecoute && ecoute.estOuvert()) { jouerPiece(); return; }
    clearInterval(dech.minuteur); dech.minuteur = null;
    $('dech-etat').textContent = 'À toi : touche « Je suis prêt » quand tu veux.';
  }, 1000);
  actionsDech(boutonDech('▶ Je suis prêt', jouerPiece, 'btn-principal'));
}

async function jouerPiece() {
  arreterDechiffrage();
  dech.phase = 'jeu';
  montrerChoixMain(false);
  actionsDech();
  ecoute ||= creerEcoute();
  if (!ecoute) { $('dech-etat').textContent = 'Micro indisponible sur cet appareil.'; actionsDech(boutonDech('Retour à la préparation', preparerPiece)); return; }
  $('dech-etat').textContent = 'Micro…';
  try { await ecoute.ouvrir(); } catch {
    ecoute = null;
    if (!dech || dech.phase !== 'jeu') return; // quitté pendant la demande d'autorisation
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
  ecoute.demarrer(undefined, { fMin: REGLES_ECOUTE.fMin[dech.main] });
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
  montrerChoixMain(true);
  const attendues = notesAttendues(dech.piece, dech.bpm);
  const joues = detecterAttaques(trames);
  const r = aligner(attendues, joues, { bpm: dech.bpm });
  // Détail de ce que l'app a entendu, à coller à Claude pour régler la détection.
  // Trames compactées : [temps ms, énergie × 1000, hauteur MIDI × 10 ou null].
  dech.diagnostic = JSON.stringify({
    main: dech.main, niveau: dech.niveau, graine: dech.graine, bpm: dech.bpm, latenceMs: r.latenceMs,
    attendues: attendues.map((a) => [a.tMs, a.midi]),
    joues: joues.map((j) => [j.tMs, j.midi]),
    notes: r.notes.map((n) => [n.etat, n.jouee, n.ecartMs]),
    enTrop: r.enTrop.map((x) => [x.tMs, x.midi]),
    trames: trames.map((x) => [Math.round(x.tMs), Math.round(x.rms * 1000), x.f0 ? Math.round(midiDeFrequence(x.f0) * 10) : null]),
  });
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
    const arrets = r.arrets.length ? `arrêt${r.arrets.length > 1 ? 's' : ''} mesure${r.arrets.length > 1 ? 's' : ''} ${r.arrets.join(', ')}` : 'aucun arrêt';
    const trop = r.enTrop.length ? ` · ${r.enTrop.length} note${r.enTrop.length > 1 ? 's' : ''} en trop` : '';
    const decalees = r.decalees > 0 ? ` · ${r.decalees} note${r.decalees > 1 ? 's' : ''} décalée${r.decalees > 1 ? 's' : ''}` : '';
    zone.append(
      el('div', { class: 'verdict' }, el('span', {}, r.reussi ? 'Réussi !' : 'Pas encore'), el('span', {}, `${r.justes}/${r.total} justes`)),
      el('p', { class: 'explication' }, `Régularité : ${r.ecartMedianMs === null ? '–' : `${r.ecartMedianMs} ms d’écart médian`} · ${arrets}${trop}${decalees}.`),
      el('p', { class: 'sous' }, 'Vert : juste · orange : juste mais décalée · rouge : fausse (note jouée dessous) · pointillé : manquée · × : en trop.'));
    if (!r.reussi && r.arrets.length === 0 && r.total > 0 && r.justes / r.total >= REGLES_ECOUTE.tauxReussite) {
      zone.append(el('p', { class: 'explication' }, 'Trop de notes à côté du tempo : suis le curseur.'));
    }
    if (dech.rejoue) zone.append(el('p', { class: 'boite-info' }, 'Pièce rejouée : elle ne compte pas.'));
    else {
      const e = enregistrerPiece(etat, { main: dech.main, niveau: dech.niveau, graine: dech.graine, bpm: dech.bpm, resultat: r }, Date.now());
      sauver();
      zone.append(el('p', { class: 'boite-info' }, `Prochaine pièce à ${e.bpmApres} à la noire.`));
      if (e.debloque) zone.append(el('div', { class: 'debloque' }, `Niveau débloqué : Déchiffrage ${NOMS_MAIN[dech.main].toLowerCase()}, niveau ${e.debloque}`));
    }
  }
  // Une pièce qui n'a pas compté (rien entendu, parasites) n'avait pas été enregistrée :
  // la rejouer n'est pas un « rejeu » au sens de la progression.
  const boutonRejouer = r.compte
    ? boutonDech('↻ Réessayer (sans compter)', () => { dech.rejoue = true; preparerPiece(); })
    : boutonDech('↻ Réessayer', preparerPiece);
  actionsDech(
    boutonDech('Suivante', nouvellePiece, 'btn-principal'),
    boutonDech('▶ Écouter la pièce', ecouterPiece),
    boutonRejouer,
    boutonDech('Copier le détail pour Claude', copierDiagnostic, 'btn-lien'));
}

async function copierDiagnostic(ev) {
  const bouton = ev.currentTarget;
  try { await navigator.clipboard.writeText(dech.diagnostic); bouton.textContent = 'Détail copié ✓ : colle-le à Claude'; }
  catch { bouton.textContent = 'Copie impossible sur cet appareil'; }
}

function ecouterPiece() {
  lecteur ||= creerLecteur();
  if (lecteur) lecteur.jouer(sequencePiece(dech.piece, dech.bpm));
}

function quitterDechiffrage() {
  arreterDechiffrage();
  dech = null;
  if (ecoute) { ecoute.fermer(); ecoute = null; }
  libererEcran();
  rendreAccueil();
}

async function ouvrirTestMicro() {
  arreterDechiffrage();
  if (dech) dech.phase = 'test';
  montrer('test-micro');
  garderEcranAllume();
  $('test-note').textContent = '–';
  $('test-fil').textContent = '';
  ecoute ||= creerEcoute();
  if (!ecoute) { $('test-fil').textContent = 'Micro indisponible sur cet appareil.'; return; }
  try { await ecoute.ouvrir(); } catch {
    ecoute = null;
    if ($('ecran-test-micro').hidden) return; // l'utilisateur a déjà quitté l'écran de test
    $('test-fil').textContent = 'Le micro a été refusé. Autorise-le pour ce site dans les réglages du navigateur.';
    return;
  }
  // plage de la main gauche : couvre aussi la main droite
  ecoute.demarrer((tr) => {
    $('test-niveau').style.width = `${Math.min(100, Math.round(tr.rms * 400))}%`;
    $('test-note').textContent = tr.f0 ? nomMidi(Math.round(midiDeFrequence(tr.f0))) : '…';
  }, { fMin: REGLES_ECOUTE.fMin.gauche });
  clearInterval(testMicro);
  testMicro = setInterval(() => {
    if (!ecoute) return; // micro fermé (arrière-plan) pendant que le minuteur tournait encore
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

// ---------- Démarrage ----------
async function obtenirDb() {
  try {
    if (!globalThis.claude?.use) return null;
    return await Promise.race([globalThis.claude.use('db'), new Promise((r) => setTimeout(() => r(null), 5000))]);
  } catch { return null; }
}

async function demarrer() {
  let local = null;
  try { local = globalThis.localStorage; } catch { /* navigation privée */ }
  const db = await obtenirDb();
  stockage = creerStockage({ local, db });
  etat = normaliser(await stockage.charger());
  rendreAccueil();
}

$('btn-seance').addEventListener('click', () => demarrerSeance());
$('btn-progression').addEventListener('click', rendreProgression);
$('btn-accueil-prog').addEventListener('click', rendreAccueil);
$('btn-accueil-bilan').addEventListener('click', rendreAccueil);
$('btn-continuer').addEventListener('click', prochaineQuestion);
$('btn-encore').addEventListener('click', () => demarrerSeance({ ...seance.options, taille: 10 }));
$('btn-quitter').addEventListener('click', () => (seance && seance.n > 0 ? finSeance() : rendreAccueil()));
$('btn-pause').addEventListener('click', mettreEnPause);
$('btn-reprendre').addEventListener('click', reprendre);
// Appel, changement d'application, écran verrouillé : la séance se met en pause toute seule.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    mettreEnPause();
    // une pièce en cours est abandonnée : on revient à la préparation
    if (dech && (dech.phase === 'jeu' || dech.phase === 'preparation') && !$('ecran-dechiffrage').hidden) preparerPiece();
    // le micro se ferme en arrière-plan ; il sera rouvert au prochain « Je suis prêt » (geste)
    if (ecoute) { ecoute.fermer(); ecoute = null; }
    // le test du micro tournait peut-être : son minuteur ne doit plus lire un micro fermé
    if (testMicro) {
      clearInterval(testMicro); testMicro = null;
      if (!$('ecran-test-micro').hidden) $('test-fil').textContent = 'Test interrompu : touche Retour puis Tester le micro pour reprendre.';
    }
    return;
  }
  // retour visible : le navigateur a relâché le verrou d'écran pendant que la page était cachée
  if (!$('ecran-dechiffrage').hidden || !$('ecran-test-micro').hidden) garderEcranAllume();
});
$('opt-silence').addEventListener('change', (ev) => {
  etat.prefs.silence = ev.target.checked;
  sauver();
  rendreAccueil();
});
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
for (const b of $('dech-main').querySelectorAll('button')) b.addEventListener('click', () => choisirMain(b.dataset.main));
$('btn-test-micro').addEventListener('click', ouvrirTestMicro);
$('btn-test-retour').addEventListener('click', quitterTestMicro);
$('opt-clic').addEventListener('change', (ev) => { etat.prefs.clic = ev.target.checked; sauver(); });
demarrer();

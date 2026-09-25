// Rythme : cellules rythmiques (12 unités par temps), comptage en français, notation SVG
// et évaluation d'une frappe contre les attaques attendues. Pur, sans DOM.

export const U = 12; // unités par temps : la double-croche vaut 3, la croche de triolet 4

const VALEURS = { r: 48, 'b.': 36, b: 24, 'n.': 18, n: 12, 'c.': 9, c: 6, d: 3, T: 8, t: 4 };
const NOMS = {
  r: 'ronde', 'b.': 'blanche pointée', b: 'blanche', 'n.': 'noire pointée', n: 'noire',
  'c.': 'croche pointée', c: 'croche', d: 'double-croche', T: 'noire de triolet', t: 'croche de triolet',
};
const TEMPS_VALEUR = {
  48: '4 temps', 36: '3 temps', 24: '2 temps', 18: '1 temps et demi', 12: '1 temps', 9: '3/4 de temps',
  6: '1/2 temps', 3: '1/4 de temps', 8: '2/3 de temps', 4: '1/3 de temps',
};
export function nomValeur(token) { return NOMS[token]; }
export function tempsValeur(token) { return TEMPS_VALEUR[VALEURS[token]]; }
export const TOKENS = Object.keys(VALEURS);

// « n c c n -c c » : n noire, c croche, d double, b blanche, r ronde, « . » pointé, t/T triolet,
// préfixe « - » silence, préfixe « _ » lié à la note précédente (pas de nouvelle attaque).
export function cellule(texte, { temps = 4, swing = false } = {}) {
  const evenements = [];
  let pos = 0;
  for (const tok of texte.trim().split(/\s+/)) {
    const m = /^([-_]?)(r|b\.|b|n\.|n|c\.|c|d|T|t)$/.exec(tok);
    if (!m) throw new Error(`Cellule illisible : « ${tok} »`);
    const d = VALEURS[m[2]];
    evenements.push({ pos, d, token: m[2], silence: m[1] === '-', lie: m[1] === '_', triolet: m[2] === 't' || m[2] === 'T' });
    pos += d;
  }
  const mesure = temps * U;
  if (pos % mesure !== 0) throw new Error(`Cellule « ${texte} » : ${pos} unités, pas un nombre entier de mesures à ${temps} temps`);
  return { texte, temps, swing, evenements, duree: pos, mesures: pos / mesure };
}

// Positions (en unités) des attaques : ni silences ni notes liées. Le swing décale le « et » à 2/3 du temps.
export function onsets(cell) {
  return cell.evenements
    .filter((e) => !e.silence && !e.lie)
    .map((e) => (cell.swing && e.pos % U === 6 ? e.pos + 2 : e.pos));
}
export function onsetsMs(cell, bpm) {
  const parUnite = 60000 / bpm / U;
  return onsets(cell).map((p) => Math.round(p * parUnite));
}
export function dureeMs(cell, bpm) { return Math.round((cell.duree * 60000) / bpm / U); }

const SYLLABES = { 0: '', 3: 'e', 6: 'et', 9: 'a', 4: 'tri', 8: 'o' };
// « 1 et (2) et 3 4 » : chaque temps est nommé, entre parenthèses s'il n'est pas attaqué.
export function compter(cell) {
  const attaques = new Set(onsets(cell));
  const mots = [];
  for (let p = 0; p < cell.duree; p += U) {
    const temps = ((p / U) % cell.temps) + 1;
    mots.push(attaques.has(p) ? String(temps) : `(${temps})`);
    for (const f of [3, 4, 6, 8, 9]) if (attaques.has(p + f)) mots.push(SYLLABES[f]);
  }
  return mots.join(' ');
}

// ---------- Notation SVG (une ligne, sans portée) ----------
const S = 6;          // pixels par unité
const MARGE = 18;
const Y = 44;         // ligne des têtes de notes
const HAUT = 22;      // hauteur de hampe

function tete(x, pleine) {
  // La classe « vide » est indispensable : la feuille de style remplit les têtes, un simple attribut fill="none" serait écrasé.
  return `<ellipse class="tete${pleine ? '' : ' vide'}" cx="${x}" cy="${Y}" rx="4.6" ry="3.3" transform="rotate(-20 ${x} ${Y})"${pleine ? '' : ' fill="none" stroke-width="1.6"'}/>`;
}
function silence(x, d) {
  if (d >= 24) return `<rect class="silence" x="${x - 4}" y="${d >= 48 ? Y - 12 : Y - 8}" width="9" height="4"/>`;
  if (d >= 12) return `<path class="silence" d="M${x - 2} ${Y - 12} l4 5 l-4 5 l4 5 q-4 -1 -3 3" fill="none" stroke-width="1.8"/>`;
  if (d >= 6) return `<path class="silence" d="M${x - 3} ${Y - 7} q3 3 6 1 l-3 12" fill="none" stroke-width="1.6"/><circle class="silence" cx="${x - 3}" cy="${Y - 7}" r="1.6"/>`;
  return `<path class="silence" d="M${x - 3} ${Y - 9} q3 3 6 1 m-1 4 q-2 2 -4 1 l-2 10" fill="none" stroke-width="1.4"/>`;
}
function drapeau(x, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const y = Y - HAUT + i * 5;
    s += `<path class="hampe" d="M${x + 4} ${y} q6 4 5 12" fill="none" stroke-width="1.8"/>`;
  }
  return s;
}

export function notationSvg(cell, { compte = false } = {}) {
  const largeur = MARGE * 2 + cell.duree * S + 14;
  const hauteur = compte ? 84 : 66;
  const parts = [];
  const mesure = cell.temps * U;
  // chiffrage (masqué quand la question porte dessus)
  if (cell.chiffrage !== false) parts.push(`<text class="chiffrage" x="${MARGE - 12}" y="${Y - 6}" text-anchor="middle">${cell.temps}</text><text class="chiffrage" x="${MARGE - 12}" y="${Y + 10}" text-anchor="middle">4</text>`);
  const x0 = MARGE + 6;
  const xDe = (p) => x0 + p * S;
  // barres de mesure
  for (let p = mesure; p <= cell.duree; p += mesure) parts.push(`<line class="barre" x1="${xDe(p) - 3}" y1="${Y - 14}" x2="${xDe(p) - 3}" y2="${Y + 14}" stroke-width="1.4"/>`);
  // ligne de base discrète
  parts.push(`<line class="ligne" x1="${x0 - 8}" y1="${Y}" x2="${xDe(cell.duree)}" y2="${Y}" stroke-width=".6"/>`);

  const ev = cell.evenements;
  // groupes de ligature : notes courtes consécutives dans le même temps
  const groupes = [];
  let g = null;
  ev.forEach((e, i) => {
    const courte = !e.silence && e.d < 12;
    const memeTemps = g && Math.floor(e.pos / U) === Math.floor(ev[g[0]].pos / U);
    if (courte && memeTemps) g.push(i);
    else { if (g && g.length > 1) groupes.push(g); g = courte ? [i] : null; }
  });
  if (g && g.length > 1) groupes.push(g);
  const dansGroupe = new Set(groupes.flat());

  ev.forEach((e, i) => {
    const x = xDe(e.pos);
    if (e.silence) { parts.push(silence(x, e.d)); return; }
    parts.push(tete(x, e.d < 24));
    if (e.d !== 48) parts.push(`<line class="hampe" x1="${x + 4}" y1="${Y - 1}" x2="${x + 4}" y2="${Y - HAUT}" stroke-width="1.6"/>`);
    if (e.token.endsWith('.')) parts.push(`<circle class="point" cx="${x + 9}" cy="${Y - 2}" r="1.6"/>`);
    if (e.d < 12 && !dansGroupe.has(i)) parts.push(drapeau(x, e.d <= 3 ? 2 : 1));
    if (e.lie && i > 0) {
      const xp = xDe(ev[i - 1].pos);
      parts.push(`<path class="liaison" d="M${xp + 3} ${Y + 6} q${(x - xp - 6) / 2} 9 ${x - xp - 6} 0" fill="none" stroke-width="1.3"/>`);
    }
  });
  for (const grp of groupes) {
    const xa = xDe(ev[grp[0]].pos) + 4; const xb = xDe(ev[grp.at(-1)].pos) + 4;
    parts.push(`<line class="hampe" x1="${xa}" y1="${Y - HAUT}" x2="${xb}" y2="${Y - HAUT}" stroke-width="3.2"/>`);
    // ligature secondaire pour les doubles-croches
    grp.forEach((i, k) => {
      if (ev[i].d > 3) return;
      const x = xDe(ev[i].pos) + 4;
      const voisin = grp[k + 1] !== undefined && ev[grp[k + 1]].d <= 3 ? xDe(ev[grp[k + 1]].pos) + 4 : null;
      const x2 = voisin ?? (k > 0 && ev[grp[k - 1]].d <= 3 ? null : x + 7);
      if (x2 !== null) parts.push(`<line class="hampe" x1="${x}" y1="${Y - HAUT + 5}" x2="${x2}" y2="${Y - HAUT + 5}" stroke-width="3.2"/>`);
    });
  }
  // triolets : accolade + 3
  let t = null;
  const fermer = () => { if (t) { const xa = xDe(ev[t[0]].pos); const xb = xDe(ev[t.at(-1)].pos) + 8; parts.push(`<path class="triolet" d="M${xa} ${Y - HAUT - 4} v-4 h${xb - xa} v4" fill="none" stroke-width="1.2"/><text class="chiffrage petit" x="${(xa + xb) / 2}" y="${Y - HAUT - 10}" text-anchor="middle">3</text>`); t = null; } };
  ev.forEach((e, i) => { if (e.triolet) { (t ||= []).push(i); if (t.length === 3) fermer(); } else fermer(); });
  fermer();
  if (cell.swing) parts.push(`<text class="chiffrage petit" x="${largeur - 6}" y="12" text-anchor="end">swing</text>`);
  if (compte) {
    const mots = compter(cell).split(' ');
    const attaques = onsets(cell);
    // un mot par temps + syllabes : on replace chaque mot à sa position
    let k = 0;
    for (let p = 0; p < cell.duree; p += U) {
      parts.push(`<text class="compte${mots[k].startsWith('(') ? ' muet' : ''}" x="${xDe(p)}" y="${Y + 30}" text-anchor="middle">${mots[k++]}</text>`);
      for (const f of [3, 4, 6, 8, 9]) if (attaques.includes(p + f)) parts.push(`<text class="compte" x="${xDe(p + f)}" y="${Y + 30}" text-anchor="middle">${mots[k++]}</text>`);
    }
  }
  return `<svg class="notation" viewBox="0 0 ${largeur} ${hauteur}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${cell.texte}">${parts.join('')}</svg>`;
}

// ---------- Évaluation d'une frappe ----------
// attendusMs / tapsMs : instants relatifs à la même origine.
export function evaluerFrappe(attendusMs, tapsMs, { tolerance = 80, fenetre = 150 } = {}) {
  const libres = tapsMs.map((t) => ({ t, pris: false }));
  const details = attendusMs.map((a) => {
    let meilleur = null;
    for (const c of libres) {
      if (c.pris) continue;
      const ecart = c.t - a;
      if (Math.abs(ecart) <= fenetre && (!meilleur || Math.abs(ecart) < Math.abs(meilleur.ecart))) meilleur = { c, ecart };
    }
    if (!meilleur) return { attendu: a, tap: null, ecart: null };
    meilleur.c.pris = true;
    return { attendu: a, tap: meilleur.c.t, ecart: Math.round(meilleur.ecart) };
  });
  const touches = details.filter((d) => d.tap !== null);
  const manques = details.length - touches.length;
  const extras = libres.filter((c) => !c.pris).length;
  const ecartMoyen = touches.length ? Math.round(touches.reduce((s, d) => s + Math.abs(d.ecart), 0) / touches.length) : null;
  const ecartSigne = touches.length ? Math.round(touches.reduce((s, d) => s + d.ecart, 0) / touches.length) : null;
  const juste = manques === 0 && extras <= 1 && ecartMoyen !== null && ecartMoyen <= tolerance;
  return { juste, manques, extras, ecartMoyen, ecartSigne, details };
}

// Bande de visualisation : repères des attaques attendues, points colorés selon l'écart des frappes.
export function frappeSvg(r, longueurMs, tapsMs = []) {
  const L = 320, H = 34, x0 = 10, x1 = L - 10;
  const xDe = (t) => x0 + (Math.max(0, Math.min(longueurMs, t)) / longueurMs) * (x1 - x0);
  const parts = [`<line class="ligne" x1="${x0}" y1="${H / 2}" x2="${x1}" y2="${H / 2}" stroke-width=".8"/>`];
  for (const d of r.details) {
    const x = xDe(d.attendu);
    parts.push(`<line class="repere" x1="${x}" y1="6" x2="${x}" y2="${H - 6}" stroke-width="1"/>`);
    if (d.tap === null) parts.push(`<circle class="frappe manque" cx="${x}" cy="${H / 2}" r="5" fill="none" stroke-width="1.6"/>`);
    else {
      const cls = Math.abs(d.ecart) <= 40 ? 'bonne' : Math.abs(d.ecart) <= 80 ? 'moyenne' : 'loin';
      parts.push(`<circle class="frappe ${cls}" cx="${xDe(d.tap)}" cy="${H / 2}" r="5"/>`);
    }
  }
  const utilises = new Set(r.details.map((d) => d.tap));
  for (const t of tapsMs) if (!utilises.has(t)) parts.push(`<text class="frappe extra" x="${xDe(t)}" y="${H / 2 + 4}" text-anchor="middle">×</text>`);
  return `<svg class="bande-frappe" viewBox="0 0 ${L} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="frappes">${parts.join('')}</svg>`;
}

// Phrase de bilan pour l'élève.
export function commentaireFrappe(r) {
  if (r.ecartMoyen === null) return 'Aucune frappe reconnue.';
  const parts = [`écart moyen ${r.ecartMoyen} ms`];
  if (r.ecartSigne <= -25) parts.push('plutôt en avance');
  else if (r.ecartSigne >= 25) parts.push('plutôt en retard');
  else parts.push('bien centré');
  if (r.manques) parts.push(`${r.manques} attaque${r.manques > 1 ? 's' : ''} manquée${r.manques > 1 ? 's' : ''}`);
  if (r.extras) parts.push(`${r.extras} frappe${r.extras > 1 ? 's' : ''} en trop`);
  return parts.join(', ') + '.';
}

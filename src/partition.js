// Partition d'une pièce de déchiffrage : clé de sol ou de fa, hauteurs et rythmes, plusieurs mesures sur
// plusieurs lignes, et le résultat de la correction coloré sur chaque note. Pur, sans DOM.

import { positionPortee, cleSol, cleFa, POS_DIESES, POS_BEMOLS } from './portee.js';
import { U } from './rythme.js';

const PX_UNITE = 3.5;       // largeur d'une unité de temps (12 par temps)
const MARGE_MESURE = 16;    // avant la première note d'une mesure
const FIN_MESURE = 10;      // après la dernière
const DEMI_INTERLIGNE = 5;
const HAUT_SYSTEME = 130;   // hauteur d'une ligne de partition
const BAS_SYSTEME = 100;    // y de la ligne du bas de la portée, dans une ligne
const X_ARMURE = { sol: 56, fa: 66 }; // la clé de fa, avec ses deux points, est plus large

export function geometriePartition(piece, { mesuresParLigne = 2 } = {}) {
  const unitesMesure = piece.temps * U;
  const largeurMesure = MARGE_MESURE + unitesMesure * PX_UNITE + FIN_MESURE;
  const entete = X_ARMURE[piece.cle || 'sol'] + Math.abs(piece.armure) * 9 + 4;
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
  const cle = piece.cle || 'sol';
  const posArm = (piece.armure > 0 ? POS_DIESES : POS_BEMOLS)[cle];
  for (const s of geo.systemes) {
    const bas = geo.basPortee(s.ligne);
    const fin = s.mesures.at(-1).x1;
    for (let k = 0; k < 5; k++) parts.push(`<line class="ligne" x1="6" y1="${bas - 10 * k}" x2="${fin}" y2="${bas - 10 * k}" stroke-width="1"/>`);
    parts.push(`<g transform="translate(0 ${bas - 90})">${cle === 'fa' ? cleFa() : cleSol()}</g>`);
    for (let i = 0; i < Math.abs(piece.armure); i++) {
      parts.push(`<text class="alteration" x="${X_ARMURE[cle] + i * 9}" y="${yDePos(s.ligne, posArm[i]) + 5}" text-anchor="middle">${piece.armure > 0 ? '♯' : '♭'}</text>`);
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
    const p = positionPortee(x.note, x.octave, cle);
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
    parts.push(`<text class="en-trop" x="${x}" y="${geo.basPortee(ligne) - 62}" text-anchor="middle">×</text>`);
  }
  parts.push('<line class="curseur" x1="0" y1="0" x2="0" y2="0" stroke-width="2" visibility="hidden"/>');
  return `<svg class="partition" viewBox="0 0 ${geo.largeur} ${geo.hauteur}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="partition à déchiffrer">${parts.join('')}</svg>`;
}

// Petit clavier SVG de 2 octaves (do → si) qui surligne une liste de notes, en ordre montant.

import { classe, nomFr } from './theorie.js';

const BLANCHES = [0, 2, 4, 5, 7, 9, 11];         // classes des touches blanches
const NOIRES = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }; // classe → index de la blanche qui précède
const L = 22, H = 72, LN = 13, HN = 44;

export function clavierSvg(notes, { interactif = false } = {}) {
  // Position absolue (0..23) de chaque note, en montant à partir de la première.
  const marques = new Map();
  let prec = null;
  for (const n of notes) {
    const c = classe(n);
    let abs;
    if (prec === null) abs = c;
    else { const saut = (c - (prec % 12) + 12) % 12 || 12; abs = prec + saut; }
    if (abs >= 24) abs -= 12;
    marques.set(abs, nomFr(n));
    prec = abs;
  }
  const blanches = [], noires = [], textes = [];
  for (let o = 0; o < 2; o++) {
    BLANCHES.forEach((c, i) => {
      const x = (o * 7 + i) * L;
      const abs = o * 12 + c;
      const m = marques.has(abs);
      blanches.push(`<rect class="touche${m ? ' marquee' : ''} blanche" data-classe="${c}" data-abs="${abs}" x="${x}" y="0" width="${L}" height="${H}" rx="2"/>`);
      if (m) textes.push(`<text x="${x + L / 2}" y="${H - 6}" text-anchor="middle" class="etiquette">${marques.get(abs)}</text>`);
    });
    for (const [c, i] of Object.entries(NOIRES)) {
      const x = (o * 7 + Number(i)) * L + L - LN / 2;
      const abs = o * 12 + Number(c);
      const m = marques.has(abs);
      noires.push(`<rect class="touche${m ? ' marquee' : ''} noire" data-classe="${c}" data-abs="${abs}" x="${x}" y="0" width="${LN}" height="${HN}" rx="2"/>`);
      if (m) textes.push(`<text x="${x + LN / 2}" y="${HN - 5}" text-anchor="middle" class="etiquette noire">${marques.get(abs)}</text>`);
    }
  }
  return `<svg class="clavier${interactif ? ' cliquable' : ''}" viewBox="0 0 ${14 * L} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Clavier : ${notes.map(nomFr).join(' ')}">${blanches.join('')}${noires.join('')}${textes.join('')}</svg>`;
}

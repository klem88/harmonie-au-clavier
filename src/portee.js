// Portée : position d'une note en clé de sol ou de fa, armure, dessin SVG. Pur, sans DOM.

import { nomFr } from './theorie.js';

const LETTRES_PORTEE_MOD = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
// Numéro diatonique : do4 = 28 ; chaque lettre compte 1, chaque octave 7.
export const diatonique = (n, octave) => octave * 7 + LETTRES_PORTEE_MOD.indexOf(n.lettre);
// Ligne du bas : mi4 en clé de sol, sol2 en clé de fa. Position 0 = ligne du bas, +1 par interligne/ligne.
const BAS = { sol: diatonique({ lettre: 'E' }, 4), fa: diatonique({ lettre: 'G' }, 2) };
export function positionPortee(n, octave, cle) { return diatonique(n, octave) - BAS[cle]; }

// Numéro d'octave qui met la note à la position p (inverse de positionPortee).
export function noteAPosition(p, cle) {
  const d = BAS[cle] + p;
  return { lettre: LETTRES_PORTEE_MOD[((d % 7) + 7) % 7], octave: Math.floor(d / 7) };
}

// Où va chaque dièse / bémol de l'armure (positions sur la portée).
export const POS_DIESES = { sol: [8, 5, 9, 6, 3, 7, 4], fa: [6, 3, 7, 4, 1, 5, 2] };
export const POS_BEMOLS = { sol: [4, 7, 3, 6, 2, 5, 1], fa: [2, 5, 1, 4, 0, 3, -1] };

export const REGLES_LECTURE = {
  sol: 'Clé de sol : lignes mi – sol – si – ré – fa, interlignes fa – la – do – mi ; la clé s’enroule sur la 2e ligne, sol.',
  fa: 'Clé de fa : lignes sol – si – ré – fa – la, interlignes la – do – mi – sol ; les deux points encadrent la 4e ligne, fa.',
};
export function decrirePosition(p) {
  if (p < 0) return `${Math.ceil(-p / 2)}${-p === 2 ? 're' : 'e'} ligne supplémentaire ${p % 2 === 0 ? 'en dessous' : 'sous la portée, dans l’interligne'}`.replace('1e ligne', '1re ligne');
  if (p > 8) return `${Math.ceil((p - 8) / 2)}${p - 8 === 2 ? 're' : 'e'} ligne supplémentaire ${p % 2 === 0 ? 'au-dessus' : 'au-dessus, dans l’interligne'}`.replace('1e ligne', '1re ligne');
  return p % 2 === 0 ? `${p / 2 + 1}${p === 0 ? 're' : 'e'} ligne` : `${(p + 1) / 2}${p === 1 ? 'er' : 'e'} interligne`;
}

const X_NOTE0 = 92; // première note
const ESP = 10;     // interligne (entre deux lignes) en px
const Y_BAS = 90;   // ligne du bas
const yDe = (p) => Y_BAS - (p * ESP) / 2;

export function cleSol() {
  // Tracé simplifié : boucle sur la 2e ligne (sol), montée, crochet en bas.
  return `<path class="cle" d="M 29 108 Q 18 114 17 104 Q 17 97 23 97 Q 30 97 30 105 L 30 30 Q 30 18 25 18 Q 19 18 18 30 Q 18 44 40 66 Q 47 76 37 84 Q 26 89 19 80 Q 14 70 24 65 Q 34 62 36 72" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function cleFa() {
  return `<path class="cle" d="M 20 66 Q 19 46 33 46 Q 46 46 46 60 Q 46 80 22 94" fill="none" stroke-width="2.8" stroke-linecap="round"/><circle class="cle" cx="21" cy="66" r="3.4"/><circle class="cle" cx="53" cy="55" r="2.4"/><circle class="cle" cx="53" cy="65" r="2.4"/>`;
}

// notes : [{ note: {lettre, alt}, octave, accidentel: '#' | 'b' | 'n' | null }]
// armure : entier −7..7 (négatif = bémols). Les altérations de l'armure ne sont pas redessinées sur la note.
export function porteeSvg({ cle = 'sol', notes = [], armure = 0, etiquettes = false } = {}) {
  const nbArm = Math.abs(armure);
  const xArm0 = 62;
  const xNote0 = X_NOTE0 + nbArm * 9;
  const largeur = xNote0 + notes.length * 34 + 30;
  const parts = [];
  for (let k = 0; k < 5; k++) parts.push(`<line class="ligne" x1="8" y1="${yDe(2 * k)}" x2="${largeur - 8}" y2="${yDe(2 * k)}" stroke-width="1"/>`);
  parts.push(cle === 'sol' ? cleSol() : cleFa());
  // armure
  const posArm = (armure > 0 ? POS_DIESES : POS_BEMOLS)[cle];
  for (let i = 0; i < nbArm; i++) {
    parts.push(`<text class="alteration" x="${xArm0 + i * 9}" y="${yDe(posArm[i]) + 5}" text-anchor="middle">${armure > 0 ? '♯' : '♭'}</text>`);
  }
  notes.forEach((n, i) => {
    const x = xNote0 + i * 34;
    const p = positionPortee(n.note, n.octave, cle);
    const y = yDe(p);
    // lignes supplémentaires
    for (let q = -2; q >= p; q -= 2) parts.push(`<line class="ligne" x1="${x - 11}" y1="${yDe(q)}" x2="${x + 11}" y2="${yDe(q)}" stroke-width="1.2"/>`);
    for (let q = 10; q <= p; q += 2) parts.push(`<line class="ligne" x1="${x - 11}" y1="${yDe(q)}" x2="${x + 11}" y2="${yDe(q)}" stroke-width="1.2"/>`);
    if (n.accidentel) parts.push(`<text class="alteration" x="${x - 14}" y="${y + 5}" text-anchor="middle">${{ '#': '♯', b: '♭', n: '♮' }[n.accidentel]}</text>`);
    parts.push(`<ellipse class="tete" cx="${x}" cy="${y}" rx="6.2" ry="4.4" transform="rotate(-20 ${x} ${y})"/>`);
    // hampe : vers le haut sous la ligne du milieu, vers le bas au-dessus
    if (p < 4) parts.push(`<line class="hampe" x1="${x + 5.5}" y1="${y - 1}" x2="${x + 5.5}" y2="${y - 32}" stroke-width="1.5"/>`);
    else parts.push(`<line class="hampe" x1="${x - 5.5}" y1="${y + 1}" x2="${x - 5.5}" y2="${y + 32}" stroke-width="1.5"/>`);
    if (etiquettes) parts.push(`<text class="etiquette" x="${x}" y="${Y_BAS + 34}" text-anchor="middle">${nomFr(n.note)}${n.octave}</text>`);
  });
  const hauteur = etiquettes ? 138 : 128;
  return `<svg class="portee" viewBox="0 0 ${largeur} ${hauteur}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="portée en clé de ${cle}">${parts.join('')}</svg>`;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererPiece } from '../src/piece.js';
import { partitionSvg, geometriePartition, curseurA } from '../src/partition.js';
import { U } from '../src/rythme.js';

const compter = (s, motif) => s.split(motif).length - 1;
function pieceOu(niveau, condition) {
  for (let g = 1; g < 5000; g++) { const p = genererPiece(niveau, g); if (condition(p)) return p; }
  throw new Error('aucune pièce trouvée');
}

test('une tête par note, une barre par mesure, barre finale, chiffrage, curseur', () => {
  const p = genererPiece(1, 3);
  const svg = partitionSvg(p);
  assert.ok(svg.startsWith('<svg class="partition"'));
  assert.equal(compter(svg, '<ellipse class="tete'), p.notes.length);
  assert.equal(compter(svg, 'class="barre-mesure"'), p.mesures);
  assert.equal(compter(svg, 'class="barre-finale"'), 1);
  assert.equal(compter(svg, 'class="chiffrage-partition"'), 2);
  assert.equal(compter(svg, 'class="curseur"'), 1);
});

test('armure répétée sur chaque ligne : dièses, bémols, rien en do', () => {
  assert.equal(compter(partitionSvg(pieceOu(2, (p) => p.tonalite === 'G')), '♯'), 2);
  assert.equal(compter(partitionSvg(pieceOu(2, (p) => p.tonalite === 'D')), '♯'), 4);
  assert.equal(compter(partitionSvg(pieceOu(2, (p) => p.tonalite === 'F')), '♭'), 2);
  const doMaj = partitionSvg(pieceOu(2, (p) => p.tonalite === 'C'));
  assert.equal(compter(doMaj, '♯') + compter(doMaj, '♭'), 0);
});

test('géométrie : 2 lignes de 2 mesures, x croissants, curseur qui avance, largeur téléphone', () => {
  const p = genererPiece(2, 11);
  const geo = geometriePartition(p);
  assert.equal(geo.systemes.length, 2);
  const places = p.notes.map((n) => geo.ou(n.pos));
  p.notes.forEach((n, i) => assert.equal(places[i].ligne, n.mesure < 2 ? 0 : 1));
  for (let i = 1; i < places.length; i++) if (places[i].ligne === places[i - 1].ligne) assert.ok(places[i].x > places[i - 1].x);
  const c1 = curseurA(geo, 0); const c2 = curseurA(geo, U);
  assert.ok(c2.x > c1.x && c1.ligne === 0);
  assert.equal(curseurA(geo, 2 * p.temps * U).ligne, 1);
  for (const t of ['C', 'D']) {
    const large = geometriePartition(pieceOu(2, (x) => x.tonalite === t));
    assert.ok(large.largeur <= 520, `trop large pour un téléphone : ${large.largeur}`);
  }
});

test('marques de correction et notes en trop', () => {
  const p = genererPiece(1, 5);
  const marques = p.notes.map(() => ({ etat: 'juste' }));
  marques[1] = { etat: 'fausse', joue: 'fa4' };
  marques[2] = { etat: 'manquee' };
  const svg = partitionSvg(p, { marques, enTrop: [{ pos: 6 }] });
  assert.equal(compter(svg, 'marque-juste'), p.notes.length - 2);
  assert.ok(svg.includes('marque-fausse') && svg.includes('>fa4<') && svg.includes('marque-manquee'));
  assert.equal(compter(svg, 'class="en-trop"'), 1);
});

test('note en trop : la croix se dessine plus haut (-62) pour ne pas chevaucher une note aiguë', () => {
  const p = genererPiece(1, 5);
  const geo = geometriePartition(p);
  const { ligne } = geo.ou(6);
  const svg = partitionSvg(p, { enTrop: [{ pos: 6 }] });
  assert.ok(svg.includes(`y="${geo.basPortee(ligne) - 62}"`), 'la croix doit être à basPortee(ligne) - 62');
});

test('croches liées par deux, noire pointée avec son point, ronde sans hampe', () => {
  const avecCroches = pieceOu(2, (p) => p.notes.some((n, i) => n.duree === U / 2 && n.pos % U === 0 && p.notes[i + 1]?.duree === U / 2));
  assert.ok(partitionSvg(avecCroches).includes('class="ligature"'));
  const pointee = pieceOu(3, (p) => p.notes.some((n) => n.token === 'n.'));
  assert.ok(partitionSvg(pointee).includes('class="point"'));
  const ronde = pieceOu(3, (p) => p.notes.at(-1).token === 'r');
  const svg = partitionSvg(ronde);
  assert.ok(svg.includes('tete vide'));
});

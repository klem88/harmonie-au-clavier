import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clavierSvg } from '../src/clavier.js';
import { note } from '../src/theorie.js';

test('clavier : 24 touches, notes marquées et étiquetées', () => {
  const svg = clavierSvg([note('C'), note('E'), note('G')]);
  assert.ok(svg.startsWith('<svg'));
  assert.equal((svg.match(/<rect /g) || []).length, 24);
  assert.equal((svg.match(/touche marquee/g) || []).length, 3);
  assert.ok(svg.includes('>mi<'));
  assert.ok(svg.includes('data-classe="1"'));
});

test('clavier : un accord qui monte reste en ordre (la♭ do mi♭ sol♭)', () => {
  const svg = clavierSvg([note('Ab'), note('C'), note('Eb'), note('Gb')]);
  const abs = [...svg.matchAll(/touche marquee[^>]*data-abs="(\d+)"/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
  assert.deepEqual(abs, [8, 12, 15, 18]);
});

test('clavier interactif : classe cliquable', () => {
  assert.ok(clavierSvg([], { interactif: true }).includes('class="clavier cliquable"'));
  assert.ok(!clavierSvg([]).includes('cliquable'));
});

test('clavier : liste vide → clavier nu', () => {
  const svg = clavierSvg([]);
  assert.equal((svg.match(/touche marquee/g) || []).length, 0);
});

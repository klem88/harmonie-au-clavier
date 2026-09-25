import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionPortee, noteAPosition, porteeSvg, decrirePosition, diatonique } from '../src/portee.js';
import { note } from '../src/theorie.js';

test('positions en clé de sol et de fa', () => {
  assert.equal(positionPortee(note('E'), 4, 'sol'), 0, 'mi4 = 1re ligne');
  assert.equal(positionPortee(note('G'), 4, 'sol'), 2, 'sol4 = 2e ligne');
  assert.equal(positionPortee(note('B'), 4, 'sol'), 4, 'si4 = 3e ligne');
  assert.equal(positionPortee(note('F'), 5, 'sol'), 8, 'fa5 = 5e ligne');
  assert.equal(positionPortee(note('C'), 4, 'sol'), -2, 'do4 = 1re ligne supplémentaire en dessous');
  assert.equal(positionPortee(note('G'), 2, 'fa'), 0, 'sol2 = 1re ligne en clé de fa');
  assert.equal(positionPortee(note('F'), 3, 'fa'), 6, 'fa3 = 4e ligne');
  assert.equal(positionPortee(note('C'), 4, 'fa'), 10, 'do4 = 1re ligne supplémentaire au-dessus');
  assert.deepEqual(noteAPosition(4, 'sol'), { lettre: 'B', octave: 4 });
  assert.deepEqual(noteAPosition(-2, 'sol'), { lettre: 'C', octave: 4 });
  assert.deepEqual(noteAPosition(6, 'fa'), { lettre: 'F', octave: 3 });
  assert.equal(diatonique(note('C'), 4), 28);
});

test('descriptions de position', () => {
  assert.equal(decrirePosition(0), '1re ligne');
  assert.equal(decrirePosition(4), '3e ligne');
  assert.equal(decrirePosition(1), '1er interligne');
  assert.equal(decrirePosition(5), '3e interligne');
  assert.match(decrirePosition(-2), /1re ligne supplémentaire/);
  assert.match(decrirePosition(10), /1re ligne supplémentaire/);
  assert.match(decrirePosition(-1), /interligne/);
});

test('porteeSvg : lignes, clé, armure, altérations, lignes supplémentaires', () => {
  const svg = porteeSvg({ cle: 'sol', notes: [{ note: note('C'), octave: 4 }, { note: note('F'), octave: 5, accidentel: '#' }], armure: 2 });
  assert.ok(svg.startsWith('<svg'));
  assert.equal((svg.match(/class="tete"/g) || []).length, 2);
  assert.ok(svg.includes('class="cle"'));
  assert.equal((svg.match(/class="alteration"/g) || []).length, 3, '2 dièses d’armure + 1 accidentel');
  assert.ok(svg.includes('>♮<') === false && svg.includes('>♯<'));
  // do4 : une ligne supplémentaire, dessinée en plus des 5 lignes de portée
  assert.equal((svg.match(/class="ligne"/g) || []).length, 6);
  const fa = porteeSvg({ cle: 'fa', notes: [{ note: note('G'), octave: 2 }], armure: -3, etiquettes: true });
  assert.equal((fa.match(/>♭</g) || []).length, 3);
  assert.ok(fa.includes('>sol2<'));
});

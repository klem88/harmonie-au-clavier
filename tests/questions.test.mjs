import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIMENSIONS, catalogue, carte, cartesDuNiveau, melangerChoix } from '../src/questions.js';

test('le catalogue est valide carte par carte', () => {
  const cartes = catalogue();
  const ids = new Set();
  for (const c of cartes) {
    assert.ok(!ids.has(c.id), `id en double : ${c.id}`);
    ids.add(c.id);
    assert.ok(DIMENSIONS[c.dimension], `dimension inconnue ${c.id}`);
    assert.ok(c.niveau >= 1 && c.niveau <= DIMENSIONS[c.dimension].niveaux, `niveau hors bornes ${c.id}`);
    assert.ok(c.enonce.length > 3, `énoncé vide ${c.id}`);
    if (c.clavierReponse) {
      assert.ok(Number.isInteger(c.reponseClasse) && c.reponseClasse >= 0 && c.reponseClasse < 12, `classe attendue ${c.id}`);
      assert.ok(c.svg.startsWith('<svg') && c.svgCorrection.startsWith('<svg'), `portée manquante ${c.id}`);
      assert.deepEqual(c.pieges, []);
    } else if (c.chant) {
      assert.equal(c.reponse, 'chant');
      assert.ok(c.chant.cibles.length >= 1 && c.chant.cibles.length === c.chant.noms.length, `cibles ${c.id}`);
      assert.ok(c.audio && ['midis', 'accordMidis'].includes(c.audio.mode), `référence audio ${c.id}`);
    } else if (c.frappe) {
      assert.equal(c.reponse, 'frappe');
      assert.ok(c.frappe.bpm > 0 && c.frappe.mains.length >= 1 && c.frappe.mesures === 2, `frappe incomplète ${c.id}`);
      assert.ok(c.svgCorrection.startsWith('<svg'), `notation manquante ${c.id}`);
    } else {
      assert.equal(c.pieges.length, 3, `3 pièges attendus ${c.id}`);
      const choix = [c.reponse, ...c.pieges];
      assert.equal(new Set(choix).size, 4, `choix non distincts ${c.id} : ${choix.join(' | ')}`);
      if (c.rendus) for (const t of choix) assert.ok(c.rendus[t]?.startsWith('<svg'), `rendu manquant ${c.id} : ${t}`);
    }
    if (c.svg) assert.ok(c.svg.startsWith('<svg'));
    assert.ok(c.explication.length > 10, `explication trop courte ${c.id}`);
    if ('BCEF'.includes(c.dimension)) {
      assert.ok(Array.isArray(c.notes) && c.notes.length >= 2, `notes manquantes ${c.id}`);
    }
    if (c.dimension === 'F') assert.ok(c.audio && ['melodique', 'accord', 'cadence'].includes(c.audio.mode), `audio manquant ${c.id}`);
    else if (c.dimension === 'G' && c.niveau === 2) assert.ok(c.audio && c.audio.mode === 'rythme' && c.audio.onsetsMs.length > 0, `audio manquant ${c.id}`);
    else if (c.dimension === 'I') assert.ok(c.audio, `audio manquant ${c.id}`);
    else assert.equal(c.audio, undefined);
    if (c.dimension === 'G') assert.equal(!!c.frappe, c.niveau >= 3, `frappe attendue seulement aux niveaux 3-4 : ${c.id}`);
  }
});

test('chaque niveau déclaré a au moins 12 cartes', () => {
  const comptes = [];
  for (const [dim, d] of Object.entries(DIMENSIONS)) {
    for (let n = 1; n <= d.niveaux; n++) {
      const k = cartesDuNiveau(dim, n).length;
      comptes.push(`${dim}${n}=${k}`);
      assert.ok(k >= 12, `${dim}${n} n'a que ${k} cartes`);
    }
  }
  console.log('cartes par niveau :', comptes.join(' '), '· total', catalogue().length);
});

test('cartes précises', () => {
  const c1 = carte('C1:G:7:tierce');
  assert.equal(c1.reponse, 'si');
  assert.match(c1.explication, /sol si ré fa/);
  assert.ok(c1.pieges.includes('si♭'));

  const b3 = carte('B3:Ab:7:notes');
  assert.equal(b3.reponse, 'la♭ do mi♭ sol♭');

  const b3n = carte('B3:Ab:7:nom');
  assert.equal(b3n.reponse, 'A♭7');
  assert.equal(b3n.enonce, 'la♭ do mi♭ sol♭ = ?');

  assert.equal(carte('D4:C:complet').reponse, 'Dm7♭5 – G7 – Cm');
  assert.equal(carte('D3:E:complet').reponse, 'F♯m7 – B7 – Emaj7');
  assert.equal(carte('D3:C:resout').reponse, 'Cmaj7');
  assert.equal(carte('A1:D:armure').reponse, '2 ♯');
  assert.equal(carte('A1:D:tonalite').reponse, 'ré majeur');
  assert.equal(carte('A1:C:armure').reponse, 'aucune');
  assert.equal(carte('A2:Eb:relative').reponse, 'do mineur');
  assert.equal(carte('A2:F#m:armure').reponse, '3 ♯');
  assert.equal(carte('A3:Ab:quinteSup').reponse, 'mi♭');
  assert.equal(carte('A3:Bb:V').reponse, 'fa');
  assert.equal(carte('B4:C:maj:renv1').reponse, 'C (1er renversement)');
  assert.equal(carte('B4:C:maj:renv1').enonce, 'mi sol do = ?');
  assert.equal(carte('C3:C:ii-V').reponse, 'si');
  assert.equal(carte('C3:C:V-I').reponse, 'mi');
  assert.equal(carte('D1:G:4').reponse, 'C');
  assert.equal(carte('D2:Eb:2:accord').reponse, 'Fm7');
  assert.equal(carte('D2:C:6:degre').reponse, 'vi');
  assert.equal(carte('D4:A:II').reponse, 'Bm7♭5');

  assert.equal(carte('E1:C:M3:note').reponse, 'mi');
  assert.ok(carte('E1:C:M3:note').pieges.includes('mi♭'));
  assert.equal(carte('E1:G:m7:nom').reponse, 'septième mineure');
  assert.equal(carte('E1:G:m7:nom').enonce, 'sol → fa : quel intervalle ?');
  assert.equal(carte('E2:Ab:M6:note').reponse, 'fa');
  assert.equal(carte('E3:renv:m3').reponse, 'sixte majeure');
  assert.equal(carte('E3:C:A4:note').reponse, 'fa♯');
  assert.ok(carte('E3:C:A4:note').pieges.includes('sol♭'));
  assert.equal(carte('E3:C:d5:nom').reponse, 'quinte diminuée');
  assert.equal(carte('E3:C:d5:nom').enonce, 'do → sol♭ : quel intervalle ?');

  assert.equal(carte('F1:C:P5').reponse, 'quinte juste');
  assert.deepEqual(carte('F1:C:P5').audio.mode, 'melodique');
  assert.equal(carte('F2:F:min').reponse, 'mineur');
  assert.equal(carte('F3:G:7').reponse, '7 (dominante)');
  assert.equal(carte('F4:C:II-V-i_mineur').reponse, 'II-V-i mineur');
  assert.equal(carte('F4:C:II-V-i_mineur').audio.accords.length, 3);
  assert.match(carte('F4:C:II-V-i_mineur').explication, /Dm7♭5 – G7 – Cm/);

  assert.equal(carte('G1:c4-4:compter').reponse, '1 et (2) et 3 4');
  assert.equal(carte('G1:c4-3:compter').reponse, '(1) et (2) et (3) et (4) et');
  assert.equal(carte('G1:valeur:np').reponse, '1 temps et demi');
  assert.equal(carte('G1:c4-2:completer').reponse, 'croche');
  assert.equal(carte('G1:c3-0:mesure').reponse, '3/4');
  const d = carte('G2:c4-5');
  assert.equal(d.reponse, 'n. c n. c · 4/4');
  assert.deepEqual(d.audio.onsetsMs.slice(0, 4), [0, 1125, 1500, 2625]);
  assert.equal(d.audio.onsetsMs.length, 8);
  assert.equal(carte('G3:c4-9').frappe.mains[0].swing, true);
  assert.equal(carte('G4:bossa:72').frappe.mains.length, 2);
  assert.equal(carte('G4:3contre2:96').frappe.temps, 3);

  assert.equal(carte('H1:sol:4').reponse, 'si4');
  assert.equal(carte('H1:sol:4').reponseClasse, 11);
  assert.equal(carte('H2:fa:6').reponse, 'fa3');
  assert.equal(carte('H1:sol:-2').reponse, 'do4');
  const h3 = catalogue().filter((c) => c.id.startsWith('H3:G:sol:'));
  assert.equal(h3.length, 3);
  assert.ok(h3.some((c) => c.reponse.startsWith('fa♯')), 'armure de sol : fa♯');
  assert.equal(carte('H3:acc:sol:3b').reponse, 'la♭4');
  assert.equal(carte('H4:int:sol:P5').reponse, 'quinte juste');
  assert.equal(carte('I1:C').chant.cibles[0], 48);
  assert.equal(carte('I2:C:P5').chant.cibles[0], 55);
  assert.deepEqual(carte('I2:C:P5').chant.noms, ['sol']);
  assert.equal(carte('I3:C:min:tierce').chant.noms[0], 'mi♭');
  assert.equal(carte('I4:0').chant.cibles.length, 3);
});

test('melangerChoix garde les 4 choix et mélange', () => {
  const c = carte('C1:G:7:tierce');
  let i = 0;
  const alea = () => [0.9, 0.1, 0.5, 0.3][i++ % 4];
  const choix = melangerChoix(c, alea);
  assert.equal(choix.length, 4);
  assert.deepEqual([...choix].sort(), [c.reponse, ...c.pieges].sort());
});

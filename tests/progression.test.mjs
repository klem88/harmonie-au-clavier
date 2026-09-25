import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGLES, seuils, etatInitial, normaliser, estDue, niveauMaitrise, composerSeance,
  enregistrerReponse, cloreSeance, bilan, FileSeance, mediane, tauxNiveau, etatDeblocage, delaiBoite, cartesDues, lireSauvegarde,
} from '../src/progression.js';
import { cartesDuNiveau, carte } from '../src/questions.js';

const JOUR = 86_400_000;
const J0 = Date.UTC(2026, 8, 22, 9);

test('mediane', () => {
  assert.equal(mediane([3, 1, 2]), 2);
  assert.equal(mediane([4, 1, 3, 2]), 2.5);
  assert.equal(mediane([]), null);
});

test('boîtes : faux → 0, juste rapide → +1, juste lent → inchangé, plafond 5', () => {
  const etat = etatInitial();
  const id = cartesDuNiveau('B', 1)[0].id;
  let r = enregistrerReponse(etat, id, true, 3000, J0);
  assert.equal(r.boiteAvant, 0); assert.equal(r.boiteApres, 1);
  assert.equal(etat.cartes[id].prochaine, J0 + 1 * JOUR);
  r = enregistrerReponse(etat, id, true, 8000, J0);
  assert.equal(r.boiteApres, 1);
  r = enregistrerReponse(etat, id, false, 2000, J0);
  assert.equal(r.boiteApres, 0);
  assert.equal(etat.cartes[id].prochaine, J0);
  for (let i = 0; i < 8; i++) r = enregistrerReponse(etat, id, true, 1000, J0 + i * JOUR);
  assert.equal(r.boiteApres, 5);
  assert.equal(etat.cartes[id].n, 11);
  assert.equal(etat.cartes[id].ok, 10);
  assert.equal(etat.cartes[id].temps.length, 5);
});

test('estDue', () => {
  assert.equal(estDue({ boite: 0, prochaine: J0 }, J0), true);
  assert.equal(estDue({ boite: 2, prochaine: J0 + JOUR }, J0), false);
  assert.equal(estDue({ boite: 2, prochaine: J0 - 1 }, J0), true);
});

test('déblocage du niveau suivant', () => {
  const ids = cartesDuNiveau('B', 1).map((c) => c.id);
  let etat = etatInitial();
  let debloque = null;
  for (let i = 0; i < 15; i++) debloque = enregistrerReponse(etat, ids[i], true, 2000, J0).debloque;
  assert.equal(debloque, 'B2');
  assert.equal(etat.niveaux.B, 2);
  // un 16e succès ne redéclenche pas
  assert.equal(enregistrerReponse(etat, ids[15], true, 2000, J0).debloque, null);

  etat = etatInitial();
  for (let i = 0; i < 14; i++) debloque = enregistrerReponse(etat, ids[i], true, 2000, J0).debloque;
  assert.equal(debloque, null);

  etat = etatInitial();
  for (let i = 0; i < 15; i++) debloque = enregistrerReponse(etat, ids[i], i < 3 ? false : true, 2000, J0).debloque;
  assert.equal(debloque, null);

  etat = etatInitial();
  for (let i = 0; i < 15; i++) debloque = enregistrerReponse(etat, ids[i], true, 6000, J0).debloque;
  assert.equal(debloque, null, 'trop lent');

  // dernier niveau : rien à débloquer
  etat = etatInitial(); etat.niveaux.A = 3;
  const a3 = cartesDuNiveau('A', 3).map((c) => c.id);
  for (let i = 0; i < 15; i++) debloque = enregistrerReponse(etat, a3[i], true, 2000, J0).debloque;
  assert.equal(debloque, null);
  assert.equal(etat.niveaux.A, 3);
});

test('seuils par dimension : D et F laissent plus de temps', () => {
  assert.equal(seuils('B').rapideMs, 7000);
  assert.equal(seuils('B').medianeMaxMs, 5500);
  assert.equal(seuils('D').rapideMs, 9000);
  assert.equal(seuils('D').medianeMaxMs, 7000);
  assert.equal(seuils('F').medianeMaxMs, 7000);
  // dimension inconnue : on retombe sur les valeurs par défaut
  assert.deepEqual(seuils('Z'), { rapideMs: REGLES.rapideMs, medianeMaxMs: REGLES.deblocage.medianeMaxMs });
  // rythme : les niveaux de frappe ont des seuils de précision en ms d'écart
  assert.equal(seuils('G', 1).rapideMs, 7000);
  assert.equal(seuils('G', 3).rapideMs, 80);
  assert.equal(seuils('G', 3).medianeMaxMs, 70);
  assert.equal(seuils('G', 4).rapideMs, 90);
  assert.deepEqual(seuils('G'), { rapideMs: 7000, medianeMaxMs: 5500 });
  assert.deepEqual(seuils('I', 2), { rapideMs: 35, medianeMaxMs: 30 });
  assert.deepEqual(seuils('H', 1), { rapideMs: REGLES.rapideMs, medianeMaxMs: REGLES.deblocage.medianeMaxMs });
});

test('frappe : la boîte monte selon la précision, déblocage G3 → G4 sur l’écart médian', () => {
  const etat = etatInitial(); etat.niveaux.G = 3;
  const g3 = cartesDuNiveau('G', 3).map((c) => c.id);
  assert.equal(enregistrerReponse(etat, g3[0], true, 120, J0).boiteApres, 0, '120 ms : juste mais imprécis');
  assert.equal(enregistrerReponse(etat, g3[1], true, 40, J0).boiteApres, 1);
  let debloque = null;
  for (let i = 0; i < 15; i++) debloque ||= enregistrerReponse(etat, g3[i % g3.length], true, 50, J0).debloque;
  assert.equal(debloque, 'G4');
});

test('mode silencieux : les cartes de chant sont exclues aussi', () => {
  const etat = etatInitial(); etat.niveaux.I = 4;
  assert.deepEqual(composerSeance(etat, J0, { dimension: 'I', sansAudio: true }), []);
  assert.ok(composerSeance(etat, J0, { dimension: 'I' }).every((id) => carte(id).chant));
});

test('sans micro : seules les cartes de chant sont exclues', () => {
  const etat = etatInitial(); etat.niveaux.I = 4; etat.niveaux.F = 2;
  assert.deepEqual(composerSeance(etat, J0, { dimension: 'I', sansChant: true }), []);
  assert.ok(composerSeance(etat, J0, { dimension: 'F', sansChant: true }).length > 0);
  const ids = composerSeance(etat, J0, { sansChant: true, taille: 200 });
  assert.ok(ids.every((id) => !carte(id).chant));
  for (const id of composerSeance(etat, J0, { dimension: 'I' })) enregistrerReponse(etat, id, true, 20, J0);
  const plusTard = J0 + 60 * 86400000;
  assert.ok(cartesDues(etat, plusTard) > 0);
  assert.equal(cartesDues(etat, plusTard, { sansChant: true }), 0);
});

test('mode silencieux : les cartes de frappe sont exclues aussi', () => {
  const etat = etatInitial(); etat.niveaux.G = 4;
  const ids = composerSeance(etat, J0, { dimension: 'G', sansAudio: true });
  assert.ok(ids.length > 0);
  for (const id of ids) { assert.equal(carte(id).frappe, undefined); assert.equal(carte(id).audio, undefined); }
  assert.ok(composerSeance(etat, J0, { dimension: 'G' }).some((id) => carte(id).frappe));
});

test('la boîte monte selon le seuil de la dimension', () => {
  const etat = etatInitial();
  const b = cartesDuNiveau('B', 1)[0].id;
  const d = cartesDuNiveau('D', 1)[0].id;
  assert.equal(enregistrerReponse(etat, b, true, 8000, J0).boiteApres, 0, 'B : 8 s trop lent');
  assert.equal(enregistrerReponse(etat, d, true, 8000, J0).boiteApres, 1, 'D : 8 s encore rapide');
});

test('déblocage : médiane comparée au seuil de la dimension', () => {
  const b = cartesDuNiveau('B', 1).map((c) => c.id);
  let etat = etatInitial();
  let debloque = null;
  for (let i = 0; i < 15; i++) debloque = enregistrerReponse(etat, b[i], true, 5000, J0).debloque;
  assert.equal(debloque, 'B2', '5 s passe en B (≤ 5,5 s)');

  const d = cartesDuNiveau('D', 1).map((c) => c.id);
  etat = etatInitial();
  for (let i = 0; i < 15; i++) debloque = enregistrerReponse(etat, d[i], true, 6800, J0).debloque;
  assert.equal(debloque, 'D2', '6,8 s passe en D (≤ 7 s)');
});

test('tauxNiveau : fenêtre glissante une fois pleine, cumul avant', () => {
  // cumul tant que la fenêtre n'a pas 15 réponses
  assert.equal(tauxNiveau({ n: 10, ok: 8, justes: new Array(10).fill(true) }), 0.8);
  assert.equal(tauxNiveau({ n: 0, ok: 0, justes: [] }), null);
  // état d'avant la fenêtre (pas de `justes`) : cumul
  assert.equal(tauxNiveau({ n: 20, ok: 15 }), 0.75);
  // fenêtre pleine : les vieilles erreurs ne comptent plus
  const justes = [...new Array(5).fill(false), ...new Array(15).fill(true)];
  assert.equal(tauxNiveau({ n: 100, ok: 50, justes }), 0.75);
  assert.equal(tauxNiveau({ n: 100, ok: 50, justes: new Array(20).fill(true) }), 1);
});

test('un mauvais départ ne bloque plus : la fenêtre se vide', () => {
  const ids = cartesDuNiveau('C', 1).map((c) => c.id);
  const etat = etatInitial();
  let debloque = null;
  // 10 erreurs au départ : le cumul tombe très bas
  for (let i = 0; i < 10; i++) enregistrerReponse(etat, ids[i], false, 3000, J0);
  assert.ok(etat.statsNiveaux.C1.ok / etat.statsNiveaux.C1.n < REGLES.deblocage.tauxMin);
  // puis 20 bonnes réponses rapides : la fenêtre ne contient plus que celles-là
  for (let i = 0; i < 20; i++) debloque ||= enregistrerReponse(etat, ids[i % ids.length], true, 3000, J0).debloque;
  assert.equal(debloque, 'C2');
});

test('etatDeblocage : ce qui manque pour le niveau suivant', () => {
  const etat = etatInitial();
  const ids = cartesDuNiveau('B', 1).map((c) => c.id);
  let e = etatDeblocage(etat, 'B');
  assert.equal(e.niveau, 1);
  assert.equal(e.suivant, 2);
  assert.equal(e.pret, false);
  assert.deepEqual(e.criteres.map((c) => c.cle), ['reponses', 'taux', 'vitesse']);
  assert.deepEqual(e.criteres.map((c) => c.fait), [false, false, false]);

  // juste mais trop lent : seule la vitesse manque
  for (let i = 0; i < 16; i++) enregistrerReponse(etat, ids[i], true, 9000, J0);
  e = etatDeblocage(etat, 'B');
  assert.deepEqual(e.criteres.map((c) => c.fait), [true, true, false]);
  assert.equal(e.criteres[2].valeur, 9000);
  assert.equal(e.criteres[2].cible, 5500);
  assert.equal(e.pret, false);

  // dernier niveau ouvert : plus rien à débloquer
  const fini = etatInitial(); fini.niveaux.A = 3;
  assert.equal(etatDeblocage(fini, 'A'), null);
});

test('composerSeance : état vide → 20 cartes de niveau 1, dimensions alternées', () => {
  const etat = etatInitial();
  const ids = composerSeance(etat, J0);
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20);
  for (const id of ids) assert.equal(carte(id).niveau, 1);
  assert.deepEqual([...new Set(ids.slice(0, 9).map((id) => carte(id).dimension))].sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
});

test('composerSeance : les cartes dues d’abord, la plus en retard en tête', () => {
  const etat = etatInitial();
  const [a, b, c] = cartesDuNiveau('C', 1).map((x) => x.id);
  etat.cartes[a] = { boite: 2, prochaine: J0 - 2 * JOUR, n: 1, ok: 1, temps: [] };
  etat.cartes[b] = { boite: 1, prochaine: J0 - 5 * JOUR, n: 1, ok: 1, temps: [] };
  etat.cartes[c] = { boite: 3, prochaine: J0 + JOUR, n: 1, ok: 1, temps: [] };
  const ids = composerSeance(etat, J0);
  assert.equal(ids[0], b);
  assert.equal(ids[1], a);
  assert.ok(!ids.includes(c));
});

test('composerSeance : une dimension, un niveau', () => {
  const etat = etatInitial(); etat.niveaux.C = 2;
  const ids = composerSeance(etat, J0, { dimension: 'C' });
  assert.equal(ids.length, 20);
  for (const id of ids) assert.equal(carte(id).dimension, 'C');
  assert.ok(ids.some((id) => carte(id).niveau === 2));
  const ids1 = composerSeance(etat, J0, { dimension: 'C', niveau: 1, taille: 10 });
  assert.equal(ids1.length, 10);
  for (const id of ids1) assert.equal(carte(id).niveau, 1);
});

test('composerSeance : révision des niveaux maîtrisés (~20 %)', () => {
  const etat = etatInitial(); etat.niveaux.A = 2;
  for (const c of cartesDuNiveau('A', 1)) etat.cartes[c.id] = { boite: 4, prochaine: J0 + 30 * JOUR, n: 5, ok: 5, temps: [] };
  assert.equal(niveauMaitrise(etat, 'A', 1), true);
  assert.equal(niveauMaitrise(etat, 'A', 2), false);
  const ids = composerSeance(etat, J0);
  const revisions = ids.filter((id) => carte(id).dimension === 'A' && carte(id).niveau === 1);
  assert.equal(revisions.length, 4);
});

test('FileSeance : réinsertion au plus 5 positions plus loin', () => {
  const f = new FileSeance(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.equal(f.suivante(), 'a');
  f.reinserer('a');
  const suite = [];
  for (let i = 0; i < 6; i++) suite.push(f.suivante());
  assert.deepEqual(suite, ['b', 'c', 'd', 'e', 'f', 'a']);
  assert.equal(f.total(), 9);
  const g = new FileSeance(['x', 'y']);
  g.suivante(); g.reinserer('x');
  assert.equal(g.suivante(), 'y');
  assert.equal(g.suivante(), 'x');
  assert.equal(g.suivante(), null);
  assert.equal(g.restantes(), 0);
  // une carte n'est réinsérée qu'une fois par séance
  const h = new FileSeance(['p', 'q']);
  h.suivante();
  assert.equal(h.reinserer('p'), true);
  assert.equal(h.reinserer('p'), false);
  assert.equal(h.total(), 3);
});

test('cloreSeance et bilan', () => {
  const etat = etatInitial();
  const ids = cartesDuNiveau('B', 1).map((c) => c.id);
  for (let i = 0; i < 5; i++) enregistrerReponse(etat, ids[i], true, 2000, J0);
  cloreSeance(etat, { n: 20, ok: 17, medianeMs: 2500, dimension: null }, J0);
  assert.equal(etat.seances.length, 1);
  assert.equal(etat.seances[0].date, J0);
  const b = bilan(etat);
  assert.equal(b.dimensions.B.niveauOuvert, 1);
  assert.equal(b.dimensions.B.niveaux[0].etat, 'ouvert');
  assert.equal(b.dimensions.B.niveaux[0].acquis, 0);
  assert.equal(b.dimensions.B.niveaux[0].total, 28);
  assert.equal(b.dimensions.B.niveaux[1].etat, 'verrouille');
  assert.equal(b.dimensions.B.seuils.rapideMs, 7000);
  assert.equal(b.dimensions.B.deblocage.suivant, 2);
  assert.equal(b.dimensions.B.deblocage.criteres[0].valeur, 5);
  assert.equal(b.seances.length, 1);
});

test('mode silencieux : aucune carte sonore, et la préférence survit à normaliser', () => {
  const etat = etatInitial();
  const ids = composerSeance(etat, J0, { sansAudio: true });
  assert.equal(ids.length, 20);
  for (const id of ids) assert.equal(carte(id).audio, undefined);
  assert.ok(ids.every((id) => carte(id).dimension !== 'F'));
  assert.deepEqual(composerSeance(etat, J0, { dimension: 'F', sansAudio: true }), []);
  assert.ok(composerSeance(etat, J0).some((id) => carte(id).dimension === 'F'));
  etat.prefs.silence = true;
  assert.equal(normaliser(JSON.parse(JSON.stringify(etat))).prefs.silence, true);
  assert.equal(normaliser({ version: 1 }).prefs.silence, false);
});

test('bilan : avancement gradué, qui bouge dès la première bonne réponse', () => {
  const etat = etatInitial();
  const ids = cartesDuNiveau('A', 1).map((c) => c.id);
  const total = ids.length;
  let n = bilan(etat).dimensions.A.niveaux[0];
  assert.equal(n.consolide, 0);
  assert.equal(n.consolideMax, total * REGLES.boiteAcquise);

  // une bonne réponse rapide : la carte est en boîte 1, donc 1/3 d'une carte
  enregistrerReponse(etat, ids[0], true, 2000, J0);
  n = bilan(etat).dimensions.A.niveaux[0];
  assert.equal(n.consolide, 1, 'la barre bouge alors qu’aucune carte n’est acquise');
  assert.equal(n.acquis, 0);
  assert.equal(n.vues, 1);

  // montée jusqu'à la boîte 5 : plafonnée à « acquise » dans le calcul
  for (let j = 1; j <= 5; j++) enregistrerReponse(etat, ids[0], true, 2000, J0 + j * 40 * JOUR);
  assert.equal(etat.cartes[ids[0]].boite, 5);
  n = bilan(etat).dimensions.A.niveaux[0];
  assert.equal(n.consolide, REGLES.boiteAcquise);
  assert.equal(n.acquis, 1);
});

test('delaiBoite : le calendrier des révisions', () => {
  assert.equal(delaiBoite(0), 0);
  assert.equal(delaiBoite(1), 1);
  assert.equal(delaiBoite(3), 7);
  assert.equal(delaiBoite(REGLES.boiteMax), 35);
});

test('normaliser : un état gelé (snapshot de la base) redevient modifiable', () => {
  const geler = (o) => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(geler); } return o; };
  const source = etatInitial();
  const id = cartesDuNiveau('A', 1)[0].id;
  enregistrerReponse(source, id, true, 2000, J0);
  cloreSeance(source, { n: 1, ok: 1, medianeMs: 2000 }, J0);
  const etat = normaliser(geler(JSON.parse(JSON.stringify(source))));
  assert.doesNotThrow(() => {
    enregistrerReponse(etat, id, true, 2000, J0 + JOUR);
    cloreSeance(etat, { n: 1, ok: 1, medianeMs: 2000 }, J0 + JOUR);
  });
  assert.equal(etat.cartes[id].n, 2);
  assert.equal(etat.seances.length, 2);
  assert.equal(etat.statsNiveaux.A1.n, 2);
});

test('normaliser', () => {
  assert.deepEqual(normaliser({}), etatInitial());
  assert.deepEqual(normaliser(null), etatInitial());
  assert.deepEqual(normaliser({ version: 99 }), etatInitial());
  const e = etatInitial(); e.niveaux.B = 3;
  assert.deepEqual(normaliser(JSON.parse(JSON.stringify(e))), e);
  assert.equal(REGLES.tailleSeance, 20);
});

test('état : déchiffrage et préférence du clic, y compris depuis un ancien état', () => {
  const e = etatInitial();
  assert.equal(e.dechiffrage.niveau, 1);
  assert.equal(e.prefs.clic, false);
  const ancien = normaliser({ version: 1, cartes: {}, niveaux: { A: 2 }, seances: [], prefs: { silence: true } });
  assert.deepEqual(ancien.dechiffrage, etatInitial().dechiffrage);
  assert.equal(ancien.prefs.silence, true);
  assert.equal(ancien.prefs.clic, false);
  const garde = normaliser({ ...etatInitial(), dechiffrage: { niveau: 2, bpm: { 1: 72, 2: 60, 3: 60 }, historique: [{ niveau: 1 }] } });
  assert.equal(garde.dechiffrage.niveau, 2);
  assert.equal(garde.dechiffrage.historique.length, 1);
});

test('lireSauvegarde : accepte un export, refuse le reste', () => {
  const e = etatInitial(); e.niveaux.B = 3;
  const ok = lireSauvegarde(JSON.stringify(e));
  assert.equal(ok.ok, true);
  assert.equal(ok.etat.niveaux.B, 3);
  assert.equal(lireSauvegarde('pas du json').ok, false);
  assert.equal(lireSauvegarde('{"version":2}').ok, false);
  assert.match(lireSauvegarde('[]').erreur, /sauvegarde/);
});

test('lireSauvegarde : messages d’erreur avec apostrophe typographique', () => {
  assert.equal(lireSauvegarde('pas du json').erreur, 'Texte illisible : colle l’export complet, du premier { au dernier }.');
  assert.equal(lireSauvegarde('[]').erreur, 'Ce texte n’est pas une sauvegarde de l’app.');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGLES_DECHIFFRAGE, etatDechiffrageInitial, normaliserDechiffrage, enregistrerPiece, etatDeblocageDechiffrage } from '../src/dechiffrage.js';

const J0 = Date.UTC(2026, 8, 25, 9);
const resultat = (reussi) => ({ justes: reussi ? 16 : 10, total: 16, ecartMedianMs: 40, arrets: reussi ? [] : [3], reussi });
const etatNeuf = () => ({ dechiffrage: etatDechiffrageInitial() });
const jouer = (etat, niveau, reussi) => enregistrerPiece(etat, { niveau, graine: 1, bpm: etat.dechiffrage.bpm[niveau], resultat: resultat(reussi) }, J0);

test('état initial et normalisation', () => {
  assert.deepEqual(etatDechiffrageInitial(), { niveau: 1, bpm: { 1: 60, 2: 60, 3: 60 }, historique: [] });
  assert.deepEqual(normaliserDechiffrage(undefined), etatDechiffrageInitial());
  assert.deepEqual(normaliserDechiffrage({ niveau: 9, bpm: { 2: 72 }, historique: 'x' }), { niveau: 1, bpm: { 1: 60, 2: 72, 3: 60 }, historique: [] });
  assert.equal(normaliserDechiffrage({ niveau: 2, bpm: {}, historique: [] }).niveau, 2);
});

test('normaliserDechiffrage : bpm importé hors bornes ramené dans [bpmMin, bpmMax]', () => {
  assert.deepEqual(normaliserDechiffrage({ niveau: 1, bpm: { 1: 0, 2: 500 }, historique: [] }).bpm, { 1: 50, 2: 96, 3: 60 });
});

test('tempo : +6 après une réussite, −6 après un échec, bornes 50–96', () => {
  const e = etatNeuf();
  assert.equal(jouer(e, 1, true).bpmApres, 66);
  assert.equal(jouer(e, 1, false).bpmApres, 60);
  e.dechiffrage.bpm[1] = 94; assert.equal(jouer(e, 1, true).bpmApres, 96);
  e.dechiffrage.bpm[1] = 52; assert.equal(jouer(e, 1, false).bpmApres, 50);
  assert.equal(e.dechiffrage.historique.length, 4);
  assert.deepEqual(e.dechiffrage.historique[0], { date: J0, niveau: 1, graine: 1, bpm: 60, justes: 16, total: 16, ecartMs: 40, arrets: 0, reussi: true });
});

test('déblocage : 6 réussites sur les 8 dernières pièces du niveau', () => {
  const e = etatNeuf();
  jouer(e, 1, false); jouer(e, 1, false);
  for (let i = 0; i < 5; i++) assert.equal(jouer(e, 1, true).debloque, null);
  assert.deepEqual(etatDeblocageDechiffrage(e), { niveau: 1, suivant: 2, reussites: 5, jouees: 7, cible: 6, fenetre: 8, pret: false });
  assert.equal(jouer(e, 1, true).debloque, 2);
  assert.equal(e.dechiffrage.niveau, 2);
  assert.equal(etatDeblocageDechiffrage(e).reussites, 0, 'le niveau 2 repart de zéro');
});

test('trois échecs dans la fenêtre : pas de déblocage', () => {
  const e = etatNeuf();
  for (const r of [true, false, true, false, true, false, true, true]) jouer(e, 1, r);
  assert.equal(e.dechiffrage.niveau, 1);
});

test('dernier niveau : plus rien à débloquer ; historique plafonné', () => {
  const e = etatNeuf(); e.dechiffrage.niveau = 3;
  assert.equal(etatDeblocageDechiffrage(e), null);
  for (let i = 0; i < 105; i++) assert.equal(jouer(e, 3, true).debloque, null);
  assert.equal(e.dechiffrage.historique.length, REGLES_DECHIFFRAGE.historiqueMax);
});

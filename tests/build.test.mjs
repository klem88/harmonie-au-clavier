import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assembler } from '../build.mjs';

test('build : une seule page, sans import/export, avec titre et style', () => {
  const page = assembler();
  const disque = readFileSync(new URL('../dist/harmonie.html', import.meta.url), 'utf8');
  assert.equal(page, disque);
  assert.ok(page.includes('<title>Harmonie au clavier</title>'));
  assert.ok(!/^\s*import\s/m.test(page), 'import résiduel');
  assert.ok(!/^\s*export\s/m.test(page), 'export résiduel');
  assert.ok(!page.includes('src/style.css'));
  assert.ok(!page.includes('src/interface.js'));
  assert.ok(page.includes('--accent:'));
  assert.ok(page.length < 16 * 1024 * 1024);
  const artefact = readFileSync(new URL('../dist/harmonie-artefact.html', import.meta.url), 'utf8');
  assert.ok(artefact.startsWith('<title>Harmonie au clavier</title>'));
  assert.ok(!artefact.includes('<!doctype') && !artefact.includes('<body>') && !artefact.includes('<meta'));
  assert.ok(artefact.includes('id="ecran-accueil"') && artefact.includes('<style>'));
  const index = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.equal(index, page);
  for (const f of ['genererPiece', 'partitionSvg', 'detecterAttaques', 'aligner', 'enregistrerPiece']) assert.ok(page.includes(`function ${f}(`), `${f} absent de la page`);
});

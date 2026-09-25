// Assemble index.html + src/*.css + src/*.js en une seule page : dist/harmonie.html
// Les modules sont concaténés dans l'ordre des dépendances ; les imports et le mot-clé export sont retirés.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = dirname(fileURLToPath(import.meta.url));
const ORDRE = ['theorie', 'rythme', 'portee', 'voix', 'piece', 'partition', 'ecoute', 'questions', 'dechiffrage', 'progression', 'stockage', 'clavier', 'audio', 'interface'];

export function assembler() {
  const html = readFileSync(join(racine, 'index.html'), 'utf8');
  const css = readFileSync(join(racine, 'src/style.css'), 'utf8');
  const js = ORDRE.map((m) => {
    const src = readFileSync(join(racine, `src/${m}.js`), 'utf8')
      .replace(/^import[\s\S]*?from\s+'[^']+';\s*$/gm, '')
      .replace(/^export\s+/gm, '');
    return `// ===== ${m}.js =====\n${src}`;
  }).join('\n');
  verifierDoublons(js);
  const page = html
    .replace('<link rel="stylesheet" href="src/style.css">', `<style>\n${css}</style>`)
    .replace('<script type="module" src="src/interface.js"></script>', `<script>\n(() => {\n${js}\n})();\n</script>`);
  mkdirSync(join(racine, 'dist'), { recursive: true });
  writeFileSync(join(racine, 'dist/harmonie.html'), page);
  writeFileSync(join(racine, 'dist/index.html'), page); // page publiée sur GitHub Pages
  // Version pour la page claude.ai : le squelette (doctype, html, head, body) est ajouté à la publication.
  const tete = page.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, '');
  const corps = page.match(/<body>([\s\S]*?)<\/body>/)[1];
  writeFileSync(join(racine, 'dist/harmonie-artefact.html'), `${tete.trim()}\n${corps.trim()}\n`);
  return page;
}

function verifierDoublons(js) {
  const noms = new Map();
  for (const m of js.matchAll(/^(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    noms.set(m[1], (noms.get(m[1]) || 0) + 1);
  }
  const doublons = [...noms].filter(([, n]) => n > 1).map(([k]) => k);
  if (doublons.length) throw new Error(`Déclarations en double entre modules : ${doublons.join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const page = assembler();
  console.log(`dist/harmonie.html : ${(page.length / 1024).toFixed(0)} Ko`);
}

// Fabrique les pages du site à partir de sources/contenu.json (aperçu sur ce poste).
// En ligne, Vercel fabrique les mêmes pages à la demande, avec le contenu de la base Neon.
// Usage : node scripts/generer.mjs [dossier de sortie, par défaut site/]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerRendu } from '../lib/rendu.js';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sortie = resolve(process.argv[2] || join(racine, 'site'));
const contenu = JSON.parse(readFileSync(join(racine, 'sources', 'contenu.json'), 'utf8'));

console.log(`Génération du site NOLOUT dans ${sortie}`);
const pages = creerRendu(contenu).rendreTout();
for (const [chemin, html] of pages) {
  const fichier = join(sortie, chemin);
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, html, 'utf8');
  console.log(`  ${chemin}`);
}
console.log(`Terminé : ${pages.length} pages générées.`);

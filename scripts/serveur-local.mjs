// Aperçu local qui imite Vercel : fichiers de site/ d'abord, puis fonctions api/, puis pages
// fabriquées par api/page.js. Sans DATABASE_URL, le contenu vient de sources/contenu.json.
// Usage : node scripts/serveur-local.mjs [port, 3000 par défaut]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(racine, 'site');
const port = Number(process.argv[2]) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon',
};

// Réponse enrichie comme sur Vercel : res.status(), res.json(), res.send()
function enrichir(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (objet) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(objet)); return res; };
  res.send = (corps) => { res.end(corps); return res; };
  return res;
}

async function fichierStatique(chemin) {
  let fichier = normalize(join(site, decodeURIComponent(chemin)));
  if (!fichier.startsWith(site + sep) && fichier !== site) return null;
  try {
    let s = await stat(fichier);
    if (s.isDirectory()) { fichier = join(fichier, 'index.html'); s = await stat(fichier); }
    return s.isFile() ? fichier : null;
  } catch { return null; }
}

async function appelerFonction(nom, req, res) {
  const module = await import(pathToFileURL(join(racine, 'api', `${nom}.js`)).href + `?t=${Date.now()}`);
  let brut = '';
  for await (const morceau of req) brut += morceau;
  req.body = brut && /json/.test(req.headers['content-type'] || '') ? JSON.parse(brut) : brut;
  return module.default(req, res);
}

createServer(async (req, res) => {
  enrichir(res);
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    const fichier = await fichierStatique(url.pathname);
    if (fichier && !url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', TYPES[extname(fichier)] || 'application/octet-stream');
      return res.end(await readFile(fichier));
    }
    const fonction = url.pathname.match(/^\/api\/([\w/-]+)$/);
    if (fonction) {
      try { await stat(join(racine, 'api', `${fonction[1]}.js`)); } catch { return res.status(404).send('404'); }
      return await appelerFonction(fonction[1], req, res);
    }
    req.url = `/api/page?chemin=${encodeURIComponent(url.pathname)}`;
    return await appelerFonction('page', req, res);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).send('500 - ' + erreur.message);
  } finally {
    console.log(`${res.statusCode} ${req.method} ${url.pathname}`);
  }
}).listen(port, () => console.log(`Aperçu NOLOUT : http://localhost:${port}/`));

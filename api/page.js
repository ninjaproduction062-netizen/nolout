// Pages publiques du site, fabriquées à la demande à partir du contenu publié (base Neon),
// puis gardées en cache par Vercel : une modification publiée apparaît en une minute environ.
// vercel.json envoie ici toute adresse qui n'est pas un fichier (images, vidéo, feuilles de style…).
import { creerRendu } from '../lib/rendu.js';
import { lireContenu, contenuInitial } from '../lib/contenu.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://site');
  const chemin = url.searchParams.get('chemin') || '/';

  // Adresse sans barre finale (« /contact ») : les liens des pages sont relatifs, on redirige vers « /contact/ »
  if (!chemin.endsWith('/') && !/\.[a-z0-9]{1,5}$/i.test(chemin)) {
    res.setHeader('Location', chemin + '/');
    return res.status(308).end();
  }

  // X-Nolout-Contenu indique d'où vient le contenu : « base » (Neon) ou le contenu initial de secours
  let contenu;
  let source = process.env.DATABASE_URL ? 'base' : 'initial-sans-base';
  try {
    contenu = await lireContenu('publie');
  } catch (erreur) {
    // Base momentanément injoignable : le site reste en ligne avec le contenu initial
    console.error('Lecture du contenu impossible :', erreur);
    contenu = contenuInitial;
    source = 'initial-erreur';
  }

  const rendu = creerRendu(contenu);
  const html = rendu.rendreAdresse(chemin);
  res.setHeader('X-Nolout-Contenu', source);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=60, stale-while-revalidate=86400');
  if (html === null) return res.status(404).send(rendu.page404());
  return res.status(200).send(html);
}

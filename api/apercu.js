// Aperçu du brouillon : /apercu/… montre le site tel qu'il sera après « Publier ».
// Réservé aux membres de l'équipe connectés à l'administration ; jamais mis en cache ni indexé.
// Les liens entre pages restent relatifs, donc la visite se poursuit dans l'aperçu ;
// les fichiers (feuilles de style, images, vidéos) sont pris à la racine du site.
import { base, preparerBase } from '../lib/base.js';
import { compteConnecte } from '../lib/auth.js';
import { lireContenu } from '../lib/contenu.js';
import { creerRendu } from '../lib/rendu.js';

// Fine bande « Aperçu » en bas de l'écran (au-dessus de la barre d'action sur téléphone) :
// elle ne cache ni les titres ni les commandes ; la page et le bouton des cookies remontent d'autant
const STYLE = `<style>
.nl-apercu{position:fixed;z-index:60;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:0 12px;min-height:34px;padding:7px 12px;background:#E9A825;color:#061120;font:500 13px/18px Poppins,"Segoe UI",system-ui,sans-serif;text-align:center;box-shadow:0 -6px 20px rgba(0,0,0,.3)}
.nl-apercu strong{font:800 12px/18px Montserrat,"Segoe UI",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.nl-apercu a{color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:3px}
body{padding-bottom:34px}
.nl-cookies,.nl-cookies-badge{bottom:50px}
@media (max-width:767.98px){
.nl-apercu{bottom:calc(69px + env(safe-area-inset-bottom,0px))}
body{padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))}
.nl-cookies,.nl-cookies-badge{bottom:calc(116px + env(safe-area-inset-bottom,0px))}
}
</style>`;
const BANDE = '<div class="nl-apercu" role="status"><strong>Aperçu</strong><span>pas encore en ligne</span><a href="/admin/#contenus">Retour à l’administration</a></div>';

function pageSimple(titre, texte) {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${titre} — NOLOUT</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#061120;color:#fff;font:16px/1.6 Poppins,'Segoe UI',system-ui,sans-serif">
<main style="max-width:420px;padding:24px;text-align:center"><h1 style="font-size:22px">${titre}</h1><p style="color:#C8CCD1">${texte}</p><p><a href="/admin/" style="color:#F2C14E">Ouvrir l’administration</a></p></main>
</body>
</html>`;
}

// Page de l'aperçu : fichiers à la racine du site, bande « Aperçu », pas d'indexation.
// Le style vient après la feuille du site, pour la compléter.
function marquerApercu(html) {
  return html
    .replace(/((?:src|href|poster)=")(?:\.\.\/)*assets\//g, '$1/assets/')
    .replace(/(data-pub-liste=")([^"]*)"/g, (_, debut, liste) => `${debut}${liste.replace(/(^|\s)(?:\.\.\/)*assets\//g, '$1/assets/')}"`)
    .replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">')
    .replace('</head>', `${STYLE}\n</head>`)
    .replace('<body>', `<body>\n${BANDE}`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const chemin = new URL(req.url, 'http://site').searchParams.get('chemin') || '';
  // « /apercu » ou « /apercu/contact » : les liens des pages sont relatifs, il faut la barre finale
  if (!chemin.endsWith('/')) {
    res.setHeader('Location', `/apercu${chemin}/`);
    return res.status(308).end();
  }

  const sql = base();
  if (!sql) return res.status(503).send(pageSimple('Aperçu indisponible', 'La base de données n’est pas reliée.'));
  try {
    await preparerBase(sql);
    if (!(await compteConnecte(sql, req))) {
      return res.status(401).send(pageSimple('Aperçu réservé à l’équipe', 'Connectez-vous à l’administration, puis ouvrez l’aperçu depuis l’onglet « Contenus ».'));
    }
    const rendu = creerRendu(await lireContenu('brouillon'));
    const html = rendu.rendreAdresse(chemin);
    if (html === null) return res.status(404).send(marquerApercu(rendu.page404()));
    return res.status(200).send(marquerApercu(html));
  } catch (erreur) {
    console.error('Aperçu :', erreur);
    return res.status(500).send(pageSimple('Aperçu impossible', 'Le brouillon n’a pas pu être affiché. Réessayez dans un instant.'));
  }
}

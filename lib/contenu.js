// Contenu du site (même structure que sources/contenu.json), gardé dans la base Neon.
// Au tout premier appel, la base reçoit le contenu de sources/contenu.json.
// L'administration modifie le « brouillon » ; « Publier » le recopie dans « publie », la version en ligne.
import contenuInitial from '../sources/contenu.json' with { type: 'json' };
import { base, preparerBase } from './base.js';
import { creerRendu, lienAutorise, NOMBRE_ANIME } from './rendu.js';
import { MIGRATIONS } from './migrations.js';

export { contenuInitial };

// Étiquette de cache des pages publiques (en-tête Vercel-Cache-Tag de api/page.js)
export const ETIQUETTE_PAGES = 'pages';

// Contenu « publie » (en ligne) ou « brouillon » ; contenu initial si la base n'est pas reliée
export async function lireContenu(cle = 'publie') {
  const sql = base();
  if (!sql) return contenuInitial;
  await preparerBase(sql);
  let lignes = await sql`SELECT valeur FROM contenus WHERE cle = ${cle}`;
  if (!lignes.length) {
    const json = JSON.stringify(contenuInitial);
    await sql`INSERT INTO contenus (cle, valeur, modifie_par)
              VALUES ('publie', ${json}::json, 'installation'), ('brouillon', ${json}::json, 'installation')
              ON CONFLICT (cle) DO NOTHING`;
  }
  if ((await appliquerMigrations(sql)) || !lignes.length) lignes = await sql`SELECT valeur FROM contenus WHERE cle = ${cle}`;
  return lignes.length ? lignes[0].valeur : contenuInitial;
}

// Changements de lib/migrations.js pas encore appliqués : chacun est appliqué au contenu en ligne
// (l'ancienne version part dans l'historique) et au brouillon, puis noté. Chaque écriture n'a lieu
// que si la ligne n'a pas bougé depuis sa lecture ; sinon, nouvel essai à l'appel suivant.
// Renvoie true si le contenu a changé.
const AUTEUR_MIGRATIONS = 'la mise à jour du site';
let migrationsAJour = false;

async function appliquerMigrations(sql) {
  if (migrationsAJour || !MIGRATIONS.length) return false;
  const faites = new Set((await sql`SELECT id, cle FROM contenus_migrations`).map((l) => `${l.id} ${l.cle}`));
  let change = false;
  let reste = false;
  for (const migration of MIGRATIONS) {
    for (const cle of ['publie', 'brouillon']) {
      if (faites.has(`${migration.id} ${cle}`)) continue;
      const [ligne] = await sql`SELECT valeur, version FROM contenus WHERE cle = ${cle}`;
      if (!ligne) { reste = true; continue; }
      const contenu = JSON.parse(JSON.stringify(ligne.valeur));
      if (!migration.appliquer(contenu)) {
        // Rien à changer (valeur déjà modifiée dans l'administration, par exemple) : c'est noté
        await sql`INSERT INTO contenus_migrations (id, cle) VALUES (${migration.id}, ${cle}) ON CONFLICT DO NOTHING`;
        continue;
      }
      const problemes = verifierContenu(contenu);
      if (problemes.length) {
        console.error(`Changement ${migration.id} non appliqué (${cle}) :`, problemes.join(' '));
        reste = true;
        continue;
      }
      const json = JSON.stringify(contenu);
      const notees = cle === 'publie'
        ? await sql`
            WITH ancien AS (SELECT valeur, modifie_le, modifie_par FROM contenus WHERE cle = 'publie' AND version = ${ligne.version}),
                 maj AS (UPDATE contenus SET valeur = ${json}::json, version = version + 1, modifie_le = now(), modifie_par = ${AUTEUR_MIGRATIONS}
                         WHERE cle = 'publie' AND version = ${ligne.version} RETURNING cle),
                 archive AS (INSERT INTO contenus_historique (valeur, publie_le, publie_par)
                             SELECT valeur, modifie_le, modifie_par FROM ancien WHERE EXISTS (SELECT 1 FROM maj))
            INSERT INTO contenus_migrations (id, cle) SELECT ${migration.id}, cle FROM maj
            ON CONFLICT DO NOTHING RETURNING id`
        : await sql`
            WITH maj AS (UPDATE contenus SET valeur = ${json}::json, version = version + 1, modifie_le = now(), modifie_par = ${AUTEUR_MIGRATIONS}
                         WHERE cle = 'brouillon' AND version = ${ligne.version} RETURNING cle)
            INSERT INTO contenus_migrations (id, cle) SELECT ${migration.id}, cle FROM maj
            ON CONFLICT DO NOTHING RETURNING id`;
      if (notees.length) change = true;
      else reste = true;
    }
  }
  migrationsAJour = !reste;
  if (change) await viderCachePages();
  return change;
}

// Vide le cache des pages chez Vercel juste après une publication : la visite suivante fabrique
// chaque page avec le nouveau contenu. Même mécanisme que dangerouslyDeleteByTag de
// @vercel/functions, sans ses dépendances. Hors de Vercel, ou en cas d'échec, les pages
// se mettent à jour d'elles-mêmes en une minute (durée du cache).
export async function viderCachePages() {
  try {
    const contexte = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
    if (!contexte?.purge) return false;
    await contexte.purge.dangerouslyDeleteByTag(ETIQUETTE_PAGES);
    return true;
  } catch (erreur) {
    console.error('Cache des pages non vidé :', erreur);
    return false;
  }
}

// ── Vérification d'un contenu avant de l'enregistrer ou de le publier ─────────
// Les textes sont libres : ils sont toujours échappés à l'affichage. Les champs techniques
// (codes, couleurs, fichiers, liens) doivent garder une forme sûre. Enfin, toutes les pages
// doivent pouvoir être fabriquées avec ce contenu.

const TAILLE_MAX = 500_000; // caractères, pour tout le contenu
const TEXTE_MAX = 5_000;
const LISTE_MAX = 100;
const MOTIFS = {
  code: /^[a-z]{2,12}$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  couleur: /^#[0-9a-f]{3,8}$/i,
  rgb: /^\d{1,3},\d{1,3},\d{1,3}$/,
  fond: /^[#\w\s(),.%-]*$/,
  fichier: /^(?:https:\/\/[^\s"'<>\\]+|[\w-][\w\-./]*)$/,
  email: /^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]{2,}$/,
  numero: /^[\d\s+().-]{6,25}$/,
  adresseWeb: /^https?:\/\/[^\s"'<>]+$/i,
  api: /^\/api\/[\w-]+$/,
};

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const liste = (v) => (Array.isArray(v) ? v : []);

// Liste des problèmes trouvés (phrases en français), vide si le contenu est bon
export function verifierContenu(C) {
  const erreurs = [];
  const signaler = (message) => { if (!erreurs.includes(message)) erreurs.push(message); };
  if (!estObjet(C)) return ['Contenu illisible.'];
  if (JSON.stringify(C).length > TAILLE_MAX) return ['Contenu trop volumineux.'];

  (function parcourir(valeur, chemin, profondeur) {
    if (profondeur > 8) return signaler(`Contenu trop imbriqué : ${chemin}.`);
    if (typeof valeur === 'string') {
      if (valeur.length > TEXTE_MAX) signaler(`Texte trop long : ${chemin}.`);
    } else if (Array.isArray(valeur)) {
      if (valeur.length > LISTE_MAX) signaler(`Liste trop longue : ${chemin}.`);
      valeur.forEach((v, i) => parcourir(v, `${chemin}[${i + 1}]`, profondeur + 1));
    } else if (estObjet(valeur)) {
      for (const [cle, v] of Object.entries(valeur)) parcourir(v, chemin ? `${chemin}.${cle}` : cle, profondeur + 1);
    } else if (valeur !== null && typeof valeur !== 'number' && typeof valeur !== 'boolean') {
      signaler(`Valeur non prise en charge : ${chemin}.`);
    }
  })(C, '', 0);

  const G = C.groupe;
  const A = C.accueil;
  if (!estObjet(G)) signaler('Coordonnées du groupe manquantes.');
  if (!estObjet(A)) signaler('Contenu de l’accueil manquant.');
  if (!Array.isArray(C.departements) || !C.departements.length) signaler('Liste des départements manquante.');
  if (erreurs.length) return erreurs;

  const fichier = (valeur, ou) => { if (valeur && !MOTIFS.fichier.test(String(valeur))) signaler(`${ou} : nom de fichier invalide.`); };
  const fond = (valeur, ou) => { if (valeur && !MOTIFS.fond.test(String(valeur))) signaler(`${ou} : couleur de fond invalide.`); };
  const email = (valeur, ou) => { if (!MOTIFS.email.test(String(valeur || ''))) signaler(`${ou} : adresse e-mail invalide.`); };
  const numero = (valeur, ou) => { if (valeur && !MOTIFS.numero.test(String(valeur))) signaler(`${ou} : numéro invalide (chiffres, espaces et + uniquement).`); };

  // Coordonnées du groupe
  email(G.email, 'Coordonnées');
  numero(G.telephone, 'Coordonnées, téléphone');
  numero(G.whatsapp, 'Coordonnées, WhatsApp');
  if (G.itineraire && !MOTIFS.adresseWeb.test(String(G.itineraire))) signaler('Coordonnées : le lien de l’itinéraire doit commencer par https://');
  if (G.formulaireEndpoint && !MOTIFS.api.test(String(G.formulaireEndpoint))) signaler('Adresse d’envoi du formulaire invalide.');

  // Départements
  const codes = new Set();
  C.departements.forEach((d, i) => {
    const ou = (estObjet(d) && d.nom) || `Département ${i + 1}`;
    if (!estObjet(d)) return signaler(`${ou} : illisible.`);
    if (!MOTIFS.code.test(String(d.code || '')) || codes.has(d.code)) signaler(`${ou} : code interne invalide.`);
    codes.add(d.code);
    if (!MOTIFS.slug.test(String(d.slug || ''))) signaler(`${ou} : adresse de page invalide.`);
    if (!MOTIFS.couleur.test(String(d.base || '')) || !MOTIFS.couleur.test(String(d.clair || '')) || !MOTIFS.rgb.test(String(d.rgb || ''))) {
      signaler(`${ou} : couleurs invalides.`);
    }
    if (!Number.isFinite(Number(d.orbite))) signaler(`${ou} : position sur le schéma de l’accueil invalide.`);
    email(d.email, ou);
    numero(d.telephone, `${ou}, téléphone`);
    numero(d.whatsapp, `${ou}, WhatsApp`);
    if (d.image !== undefined && !estObjet(d.image)) signaler(`${ou} : image illisible.`);
    else if (d.image) {
      fichier(d.image.fichier, `${ou}, image`);
      fond(d.image.fond, `${ou}, image`);
    }
    liste(d.references && d.references.photos).forEach((p, n) => fichier(p && p.fichier, `${ou}, photo ${n + 1}`));
    if (d.galerie !== undefined && !Array.isArray(d.galerie)) signaler(`${ou} : galerie illisible.`);
    liste(d.galerie).forEach((p, n) => {
      if (!estObjet(p) || !p.fichier) return signaler(`${ou}, galerie, photo ${n + 1} : fichier manquant.`);
      fichier(p.fichier, `${ou}, galerie, photo ${n + 1}`);
    });
  });
  if (C.realisations !== undefined && !estObjet(C.realisations)) signaler('Page Réalisations : contenu illisible.');

  // Menu et pages en préparation : adresses fixes
  liste(C.navigation).forEach((n, i) => {
    if (!estObjet(n) || (!n.megamenu && !MOTIFS.slug.test(String(n.page || '')))) signaler(`Menu, lien ${i + 1} : page invalide.`);
  });
  liste(C.pagesEnPreparation).forEach((p, i) => {
    if (!estObjet(p) || !MOTIFS.slug.test(String(p.page || ''))) signaler(`Page en préparation ${i + 1} : adresse invalide.`);
  });

  // Accueil
  liste(A.chiffres).forEach((c, i) => {
    if (estObjet(c) && c.compteur && !NOMBRE_ANIME.test(String(c.valeur ?? '').trim())) {
      signaler(`Chiffre clé ${i + 1} : le comptage ne fonctionne qu’avec un nombre entier, avec un signe si besoin (ex. 120, +40 ou 98 %). Saisissez un nombre ou décochez « Compter depuis 0 ».`);
    }
  });
  liste(A.realisations).forEach((r, i) => {
    if (!estObjet(r) || !codes.has(r.departement)) return signaler(`Réalisation ${i + 1} : choisissez un département.`);
    fichier(r.image, `Réalisation ${i + 1}, photo`);
  });
  liste(A.temoignages).forEach((t, i) => {
    if (!estObjet(t) || !codes.has(t.departement)) signaler(`Témoignage ${i + 1} : choisissez un département.`);
  });
  liste(estObjet(A.partenaires) ? A.partenaires.logos : []).forEach((l, i) => {
    if (!estObjet(l)) return signaler(`Logo ${i + 1} : illisible.`);
    fichier(l.fichier, `Logo ${i + 1}`);
    fond(l.fond, `Logo ${i + 1}`);
  });
  const pub = estObjet(A.pub) ? A.pub : {};
  liste(pub.videos).forEach((v, i) => {
    if (!estObjet(v)) return signaler(`Vidéo ${i + 1} : illisible.`);
    fichier(v.fichier, `Vidéo ${i + 1}`);
    fichier(v.affiche, `Vidéo ${i + 1}, image d’attente`);
  });
  if (estObjet(pub.lien) && pub.lien.href && !lienAutorise(pub.lien.href)) {
    signaler('Publicité : adresse du lien refusée. Indiquez une page du site (ex. contact/) ou une adresse qui commence par https://');
  }

  // Enfin, toutes les pages doivent pouvoir être fabriquées
  if (!erreurs.length) {
    try {
      const rendu = creerRendu(C);
      rendu.rendreTout();
      rendu.page404();
    } catch (erreur) {
      signaler(`Une page du site ne peut pas être fabriquée avec ce contenu (${erreur.message}).`);
    }
  }
  return erreurs;
}

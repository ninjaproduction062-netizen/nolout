// API de l'administration (page /admin/). Une seule fonction, l'action est dans l'adresse :
// /api/admin?action=session | premier-compte | demandes | comptes | mot-de-passe
import { base, preparerBase } from '../lib/base.js';
import { chiffrerMotDePasse, verifierMotDePasse, creerJeton, cookieSession, cookieFin, compteConnecte } from '../lib/auth.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STATUTS = ['nouvelle', 'en cours', 'traitée'];
const texte = (valeur, max = 200) => (typeof valeur === 'string' ? valeur.trim().slice(0, max) : '');
const motDePasseValide = (m) => typeof m === 'string' && m.length >= 10 && m.length <= 200;

// Le premier compte ne peut être créé que depuis l'adresse propre au déploiement (VERCEL_URL) :
// Vercel la protège et exige d'être connecté au compte Vercel du site.
const hoteProtege = (req) => {
  const hote = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return Boolean(process.env.VERCEL_URL) && hote === process.env.VERCEL_URL;
};

const erreur = (res, code, message) => res.status(code).json({ ok: false, erreur: message });

// Empreinte factice : une adresse inconnue coûte le même temps de calcul qu'une vraie,
// pour ne pas révéler quelles adresses ont un compte
let empreinteFactice = null;
const verifierSansCompte = async (motDePasse) => {
  empreinteFactice ??= await chiffrerMotDePasse('compte-inexistant');
  await verifierMotDePasse(motDePasse, empreinteFactice);
  return false;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const sql = base();
  if (!sql) return erreur(res, 503, 'Base de données non reliée');

  const action = new URL(req.url, 'http://site').searchParams.get('action') || '';
  const methode = req.method;
  // Les modifications arrivent en JSON uniquement (protection contre les envois depuis un autre site)
  if (methode !== 'GET' && !String(req.headers['content-type'] || '').includes('application/json')) {
    return erreur(res, 415, 'Format non accepté');
  }
  let corps = req.body;
  if (typeof corps === 'string') {
    try { corps = JSON.parse(corps || '{}'); } catch { corps = {}; }
  }
  corps = corps || {};

  try {
    await preparerBase(sql);

    // ── Session : état, connexion, déconnexion ──
    if (action === 'session') {
      if (methode === 'GET') {
        const compte = await compteConnecte(sql, req);
        const [{ nombre }] = await sql`SELECT count(*)::int AS nombre FROM comptes`;
        return res.status(200).json({
          ok: true,
          compte: compte ? { id: Number(compte.id), nom: compte.nom, email: compte.email } : null,
          premierCompte: nombre === 0,
          installationIci: hoteProtege(req),
        });
      }
      if (methode === 'POST') {
        const email = texte(corps.email, 160).toLowerCase();
        const motDePasse = typeof corps.motDePasse === 'string' ? corps.motDePasse : '';
        const [essais] = await sql`SELECT nombre, derniere > now() - interval '15 minutes' AS recent FROM connexions_echouees WHERE email = ${email}`;
        if (essais && essais.nombre >= 5 && essais.recent) {
          return erreur(res, 429, 'Trop d’essais manqués. Réessayez dans 15 minutes.');
        }
        const [compte] = await sql`SELECT id, email, nom, empreinte, actif FROM comptes WHERE email = ${email}`;
        const valide = compte && compte.actif
          ? await verifierMotDePasse(motDePasse, compte.empreinte)
          : await verifierSansCompte(motDePasse);
        if (!valide) {
          await sql`INSERT INTO connexions_echouees (email, nombre, derniere) VALUES (${email}, 1, now())
                    ON CONFLICT (email) DO UPDATE SET
                      nombre = CASE WHEN connexions_echouees.derniere > now() - interval '15 minutes' THEN connexions_echouees.nombre + 1 ELSE 1 END,
                      derniere = now()`;
          return erreur(res, 401, 'Adresse e-mail ou mot de passe incorrect.');
        }
        await sql`DELETE FROM connexions_echouees WHERE email = ${email}`;
        await sql`UPDATE comptes SET derniere_connexion = now() WHERE id = ${compte.id}`;
        res.setHeader('Set-Cookie', cookieSession(creerJeton(compte)));
        return res.status(200).json({ ok: true, compte: { id: Number(compte.id), nom: compte.nom, email: compte.email } });
      }
      if (methode === 'DELETE') {
        res.setHeader('Set-Cookie', cookieFin);
        return res.status(200).json({ ok: true });
      }
      return erreur(res, 405, 'Méthode non autorisée');
    }

    // ── Premier compte (installation) ──
    if (action === 'premier-compte') {
      if (methode !== 'POST') return erreur(res, 405, 'Méthode non autorisée');
      const [{ nombre }] = await sql`SELECT count(*)::int AS nombre FROM comptes`;
      if (nombre > 0) return erreur(res, 409, 'Un compte existe déjà : connectez-vous.');
      if (!hoteProtege(req)) return erreur(res, 403, 'Le premier compte se crée depuis l’adresse protégée de Vercel.');
      const nom = texte(corps.nom, 120);
      const email = texte(corps.email, 160).toLowerCase();
      if (!nom || !EMAIL.test(email)) return erreur(res, 400, 'Nom ou adresse e-mail invalide.');
      if (!motDePasseValide(corps.motDePasse)) return erreur(res, 400, 'Le mot de passe doit compter au moins 10 caractères.');
      const empreinte = await chiffrerMotDePasse(corps.motDePasse);
      const [compte] = await sql`INSERT INTO comptes (email, nom, empreinte) VALUES (${email}, ${nom}, ${empreinte})
                                 RETURNING id, email, nom, empreinte`;
      res.setHeader('Set-Cookie', cookieSession(creerJeton(compte)));
      return res.status(201).json({ ok: true, compte: { id: Number(compte.id), nom: compte.nom, email: compte.email } });
    }

    // ── À partir d'ici, il faut être connecté ──
    const moi = await compteConnecte(sql, req);
    if (!moi) return erreur(res, 401, 'Session expirée : reconnectez-vous.');

    // ── Demandes du formulaire de contact ──
    if (action === 'demandes') {
      if (methode === 'GET') {
        const demandes = await sql`SELECT id, recue_le, departement, equipe, destinataire, nom, entreprise, email, telephone, message, statut
                                   FROM demandes ORDER BY recue_le DESC LIMIT 500`;
        return res.status(200).json({ ok: true, demandes: demandes.map((d) => ({ ...d, id: Number(d.id) })) });
      }
      if (methode === 'PATCH') {
        const id = Number(corps.id);
        if (!Number.isInteger(id) || !STATUTS.includes(corps.statut)) return erreur(res, 400, 'Demande ou statut invalide.');
        const lignes = await sql`UPDATE demandes SET statut = ${corps.statut} WHERE id = ${id} RETURNING id`;
        return lignes.length ? res.status(200).json({ ok: true }) : erreur(res, 404, 'Demande introuvable.');
      }
      if (methode === 'DELETE') {
        const id = Number(corps.id);
        if (!Number.isInteger(id)) return erreur(res, 400, 'Demande invalide.');
        const lignes = await sql`DELETE FROM demandes WHERE id = ${id} RETURNING id`;
        return lignes.length ? res.status(200).json({ ok: true }) : erreur(res, 404, 'Demande introuvable.');
      }
      return erreur(res, 405, 'Méthode non autorisée');
    }

    // ── Comptes de l'équipe ──
    if (action === 'comptes') {
      if (methode === 'GET') {
        const comptes = await sql`SELECT id, email, nom, actif, cree_le, derniere_connexion FROM comptes ORDER BY cree_le`;
        return res.status(200).json({ ok: true, comptes: comptes.map((c) => ({ ...c, id: Number(c.id) })) });
      }
      if (methode === 'POST') {
        const nom = texte(corps.nom, 120);
        const email = texte(corps.email, 160).toLowerCase();
        if (!nom || !EMAIL.test(email)) return erreur(res, 400, 'Nom ou adresse e-mail invalide.');
        if (!motDePasseValide(corps.motDePasse)) return erreur(res, 400, 'Le mot de passe doit compter au moins 10 caractères.');
        const empreinte = await chiffrerMotDePasse(corps.motDePasse);
        const lignes = await sql`INSERT INTO comptes (email, nom, empreinte) VALUES (${email}, ${nom}, ${empreinte})
                                 ON CONFLICT (email) DO NOTHING RETURNING id`;
        return lignes.length ? res.status(201).json({ ok: true }) : erreur(res, 409, 'Un compte existe déjà avec cette adresse.');
      }
      if (methode === 'PATCH') {
        const id = Number(corps.id);
        if (!Number.isInteger(id) || typeof corps.actif !== 'boolean') return erreur(res, 400, 'Compte invalide.');
        if (id === Number(moi.id)) return erreur(res, 400, 'Vous ne pouvez pas désactiver votre propre compte.');
        const lignes = await sql`UPDATE comptes SET actif = ${corps.actif} WHERE id = ${id} RETURNING id`;
        return lignes.length ? res.status(200).json({ ok: true }) : erreur(res, 404, 'Compte introuvable.');
      }
      return erreur(res, 405, 'Méthode non autorisée');
    }

    // ── Mon mot de passe ──
    if (action === 'mot-de-passe') {
      if (methode !== 'POST') return erreur(res, 405, 'Méthode non autorisée');
      if (!(await verifierMotDePasse(String(corps.actuel || ''), moi.empreinte))) return erreur(res, 400, 'Mot de passe actuel incorrect.');
      if (!motDePasseValide(corps.nouveau)) return erreur(res, 400, 'Le nouveau mot de passe doit compter au moins 10 caractères.');
      const empreinte = await chiffrerMotDePasse(corps.nouveau);
      const [compte] = await sql`UPDATE comptes SET empreinte = ${empreinte} WHERE id = ${moi.id} RETURNING id, email, nom, empreinte`;
      // Les autres sessions de ce compte prennent fin ; celle-ci continue avec le nouveau mot de passe
      res.setHeader('Set-Cookie', cookieSession(creerJeton(compte)));
      return res.status(200).json({ ok: true });
    }

    return erreur(res, 404, 'Action inconnue.');
  } catch (e) {
    console.error('Administration :', e);
    return erreur(res, 500, 'Erreur du serveur, réessayez.');
  }
}

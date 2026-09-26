// Formulaire de contact : chaque demande est enregistrée dans la base Neon (table « demandes »).
// Le formulaire (contact/) envoie en JSON : departement, equipe, destinataire, nom, entreprise,
// email, telephone, message, site_web (champ piège, invisible, que seuls les robots remplissent).
import { base, preparerBase } from '../lib/base.js';

const DEPARTEMENTS = new Set(['hek', 'con', 'baz', 'com', 'game', 'tra', '?']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const texte = (valeur, max) => (typeof valeur === 'string' ? valeur.trim().slice(0, max) : '');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée' });
  }
  const sql = base();
  if (!sql) return res.status(503).json({ ok: false, erreur: 'Base de données non reliée' });

  let corps = req.body;
  if (typeof corps === 'string') {
    try { corps = JSON.parse(corps); } catch { corps = {}; }
  }
  corps = corps || {};

  // Robot : on répond comme si tout allait bien, sans rien enregistrer
  if (texte(corps.site_web, 200)) return res.status(200).json({ ok: true });

  const demande = {
    departement: texte(corps.departement, 8),
    equipe: texte(corps.equipe, 120),
    destinataire: texte(corps.destinataire, 160),
    nom: texte(corps.nom, 120),
    entreprise: texte(corps.entreprise, 160),
    email: texte(corps.email, 160),
    telephone: texte(corps.telephone, 40),
    message: texte(corps.message, 5000),
  };
  if (!DEPARTEMENTS.has(demande.departement) || !demande.equipe || !demande.nom
      || !EMAIL.test(demande.email) || !demande.message) {
    return res.status(400).json({ ok: false, erreur: 'Champs manquants ou invalides' });
  }

  try {
    await preparerBase(sql);
    await sql`
      INSERT INTO demandes (departement, equipe, destinataire, nom, entreprise, email, telephone, message)
      VALUES (${demande.departement}, ${demande.equipe}, ${demande.destinataire || null}, ${demande.nom},
              ${demande.entreprise || null}, ${demande.email}, ${demande.telephone || null}, ${demande.message})`;
    return res.status(201).json({ ok: true });
  } catch (erreur) {
    console.error('Enregistrement de la demande impossible :', erreur);
    return res.status(500).json({ ok: false, erreur: 'Enregistrement impossible' });
  }
}

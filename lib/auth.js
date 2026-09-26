// Connexion à l'administration : mots de passe chiffrés (scrypt) dans la table « comptes »,
// session dans un cookie signé (HttpOnly, Secure, SameSite=Strict) sur le domaine du site.
// La clé de signature est dérivée de DATABASE_URL : aucun secret supplémentaire à gérer.
// Changer de mot de passe ou désactiver un compte met fin à ses sessions ouvertes.
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const COOKIE = 'nolout_session';
const DUREE = 12 * 3600; // une session dure 12 heures
const PARAMETRES = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const scryptAsync = (mot, sel, longueur, options) => new Promise((ok, ko) => {
  scrypt(mot, sel, longueur, options, (erreur, cle) => (erreur ? ko(erreur) : ok(cle)));
});

export async function chiffrerMotDePasse(motDePasse) {
  const sel = randomBytes(16);
  const cle = await scryptAsync(String(motDePasse).normalize('NFC'), sel, 64, PARAMETRES);
  return `scrypt$${PARAMETRES.N}$${PARAMETRES.r}$${PARAMETRES.p}$${sel.toString('base64')}$${cle.toString('base64')}`;
}

export async function verifierMotDePasse(motDePasse, empreinte) {
  const [algo, N, r, p, sel, cle] = String(empreinte || '').split('$');
  if (algo !== 'scrypt' || !sel || !cle) return false;
  const attendue = Buffer.from(cle, 'base64');
  const calculee = await scryptAsync(String(motDePasse).normalize('NFC'), Buffer.from(sel, 'base64'), attendue.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMETRES.maxmem });
  return timingSafeEqual(calculee, attendue);
}

const cleSignature = () => createHmac('sha256', process.env.DATABASE_URL || '').update('nolout-admin-session-v1').digest();
const signer = (charge) => createHmac('sha256', cleSignature()).update(charge).digest();
// Version du compte : change avec le mot de passe, ce qui invalide les anciennes sessions
const versionCompte = (compte) => createHash('sha256').update(String(compte.empreinte)).digest('base64url').slice(0, 12);

export function creerJeton(compte) {
  const charge = Buffer.from(JSON.stringify({ id: Number(compte.id), v: versionCompte(compte), exp: Math.floor(Date.now() / 1000) + DUREE })).toString('base64url');
  return `${charge}.${signer(charge).toString('base64url')}`;
}

function lireJeton(jeton) {
  const [charge, signature] = String(jeton || '').split('.');
  if (!charge || !signature) return null;
  const recue = Buffer.from(signature, 'base64url');
  const attendue = signer(charge);
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return null;
  try {
    const donnees = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
    return donnees.exp > Date.now() / 1000 ? donnees : null;
  } catch {
    return null;
  }
}

export function lireCookie(req, nom = COOKIE) {
  for (const morceau of String(req.headers.cookie || '').split(';')) {
    const [cle, ...valeur] = morceau.trim().split('=');
    if (cle === nom) return decodeURIComponent(valeur.join('='));
  }
  return null;
}

export const cookieSession = (jeton) => `${COOKIE}=${jeton}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DUREE}`;
export const cookieFin = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

// Compte connecté (actif, mot de passe inchangé depuis la connexion), ou null
export async function compteConnecte(sql, req) {
  const donnees = lireJeton(lireCookie(req));
  if (!donnees) return null;
  const [compte] = await sql`SELECT id, email, nom, empreinte, actif FROM comptes WHERE id = ${donnees.id}`;
  if (!compte || !compte.actif || versionCompte(compte) !== donnees.v) return null;
  return compte;
}

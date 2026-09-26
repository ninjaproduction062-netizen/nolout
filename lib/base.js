// Accès à la base Neon. DATABASE_URL est fournie par l'intégration Neon du projet Vercel :
// aucun mot de passe dans le code ni dans le dépôt.
import { neon } from '@neondatabase/serverless';

let client = null;

// Client SQL, ou null si la base n'est pas reliée (poste local sans DATABASE_URL)
export function base() {
  if (!process.env.DATABASE_URL) return null;
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}

// Tables du site, créées au premier appel (puis plus vérifiées pour cette instance)
let prete = false;
export async function preparerBase(sql) {
  if (prete) return;
  // Contenu du site : clé « publie » (en ligne) et « brouillon » (en cours de modification) ;
  // type json et non jsonb, pour garder l'ordre des champs tel qu'il a été saisi
  await sql`CREATE TABLE IF NOT EXISTS contenus (
    cle         text PRIMARY KEY,
    valeur      json NOT NULL,
    modifie_le  timestamptz NOT NULL DEFAULT now(),
    modifie_par text
  )`;
  // Chaque publication garde une copie de la version précédente, pour pouvoir revenir en arrière
  await sql`CREATE TABLE IF NOT EXISTS contenus_historique (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    valeur     json NOT NULL,
    publie_le  timestamptz NOT NULL DEFAULT now(),
    publie_par text
  )`;
  // Demandes du formulaire de contact
  await sql`CREATE TABLE IF NOT EXISTS demandes (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recue_le      timestamptz NOT NULL DEFAULT now(),
    departement   text NOT NULL,
    equipe        text NOT NULL,
    destinataire  text,
    nom           text NOT NULL,
    entreprise    text,
    email         text NOT NULL,
    telephone     text,
    message       text NOT NULL,
    statut        text NOT NULL DEFAULT 'nouvelle'
  )`;
  // Comptes de l'administration (mot de passe chiffré avec scrypt)
  await sql`CREATE TABLE IF NOT EXISTS comptes (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               text NOT NULL UNIQUE,
    nom                 text NOT NULL,
    empreinte           text NOT NULL,
    actif               boolean NOT NULL DEFAULT true,
    cree_le             timestamptz NOT NULL DEFAULT now(),
    derniere_connexion  timestamptz
  )`;
  // Connexions échouées, pour bloquer un compte 15 minutes après 5 essais manqués
  await sql`CREATE TABLE IF NOT EXISTS connexions_echouees (
    email     text PRIMARY KEY,
    nombre    integer NOT NULL DEFAULT 0,
    derniere  timestamptz NOT NULL DEFAULT now()
  )`;
  prete = true;
}

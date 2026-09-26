// Contenu du site (même structure que sources/contenu.json), gardé dans la base Neon.
// Au tout premier appel, la base reçoit le contenu de sources/contenu.json.
import contenuInitial from '../sources/contenu.json' with { type: 'json' };
import { base, preparerBase } from './base.js';

export { contenuInitial };

// Contenu « publie » (en ligne) ou « brouillon » ; contenu initial si la base n'est pas reliée
export async function lireContenu(cle = 'publie') {
  const sql = base();
  if (!sql) return contenuInitial;
  await preparerBase(sql);
  const lignes = await sql`SELECT valeur FROM contenus WHERE cle = ${cle}`;
  if (lignes.length) return lignes[0].valeur;
  const json = JSON.stringify(contenuInitial);
  await sql`INSERT INTO contenus (cle, valeur, modifie_par)
            VALUES ('publie', ${json}::json, 'installation'), ('brouillon', ${json}::json, 'installation')
            ON CONFLICT (cle) DO NOTHING`;
  const relues = await sql`SELECT valeur FROM contenus WHERE cle = ${cle}`;
  return relues.length ? relues[0].valeur : contenuInitial;
}

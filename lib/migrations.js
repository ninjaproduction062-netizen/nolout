// Changements de contenu faits hors de l'administration (demandés par le client dans la
// conversation avec Claude), appliqués une seule fois à la version en ligne et au brouillon,
// dès le déploiement. Chacun ne touche que ce qu'il vise, et seulement si la valeur n'a pas
// déjà été changée dans l'administration. appliquer(C) modifie le contenu C et renvoie true
// s'il a changé quelque chose.
// Ne jamais retirer ni renommer une entrée déjà en ligne : son identifiant est noté dans la
// table contenus_migrations. Reporter aussi le changement dans sources/contenu.json.
export const MIGRATIONS = [
  {
    id: '2026-09-28-projets-livres',
    // Chiffre clé « projets livrés » : plus de 40, qui compte de 0 à 40
    appliquer(C) {
      const chiffres = (C.accueil && C.accueil.chiffres) || [];
      const chiffre = chiffres.find((c) => c && c.libelle === 'projets livrés');
      if (!chiffre || chiffre.valeur !== '[nombre]') return false;
      chiffre.valeur = '+40';
      chiffre.compteur = true;
      return true;
    },
  },
  {
    id: '2026-09-28-collaborateurs',
    // Chiffre clé « collaborateurs » : 27, qui compte de 0 à 27
    appliquer(C) {
      const chiffres = (C.accueil && C.accueil.chiffres) || [];
      const chiffre = chiffres.find((c) => c && c.libelle === 'collaborateurs');
      if (!chiffre || chiffre.valeur !== '[nombre]') return false;
      chiffre.valeur = '27';
      chiffre.compteur = true;
      return true;
    },
  },
];

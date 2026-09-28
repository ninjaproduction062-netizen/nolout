// Changements de contenu faits hors de l'administration (demandés par le client dans la
// conversation avec Claude), appliqués une seule fois à la version en ligne et au brouillon,
// dès le déploiement. Chacun ne touche que ce qu'il vise, et seulement si la valeur n'a pas
// déjà été changée dans l'administration. appliquer(C) modifie le contenu C et renvoie true
// s'il a changé quelque chose.
// Ne jamais retirer ni renommer une entrée déjà en ligne : son identifiant est noté dans la
// table contenus_migrations. Reporter aussi le changement dans sources/contenu.json.

// Textes de la page Réalisations, et titres des photos déjà en place (galeries)
const PAGE_REALISATIONS = {
  titrePage: 'Réalisations — NOLOUT SARLU',
  description: 'Les réalisations des six départements de NOLOUT SARLU en images : conseil, construction, commerce, communication, gaming et transport.',
  pastille: 'Six départements, des projets concrets',
  titre: 'Nos réalisations',
  intro: 'Chantiers, campagnes, événements et missions : découvrez en images le travail de nos six départements. Choisissez un département pour ne voir que sa galerie.',
};
const TITRES_PHOTOS = {
  'realisations/nolout-communication-portrait.jpg': 'Portrait en studio',
  'realisations/nolout-communication-evenement.jpg': 'Couverture d’événement',
};

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
  {
    id: '2026-09-28-galeries',
    // Page Réalisations : une galerie photos par département ; les photos des références y passent
    appliquer(C) {
      let change = false;
      for (const d of C.departements || []) {
        if (!d || Array.isArray(d.galerie)) continue;
        const photos = d.references && Array.isArray(d.references.photos) ? d.references.photos : [];
        d.galerie = photos.filter((p) => p && p.fichier).map((p) => ({
          fichier: p.fichier,
          alt: p.alt || '',
          titre: TITRES_PHOTOS[p.fichier] || '',
          meta: '',
        }));
        if (d.references) delete d.references.photos;
        change = true;
      }
      if (!C.realisations) {
        C.realisations = { ...PAGE_REALISATIONS };
        change = true;
      }
      if (Array.isArray(C.pagesEnPreparation) && C.pagesEnPreparation.some((p) => p && p.page === 'realisations')) {
        C.pagesEnPreparation = C.pagesEnPreparation.filter((p) => !p || p.page !== 'realisations');
        change = true;
      }
      return change;
    },
  },
];

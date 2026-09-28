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

// Photos du chantier de nuit (drone), pour la galerie de Nolout Construction
const PHOTOS_CONSTRUCTION = [
  { fichier: 'realisations/nolout-construction-vue-ensemble.jpg', alt: 'Vue aérienne de nuit d’un grand chantier en sous-sol : dalles coulées, zone bâchée en bleu et fondations, éclairés par un projecteur', titre: 'Vue d’ensemble du chantier', meta: '' },
  { fichier: 'realisations/nolout-construction-coulage-dalle.jpg', alt: 'Vue du ciel, de nuit : une équipe en gilets orange étale le béton frais d’une dalle', titre: 'Coulage d’une dalle', meta: '' },
  { fichier: 'realisations/nolout-construction-beton-poteaux.jpg', alt: 'Ouvriers coulant le béton au pied des poteaux, vus du ciel pendant un chantier de nuit', titre: 'Béton coulé entre les poteaux', meta: '' },
  { fichier: 'realisations/nolout-construction-dalle-fondations.jpg', alt: 'Vue aérienne de nuit : dalle en cours de coulage, massifs de fondation et zone protégée par une bâche bleue', titre: 'Dalle et fondations', meta: '' },
  { fichier: 'realisations/nolout-construction-chantier-nuit.jpg', alt: 'Vue aérienne de nuit du chantier, avec la pompe à béton et les zones de fondation en préparation', titre: 'Le chantier de nuit', meta: '' },
];

// Séance « save the date » en studio (dossier G:\SHOOT SAVE THE DATE), pour la galerie de Nolout Communication
const PHOTOS_SAVE_THE_DATE = [
  { fichier: 'realisations/nolout-communication-save-the-date-1.jpg', alt: 'Couple enlacé et souriant en studio, lui en chemise noire pailletée, elle en robe blanche, sur fond marron', titre: 'Complicité', meta: 'Séance save the date', largeur: 1067, hauteur: 1600 },
  { fichier: 'realisations/nolout-communication-save-the-date-2.jpg', alt: 'Couple posant debout en studio, elle en longue robe blanche à cape, lui en chemise noire, sur fond marron', titre: 'Élégance en blanc et noir', meta: 'Séance save the date', largeur: 1067, hauteur: 1600 },
  { fichier: 'realisations/nolout-communication-save-the-date-3.jpg', alt: 'Femme en robe orange assise au sol contre un fauteuil, son compagnon en chemise blanche assis derrière elle', titre: 'Pause en orange', meta: 'Séance save the date', largeur: 1067, hauteur: 1600 },
  { fichier: 'realisations/nolout-communication-save-the-date-4.jpg', alt: 'Femme en robe orange assise dans un fauteuil gris, son compagnon debout derrière elle en chemise blanche', titre: 'Orange et blanc', meta: 'Séance save the date', largeur: 1067, hauteur: 1600 },
  { fichier: 'realisations/nolout-communication-save-the-date-5.jpg', alt: 'Couple en tenues marron et blanc, lui assis sur un fauteuil, elle appuyée contre lui, sur fond marron', titre: 'Tons chocolat', meta: 'Séance save the date', largeur: 1067, hauteur: 1600 },
  { fichier: 'realisations/nolout-communication-save-the-date-6.jpg', alt: 'Couple enlacé, visage contre visage, photographié en noir et blanc', titre: 'En noir et blanc', meta: 'Séance save the date', largeur: 1067, hauteur: 1600 },
];
// Dimensions des photos déjà en ligne : la galerie les affiche dans leur format
const DIMENSIONS = {
  'realisations/nolout-communication-portrait.jpg': [1200, 750],
  'realisations/nolout-communication-evenement.jpg': [1200, 750],
  ...Object.fromEntries(PHOTOS_CONSTRUCTION.map((p) => [p.fichier, [1600, 1200]])),
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
  {
    id: '2026-09-28-carte-gombe',
    // Siège à la Gombe (Kinshasa) : commune dans l'adresse et carte Google Maps sur la page Contact
    appliquer(C) {
      const G = C.groupe;
      if (!G) return false;
      let change = false;
      if (G.adresse === '[Adresse], [Commune], Kinshasa, RDC') { G.adresse = '[Adresse], Gombe, Kinshasa, RDC'; change = true; }
      if (G.adresseCourte === '[Adresse], Kinshasa') { G.adresseCourte = '[Adresse], Gombe, Kinshasa'; change = true; }
      if (G.carte === undefined) { G.carte = 'Gombe, Kinshasa'; change = true; }
      return change;
    },
  },
  {
    id: '2026-09-28-photos-construction',
    // Galerie de Nolout Construction : photos du chantier de nuit prises au drone
    appliquer(C) {
      const d = (C.departements || []).find((x) => x && x.code === 'con');
      if (!d) return false;
      if (!Array.isArray(d.galerie)) d.galerie = [];
      const deja = new Set(d.galerie.map((p) => p && p.fichier));
      const nouvelles = PHOTOS_CONSTRUCTION.filter((p) => !deja.has(p.fichier));
      if (!nouvelles.length) return false;
      d.galerie.push(...nouvelles.map((p) => ({ ...p })));
      return true;
    },
  },
  {
    id: '2026-09-28-save-the-date',
    // Galerie de Nolout Communication : six photos de la séance « save the date » ;
    // dimensions des photos déjà en ligne, pour les afficher dans leur format
    appliquer(C) {
      let change = false;
      for (const d of C.departements || []) {
        for (const p of (d && Array.isArray(d.galerie) ? d.galerie : [])) {
          const dims = p && DIMENSIONS[p.fichier];
          if (dims && !(p.largeur > 0 && p.hauteur > 0)) {
            [p.largeur, p.hauteur] = dims;
            change = true;
          }
        }
      }
      const com = (C.departements || []).find((x) => x && x.code === 'com');
      if (com) {
        if (!Array.isArray(com.galerie)) com.galerie = [];
        const deja = new Set(com.galerie.map((p) => p && p.fichier));
        const nouvelles = PHOTOS_SAVE_THE_DATE.filter((p) => !deja.has(p.fichier));
        if (nouvelles.length) {
          com.galerie.push(...nouvelles.map((p) => ({ ...p })));
          change = true;
        }
      }
      return change;
    },
  },
];

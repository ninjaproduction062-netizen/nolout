/* NOLOUT SARLU — administration du site (/admin/). Sans dépendance.
 * Tout ce qui vient des visiteurs (demandes) est inséré comme texte, jamais comme HTML. */
(() => {
  'use strict';

  const $ = (sel, racine = document) => racine.querySelector(sel);
  const $$ = (sel, racine = document) => [...racine.querySelectorAll(sel)];

  const DEPARTEMENTS = {
    hek: ['Hekima Consulting', '#2F7DE1', '#6FA8F0'],
    con: ['Nolout Construction', '#E0662A', '#F08A55'],
    baz: ['Le Bazar de Chacha et Loulou', '#3A9D4F', '#5CC271'],
    com: ['Nolout Communication', '#D8345F', '#F06A8C'],
    game: ['Nolout Game', '#8A5CE6', '#AE8CF2'],
    tra: ['Nolout Transport', '#14908F', '#3CC0BE'],
    '?': ['À orienter', '#E9A825', '#F2C14E'],
  };
  const STATUTS = [['nouvelle', 'Nouvelle'], ['en cours', 'En cours'], ['traitée', 'Traitée']];
  const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  let compte = null;
  let demandes = [];

  // ── Appels à l'API ──
  async function api(action, { methode = 'GET', corps } = {}) {
    const options = { method: methode, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (corps !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(corps);
    }
    let reponse;
    try {
      reponse = await fetch(`/api/admin?action=${encodeURIComponent(action)}`, options);
    } catch {
      throw new Error('Connexion impossible. Vérifiez votre accès à Internet.');
    }
    const donnees = await reponse.json().catch(() => ({}));
    if (reponse.status === 401 && action !== 'session') afficherEcran('connexion');
    if (!reponse.ok || donnees.ok === false) {
      const erreur = new Error(donnees.erreur || (reponse.status === 401 ? 'Session expirée : reconnectez-vous.' : `Erreur ${reponse.status}`));
      erreur.statut = reponse.status;
      throw erreur;
    }
    return donnees;
  }

  // ── Écrans ──
  function afficherEcran(nom) {
    $$('[data-ecran]').forEach((el) => { el.hidden = el.dataset.ecran !== nom; });
    const premierChamp = $(`[data-ecran="${nom}"] input`);
    if (premierChamp) premierChamp.focus();
  }

  // Espaces insécables de la typographie française (avant « : ; ! ? » et à l'intérieur des guillemets)
  const typo = (texte) => String(texte).replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ');

  function message(zone, texte, ok = false) {
    if (!zone) return;
    zone.textContent = typo(texte || '');
    zone.classList.toggle('is-ok', ok);
  }

  // Formulaire : bouton désactivé pendant l'envoi, message d'erreur sous les champs
  function brancherFormulaire(nom, envoyer) {
    const form = $(`[data-form="${nom}"]`);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bouton = $('button[type="submit"]', form);
      const zone = $('[data-message]', form);
      message(zone, '');
      bouton.disabled = true;
      try {
        await envoyer(Object.fromEntries(new FormData(form)), form, zone);
      } catch (erreur) {
        message(zone, erreur.message);
      } finally {
        bouton.disabled = false;
      }
    });
  }

  async function ouvrirApp(c) {
    compte = c;
    $('[data-nom]').textContent = c.nom;
    afficherEcran('app');
    ouvrirOnglet(location.hash.slice(1) || 'demandes');
  }

  // ── Onglets ──
  function ouvrirOnglet(nom) {
    if (!$(`[data-panneau="${nom}"]`)) nom = 'demandes';
    $$('[data-onglet]').forEach((b) => {
      if (b.dataset.onglet === nom) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $$('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== nom; });
    history.replaceState(null, '', `#${nom}`);
    if (nom === 'demandes') chargerDemandes();
    if (nom === 'contenus') ouvrirContenus();
    if (nom === 'equipe') chargerComptes();
  }
  $$('[data-onglet]').forEach((b) => b.addEventListener('click', () => ouvrirOnglet(b.dataset.onglet)));
  window.addEventListener('hashchange', () => { if (compte) ouvrirOnglet(location.hash.slice(1)); });

  // ── Demandes ──
  const zoneDemandes = $('[data-message-demandes]');

  async function chargerDemandes() {
    message(zoneDemandes, 'Chargement des demandes…', true);
    try {
      ({ demandes } = await api('demandes'));
      message(zoneDemandes, '');
      afficherDemandes();
    } catch (erreur) {
      message(zoneDemandes, erreur.message);
    }
  }

  function element(balise, classe, texte) {
    const el = document.createElement(balise);
    if (classe) el.className = classe;
    if (texte !== undefined && texte !== null) el.textContent = typo(texte);
    return el;
  }

  function afficherDemandes() {
    const liste = $('[data-demandes]');
    const filtreStatut = $('[data-filtre="statut"]').value;
    const filtreDept = $('[data-filtre="departement"]').value;
    const nouvelles = demandes.filter((d) => d.statut === 'nouvelle').length;
    const compteur = $('[data-nouvelles]');
    compteur.textContent = nouvelles;
    compteur.hidden = nouvelles === 0;

    const visibles = demandes.filter((d) => (!filtreStatut || d.statut === filtreStatut) && (!filtreDept || d.departement === filtreDept));
    liste.replaceChildren();
    if (!visibles.length) {
      liste.append(element('li', 'ad-vide', demandes.length ? 'Aucune demande ne correspond à ces filtres.' : 'Aucune demande pour l’instant.'));
      return;
    }
    for (const d of visibles) {
      const [nomDept, couleur, clair] = DEPARTEMENTS[d.departement] || [d.equipe, '#E9A825', '#F2C14E'];
      const li = element('li', `ad-demande${d.statut === 'nouvelle' ? ' is-nouvelle' : ''}`);
      li.style.setProperty('--c', couleur);
      li.style.setProperty('--c-clair', clair);

      const tete = element('div', 'ad-demande__tete');
      tete.append(element('span', 'ad-demande__dept', nomDept), element('span', 'ad-demande__date', DATE.format(new Date(d.recue_le))));

      const qui = element('p', 'ad-demande__qui', d.nom);
      if (d.entreprise) qui.append(' ', element('span', '', `· ${d.entreprise}`));

      const contacts = element('p', 'ad-demande__contacts');
      const mail = element('a', '', d.email);
      mail.href = `mailto:${d.email}?subject=${encodeURIComponent(`Votre demande à ${nomDept}`)}`;
      contacts.append(mail);
      if (d.telephone) {
        const tel = element('a', '', d.telephone);
        tel.href = `tel:${d.telephone.replace(/[^\d+]/g, '')}`;
        const wa = element('a', '', 'WhatsApp');
        wa.href = `https://wa.me/${d.telephone.replace(/\D/g, '')}`;
        wa.target = '_blank';
        wa.rel = 'noopener';
        contacts.append(tel, wa);
      }

      const texte = element('p', 'ad-demande__message', d.message);

      const pied = element('div', 'ad-demande__pied');
      const statut = element('label', 'ad-demande__statut', 'Statut');
      const choix = document.createElement('select');
      for (const [valeur, libelle] of STATUTS) {
        const option = element('option', '', libelle);
        option.value = valeur;
        option.selected = d.statut === valeur;
        choix.append(option);
      }
      choix.addEventListener('change', async () => {
        const ancien = d.statut;
        d.statut = choix.value;
        try {
          await api('demandes', { methode: 'PATCH', corps: { id: d.id, statut: choix.value } });
          afficherDemandes();
        } catch (erreur) {
          d.statut = ancien;
          choix.value = ancien;
          message(zoneDemandes, erreur.message);
        }
      });
      statut.append(choix);
      const supprimer = element('button', 'ad-lien-danger', 'Supprimer');
      supprimer.type = 'button';
      supprimer.addEventListener('click', async () => {
        if (!confirm(`Supprimer définitivement la demande de ${d.nom} ?`)) return;
        try {
          await api('demandes', { methode: 'DELETE', corps: { id: d.id } });
          demandes = demandes.filter((x) => x.id !== d.id);
          afficherDemandes();
        } catch (erreur) {
          message(zoneDemandes, erreur.message);
        }
      });
      pied.append(statut, supprimer);

      li.append(tete, qui, contacts, texte, pied);
      liste.append(li);
    }
  }
  $$('[data-filtre]').forEach((f) => f.addEventListener('change', afficherDemandes));
  $('[data-actualiser]').addEventListener('click', chargerDemandes);

  // ── Contenus du site ──────────────────────────────────────────────────────
  // Le brouillon est modifié ici et enregistré une seconde après la dernière frappe.
  // L'aperçu (/apercu/…) le montre tel qu'il sera en ligne ; « Publier » met le site à jour.

  const ed = {
    brouillon: null, // contenu en cours de modification (même structure que sources/contenu.json)
    publie: null, // contenu en ligne, pour repérer les sections modifiées
    version: 0, // version du brouillon dans la base : un enregistrement sur une version dépassée est refusé
    aPublier: false,
    section: null,
    minuteur: null,
    envoi: null, // enregistrement en cours
    aEnvoyer: false, // modifications pas encore enregistrées
    erreur: '', // dernier enregistrement refusé
    bloque: false, // brouillon modifié ailleurs : il faut recharger
    alerte: '', // publication refusée
    annonce: '', // publication réussie
  };
  const zoneContenus = $('[data-message-contenus]');
  let numeroChamp = 0;

  const ICONES = [['check', 'Coche'], ['target', 'Cible'], ['flag', 'Drapeau'], ['users', 'Personnes'], ['org', 'Organigramme'],
    ['plan', 'Plan'], ['build', 'Bâtiment'], ['tools', 'Outils'], ['bag', 'Sac'], ['mega', 'Mégaphone'], ['game', 'Manette'],
    ['truck', 'Camion'], ['phone', 'Téléphone'], ['mail', 'Enveloppe']];
  const cloner = (valeur) => JSON.parse(JSON.stringify(valeur));
  const provisoire = (valeur) => typeof valeur === 'string' && /\[[^\]]+\]/.test(valeur);

  // Sections du formulaire. racine(C) : l'objet modifié dans le contenu C ; cles : ce qui est comparé
  // à la version en ligne pour signaler une section modifiée (tout l'objet si absent).
  function sectionsContenus(C) {
    const departements = () => (ed.brouillon.departements || []).map((d) => [d.code, d.nom]);
    const premierDepartement = () => (departements()[0] || [''])[0];
    const sections = [
      {
        id: 'pub', rubrique: 'Accueil', titre: 'Publicité « À l’affiche »', apercu: '/apercu/#titre-pub',
        intro: 'Le bloc vidéo de l’accueil, sous le bandeau des marques.',
        racine: (X) => X.accueil && X.accueil.pub,
        champs: [
          { cle: 'surtitre', libelle: 'Petit titre (au-dessus)', exemple: 'À l’affiche' },
          { cle: 'titre', libelle: 'Titre de la publicité' },
          { cle: 'texte', type: 'zone', libelle: 'Texte de présentation', aide: 'Deux ou trois phrases.' },
          { cle: 'lien', type: 'groupe', libelle: 'Lien sous le texte (facultatif)', champs: [
            { cle: 'libelle', libelle: 'Texte du lien', exemple: 'Nous contacter' },
            { cle: 'href', libelle: 'Adresse du lien', exemple: 'contact/#formulaire',
              aide: 'Une page du site (ex. contact/#formulaire) ou une adresse complète (https://…). Le lien s’affiche quand les deux champs sont remplis.' },
          ] },
          { type: 'note', texte: 'La vidéo elle-même se changera ici à l’étape suivante (envoi de fichiers).' },
        ],
      },
      {
        id: 'accueil', rubrique: 'Accueil', titre: 'Haut de l’accueil', apercu: '/apercu/',
        racine: (X) => X.accueil,
        cles: ['pastille', 'titre', 'titreOr', 'intro', 'partenairesTitre', 'titrePage', 'description'],
        champs: [
          { cle: 'pastille', libelle: 'Pastille au-dessus du titre' },
          { cle: 'titre', libelle: 'Titre, partie blanche' },
          { cle: 'titreOr', libelle: 'Titre, suite en doré' },
          { cle: 'intro', type: 'zone', libelle: 'Texte d’introduction' },
          { cle: 'partenairesTitre', libelle: 'Titre du bandeau des marques' },
          { type: 'intertitre', libelle: 'Google et onglet du navigateur' },
          { cle: 'titrePage', libelle: 'Titre de la page', aide: 'Affiché dans l’onglet et dans les résultats Google (60 caractères environ).' },
          { cle: 'description', type: 'zone', libelle: 'Description', aide: 'Texte sous le titre dans les résultats Google (150 caractères environ).' },
        ],
      },
      {
        id: 'chiffres', rubrique: 'Accueil', titre: 'Chiffres clés', apercu: '/apercu/',
        racine: (X) => X.accueil, cles: ['chiffres'],
        champs: [
          { cle: 'chiffres', type: 'liste', libelle: 'Chiffres', element: 'Chiffre', ajouter: 'Ajouter un chiffre', max: 8,
            nouveau: () => ({ valeur: '', libelle: '' }),
            champs: [
              { cle: 'valeur', libelle: 'Chiffre', exemple: '120' },
              { cle: 'libelle', libelle: 'Légende', exemple: 'projets livrés' },
              { cle: 'compteur', type: 'case', libelle: 'Animer le chiffre de 0 à sa valeur (nombre entier uniquement)' },
            ] },
        ],
      },
      {
        id: 'methode', rubrique: 'Accueil', titre: 'Comment nous travaillons', apercu: '/apercu/#titre-methode',
        racine: (X) => X.accueil, cles: ['methodeSurtitre', 'methodeTitre', 'etapes'],
        champs: [
          { cle: 'methodeSurtitre', libelle: 'Petit titre' },
          { cle: 'methodeTitre', libelle: 'Titre' },
          { cle: 'etapes', type: 'liste', libelle: 'Étapes', element: 'Étape', ajouter: 'Ajouter une étape', max: 6,
            nouveau: () => ({ titre: '', texte: '' }),
            champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'texte', type: 'zone', libelle: 'Texte' }] },
        ],
      },
      {
        id: 'realisations', rubrique: 'Accueil', titre: 'Réalisations', apercu: '/apercu/#realisations',
        racine: (X) => X.accueil, cles: ['realisations'],
        champs: [
          { cle: 'realisations', type: 'liste', libelle: 'Réalisations mises en avant', element: 'Réalisation', ajouter: 'Ajouter une réalisation', max: 9,
            nouveau: () => ({ departement: premierDepartement(), titre: '', meta: '', image: '' }),
            champs: [
              { cle: 'departement', type: 'choix', libelle: 'Département', options: departements },
              { cle: 'titre', libelle: 'Titre' },
              { cle: 'meta', libelle: 'Précision', exemple: 'Client · 2025' },
            ] },
          { type: 'note', texte: 'Les photos se changeront ici à l’étape suivante (envoi de fichiers).' },
        ],
      },
      {
        id: 'temoignages', rubrique: 'Accueil', titre: 'Témoignages', apercu: '/apercu/#realisations',
        racine: (X) => X.accueil, cles: ['temoignages'],
        champs: [
          { cle: 'temoignages', type: 'liste', libelle: 'Témoignages de clients', element: 'Témoignage', ajouter: 'Ajouter un témoignage', max: 9,
            nouveau: () => ({ departement: premierDepartement(), texte: '', auteur: '' }),
            champs: [
              { cle: 'departement', type: 'choix', libelle: 'Département concerné', options: departements },
              { cle: 'texte', type: 'zone', libelle: 'Témoignage', aide: 'Sans guillemets : ils sont ajoutés automatiquement.' },
              { cle: 'auteur', libelle: 'Auteur', exemple: 'Nom, fonction' },
            ] },
        ],
      },
    ];

    for (const d of C.departements || []) {
      sections.push({
        id: `dept-${d.code}`, rubrique: 'Départements', titre: d.nom, couleur: d.base,
        apercu: `/apercu/departements/${d.slug}/`,
        racine: (X) => (X.departements || []).find((x) => x.code === d.code),
        champs: [
          { type: 'intertitre', libelle: 'Présentation' },
          { cle: 'nom', libelle: 'Nom du département' },
          { cle: 'court', libelle: 'Nom court', aide: 'Menus et schéma de l’accueil.' },
          { cle: 'domaine', libelle: 'Domaine', exemple: 'Conseil · stratégie' },
          { cle: 'tag', libelle: 'Étiquette sur le schéma de l’accueil' },
          { cle: 'resume', type: 'zone', libelle: 'Résumé', aide: 'Accueil, page « Départements » et menu.' },
          { cle: 'pitch', type: 'zone', libelle: 'Phrase d’accroche', aide: 'En haut de la page du département.' },
          { cle: 'cta', libelle: 'Texte du bouton principal' },
          { cle: 'servicesCles', type: 'textes', libelle: 'Services cités sur l’accueil', element: 'Service', ajouter: 'Ajouter un service', max: 5 },
          { type: 'intertitre', libelle: 'Services' },
          { cle: 'servicesTitre', libelle: 'Titre de la section' },
          { cle: 'servicesIntro', type: 'zone', libelle: 'Introduction', lignes: 2 },
          { cle: 'services', type: 'liste', libelle: 'Services détaillés', element: 'Service', ajouter: 'Ajouter un service', max: 8,
            nouveau: () => ({ icone: 'check', titre: '', texte: '' }),
            champs: [
              { cle: 'icone', type: 'choix', libelle: 'Icône', options: () => ICONES },
              { cle: 'titre', libelle: 'Titre' },
              { cle: 'texte', type: 'zone', libelle: 'Description', lignes: 2 },
            ] },
          { type: 'intertitre', libelle: 'Références' },
          { cle: 'references', type: 'groupe', champs: [
            { cle: 'etiquette', libelle: 'Type de référence', exemple: 'Mission, chantier, campagne…' },
            { cle: 'titre', libelle: 'Titre' },
            { cle: 'meta', libelle: 'Précision', exemple: 'Client · 2025' },
          ] },
          { type: 'intertitre', libelle: 'Contact du département' },
          { cle: 'role', libelle: 'Fonction de la personne à contacter' },
          { cle: 'email', libelle: 'Adresse e-mail', format: 'email' },
          { cle: 'telephone', libelle: 'Téléphone affiché', exemple: '+243 81 234 5678', aide: 'Vide : le numéro du groupe est utilisé.' },
          { cle: 'whatsapp', libelle: 'Numéro WhatsApp', exemple: '243812345678', aide: 'Chiffres uniquement, indicatif du pays compris.' },
          { cle: 'exempleMessage', type: 'zone', libelle: 'Exemple de message', lignes: 2, aide: 'Proposé dans le formulaire de contact quand ce département est choisi.' },
        ],
      });
    }

    sections.push(
      {
        id: 'coordonnees', rubrique: 'Groupe', titre: 'Coordonnées et mentions', apercu: '/apercu/contact/',
        racine: (X) => X.groupe,
        cles: ['telephone', 'whatsapp', 'email', 'adresse', 'adresseCourte', 'horaires', 'itineraire', 'signature', 'raisonSociale', 'rccm', 'idNat', 'numeroImpot', 'annee'],
        champs: [
          { type: 'intertitre', libelle: 'Contact' },
          { cle: 'telephone', libelle: 'Téléphone affiché', exemple: '+243 81 234 5678' },
          { cle: 'whatsapp', libelle: 'Numéro WhatsApp', exemple: '243812345678', aide: 'Chiffres uniquement, indicatif du pays compris. Vide : les boutons WhatsApp mènent au formulaire.' },
          { cle: 'email', libelle: 'Adresse e-mail', format: 'email' },
          { cle: 'adresse', libelle: 'Adresse complète', aide: 'Page Contact.' },
          { cle: 'adresseCourte', libelle: 'Adresse courte', aide: 'Pied de page.' },
          { cle: 'horaires', type: 'liste', libelle: 'Horaires d’ouverture', element: 'Horaire', ajouter: 'Ajouter une ligne', max: 7,
            nouveau: () => ({ jours: '', heures: '' }),
            champs: [{ cle: 'jours', libelle: 'Jours', exemple: 'Lun – ven' }, { cle: 'heures', libelle: 'Heures', exemple: '8 h 30 – 17 h 30' }] },
          { cle: 'itineraire', libelle: 'Lien de l’itinéraire (facultatif)', exemple: 'https://maps.app.goo.gl/…', aide: 'Lien Google Maps du siège. Vide : Google Maps cherche l’adresse complète.' },
          { type: 'intertitre', libelle: 'Identité et mentions légales' },
          { cle: 'signature', libelle: 'Signature du groupe' },
          { cle: 'raisonSociale', libelle: 'Raison sociale' },
          { cle: 'rccm', libelle: 'RCCM' },
          { cle: 'idNat', libelle: 'Identification nationale' },
          { cle: 'numeroImpot', libelle: 'Numéro d’impôt' },
          { cle: 'annee', libelle: 'Année du pied de page', exemple: '2026' },
        ],
      },
      {
        id: 'pages', rubrique: 'Groupe', titre: 'Pages en préparation', apercu: '/apercu/groupe/',
        racine: (X) => X, cles: ['pagesEnPreparation'],
        champs: [
          { cle: 'pagesEnPreparation', type: 'liste', fixe: true, libelle: 'Pages', titreElement: (p) => `Page /${p.page}/`,
            champs: [{ cle: 'titre', libelle: 'Titre' }, { cle: 'texte', type: 'zone', libelle: 'Texte d’attente', lignes: 2 }] },
        ],
      },
      {
        id: 'menu', rubrique: 'Groupe', titre: 'Menu principal', apercu: '/apercu/',
        racine: (X) => X, cles: ['navigation'],
        champs: [
          { cle: 'navigation', type: 'liste', fixe: true, libelle: 'Liens du menu',
            titreElement: (n) => (n.megamenu ? 'Menu des départements' : `Page /${n.page}/`),
            champs: [{ cle: 'libelle', libelle: 'Texte affiché' }] },
        ],
      },
      {
        id: 'mesure', rubrique: 'Groupe', titre: 'Mesure d’audience', apercu: '/apercu/',
        intro: 'Ces outils ne se chargent que si le visiteur accepte les cookies correspondants.',
        racine: (X) => X.cookies, creer: (X) => (X.cookies = {}), cles: ['googleAnalytics', 'metaPixel'],
        champs: [
          { cle: 'googleAnalytics', libelle: 'Identifiant Google Analytics 4', exemple: 'G-ABC123XYZ', aide: 'Laissez vide si vous n’utilisez pas Google Analytics.' },
          { cle: 'metaPixel', libelle: 'Identifiant du pixel Meta (Facebook)', exemple: '123456789012345', aide: 'Laissez vide si vous n’utilisez pas le pixel Meta.' },
        ],
      },
    );
    return sections;
  }

  // Empreinte d'une section dans un contenu, pour la comparer à la version en ligne
  function empreinte(section, C) {
    try {
      const objet = section.racine(C);
      return JSON.stringify(section.cles ? section.cles.map((cle) => (objet ? objet[cle] : undefined)) : objet);
    } catch {
      return '';
    }
  }
  const sectionsModifiees = () => sectionsContenus(ed.brouillon).filter((s) => empreinte(s, ed.brouillon) !== empreinte(s, ed.publie));

  // ── Champs du formulaire ──
  // obtenir(creer) renvoie l'objet qui porte les valeurs (créé à la première saisie si besoin)
  function rendreChamps(definitions, obtenir, parent) {
    for (const def of definitions) {
      if (def.type === 'intertitre') { parent.append(element('h3', 'ad-ed__intertitre', def.libelle)); continue; }
      if (def.type === 'note') { parent.append(element('p', 'ad-ed__note', def.texte)); continue; }
      if (def.type === 'groupe') {
        const obtenirGroupe = (creer) => {
          const objet = obtenir(creer);
          if (!objet) return null;
          if ((!objet[def.cle] || typeof objet[def.cle] !== 'object') && creer) objet[def.cle] = {};
          return objet[def.cle] || null;
        };
        const bloc = element('fieldset', 'ad-ed__groupe');
        if (def.libelle) bloc.append(element('legend', 'ad-ed__legende', def.libelle));
        rendreChamps(def.champs, obtenirGroupe, bloc);
        parent.append(bloc);
        continue;
      }
      if (def.type === 'liste' || def.type === 'textes') { parent.append(champListe(def, obtenir)); continue; }
      parent.append(champSimple(def, {
        lire: () => { const objet = obtenir(false); return objet ? objet[def.cle] : undefined; },
        ecrire: (valeur) => {
          const objet = obtenir(true);
          if (!objet) return;
          if (valeur === undefined) delete objet[def.cle]; else objet[def.cle] = valeur;
        },
      }));
    }
  }

  function champSimple(def, acces) {
    const id = `ed-${++numeroChamp}`;
    if (def.type === 'case') {
      const bloc = element('label', 'ad-ed__case');
      const saisie = document.createElement('input');
      saisie.type = 'checkbox';
      saisie.id = id;
      saisie.checked = Boolean(acces.lire());
      saisie.addEventListener('change', () => { acces.ecrire(saisie.checked ? true : undefined); modifie(); });
      bloc.append(saisie, element('span', '', def.libelle));
      return bloc;
    }
    const bloc = element('div', 'ad-ed__champ');
    const libelle = element('label', def.sansLibelle ? 'nl-sr' : 'nl-champ__label', def.libelle);
    libelle.htmlFor = id;
    let saisie;
    if (def.type === 'zone') {
      saisie = document.createElement('textarea');
      saisie.rows = def.lignes || 3;
    } else if (def.type === 'choix') {
      saisie = document.createElement('select');
      const options = typeof def.options === 'function' ? def.options() : def.options;
      if (!options.some(([valeur]) => valeur === acces.lire())) {
        const vide = element('option', '', 'Choisir…');
        vide.value = '';
        saisie.append(vide);
      }
      for (const [valeur, texte] of options) {
        const option = element('option', '', texte);
        option.value = valeur;
        saisie.append(option);
      }
    } else {
      saisie = document.createElement('input');
      saisie.type = def.format || 'text';
    }
    saisie.className = 'nl-champ__input';
    saisie.id = id;
    if (def.exemple) saisie.placeholder = def.exemple;
    saisie.value = acces.lire() ?? '';
    bloc.append(libelle, saisie);
    if (def.aide) {
      const aide = element('p', 'ad-ed__aide', def.aide);
      aide.id = `${id}-aide`;
      saisie.setAttribute('aria-describedby', aide.id);
      bloc.append(aide);
    }
    // Les textes « [à fournir] » de la maquette restent visibles sur le site : on les signale
    const alerte = element('p', 'ad-ed__provisoire', 'Texte provisoire entre crochets : remplacez-le par le vrai texte.');
    const signaler = () => {
      const aRemplacer = provisoire(saisie.value);
      alerte.hidden = !aRemplacer;
      bloc.classList.toggle('is-provisoire', aRemplacer);
    };
    saisie.addEventListener(def.type === 'choix' ? 'change' : 'input', () => { acces.ecrire(saisie.value); signaler(); modifie(); });
    signaler();
    bloc.append(alerte);
    return bloc;
  }

  function boutonOutil(texte, etiquette, desactive, action) {
    const bouton = element('button', 'ad-ed__outil', texte);
    bouton.type = 'button';
    bouton.disabled = desactive;
    bouton.title = etiquette;
    bouton.setAttribute('aria-label', etiquette);
    bouton.addEventListener('click', action);
    return bouton;
  }

  // Liste d'éléments (témoignages, services…) ou de textes (type « textes ») : ajouter, déplacer, retirer
  function champListe(def, obtenir) {
    const bloc = element('fieldset', 'ad-ed__liste');
    bloc.append(element('legend', 'ad-ed__legende', def.libelle));
    const elements = element('div', 'ad-ed__elements');
    bloc.append(elements);
    const tableau = (creer) => {
      const objet = obtenir(creer);
      if (!objet) return null;
      if (!Array.isArray(objet[def.cle]) && creer) objet[def.cle] = [];
      return Array.isArray(objet[def.cle]) ? objet[def.cle] : null;
    };
    const nom = (i) => `${def.element || 'Élément'} ${i + 1}`;

    const dessiner = (focaliserDernier) => {
      elements.replaceChildren();
      const t = tableau(false) || [];
      t.forEach((item, i) => {
        const carte = element('div', 'ad-ed__element');
        const tete = element('div', 'ad-ed__element-tete');
        tete.append(element('span', 'ad-ed__element-titre', def.titreElement ? def.titreElement(item, i) : nom(i)));
        if (!def.fixe) {
          const outils = element('div', 'ad-ed__outils');
          outils.append(
            boutonOutil('↑', `Monter : ${nom(i)}`, i === 0, () => { t.splice(i - 1, 0, t.splice(i, 1)[0]); dessiner(); modifie(); }),
            boutonOutil('↓', `Descendre : ${nom(i)}`, i === t.length - 1, () => { t.splice(i + 1, 0, t.splice(i, 1)[0]); dessiner(); modifie(); }),
            boutonOutil('Retirer', `Retirer : ${nom(i)}`, false, () => {
              if (!confirm(`Retirer « ${nom(i)} » ? Tant que rien n’est publié, vous pourrez annuler.`)) return;
              t.splice(i, 1);
              dessiner();
              modifie();
            }),
          );
          tete.append(outils);
        }
        carte.append(tete);
        if (def.type === 'textes') {
          carte.append(champSimple({ libelle: nom(i), sansLibelle: true }, { lire: () => t[i], ecrire: (valeur) => { t[i] = valeur ?? ''; } }));
        } else {
          rendreChamps(def.champs, () => t[i], carte);
        }
        elements.append(carte);
      });
      if (!def.fixe) {
        const ajouter = element('button', 'nl-btn nl-btn--verre nl-btn--petit ad-ed__ajouter', `+ ${def.ajouter || 'Ajouter'}`);
        ajouter.type = 'button';
        ajouter.disabled = Boolean(def.max && t.length >= def.max);
        ajouter.addEventListener('click', () => {
          tableau(true).push(def.type === 'textes' ? '' : def.nouveau());
          dessiner(true);
          modifie();
        });
        elements.append(ajouter);
      }
      if (focaliserDernier) {
        const cartes = $$('.ad-ed__element', elements);
        const champ = cartes.length && $('input, textarea, select', cartes[cartes.length - 1]);
        if (champ) champ.focus();
      }
    };
    dessiner(false);
    return bloc;
  }

  // ── Sections : navigation et formulaire ──
  function afficherSections() {
    const nav = $('[data-sections]');
    const choix = $('[data-choix-section]');
    nav.replaceChildren();
    choix.replaceChildren();
    let rubrique = null;
    let groupe = null;
    for (const s of sectionsContenus(ed.brouillon)) {
      if (s.rubrique !== rubrique) {
        rubrique = s.rubrique;
        nav.append(element('p', 'ad-ed__rubrique', rubrique));
        groupe = document.createElement('optgroup');
        groupe.label = rubrique;
        choix.append(groupe);
      }
      const bouton = element('button', 'ad-ed__section');
      bouton.type = 'button';
      bouton.dataset.section = s.id;
      if (s.couleur) {
        const puce = element('span', 'ad-ed__puce');
        puce.style.background = s.couleur;
        bouton.append(puce);
      }
      bouton.append(element('span', 'ad-ed__section-nom', s.titre));
      const pastille = element('span', 'ad-ed__pastille');
      pastille.dataset.pastille = s.id;
      pastille.title = 'Modifié, pas encore publié';
      pastille.hidden = true;
      bouton.append(pastille);
      bouton.addEventListener('click', () => afficherSection(s.id, true));
      nav.append(bouton);
      const option = element('option', '', s.titre);
      option.value = s.id;
      option.dataset.titre = typo(s.titre);
      groupe.append(option);
    }
    afficherPastilles();
  }
  $('[data-choix-section]').addEventListener('change', (e) => afficherSection(e.target.value, true));

  // Pastille dorée : section modifiée dans le brouillon, pas encore publiée
  function afficherPastilles() {
    if (!ed.brouillon) return;
    const modifiees = new Set(sectionsModifiees().map((s) => s.id));
    $$('[data-pastille]').forEach((p) => { p.hidden = !modifiees.has(p.dataset.pastille); });
    $$('[data-choix-section] option').forEach((o) => { o.textContent = (modifiees.has(o.value) ? '● ' : '') + o.dataset.titre; });
  }

  function afficherSection(id, defiler = false) {
    const sections = sectionsContenus(ed.brouillon);
    const s = sections.find((x) => x.id === id) || sections[0];
    ed.section = s.id;
    $$('[data-section]').forEach((b) => {
      if (b.dataset.section === s.id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    $('[data-choix-section]').value = s.id;
    const zone = $('[data-formulaire-contenu]');
    zone.replaceChildren();
    const tete = element('div', 'ad-ed__tete');
    const titres = element('div');
    titres.append(element('p', 'ad-ed__rubrique-courante', s.rubrique), element('h2', 'ad-ed__titre', s.titre));
    const lien = element('a', 'nl-lien-or nl-lien-or--petit', 'Voir dans l’aperçu →');
    lien.href = s.apercu;
    lien.target = '_blank';
    lien.rel = 'noopener';
    lien.addEventListener('click', ouvrirApercu);
    tete.append(titres, lien);
    zone.append(tete);
    if (s.intro) zone.append(element('p', 'ad-ed__intro', s.intro));
    rendreChamps(s.champs, (creer) => s.racine(ed.brouillon) || (creer && s.creer ? s.creer(ed.brouillon) : null), zone);
    $('[data-apercu]').href = s.apercu;
    try { sessionStorage.setItem('nolout-section', s.id); } catch { /* navigation privée */ }
    if (defiler && zone.getBoundingClientRect().top < 0) zone.scrollIntoView({ block: 'start' });
  }

  // ── État, enregistrement, publication ──
  function afficherEtat() {
    const zone = $('[data-etat]');
    let texte;
    let classe = '';
    if (ed.bloque) { texte = ed.erreur; classe = 'is-erreur'; }
    else if (ed.erreur) { texte = `Brouillon non enregistré : ${ed.erreur}`; classe = 'is-erreur'; }
    else if (ed.envoi || ed.aEnvoyer) texte = 'Enregistrement du brouillon…';
    else if (ed.alerte) { texte = ed.alerte; classe = 'is-erreur'; }
    else if (ed.annonce) { texte = ed.annonce; classe = 'is-ok'; }
    else if (ed.aPublier) { texte = 'Brouillon enregistré, pas encore en ligne. Vérifiez l’aperçu, puis publiez.'; classe = 'is-attente'; }
    else { texte = 'Le site en ligne est à jour.'; classe = 'is-ok'; }
    zone.textContent = typo(texte);
    zone.className = `ad-etat ${classe}`;
    $('[data-publier]').disabled = ed.bloque || !(ed.aPublier || ed.aEnvoyer || ed.envoi);
    $('[data-annuler-brouillon]').hidden = ed.bloque || !(ed.aPublier || ed.aEnvoyer);
    $('[data-recharger]').hidden = !ed.bloque;
  }

  function modifie() {
    ed.aEnvoyer = true;
    ed.alerte = '';
    ed.annonce = '';
    clearTimeout(ed.minuteur);
    ed.minuteur = setTimeout(enregistrer, 1000);
    afficherEtat();
  }

  // Envoie le brouillon (un envoi à la fois) ; vrai quand tout est enregistré
  async function enregistrer() {
    clearTimeout(ed.minuteur);
    ed.minuteur = null;
    while (ed.envoi) await ed.envoi.catch(() => {});
    if (ed.bloque) return false;
    if (!ed.aEnvoyer) return !ed.erreur;
    ed.aEnvoyer = false;
    const envoi = api('contenus', { methode: 'PUT', corps: { version: ed.version, valeur: ed.brouillon } });
    ed.envoi = envoi;
    afficherEtat();
    try {
      const reponse = await envoi;
      ed.version = reponse.version;
      ed.aPublier = reponse.aPublier;
      ed.erreur = '';
    } catch (erreur) {
      ed.aEnvoyer = true;
      ed.erreur = erreur.message;
      if (erreur.statut === 409) ed.bloque = true;
    } finally {
      ed.envoi = null;
    }
    afficherEtat();
    afficherPastilles();
    // D'autres modifications sont arrivées pendant l'envoi : on les envoie aussi
    if (ed.aEnvoyer && !ed.erreur && !ed.bloque) return enregistrer();
    return !ed.erreur && !ed.bloque;
  }

  async function attendreEnvoi() {
    clearTimeout(ed.minuteur);
    ed.aEnvoyer = false;
    while (ed.envoi) await ed.envoi.catch(() => {});
  }

  async function chargerContenus() {
    message(zoneContenus, 'Chargement des contenus…', true);
    try {
      const etat = await api('contenus');
      // Modifications locales pas encore enregistrées (session expirée, par exemple) : on les garde
      // si personne n'a touché au brouillon entre-temps
      const garder = ed.aEnvoyer && ed.brouillon && etat.version === ed.version && !ed.bloque;
      if (!garder) ed.brouillon = etat.brouillon;
      ed.publie = etat.publie;
      ed.version = etat.version;
      ed.aPublier = etat.aPublier;
      ed.erreur = '';
      ed.bloque = false;
      ed.alerte = '';
      message(zoneContenus, '');
      $('[data-editeur]').hidden = false;
      $('[data-publication]').hidden = false;
      $('[data-historique-bloc]').hidden = false;
      afficherSections();
      let section = ed.section;
      if (!section) {
        try { section = sessionStorage.getItem('nolout-section'); } catch { /* navigation privée */ }
      }
      afficherSection(section || 'pub');
      afficherEtat();
      chargerHistorique();
      if (garder) enregistrer();
    } catch (erreur) {
      message(zoneContenus, erreur.message);
    }
  }

  function ouvrirContenus() {
    // Rien en attente : on repart de la base (un collègue a peut-être publié entre-temps)
    if (!ed.brouillon || (!ed.aEnvoyer && !ed.envoi && !ed.erreur)) chargerContenus();
  }

  // Aperçu : les modifications en attente sont enregistrées avant d'ouvrir la page
  function ouvrirApercu(evenement) {
    if (!ed.aEnvoyer && !ed.envoi) return;
    evenement.preventDefault();
    const adresse = evenement.currentTarget.href;
    const fenetre = window.open('', '_blank');
    enregistrer().then(() => {
      if (fenetre) fenetre.location.href = adresse;
      else location.href = adresse;
    });
  }
  $('[data-apercu]').addEventListener('click', ouvrirApercu);

  $('[data-publier]').addEventListener('click', async () => {
    const bouton = $('[data-publier]');
    bouton.disabled = true;
    if (!(await enregistrer())) return afficherEtat();
    if (!ed.aPublier) {
      ed.annonce = 'Rien à publier : le site en ligne est déjà à jour.';
      return afficherEtat();
    }
    const noms = sectionsModifiees().map((s) => `• ${s.titre}`);
    const liste = noms.length ? noms.join('\n') : '• Réglages divers';
    if (!confirm(`Publier ces modifications sur le site ?\n\n${liste}\n\nElles seront visibles par tous les visiteurs.`)) return afficherEtat();
    $('[data-etat]').textContent = 'Publication…';
    try {
      const reponse = await api('publier', { methode: 'POST', corps: { version: ed.version } });
      ed.publie = cloner(ed.brouillon);
      ed.aPublier = false;
      ed.annonce = reponse.cacheVide ? 'Publié ! Le site est à jour.' : 'Publié ! Le site sera à jour d’ici une minute.';
      chargerHistorique();
    } catch (erreur) {
      ed.alerte = `Publication refusée : ${erreur.message}`;
      if (erreur.statut === 409) { ed.bloque = true; ed.erreur = erreur.message; }
    }
    afficherEtat();
    afficherPastilles();
  });

  $('[data-annuler-brouillon]').addEventListener('click', async () => {
    if (!confirm('Annuler toutes les modifications qui ne sont pas encore publiées ? Le brouillon reprendra le contenu du site en ligne.')) return;
    await attendreEnvoi();
    try {
      await api('annuler', { methode: 'POST', corps: {} });
    } catch (erreur) {
      return message(zoneContenus, erreur.message);
    }
    ed.brouillon = null;
    await chargerContenus();
    ed.annonce = 'Modifications annulées : le brouillon est identique au site en ligne.';
    afficherEtat();
  });

  $('[data-recharger]').addEventListener('click', () => {
    ed.aEnvoyer = false;
    ed.bloque = false;
    ed.brouillon = null;
    chargerContenus();
  });

  // ── Historique des publications ──
  async function chargerHistorique() {
    const liste = $('[data-historique]');
    try {
      const { versions } = await api('historique');
      liste.replaceChildren();
      if (!versions.length) {
        liste.append(element('li', 'ad-vide', 'Aucune publication pour l’instant.'));
        return;
      }
      for (const v of versions) {
        const date = DATE.format(new Date(v.publie_le));
        const li = element('li', 'ad-historique__version');
        const origine = v.publie_par === 'installation';
        const textes = element('div');
        textes.append(
          element('p', 'ad-historique__date', origine ? 'Version d’origine du site' : `Version publiée le ${date}`),
          element('p', 'ad-historique__qui', origine ? `Mise en place le ${date}` : `par ${v.publie_par || 'un membre de l’équipe'}`),
        );
        const bouton = element('button', 'nl-btn nl-btn--verre nl-btn--petit', 'Remettre dans le brouillon');
        bouton.type = 'button';
        bouton.addEventListener('click', async () => {
          if (!confirm(`Remettre dans le brouillon la version du ${date} ? Les modifications non publiées seront remplacées. Rien ne change en ligne avant « Publier ».`)) return;
          await attendreEnvoi();
          try {
            await api('restaurer', { methode: 'POST', corps: { id: v.id } });
          } catch (erreur) {
            return message(zoneContenus, erreur.message);
          }
          ed.brouillon = null;
          await chargerContenus();
          ed.annonce = 'Ancienne version remise dans le brouillon : vérifiez l’aperçu, puis publiez.';
          afficherEtat();
          afficherPastilles();
        });
        li.append(textes, bouton);
        liste.append(li);
      }
    } catch (erreur) {
      liste.replaceChildren(element('li', 'ad-vide', erreur.message));
    }
  }

  // Modifications pas encore enregistrées : prévenir avant de quitter, envoyer si l'onglet passe en arrière-plan
  window.addEventListener('beforeunload', (e) => {
    if (ed.aEnvoyer || ed.envoi) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && ed.aEnvoyer && !ed.envoi) enregistrer();
  });

  // ── Équipe ──
  async function chargerComptes() {
    const liste = $('[data-comptes]');
    try {
      const { comptes } = await api('comptes');
      liste.replaceChildren();
      for (const c of comptes) {
        const li = element('li', `ad-compte${c.actif ? '' : ' is-inactif'}`);
        const textes = element('div');
        textes.append(element('p', 'ad-compte__nom', c.nom + (c.id === compte.id ? ' (vous)' : '')));
        const derniere = c.derniere_connexion ? `dernière connexion le ${DATE.format(new Date(c.derniere_connexion))}` : 'jamais connecté';
        textes.append(element('p', 'ad-compte__detail', `${c.email} · ${c.actif ? derniere : 'accès désactivé'}`));
        li.append(textes);
        if (c.id !== compte.id) {
          const bouton = element('button', 'nl-btn nl-btn--verre nl-btn--petit', c.actif ? 'Désactiver' : 'Réactiver');
          bouton.type = 'button';
          bouton.addEventListener('click', async () => {
            if (c.actif && !confirm(`Retirer l’accès de ${c.nom} à l’administration ?`)) return;
            try {
              await api('comptes', { methode: 'PATCH', corps: { id: c.id, actif: !c.actif } });
              chargerComptes();
            } catch (erreur) {
              alert(erreur.message);
            }
          });
          li.append(bouton);
        }
        liste.append(li);
      }
    } catch (erreur) {
      liste.replaceChildren(element('li', 'ad-vide', erreur.message));
    }
  }

  // ── Formulaires ──
  brancherFormulaire('connexion', async (donnees, form) => {
    const { compte: c } = await api('session', { methode: 'POST', corps: { email: donnees.email, motDePasse: donnees.motDePasse } });
    form.reset();
    ouvrirApp(c);
  });

  brancherFormulaire('premier-compte', async (donnees) => {
    if (donnees.motDePasse !== donnees.confirmation) throw new Error('Les deux mots de passe ne sont pas identiques.');
    const { compte: c } = await api('premier-compte', { methode: 'POST', corps: { nom: donnees.nom, email: donnees.email, motDePasse: donnees.motDePasse } });
    ouvrirApp(c);
  });

  brancherFormulaire('nouveau-compte', async (donnees, form, zone) => {
    await api('comptes', { methode: 'POST', corps: donnees });
    form.reset();
    message(zone, `Compte créé. Transmettez le mot de passe provisoire à ${donnees.nom} de vive voix : il pourra le changer dans « Mon compte ».`, true);
    chargerComptes();
  });

  brancherFormulaire('mot-de-passe', async (donnees, form, zone) => {
    await api('mot-de-passe', { methode: 'POST', corps: donnees });
    form.reset();
    message(zone, 'Mot de passe changé. Vos autres sessions ouvertes sont fermées.', true);
  });

  $('[data-deconnexion]').addEventListener('click', async () => {
    try { await api('session', { methode: 'DELETE', corps: {} }); } catch { /* la session est de toute façon abandonnée */ }
    compte = null;
    afficherEcran('connexion');
  });

  // ── Démarrage ──
  (async () => {
    try {
      const etat = await api('session');
      if (etat.compte) return ouvrirApp(etat.compte);
      if (etat.premierCompte) return afficherEcran(etat.installationIci ? 'premier-compte' : 'installation');
      afficherEcran('connexion');
    } catch (erreur) {
      afficherEcran('connexion');
      message($('[data-form="connexion"] [data-message]'), erreur.message);
    }
  })();
})();

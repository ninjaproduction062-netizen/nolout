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
    if (reponse.status === 401 && action !== 'session') {
      afficherEcran('connexion');
      throw new Error(donnees.erreur || 'Session expirée : reconnectez-vous.');
    }
    if (!reponse.ok || donnees.ok === false) throw new Error(donnees.erreur || `Erreur ${reponse.status}`);
    return donnees;
  }

  // ── Écrans ──
  function afficherEcran(nom) {
    $$('[data-ecran]').forEach((el) => { el.hidden = el.dataset.ecran !== nom; });
    const premierChamp = $(`[data-ecran="${nom}"] input`);
    if (premierChamp) premierChamp.focus();
  }

  function message(zone, texte, ok = false) {
    if (!zone) return;
    zone.textContent = texte || '';
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
    if (nom === 'equipe') chargerComptes();
  }
  $$('[data-onglet]').forEach((b) => b.addEventListener('click', () => ouvrirOnglet(b.dataset.onglet)));

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
    if (texte !== undefined && texte !== null) el.textContent = texte;
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

/* NOLOUT SARLU — interactions du site (sans dépendance).
 * Mégamenu, menu mobile, schéma des départements, compteurs, publicité vidéo, formulaire de contact. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Mégamenu « Départements » : clic, Entrée ou ↓ ; Échap ou clic extérieur pour fermer ── */
  const btnMega = $('[data-megamenu]');
  const mega = $('#nl-mega');
  if (btnMega && mega) {
    const liens = () => $$('a', mega);
    const ouvrir = (focusPremier) => {
      mega.hidden = false;
      btnMega.setAttribute('aria-expanded', 'true');
      if (focusPremier) liens()[0].focus();
    };
    const fermer = (rendreFocus) => {
      if (mega.hidden) return;
      mega.hidden = true;
      btnMega.setAttribute('aria-expanded', 'false');
      if (rendreFocus) btnMega.focus();
    };
    btnMega.addEventListener('click', () => (mega.hidden ? ouvrir(false) : fermer(false)));
    btnMega.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); ouvrir(true); }
    });
    mega.addEventListener('keydown', (e) => {
      const l = liens();
      const i = l.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); l[(i + 1) % l.length].focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
    });
    mega.addEventListener('focusout', (e) => {
      if (e.relatedTarget && !mega.contains(e.relatedTarget) && e.relatedTarget !== btnMega) fermer(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(true); });
    document.addEventListener('click', (e) => {
      if (!mega.hidden && !mega.contains(e.target) && !btnMega.contains(e.target)) fermer(false);
    });
  }

  /* ── Barre d'en-tête : cachée quand on descend, visible dès qu'on remonte (comme n8n.io) ── */
  const entete = $('.nl-entete');
  if (entete) {
    let dernierY = window.scrollY;
    let prevu = false;
    const suivreDefilement = () => {
      prevu = false;
      const y = window.scrollY;
      const occupee = (mega && !mega.hidden) || entete.contains(document.activeElement);
      if (y < 120 || y < dernierY - 4 || occupee) entete.classList.remove('is-cache');
      else if (y > dernierY + 4) entete.classList.add('is-cache');
      dernierY = y;
    };
    addEventListener('scroll', () => {
      if (!prevu) { prevu = true; requestAnimationFrame(suivreDefilement); }
    }, { passive: true });
    entete.addEventListener('focusin', () => entete.classList.remove('is-cache'));
  }

  /* ── Menu mobile plein écran ── */
  const menu = $('#nl-menu');
  const burger = $('[data-burger]');
  if (menu && burger && typeof menu.showModal === 'function') {
    burger.addEventListener('click', () => {
      menu.showModal();
      burger.setAttribute('aria-expanded', 'true');
    });
    menu.addEventListener('close', () => burger.setAttribute('aria-expanded', 'false'));
    $$('[data-fermer-menu], a', menu).forEach((el) => el.addEventListener('click', () => menu.close()));
    const large = matchMedia('(min-width: 1100px)');
    const auPassage = () => { if (large.matches && menu.open) menu.close(); };
    if (large.addEventListener) large.addEventListener('change', auPassage);
  }

  /* ── Accueil : schéma interactif des départements ── */
  const hub = $('[data-hub]');
  if (hub) {
    const noeuds = $$('[data-noeud]', hub);
    const lignes = $$('[data-ligne]', hub);
    const fiches = $$('[data-fiche]', hub);
    const choisir = (i) => {
      noeuds.forEach((n, k) => n.setAttribute('aria-pressed', String(k === i)));
      lignes.forEach((l, k) => l.classList.toggle('is-actif', k === i));
      fiches.forEach((f, k) => { f.hidden = k !== i; });
    };
    noeuds.forEach((n, i) => n.addEventListener('click', () => choisir(i)));
  }

  /* ── Accueil : les six départements tournent autour de NOLOUT ──
   * Orbite elliptique calculée sur la taille du cadre (aucune case ne dépasse),
   * un tour en 60 s. Pause au survol, au focus clavier, hors écran ou avec le bouton. */
  const orbite = $('[data-orbite]');
  if (orbite && !reduit) {
    const noeuds = $$('[data-noeud]', orbite);
    const lignes = $$('[data-ligne]', orbite);
    const anneau = $('[data-anneau]', orbite);
    const bouton = $('[data-pause-orbite]');
    const large = matchMedia('(min-width: 720px)');
    const TOUR = 60000;
    let W = 0, H = 0, rx = 0, ry = 0, tailles = [];
    let angle = 0, precedent = null, raf = 0;
    let survol = false, focusClavier = false, arret = false, visible = true;

    const mesurer = () => {
      W = orbite.clientWidth;
      H = orbite.clientHeight;
      tailles = noeuds.map((n) => [n.offsetWidth, n.offsetHeight]);
      rx = W / 2 - Math.max(...tailles.map((t) => t[0])) / 2 - 12;
      ry = H / 2 - Math.max(...tailles.map((t) => t[1])) / 2 - 14;
      if (anneau) {
        anneau.setAttribute('rx', ((rx / W) * 100).toFixed(2));
        anneau.setAttribute('ry', ((ry / H) * 100).toFixed(2));
      }
    };
    const placer = () => {
      noeuds.forEach((n, i) => {
        const a = ((Number(n.dataset.angle) + angle) * Math.PI) / 180;
        const x = W / 2 + rx * Math.cos(a);
        const y = H / 2 + ry * Math.sin(a);
        n.style.transform = `translate(${(x - tailles[i][0] / 2).toFixed(1)}px, ${(y - tailles[i][1] / 2).toFixed(1)}px)`;
        lignes[i].setAttribute('x2', ((x / W) * 100).toFixed(2));
        lignes[i].setAttribute('y2', ((y / H) * 100).toFixed(2));
      });
    };
    const tourner = (t) => {
      if (precedent !== null) angle = (angle + (Math.min(t - precedent, 100) / TOUR) * 360) % 360;
      precedent = t;
      placer();
      raf = requestAnimationFrame(tourner);
    };
    const actualiser = () => {
      if (!large.matches) {
        cancelAnimationFrame(raf);
        raf = 0;
        orbite.classList.remove('is-orbite');
        noeuds.forEach((n) => { n.style.transform = ''; });
        if (bouton) bouton.hidden = true;
        return;
      }
      if (!orbite.classList.contains('is-orbite')) {
        orbite.classList.add('is-orbite');
        mesurer();
        placer();
      }
      if (bouton) bouton.hidden = false;
      const enMouvement = visible && !survol && !focusClavier && !arret;
      if (enMouvement && !raf) { precedent = null; raf = requestAnimationFrame(tourner); }
      if (!enMouvement && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    orbite.addEventListener('mouseenter', () => { survol = true; actualiser(); });
    orbite.addEventListener('mouseleave', () => { survol = false; actualiser(); });
    orbite.addEventListener('focusin', (e) => { focusClavier = e.target.matches(':focus-visible'); actualiser(); });
    orbite.addEventListener('focusout', (e) => {
      if (!orbite.contains(e.relatedTarget)) { focusClavier = false; actualiser(); }
    });
    if (bouton) {
      bouton.addEventListener('click', () => {
        arret = bouton.getAttribute('aria-pressed') !== 'true';
        bouton.setAttribute('aria-pressed', String(arret));
        actualiser();
      });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entree]) => { visible = entree.isIntersecting; actualiser(); }).observe(orbite);
    }
    const remesurer = () => { if (orbite.classList.contains('is-orbite')) { mesurer(); placer(); } };
    if ('ResizeObserver' in window) new ResizeObserver(remesurer).observe(orbite);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remesurer);
    if (large.addEventListener) large.addEventListener('change', actualiser);
    actualiser();
  }

  /* ── Compteurs de chiffres clés : 0 → valeur en 1,2 s, au premier affichage ── */
  const compteurs = $$('[data-compteur]');
  if (compteurs.length && !reduit && 'IntersectionObserver' in window) {
    const animer = (el) => {
      const cible = Number(el.dataset.compteur);
      const debut = performance.now();
      const pas = (t) => {
        const p = Math.min(1, (t - debut) / 1200);
        el.textContent = String(Math.round(cible * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    };
    const io = new IntersectionObserver((entrees) => {
      entrees.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        animer(en.target);
      });
    }, { threshold: 0.6 });
    compteurs.forEach((el) => io.observe(el));
  }

  /* ── Témoignages : apparition au défilement, carte après carte (modèle campus.ena.gouv.cd) ──
   * Les cartes ne sont masquées que si le script tourne : sans lui, elles restent visibles. */
  const temoignages = $$('.nl-temoignage');
  if (temoignages.length && !reduit && 'IntersectionObserver' in window) {
    const ioTemoignages = new IntersectionObserver((entrees) => {
      entrees.forEach((en) => {
        if (!en.isIntersecting) return;
        ioTemoignages.unobserve(en.target);
        en.target.classList.replace('is-attente', 'is-vu');
      });
    }, { threshold: 0.2 });
    temoignages.forEach((t, i) => {
      t.style.setProperty('--delai', `${i * 0.12}s`);
      t.classList.add('is-attente');
      ioTemoignages.observe(t);
    });
  }

  /* ── Logos clients : bouton pause du défilement ── */
  const defilants = $('[data-defilants]');
  const pause = $('[data-pause-defilement]');
  if (defilants && pause) {
    pause.addEventListener('click', () => {
      const enPause = pause.getAttribute('aria-pressed') !== 'true';
      pause.setAttribute('aria-pressed', String(enPause));
      defilants.classList.toggle('is-pause', enPause);
    });
  }

  /* ── Accueil : publicité vidéo, lue en boucle et sans le son quand elle est à l'écran ──
   * Pas de lecture automatique si le visiteur a réduit les animations ou active
   * l'économie de données : la vidéo attend un clic. Une pause demandée est respectée. */
  const pub = $('[data-pub]');
  if (pub) {
    const video = $('[data-pub-video]', pub);
    const lancer = $('[data-pub-lancer]', pub);
    const btnPause = $('[data-pub-pause]', pub);
    const btnSon = $('[data-pub-son]', pub);
    const btnPlein = $('[data-pub-plein-ecran]', pub);
    const progression = $('[data-pub-progression]', pub);
    const liste = (video.dataset.pubListe || '').split(' ').filter(Boolean);
    const economie = navigator.connection && navigator.connection.saveData;
    let auto = !reduit && !economie;   // lecture automatique permise
    let arretVoulu = false;            // pause demandée par le visiteur
    let visible = false;
    let index = 0;
    let suivi = 0;

    // Le lecteur natif (sans JavaScript) laisse place aux commandes du site
    video.controls = false;
    lancer.hidden = false;
    $('[data-pub-barre]', pub).hidden = false;

    const suivre = () => {
      if (video.duration) progression.style.transform = `scaleX(${(video.currentTime / video.duration).toFixed(4)})`;
      suivi = video.paused ? 0 : requestAnimationFrame(suivre);
    };
    const majEtat = () => {
      // Entre deux vidéos de la liste, la fin de l'une n'est pas une pause
      const enPause = video.paused && !(video.ended && liste.length > 1);
      btnPause.setAttribute('aria-pressed', String(enPause));
      pub.classList.toggle('is-lecture', !enPause);
      if (!video.paused && !suivi) suivi = requestAnimationFrame(suivre);
    };
    const lire = () => {
      const essai = video.play();
      // Lecture refusée par le navigateur : le grand bouton reste affiché
      if (essai && essai.catch) essai.catch(majEtat);
    };
    const actualiser = () => {
      if (visible && auto && !arretVoulu) { if (video.paused) lire(); }
      else if (!visible && !video.paused) video.pause();
    };
    const basculer = () => {
      if (video.paused) { arretVoulu = false; auto = true; lire(); }
      else { arretVoulu = true; video.pause(); }
    };

    [btnPause, lancer, video].forEach((el) => el.addEventListener('click', basculer));
    video.addEventListener('play', majEtat);
    video.addEventListener('pause', majEtat);
    if (liste.length > 1) {
      video.addEventListener('ended', () => {
        index = (index + 1) % liste.length;
        video.src = liste[index];
        lire();
      });
    }

    btnSon.addEventListener('click', () => {
      video.muted = !video.muted;
      btnSon.setAttribute('aria-pressed', String(!video.muted));
    });

    if (!pub.requestFullscreen && !video.webkitEnterFullscreen) btnPlein.hidden = true;
    btnPlein.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (pub.requestFullscreen) pub.requestFullscreen().catch(() => {});
      else video.webkitEnterFullscreen();   // iPhone : plein écran du lecteur natif
    });
    document.addEventListener('fullscreenchange', () => {
      btnPlein.setAttribute('aria-label', document.fullscreenElement === pub ? 'Quitter le plein écran' : 'Afficher la vidéo en plein écran');
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entree]) => {
        visible = entree.intersectionRatio >= 0.5;
        actualiser();
      }, { threshold: [0, 0.5] }).observe(pub);
    } else {
      visible = true;
      actualiser();
    }
    majEtat();
  }

  /* ── Cookies : consentement (bandeau, réglages, bouton flottant) ──
   * Le choix est gardé 6 mois dans le navigateur. Les scripts marqués
   * <script type="text/plain" data-consentement="mesure|marketing"> ne sont
   * exécutés qu'après accord ; l'événement « nl:consentement » annonce le choix. */
  const CLE_COOKIES = 'nolout-cookies';
  const SIX_MOIS = 182 * 24 * 3600 * 1000;
  const banniere = $('[data-cookies-banniere]');
  const reglages = $('#nl-cookies-reglages');
  const badge = $('.nl-cookies-badge');
  const interrupteurs = reglages ? $$('[data-categorie]', reglages) : [];

  const lireChoix = () => {
    try {
      const c = JSON.parse(localStorage.getItem(CLE_COOKIES));
      if (c && c.v === 1 && Date.now() - c.date < SIX_MOIS) return c.choix;
    } catch (e) { /* stockage indisponible : le bandeau réapparaîtra */ }
    return null;
  };
  const appliquer = (choix) => {
    $$('script[type="text/plain"][data-consentement]').forEach((s) => {
      if (!choix[s.dataset.consentement] || s.dataset.active) return;
      s.dataset.active = '1';
      const script = document.createElement('script');
      if (s.dataset.src) { script.src = s.dataset.src; script.async = true; } else { script.textContent = s.textContent; }
      document.head.appendChild(script);
    });
    window.nlConsentement = choix;
    document.dispatchEvent(new CustomEvent('nl:consentement', { detail: choix }));
  };
  // Consentement retiré : on efface les cookies des outils de mesure déjà déposés
  const effacerCookiesMesure = () => {
    document.cookie.split(';').forEach((c) => {
      const nom = c.split('=')[0].trim();
      if (!/^(_ga|_gid|_gat|_fbp|_fbc)/.test(nom)) return;
      const parties = location.hostname.split('.');
      for (let i = 0; i < parties.length; i++) {
        document.cookie = `${nom}=; Max-Age=0; path=/; domain=${parties.slice(i).join('.')}`;
      }
      document.cookie = `${nom}=; Max-Age=0; path=/`;
    });
  };
  const toutes = (valeur) => Object.fromEntries(interrupteurs.map((i) => [i.dataset.categorie, valeur]));
  const enregistrerChoix = (choix) => {
    const avant = lireChoix();
    try { localStorage.setItem(CLE_COOKIES, JSON.stringify({ v: 1, date: Date.now(), choix })); } catch (e) { /* choix valable pour cette page seulement */ }
    if (banniere) banniere.hidden = true;
    if (badge) badge.hidden = false;
    if (reglages && reglages.open) reglages.close();
    if (avant && Object.keys(avant).some((k) => avant[k] && !choix[k])) {
      effacerCookiesMesure();
      window.location.reload();
      return;
    }
    appliquer(choix);
  };
  const ouvrirReglages = () => {
    if (!reglages || typeof reglages.showModal !== 'function') return;
    const choix = lireChoix() || {};
    interrupteurs.forEach((i) => { i.checked = Boolean(choix[i.dataset.categorie]); });
    reglages.showModal();
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cookies]');
    if (!b) return;
    const action = b.dataset.cookies;
    if (action === 'accepter') enregistrerChoix(toutes(true));
    else if (action === 'refuser') enregistrerChoix(toutes(false));
    else if (action === 'enregistrer') enregistrerChoix(Object.fromEntries(interrupteurs.map((i) => [i.dataset.categorie, i.checked])));
    else if (action === 'personnaliser') ouvrirReglages();
    else if (action === 'fermer' && reglages) reglages.close();
  });
  if (reglages) reglages.addEventListener('click', (e) => { if (e.target === reglages) reglages.close(); });

  const choixCookies = lireChoix();
  if (choixCookies) {
    appliquer(choixCookies);
    if (badge) badge.hidden = false;
  } else if (banniere) {
    banniere.hidden = false;
  }

  /* ── Contact : formulaire en 3 étapes, validation et routage par département ── */
  const form = $('#nl-formulaire');
  if (!form) return;

  const radios = $$('input[name="departement"]', form);
  const orientation = $('[data-orientation]', form);
  const erreurDept = $('[data-erreur-departement]', form);
  const resume = $('[data-resume]', form);
  const succes = $('[data-succes]', form);
  const envoyer = $('[type="submit"]', form);
  const libelleEnvoyer = envoyer.innerHTML;
  const halo = $('[data-halo]');
  const message = $('#c-message');
  const exempleParDefaut = message.placeholder;

  const champs = {
    nom: { el: $('#c-nom'), ok: (v) => v.trim() !== '', erreur: 'Indiquez votre nom.' },
    email: { el: $('#c-email'), ok: (v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v.trim()), erreur: 'Adresse incomplète. Exemple : nom@domaine.cd' },
    message: { el: message, ok: (v) => v.trim().length >= 10, erreur: 'Décrivez votre demande en quelques mots (10 caractères minimum).' },
  };
  let tente = false;

  const choix = () => radios.find((r) => r.checked) || null;
  const equipe = (r) => (r.value === '?' ? 'NOLOUT' : r.dataset.nom);

  const majDepartement = () => {
    const r = choix();
    if (halo) {
      halo.style.setProperty('--halo-rgb', r ? r.dataset.rgb : '233, 168, 37');
      halo.style.setProperty('--halo-alpha', r ? '.2' : '.16');
    }
    message.placeholder = r ? r.dataset.exemple : exempleParDefaut;
    orientation.hidden = !r;
    if (r) {
      orientation.textContent = r.value === '?'
        ? '→ Votre demande sera lue par l’accueil du groupe, puis orientée.'
        : `→ Votre demande sera transmise directement à l’équipe ${r.dataset.nom}.`;
    }
    if (tente) valider();
  };

  const marquer = (cle, enErreur) => {
    const { el, erreur } = champs[cle];
    const msg = document.getElementById(`${el.id}-msg`);
    el.setAttribute('aria-invalid', String(enErreur));
    el.closest('.nl-champ').classList.toggle('is-erreur', enErreur);
    msg.textContent = enErreur ? `⚠ ${erreur}` : (msg.dataset.aide || '');
  };

  // Renvoie les éléments en erreur, dans l'ordre du formulaire
  const valider = () => {
    const fautifs = [];
    const sansDept = !choix();
    erreurDept.hidden = !sansDept;
    if (sansDept) fautifs.push(radios[0]);
    Object.keys(champs).forEach((cle) => {
      const mauvais = !champs[cle].ok(champs[cle].el.value);
      marquer(cle, mauvais);
      if (mauvais) fautifs.push(champs[cle].el);
    });
    const n = fautifs.length;
    resume.hidden = n === 0;
    resume.textContent = `⚠ ${n} champ${n > 1 ? 's' : ''} à compléter avant l’envoi.`;
    return fautifs;
  };

  const chargement = (actif) => {
    envoyer.disabled = actif;
    envoyer.innerHTML = actif ? '<span class="nl-btn__spinner" aria-hidden="true"></span>Envoi…' : libelleEnvoyer;
  };

  const annoncer = (html) => {
    succes.innerHTML = html;
    succes.hidden = false;
    succes.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'center' });
  };

  radios.forEach((r) => r.addEventListener('change', majDepartement));
  Object.values(champs).forEach(({ el }) => el.addEventListener('input', () => { if (tente) valider(); }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    tente = true;
    succes.hidden = true;
    const fautifs = valider();
    if (fautifs.length) { fautifs[0].focus(); return; }

    const r = choix();
    const valeur = (id) => $(`#${id}`).value.trim();
    const donnees = {
      departement: r.value,
      equipe: equipe(r),
      destinataire: r.dataset.email,
      nom: valeur('c-nom'),
      entreprise: valeur('c-entreprise'),
      email: valeur('c-email'),
      telephone: valeur('c-telephone'),
      message: valeur('c-message'),
      site_web: $('#c-site') ? valeur('c-site') : '',   // champ piège : rempli par les robots seulement
    };

    // Service d'envoi configuré (contenu.json → groupe.formulaireEndpoint) : il route selon « destinataire »
    const endpoint = (form.dataset.endpoint || '').trim();
    if (endpoint) {
      chargement(true);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(donnees),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        form.reset();
        tente = false;
        majDepartement();
        orientation.hidden = true;
        annoncer(`✓ Demande envoyée. L’équipe ${donnees.equipe} vous répondra sous 48 h ouvrées.`);
      } catch (err) {
        resume.hidden = false;
        resume.innerHTML = `⚠ L’envoi n’a pas abouti. Réessayez dans un instant, ou écrivez directement à <a href="mailto:${donnees.destinataire}">${donnees.destinataire}</a>.`;
      } finally {
        chargement(false);
      }
      return;
    }

    // Sans service d'envoi : la demande s'ouvre dans la messagerie, adressée à la bonne équipe
    const sujet = `Demande de contact — ${donnees.equipe}`;
    const corps = [
      `Département : ${r.value === '?' ? 'à orienter' : donnees.equipe}`,
      `Nom : ${donnees.nom}`,
      donnees.entreprise ? `Entreprise : ${donnees.entreprise}` : null,
      `E-mail : ${donnees.email}`,
      donnees.telephone ? `Téléphone / WhatsApp : ${donnees.telephone}` : null,
      '',
      donnees.message,
    ].filter((ligne) => ligne !== null).join('\n');
    const lien = `mailto:${donnees.destinataire}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    window.location.href = lien;
    annoncer(`✓ Votre messagerie s’ouvre avec la demande adressée à l’équipe ${donnees.equipe}. Si elle ne s’ouvre pas, écrivez à <a href="${lien}">${donnees.destinataire}</a>.`);
  });

  // Département présélectionné depuis une page département : contact/?departement=con
  const pre = new URLSearchParams(window.location.search).get('departement');
  const cible = pre && radios.find((r) => r.value === pre);
  if (cible) { cible.checked = true; majDepartement(); }
})();

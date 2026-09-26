// ==========================================================================
//  NOLOUT SARLU - fabrication des pages du site à partir du contenu (JSON)
//  Portage fidèle de l'ancien sources/generer.ps1 : mêmes pages, au caractère près.
//  Utilisé par Vercel (api/page.js, contenu lu dans la base Neon) et, sur un poste,
//  par scripts/generer.mjs (aperçu local à partir de sources/contenu.json).
// ==========================================================================

const NBSP = '\u00A0';

// Échappe le HTML et pose les espaces insécables de la typographie française
export function E(texte) {
  if (texte === null || texte === undefined) return '';
  const t = String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/ (?=[:;!?%\u00BB])/g, NBSP);
  return t.split('\u00AB ').join('\u00AB' + NBSP);
}

const joindre = (elements) => (elements || []).map((x) => (x === null || x === undefined ? '' : x)).join('\n');
const ou = (valeur, secours) => (valeur ? valeur : secours);

// Encodage d'URL strict (RFC 3986), comme [uri]::EscapeDataString
const escapeDataString = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// Nombre avec au plus deux décimales et un point décimal (CSS et SVG l'exigent),
// arrondi « loin de zéro » sur 15 chiffres significatifs, comme .NET
export function N(valeur) {
  const p = Number(Number(valeur).toPrecision(15));
  const signe = p < 0 ? -1 : 1;
  const [ent, dec = ''] = Math.abs(p).toFixed(10).split('.');
  let centiemes = Number(ent) * 100 + Number((dec + '00').slice(0, 2));
  if (Number(dec[2] || 0) >= 5) centiemes += 1;
  const v = (centiemes / 100) * signe;
  return String(v === 0 ? 0 : v);
}

// Tracés d'icônes (trait 1,5 à 2 px, grille 24), repris des maquettes
const ICONES = {
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  build: 'M4 21V9l8-5 8 5v12M9 21v-7h6v7',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  mega: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  game: 'M6 8h12a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8zM8 11v2M7 12h2M15 12h.01M17 12h.01',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  wa: 'M4 20l1.3-3.9A8 8 0 1 1 8 19zM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  org: 'M9 3h6v5H9zM4 16h6v5H4zM14 16h6v5h-6zM12 8v4M7 16v-4h10v4',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 6v1',
  plan: 'M3 4h18v16H3zM3 10h8v10M11 4v6M15 14h6',
  tools: 'M14 6l4 4-9 9H5v-4zM12 8l4 4M16 3l5 5',
  check: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  q: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01',
};

const svg = (nom, taille = 18, trait = '1.75') =>
  `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONES[nom] ?? ''}"/></svg>`;

// Variables CSS d'un département : --c (base), --c-clair, --c-rgb
const styleDept = (d) => `--c:${d.base};--c-clair:${d.clair};--c-rgb:${d.rgb}`;

const lienTel = (numero) => (numero ? 'tel:' + String(numero).replace(/[^\d+]/g, '') : null);
function lienWhatsApp(numero, message) {
  if (!numero) return null;
  let lien = 'https://wa.me/' + String(numero).replace(/\D/g, '');
  if (message) lien += '?text=' + escapeDataString(message);
  return lien;
}

const ICONE_COOKIE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.5A9 9 0 1 1 11.5 3a3 3 0 0 0 3.5 3.5 3 3 0 0 0 3.5 3.5 3 3 0 0 0 2.5 2.5z"/><path d="M8.5 9.5h.01M8 15h.01M12.5 12.5h.01M15.5 16h.01"/></svg>';

// Fabrique toutes les pages à partir d'un contenu (même structure que sources/contenu.json)
export function creerRendu(C) {
  const G = C.groupe;
  const DEPTS = C.departements || [];
  const PAR_CODE = Object.fromEntries(DEPTS.map((d) => [d.code, d]));
  const LEGAL = `RCCM ${G.rccm} · ID Nat. ${G.idNat} · N° impôt ${G.numeroImpot}`;
  const TEL_AFFICHE = ou(G.telephone, '+243 [numéro]');
  const WA_AFFICHE = G.whatsapp ? '+' + String(G.whatsapp).replace(/\D/g, '') : '+243 [numéro]';
  let R = ''; // préfixe vers la racine du site pour la page en cours ('', '../' ou '../../')

  // Image du site (site/assets/img/…) ou adresse complète (fichier envoyé depuis l'administration)
  const cheminImage = (fichier) => (/^https?:\/\//.test(fichier) ? fichier : `${R}assets/img/${fichier}`);

  // Bouton pause / lecture d'une animation (cible de 44 px)
  function boutonPause(libelle, attribut, classe = '', cache = false) {
    const masque = cache ? ' hidden' : '';
    return `<button type="button" class="nl-pause${classe}" aria-pressed="false" aria-label="${E(libelle)}" ${attribut}${masque}>
        <svg class="nl-pause__pause" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="2.5" height="9" rx="1" fill="currentColor"/><rect x="7.5" y="1.5" width="2.5" height="9" rx="1" fill="currentColor"/></svg>
        <svg class="nl-pause__lecture" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5z" fill="currentColor"/></svg>
      </button>`;
  }

  // Bouton sur le modèle n8n : libellé + flèche qui apparaît au survol ('or-glass' ou 'glass')
  const boutonFleche = (variante, href, libelle) =>
    `<a class="nl-btn nl-btn--${variante} nl-btn--fleche" href="${href}"><span class="nl-btn__libelle">${E(libelle)}</span><span class="nl-btn__icone" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a>`;

  // Visuel : image réelle ou emplacement « photo à venir » (aplat bleu nuit + trame or)
  function visuel(image, legende, format = '', prioritaire = false) {
    const classeFormat = format ? ` nl-visuel--${format}` : '';
    if (image && image.fichier) {
      const a = String(image.ajustement || '').toLowerCase();
      const ajuste = a === 'contain' ? ' nl-visuel--contain' : a === 'logo' ? ' nl-visuel--logo' : '';
      const fond = image.fond ? ` style="--fond:${image.fond}"` : '';
      const charge = prioritaire ? 'fetchpriority="high"' : 'loading="lazy"';
      return `<div class="nl-visuel${ajuste}${classeFormat}"${fond}><img src="${cheminImage(image.fichier)}" alt="${E(image.alt)}" ${charge} decoding="async"></div>`;
    }
    return `<div class="nl-visuel nl-vide${classeFormat}" role="img" aria-label="${E(legende)}"><span class="nl-vide__legende"><span>${E(legende)}</span></span></div>`;
  }

  function canal(icone, libelle, valeur, href, externe = false) {
    const cible = externe ? ' target="_blank" rel="noopener"' : '';
    return `<a class="nl-canal" href="${E(href)}"${cible}><span class="nl-canal__icone">${svg(icone, 22, '1.5')}</span><span class="nl-canal__textes"><span class="nl-canal__libelle">${E(libelle)}</span><span class="nl-canal__valeur">${E(valeur)}</span></span><span class="nl-canal__fleche" aria-hidden="true">→</span></a>`;
  }

  const tuileDept = (d, href) =>
    `<a class="nl-tuile-dept" href="${href}" style="${styleDept(d)}"><span class="nl-icone-dept nl-icone-dept--30">${svg(d.icone, 16)}</span><span class="nl-tuile-dept__nom">${E(d.nom)}</span></a>`;

  function bandeauDepts(titre, liste) {
    const tuiles = joindre(liste.map((d) => tuileDept(d, `${R}departements/${d.slug}/`)));
    return `<section class="nl-conteneur nl-section--96 nl-bandeau-depts" aria-label="${E(titre)}">
  <p class="nl-legende">${E(titre)}</p>
  <div class="nl-grille nl-grille--tuiles">
${tuiles}
  </div>
</section>`;
  }

  // ── En-tête, menus, pied de page ──────────────────────────────────────────

  function entete(actif) {
    const accueil = ou(R, './');
    const megaLiens = joindre(DEPTS.map((d) =>
      `<a class="nl-mega__lien" href="${R}departements/${d.slug}/" style="${styleDept(d)}"><span class="nl-icone-dept">${svg(d.icone, 17)}</span><span class="nl-mega__textes"><span class="nl-mega__nom">${E(d.nom)}</span><span class="nl-mega__domaine">${E(d.domaine)}</span></span></a>`));
    const nav = joindre((C.navigation || []).map((item) => {
      if (item.megamenu) {
        const classe = actif === 'departements' ? 'nl-nav__lien is-actif' : 'nl-nav__lien';
        return `<button type="button" class="${classe}" aria-expanded="false" aria-controls="nl-mega" data-megamenu>${E(item.libelle)}<span class="nl-nav__chevron" aria-hidden="true">&#9662;</span></button>
        <div class="nl-mega" id="nl-mega" hidden>
          <div class="nl-mega__panneau">
            <div class="nl-mega__intro">
              <span class="nl-mega__intro-surtitre">Nos départements</span>
              <span class="nl-mega__intro-titre">Six métiers, une même exigence.</span>
              <a class="nl-lien-or" href="${R}departements/">Vue d’ensemble →</a>
            </div>
            <div class="nl-mega__grille">
${megaLiens}
            </div>
          </div>
        </div>`;
      }
      const attrs = actif === item.page ? 'class="nl-nav__lien is-actif" aria-current="page"' : 'class="nl-nav__lien"';
      return `<a ${attrs} href="${R}${item.page}/">${E(item.libelle)}</a>`;
    }));
    const contactActif = actif === 'contact' ? ' nl-btn--actif" aria-current="page' : '';
    return `<header class="nl-entete">
  <div class="nl-entete__barre">
    <a class="nl-marque" href="${accueil}" aria-label="NOLOUT, accueil">
      <img class="nl-marque__logo" src="${R}assets/img/logo-nolout.webp" alt="" width="38" height="38">
      <span class="nl-marque__nom">NOLOUT</span>
    </a>
    <nav class="nl-nav" aria-label="Navigation principale">
        ${nav}
    </nav>
    <div class="nl-entete__fin">
      <p class="nl-langue nl-langue--pilule"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><span aria-current="true">FR</span> · <span lang="en" title="Version anglaise en préparation">EN</span></p>
      <a class="nl-btn nl-btn--or-glass nl-entete__contact${contactActif}" href="${R}contact/">Nous contacter</a>
      <button type="button" class="nl-burger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="nl-menu" data-burger><span></span><span></span><span></span></button>
    </div>
  </div>
</header>`;
  }

  function menuMobile() {
    const tuiles = joindre(DEPTS.map((d) =>
      `<li><a class="nl-menu__tuile" href="${R}departements/${d.slug}/" style="${styleDept(d)}"><span class="nl-icone-dept nl-icone-dept--28">${svg(d.icone, 15)}</span>${E(d.nom)}</a></li>`));
    const rubriques = joindre((C.navigation || []).filter((item) => !item.megamenu).map((item) =>
      `<li><a class="nl-menu__rubrique" href="${R}${item.page}/">${E(item.libelle)}</a></li>`));
    const wa = ou(lienWhatsApp(G.whatsapp, 'Bonjour NOLOUT, '), `${R}contact/#formulaire`);
    return `<dialog class="nl-menu" id="nl-menu" aria-label="Menu">
  <div class="nl-menu__tete">
    <span class="nl-marque__nom">NOLOUT</span>
    <button type="button" class="nl-menu__fermer" data-fermer-menu aria-label="Fermer le menu">×</button>
  </div>
  <nav class="nl-menu__corps" aria-label="Menu mobile">
    <p class="nl-menu__titre">Départements</p>
    <ul class="nl-menu__liste">
${tuiles}
    </ul>
    <ul class="nl-menu__rubriques">
${rubriques}
      <li><a class="nl-menu__rubrique" href="${R}contact/">Contact</a></li>
    </ul>
    <p class="nl-langue nl-menu__langue"><span aria-current="true">FR</span> · <span lang="en" title="Version anglaise en préparation">EN</span></p>
  </nav>
  <div class="nl-menu__pied">
    <a class="nl-btn nl-btn--verre" href="${E(wa)}">WhatsApp</a>
    <a class="nl-btn nl-btn--or" href="${R}contact/">Nous contacter</a>
  </div>
</dialog>`;
  }

  // Barre d'action fixe sur mobile : Appeler · WhatsApp · Devis
  function barreMobile(d) {
    let tel;
    let wa;
    let devis;
    if (d) {
      tel = ou(lienTel(ou(d.telephone, G.telephone)), `${R}contact/?departement=${d.code}#formulaire`);
      wa = ou(lienWhatsApp(ou(d.whatsapp, G.whatsapp), `Bonjour ${d.nom}, `), `${R}contact/?departement=${d.code}#formulaire`);
      devis = `${R}contact/?departement=${d.code}#formulaire`;
    } else {
      tel = ou(lienTel(G.telephone), `${R}contact/`);
      wa = ou(lienWhatsApp(G.whatsapp, 'Bonjour NOLOUT, '), `${R}contact/#formulaire`);
      devis = `${R}contact/#formulaire`;
    }
    return `<nav class="nl-barre-mobile" aria-label="Actions rapides">
  <a class="nl-btn nl-btn--verre" href="${E(tel)}">Appeler</a>
  <a class="nl-btn nl-btn--verre" href="${E(wa)}">WhatsApp</a>
  <a class="nl-btn nl-btn--or" href="${E(devis)}">Devis</a>
</nav>`;
  }

  function piedComplet() {
    const accueil = ou(R, './');
    const depts = joindre(DEPTS.map((d) => `<li><a href="${R}departements/${d.slug}/">${E(d.nom)}</a></li>`));
    const tel = ou(lienTel(G.telephone), `${R}contact/`);
    const wa = ou(lienWhatsApp(G.whatsapp, 'Bonjour NOLOUT, '), `${R}contact/#formulaire`);
    return `<footer class="nl-pied">
  <div class="nl-conteneur nl-pied__grille">
    <div class="nl-pied__marque">
      <a class="nl-pied__logo" href="${accueil}"><img src="${R}assets/img/logo-nolout.webp" alt="" width="34" height="34" loading="lazy"><span>NOLOUT</span></a>
      <p class="nl-pied__signature">${E(G.signature)}</p>
    </div>
    <div class="nl-pied__colonne">
      <h2 class="nl-pied__titre">Départements</h2>
      <ul>
${depts}
      </ul>
    </div>
    <div class="nl-pied__colonne">
      <h2 class="nl-pied__titre">Le groupe</h2>
      <ul>
        <li><a href="${R}groupe/">Histoire et vision</a></li>
        <li><a href="${R}realisations/">Réalisations</a></li>
        <li><a href="${R}actualites/">Actualités</a></li>
        <li><a href="${R}carrieres/">Carrières</a></li>
      </ul>
    </div>
    <div class="nl-pied__colonne">
      <h2 class="nl-pied__titre">Contact</h2>
      <ul>
        <li><a href="${E(tel)}">${E(TEL_AFFICHE)}</a></li>
        <li><a href="mailto:${G.email}">${E(G.email)}</a></li>
        <li><a href="${E(wa)}">WhatsApp</a></li>
        <li><span>${E(G.adresseCourte)}</span></li>
      </ul>
    </div>
  </div>
  <div class="nl-conteneur">
    <div class="nl-pied__legal">
      <span>© ${G.annee} ${E(G.raisonSociale)} · ${E(LEGAL)}</span>
      <nav aria-label="Informations légales"><a href="${R}mentions-legales/">Mentions légales</a><a href="${R}confidentialite/">Confidentialité</a><button type="button" class="nl-pied__cookies" data-cookies="personnaliser">Cookies</button></nav>
    </div>
  </div>
</footer>`;
  }

  const piedCompact = (texte) => `<footer class="nl-pied">
  <div class="nl-conteneur nl-pied__compact">
    <span><strong>NOLOUT</strong><span>${E(texte)}</span></span>
    <span class="nl-pied__droite"><span>${E(LEGAL)}</span><button type="button" class="nl-pied__cookies" data-cookies="personnaliser">Cookies</button></span>
  </div>
</footer>`;

  // ── Cookies : bandeau de consentement, réglages et bouton flottant ────────

  const banniereCookies = () => `<section class="nl-cookies" role="region" aria-labelledby="cookies-titre" data-cookies-banniere hidden>
  <h2 class="nl-cookies__titre" id="cookies-titre"><span class="nl-cookies__icone">${ICONE_COOKIE}</span>Cookies et vie privée</h2>
  <p class="nl-cookies__texte">Nous utilisons des cookies nécessaires au fonctionnement du site. Avec votre accord, nous utilisons aussi des cookies de mesure d’audience et de marketing pour améliorer nos services. Vous pouvez changer d’avis à tout moment. <a href="${R}confidentialite/">Politique de confidentialité</a></p>
  <div class="nl-cookies__actions">
    <button type="button" class="nl-btn nl-btn--verre nl-btn--petit" data-cookies="refuser">Tout refuser</button>
    <button type="button" class="nl-btn nl-btn--or nl-btn--petit" data-cookies="accepter">Tout accepter</button>
  </div>
  <button type="button" class="nl-cookies__perso" data-cookies="personnaliser">Personnaliser mes choix</button>
</section>`;

  const categorieCookie = (code, titre, texte) => `      <li class="nl-cookies-categorie">
        <label class="nl-cookies-categorie__textes" for="cc-${code}"><span class="nl-cookies-categorie__titre" id="cc-${code}-titre">${titre}</span><span class="nl-cookies-categorie__texte" id="cc-${code}-texte">${texte}</span></label>
        <input class="nl-interrupteur" type="checkbox" role="switch" id="cc-${code}" data-categorie="${code}" aria-labelledby="cc-${code}-titre" aria-describedby="cc-${code}-texte">
      </li>`;

  // Scripts des outils de mesure, neutralisés (type="text/plain") jusqu'au consentement
  function scriptsConsentement() {
    const s = [];
    const ga = String((C.cookies && C.cookies.googleAnalytics) || '').replace(/[^\w-]/g, '');
    if (ga) {
      s.push(`<script type="text/plain" data-consentement="mesure" data-src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>`);
      s.push(`<script type="text/plain" data-consentement="mesure">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');</script>`);
    }
    const pixel = String((C.cookies && C.cookies.metaPixel) || '').replace(/\D/g, '');
    if (pixel) {
      s.push(`<script type="text/plain" data-consentement="marketing">!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/fr_FR/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');</script>`);
    }
    return joindre(s);
  }

  function reglagesCookies() {
    const mesure = categorieCookie('mesure', 'Mesure d’audience', 'Statistiques de fréquentation (pages consultées, durée des visites) pour améliorer le site.');
    const marketing = categorieCookie('marketing', 'Marketing', 'Mesure de l’efficacité de nos publicités et contenus adaptés sur les réseaux sociaux.');
    return `<dialog class="nl-cookies-reglages" id="nl-cookies-reglages" aria-labelledby="cookies-reglages-titre">
  <div class="nl-cookies-reglages__tete">
    <h2 id="cookies-reglages-titre">Paramètres des cookies</h2>
    <button type="button" class="nl-menu__fermer" data-cookies="fermer" aria-label="Fermer">×</button>
  </div>
  <div class="nl-cookies-reglages__corps">
    <p>Choisissez les cookies que vous acceptez. Votre choix est conservé six mois. Vous pouvez le modifier à tout moment avec le bouton cookies, en bas de l’écran.</p>
    <ul class="nl-cookies-categories">
      <li class="nl-cookies-categorie">
        <span class="nl-cookies-categorie__textes"><span class="nl-cookies-categorie__titre">Nécessaires</span><span class="nl-cookies-categorie__texte">Indispensables au fonctionnement du site, par exemple pour mémoriser vos choix de cookies. Ils ne peuvent pas être désactivés.</span></span>
        <span class="nl-cookies-toujours">Toujours actifs</span>
      </li>
${mesure}
${marketing}
    </ul>
  </div>
  <div class="nl-cookies-reglages__pied">
    <button type="button" class="nl-btn nl-btn--verre nl-btn--petit" data-cookies="refuser">Tout refuser</button>
    <button type="button" class="nl-btn nl-btn--verre nl-btn--petit" data-cookies="accepter">Tout accepter</button>
    <button type="button" class="nl-btn nl-btn--or nl-btn--petit" data-cookies="enregistrer">Enregistrer mes choix</button>
  </div>
</dialog>
<button type="button" class="nl-cookies-badge" data-cookies="personnaliser" hidden><span class="nl-cookies-badge__icone">${ICONE_COOKIE}</span><span class="nl-cookies-badge__texte">Gérer les cookies</span></button>
${scriptsConsentement()}`;
  }

  // Squelette commun à toutes les pages
  function page({ titre, description, actif, contenu, pied, styleMain = '', dept = null, tete = '' }) {
    const style = styleMain ? ` style="${styleMain}"` : '';
    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${E(titre)}</title>
<meta name="description" content="${E(description)}">
<meta name="theme-color" content="#061120">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NOLOUT SARLU">
<meta property="og:title" content="${E(titre)}">
<meta property="og:description" content="${E(description)}">
<meta property="og:locale" content="fr_FR">
<link rel="icon" href="${R}assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="${R}assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&amp;family=Poppins:wght@400;500&amp;display=swap">
<link rel="stylesheet" href="${R}assets/css/nolout.css">
<script src="${R}assets/js/nolout.js" defer></script>
${tete}
</head>
<body>
<a class="nl-evitement" href="#contenu">Aller au contenu</a>
${banniereCookies()}
${entete(actif)}
<main id="contenu"${style}>
${contenu}
</main>
${pied}
${menuMobile()}
${barreMobile(dept)}
${reglagesCookies()}
</body>
</html>`;
  }

  // Bloc d'appel final « Un projet ? Parlons-en. »
  function blocCta() {
    const wa = ou(lienWhatsApp(G.whatsapp, 'Bonjour NOLOUT, '), `${R}contact/#formulaire`);
    return `<section class="nl-conteneur nl-section" aria-labelledby="titre-cta">
  <div class="nl-cta">
    <h2 id="titre-cta">${E('Un projet ? Parlons-en.')}</h2>
    <p>Indiquez le département concerné, votre demande arrive directement à la bonne équipe. Réponse sous 48 h ouvrées.</p>
    <div class="nl-actions">
      <a class="nl-btn nl-btn--or" href="${R}contact/#formulaire">Demander un devis</a>
      <a class="nl-btn nl-btn--verre" href="${E(wa)}">Écrire sur WhatsApp</a>
    </div>
  </div>
</section>`;
  }

  // ── Logos : bandes qui défilent en continu (repris de n8n.io) ─────────────

  function tuileClient(logo, masque, repete) {
    let classe = repete ? 'nl-logo-client nl-logo-client--repete' : 'nl-logo-client';
    if (logo.fichier) {
      // Carte claire par défaut ; fond : autre couleur ; ajustement cover : l'image remplit la carte (photo)
      classe += ' nl-logo-client--image';
      if (String(logo.ajustement || '').toLowerCase() === 'cover') classe += ' nl-logo-client--cover';
      const fond = logo.fond ? ` style="--fond:${logo.fond}"` : '';
      const cache = masque ? ' aria-hidden="true"' : '';
      const alt = masque ? '' : E(logo.nom);
      // Pas de chargement différé : les copies cachées par la bande n'apparaîtraient qu'en entrant, avec un blanc
      return `<li class="${classe}"${fond}${cache}><img src="${cheminImage(logo.fichier)}" alt="${alt}" decoding="async"></li>`;
    }
    return `<li class="${classe} nl-logo-client--vide" aria-hidden="true"><span>[logo]</span></li>`;
  }

  // Une bande : la liste est répétée jusqu'à couvrir la largeur de l'écran (8 cartes au moins),
  // puis doublée pour que la boucle (translation de -50 %) ne marque aucun saut.
  function bandeDefilante(logos, decalage, inverse) {
    const n = logos.length;
    const tours = n ? Math.ceil(8 / n) : 0;
    const tuiles = [];
    for (const copie of [0, 1]) {
      for (let t = 0; t < tours; t++) {
        for (let i = 0; i < n; i++) {
          const repete = copie === 1 || t > 0;
          tuiles.push(tuileClient(logos[(i + decalage) % n], inverse || repete, repete));
        }
      }
    }
    const classe = inverse ? 'nl-defilant nl-defilant--inverse' : 'nl-defilant';
    const duree = n * tours * 8; // 8 s par carte de 200 px : environ 25 px/s, proche de n8n.io
    return `<div class="${classe}" style="--duree:${duree}s"><ul class="nl-defilant__piste">\n${tuiles.join('\n')}\n</ul></div>`;
  }

  function bandeauClients(titre, partenaires) {
    const logos = (partenaires && partenaires.logos) || [];
    const bandes = [bandeDefilante(logos, 0, false)];
    if (Number(partenaires && partenaires.rangees) >= 2) bandes.push(bandeDefilante(logos, Math.floor(logos.length / 2), true));
    const aucunLogo = !logos.some((l) => l.fichier);
    const annonce = aucunLogo ? '<p class="nl-sr">Les logos de nos clients seront bientôt affichés ici.</p>' : '';
    return `<section class="nl-partenaires" aria-labelledby="titre-clients">
  <div class="nl-conteneur nl-partenaires__in">
    <div class="nl-partenaires__tete">
      <p class="nl-legende" id="titre-clients">${E(titre)}</p>
      ${boutonPause('Mettre en pause le défilement des logos', 'data-pause-defilement')}
    </div>
    <div class="nl-defilants" data-defilants>
${joindre(bandes)}
    </div>
    ${annonce}
  </div>
</section>`;
  }

  // ── Publicité vidéo : lue en boucle et sans le son quand elle est à l'écran ─

  // Chemin d'un fichier vidéo : dans site/assets/video/, ou adresse complète (https://…)
  function cheminVideo(fichier) {
    if (/^https?:\/\//.test(fichier)) return fichier;
    return R + 'assets/video/' + String(fichier).split('/').map(escapeDataString).join('/');
  }

  function zonePub(pub) {
    pub = pub || {};
    const videos = (pub.videos || []).filter((v) => v && v.fichier);
    let lien = '';
    if (pub.lien && pub.lien.libelle && pub.lien.href) {
      const href = /^(https?:|mailto:|tel:|#)/.test(pub.lien.href) ? pub.lien.href : R + pub.lien.href;
      lien = `<a class="nl-lien-or" href="${E(href)}">${E(pub.lien.libelle)} →</a>`;
    }
    const iconeLecture = '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z" fill="currentColor"/></svg>';

    let ecran;
    if (videos.length) {
      const premiere = videos[0];
      const affiche = premiere.affiche ? ` poster="${cheminVideo(premiere.affiche)}"` : '';
      // Une vidéo : elle boucle d'elle-même. Plusieurs : elles s'enchaînent, puis la liste recommence.
      const boucle = videos.length === 1 ? ' loop' : ` data-pub-liste="${videos.map((v) => cheminVideo(v.fichier)).join(' ')}"`;
      ecran = `<div class="nl-pub__lecteur" data-pub>
    <div class="nl-pub__ecran">
      <video class="nl-pub__video" src="${cheminVideo(premiere.fichier)}"${affiche} muted playsinline controls preload="none"${boucle} aria-label="${E(`Vidéo : ${pub.titre}`)}" data-pub-video></video>
      <button type="button" class="nl-pub__lancer" tabindex="-1" aria-hidden="true" data-pub-lancer hidden>${iconeLecture}</button>
    </div>
    <div class="nl-pub__barre" data-pub-barre hidden>
      ${boutonPause('Mettre la vidéo en pause', 'data-pub-pause')}
      <span class="nl-pub__progression" aria-hidden="true"><span data-pub-progression></span></span>
      <button type="button" class="nl-pause" aria-pressed="false" aria-label="Activer le son" data-pub-son>
        <svg class="nl-son__coupe" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6H5l3.5-3v10L5 10H2.5z" fill="currentColor"/><path d="M11 6.2l3.6 3.6M14.6 6.2L11 9.8"/></svg>
        <svg class="nl-son__actif" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6H5l3.5-3v10L5 10H2.5z" fill="currentColor"/><path d="M11 5.8a3.2 3.2 0 0 1 0 4.4M12.9 3.8a6 6 0 0 1 0 8.4"/></svg>
      </button>
      <button type="button" class="nl-pause" aria-label="Afficher la vidéo en plein écran" data-pub-plein-ecran>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>
      </button>
    </div>
  </div>`;
    } else {
      ecran = `<div class="nl-pub__lecteur"><div class="nl-pub__ecran nl-vide" role="img" aria-label="Vidéo publicitaire à venir"><span class="nl-pub__lancer" aria-hidden="true">${iconeLecture}</span><span class="nl-vide__legende"><span>Vidéo publicitaire à venir</span></span></div></div>`;
    }

    return `<section class="nl-conteneur nl-pub" aria-labelledby="titre-pub">
  <div class="nl-pub__texte">
    <p class="nl-surtitre">${E(pub.surtitre)}</p>
    <h2 id="titre-pub" class="nl-h2">${E(pub.titre)}</h2>
    <p class="nl-corps-l">${E(pub.texte)}</p>
    ${lien}
  </div>
  ${ecran}
</section>`;
  }

  // ── Accueil ───────────────────────────────────────────────────────────────

  function pageAccueil() {
    R = '';
    const A = C.accueil;
    const lignes = [];
    const noeuds = [];
    const fiches = [];
    DEPTS.forEach((d, i) => {
      const actif = i === 0;
      // Position de départ sur l'orbite (ellipse de 33 % × 38 % du cadre) ; le JavaScript fait ensuite tourner
      const radians = (Number(d.orbite) * Math.PI) / 180;
      const x = N(50 + 33 * Math.cos(radians));
      const y = N(50 + 38 * Math.sin(radians));
      const classeLigne = actif ? ' class="is-actif"' : '';
      lignes.push(`<line data-ligne x1="50" y1="50" x2="${x}" y2="${y}" vector-effect="non-scaling-stroke"${classeLigne} style="--c-clair:${d.clair}"/>`);
      noeuds.push(`<button type="button" class="nl-hub__noeud" data-noeud data-angle="${N(d.orbite)}" aria-pressed="${actif}" aria-controls="hub-fiches" style="--x:${x}%;--y:${y}%;${styleDept(d)}"><span class="nl-icone-dept">${svg(d.icone, 18)}</span><span class="nl-hub__noeud-textes"><span class="nl-hub__noeud-nom">${E(d.court)}</span><span class="nl-hub__noeud-tag">${E(d.tag)}</span></span></button>`);
      const services = joindre((d.servicesCles || []).map((s) => `<li>${E(s)}</li>`));
      const cache = actif ? '' : ' hidden';
      fiches.push(`<div class="nl-hub__fiche" data-fiche style="${styleDept(d)}"${cache}>
            <p class="nl-hub__surtitre"><span class="nl-puce" aria-hidden="true"></span><span>${E(d.domaine)}</span></p>
            <h2 class="nl-hub__nom">${E(d.nom)}</h2>
            <p class="nl-hub__desc">${E(d.resume)}</p>
            <ul class="nl-hub__services">
${services}
            </ul>
            <a class="nl-hub__entrer" href="departements/${d.slug}/">Entrer dans le département →</a>
          </div>`);
    });

    const chiffres = joindre((A.chiffres || []).map((c) => {
      const compteur = c.compteur ? ` data-compteur="${c.valeur}"` : '';
      return `<div class="nl-chiffre"><span class="nl-chiffre__valeur"${compteur}>${E(c.valeur)}</span><span class="nl-chiffre__libelle">${E(c.libelle)}</span></div>`;
    }));
    const etapes = joindre((A.etapes || []).map((e, i) =>
      `<div class="nl-carte nl-carte--degrade nl-etape-carte"><span class="nl-etape-carte__num" aria-hidden="true">${i + 1}</span><h3><span class="nl-sr">Étape ${i + 1} : </span>${E(e.titre)}</h3><p>${E(e.texte)}</p></div>`));
    const realisations = joindre((A.realisations || []).map((r) => {
      const d = PAR_CODE[r.departement];
      const image = r.image ? { fichier: r.image, alt: ou(r.alt, r.titre), ajustement: 'cover', fond: '' } : null;
      return `<a class="nl-carte nl-realisation" href="realisations/" style="${styleDept(d)}">${visuel(image, `Photo à venir · ${d.court}`, '16-10')}<div class="nl-realisation__corps"><span class="nl-etiquette"><span class="nl-puce" aria-hidden="true"></span>${E(d.nom)}</span><span class="nl-realisation__titre">${E(r.titre)}</span><span class="nl-realisation__meta">${E(r.meta)}</span></div></a>`;
    }));
    const temoignages = joindre((A.temoignages || []).map((t) => {
      const d = PAR_CODE[t.departement];
      return `<figure class="nl-carte nl-temoignage" style="${styleDept(d)}"><span class="nl-temoignage__guillemet" aria-hidden="true">&ldquo;</span><blockquote>« ${E(t.texte)} »</blockquote><span class="nl-temoignage__guillemet nl-temoignage__guillemet--fin" aria-hidden="true">&rdquo;</span><figcaption><span class="nl-avatar nl-vide" aria-hidden="true"></span><span class="nl-temoignage__auteur"><span class="nl-temoignage__nom">${E(t.auteur)}</span><span class="nl-temoignage__client">Client ${E(d.nom)}</span></span></figcaption></figure>`;
    }));

    const jsonld = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: G.raisonSociale,
      slogan: G.signature,
      email: G.email,
      address: { '@type': 'PostalAddress', addressLocality: 'Kinshasa', addressCountry: 'CD' },
      subOrganization: DEPTS.map((d) => ({ '@type': 'Organization', name: d.nom, email: d.email })),
    }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/'/g, '\\u0027');

    const contenu = `<section class="nl-scene" aria-labelledby="titre-accueil">
  <div class="nl-halo" aria-hidden="true"></div>
  <div class="nl-trame" aria-hidden="true"></div>
  <div class="nl-conteneur nl-hero__in">
    <p class="nl-pastille nl-pastille--groupe"><span class="nl-pastille__badge">Groupe</span>${E(A.pastille)}</p>
    <h1 id="titre-accueil" class="nl-h1-accueil">${E(A.titre)} <span class="nl-or">${E(A.titreOr)}</span></h1>
    <p class="nl-corps-l">${E(A.intro)}</p>
    <div class="nl-actions">
      ${boutonFleche('or-glass', '#hub', 'Explorer les départements')}
      ${boutonFleche('glass', 'contact/#formulaire', 'Demander un devis')}
    </div>
  </div>

  <div id="hub" class="nl-conteneur nl-hub">
    <div class="nl-fenetre">
      <div class="nl-fenetre__barre nl-fenetre__barre--44"><span class="nl-fenetre__point" aria-hidden="true"></span><span class="nl-fenetre__point" aria-hidden="true"></span><span class="nl-fenetre__point" aria-hidden="true"></span><span class="nl-fenetre__titre">Cliquez sur un département</span>
      ${boutonPause('Mettre en pause la rotation des départements', 'data-pause-orbite', ' nl-pause--barre', true)}
      </div>
      <div class="nl-hub__corps" data-hub>
        <div class="nl-hub__schema">
          <div class="nl-hub__zone" data-orbite>
            <svg class="nl-hub__lignes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
<ellipse class="nl-hub__anneau" data-anneau cx="50" cy="50" rx="33" ry="38" vector-effect="non-scaling-stroke"/>
${joindre(lignes)}
            </svg>
            <div class="nl-hub__centre"><img src="assets/img/logo-nolout.webp" alt="" width="60" height="60"><span>NOLOUT</span></div>
${joindre(noeuds)}
          </div>
        </div>
        <div class="nl-hub__panneau" id="hub-fiches" aria-live="polite">
          ${joindre(fiches)}
        </div>
      </div>
    </div>
  </div>
</section>

${bandeauClients(A.partenairesTitre, A.partenaires)}

${zonePub(A.pub)}

<section class="nl-conteneur nl-chiffres" aria-label="Chiffres clés">
  <div class="nl-grille nl-grille--220">
${chiffres}
  </div>
</section>

<section class="nl-conteneur nl-section" aria-labelledby="titre-methode">
  <div class="nl-section__tete">
    <p class="nl-surtitre">${E(A.methodeSurtitre)}</p>
    <h2 id="titre-methode" class="nl-h2">${E(A.methodeTitre)}</h2>
  </div>
  <div class="nl-grille nl-grille--300">
${etapes}
  </div>
</section>

<section id="realisations" class="nl-conteneur nl-section" aria-labelledby="titre-realisations">
  <div class="nl-section__tete nl-section__tete--ligne">
    <div>
      <p class="nl-surtitre">Réalisations</p>
      <h2 id="titre-realisations" class="nl-h2">Des résultats concrets</h2>
    </div>
    <a class="nl-lien-or" href="realisations/">Toutes les réalisations →</a>
  </div>
  <div class="nl-grille nl-grille--320">
${realisations}
  </div>
</section>

<section class="nl-conteneur nl-section" aria-label="Témoignages">
  <div class="nl-grille nl-grille--340 nl-temoignages">
${temoignages}
  </div>
</section>

${blocCta()}`;

    return page({ titre: A.titrePage, description: A.description, actif: 'accueil', contenu, pied: piedComplet(), tete: `<script type="application/ld+json">${jsonld}</script>` });
  }

  // ── Passerelle « Nos départements » ───────────────────────────────────────

  function pagePasserelle() {
    R = '../';
    const cartes = joindre(DEPTS.map((d) =>
      `<a class="nl-carte-dept" href="${d.slug}/" style="${styleDept(d)}"><span class="nl-icone-dept nl-icone-dept--40">${svg(d.icone, 20)}</span><span class="nl-carte-dept__domaine">${E(d.domaine)}</span><span class="nl-carte-dept__nom">${E(d.nom)}</span><span class="nl-carte-dept__desc">${E(d.resume)}</span><span class="nl-carte-dept__entrer" aria-hidden="true">Entrer →</span></a>`));
    const contenu = `<div class="nl-scene">
  <div class="nl-halo" aria-hidden="true"></div>
  <div class="nl-trame nl-trame--dept" aria-hidden="true"></div>
  <section class="nl-conteneur nl-page-hero__in" aria-labelledby="titre-departements">
    <nav class="nl-ariane" aria-label="Fil d’Ariane"><a href="../">NOLOUT</a><span aria-hidden="true">›</span><span aria-current="page">Départements</span></nav>
    <div class="nl-page-hero__texte nl-preparation__texte">
      <p class="nl-pastille">Six départements, une seule maison</p>
      <h1 id="titre-departements" class="nl-h1">Nos départements</h1>
      <p class="nl-corps-l nl-corps-l--hero">Six métiers complémentaires, une même exigence. Choisissez un département pour découvrir ses services et parler directement à son équipe.</p>
    </div>
    <div class="nl-grille nl-grille--300">
${cartes}
    </div>
  </section>
</div>

${blocCta()}`;
    return page({ titre: 'Nos départements — NOLOUT SARLU', description: 'Les six départements de NOLOUT SARLU : conseil, construction, commerce, communication, gaming et transport.', actif: 'departements', contenu, pied: piedComplet() });
  }

  // ── Département (gabarit unique) ──────────────────────────────────────────

  function pageDepartement(d) {
    R = '../../';
    const selecteur = joindre(DEPTS.map((x) => {
      const courant = x.code === d.code ? ' aria-current="page"' : '';
      return `<a href="../${x.slug}/" style="${styleDept(x)}"${courant}><span class="nl-puce" aria-hidden="true"></span>${E(x.court)}</a>`;
    }));
    const services = joindre((d.services || []).map((s) =>
      `<div class="nl-carte nl-carte--degrade nl-carte--survol nl-service"><span class="nl-service__icone">${svg(s.icone, 22, '1.5')}</span><h3>${E(s.titre)}</h3><p>${E(s.texte)}</p></div>`));
    // Trois références ; les photos de references.photos remplissent les premières, les autres restent « photo à venir »
    const refsDept = d.references || {};
    const photos = (refsDept.photos || []).filter((p) => p && p.fichier);
    const refs = joindre([1, 2, 3].map((n) => {
      const photo = n <= photos.length ? photos[n - 1] : null;
      const image = photo ? { fichier: photo.fichier, alt: photo.alt, ajustement: 'cover', fond: '' } : null;
      return `<a class="nl-carte nl-realisation nl-realisation--ref" href="${R}realisations/">${visuel(image, `Photo à venir · ${refsDept.etiquette} ${n}`, '16-10')}<div class="nl-realisation__corps"><span class="nl-realisation__meta">${E(refsDept.meta)}</span><span class="nl-realisation__titre">${E(refsDept.titre)}</span></div></a>`;
    }));
    const formulaire = `${R}contact/?departement=${d.code}#formulaire`;
    const telDept = ou(d.telephone, G.telephone);
    const canaux = joindre([
      canal('wa', 'WhatsApp', ou(d.whatsapp, `+243 [numéro ${d.court}]`), ou(lienWhatsApp(d.whatsapp, `Bonjour ${d.nom}, `), formulaire), Boolean(d.whatsapp)),
      canal('phone', 'Téléphone', ou(telDept, '+243 [numéro]'), ou(lienTel(telDept), formulaire)),
      canal('mail', 'E-mail', d.email, `mailto:${d.email}`),
    ]);
    const autres = bandeauDepts('Les autres départements NOLOUT', DEPTS.filter((x) => x.code !== d.code));

    const contenu = `<section class="nl-scene" aria-labelledby="titre-dept">
  <div class="nl-halo nl-halo--dept" aria-hidden="true"></div>
  <div class="nl-trame nl-trame--dept" aria-hidden="true"></div>
  <div class="nl-conteneur nl-page-hero__in">
    <div class="nl-page-hero__haut">
      <nav class="nl-ariane" aria-label="Fil d’Ariane"><a href="${R}">NOLOUT</a><span aria-hidden="true">›</span><a href="../">Départements</a><span aria-hidden="true">›</span><span aria-current="page">${E(d.court)}</span></nav>
      <nav class="nl-selecteur" aria-label="Changer de département">
${selecteur}
      </nav>
    </div>
    <div class="nl-page-hero__cols">
      <div class="nl-page-hero__texte">
        <p class="nl-pastille nl-pastille--dept"><span class="nl-pastille__icone">${svg(d.icone, 13, '2')}</span>${E(d.domaine)}</p>
        <h1 id="titre-dept" class="nl-h1 nl-h1--capitales">${E(d.nom)}</h1>
        <p class="nl-corps-l nl-corps-l--hero">${E(d.pitch)}</p>
        <div class="nl-actions">
          <a class="nl-btn nl-btn--or" href="${formulaire}">${E(d.cta)}</a>
          <a class="nl-btn nl-btn--verre" href="#references">Nos références</a>
        </div>
      </div>
      <div class="nl-page-hero__visuel">
        <div class="nl-fenetre">
          <div class="nl-fenetre__barre" aria-hidden="true"><span class="nl-fenetre__point"></span><span class="nl-fenetre__point"></span><span class="nl-fenetre__point"></span><span class="nl-fenetre__trait"></span></div>
          ${visuel(d.image, `Photo réelle du département ${d.nom} à venir`, '', true)}
        </div>
      </div>
    </div>
  </div>
</section>

<section class="nl-conteneur nl-section" aria-labelledby="titre-services">
  <div class="nl-section__tete">
    <p class="nl-surtitre nl-surtitre--dept">Nos services</p>
    <h2 id="titre-services" class="nl-h2">${E(d.servicesTitre)}</h2>
    <p class="nl-intro">${E(d.servicesIntro)}</p>
  </div>
  <div class="nl-grille nl-grille--400">
${services}
  </div>
</section>

<section id="references" class="nl-conteneur nl-section" aria-labelledby="titre-references">
  <div class="nl-section__tete nl-section__tete--ligne">
    <div>
      <p class="nl-surtitre nl-surtitre--dept">Références</p>
      <h2 id="titre-references" class="nl-h2">Ils nous ont confié leur projet</h2>
    </div>
    <a class="nl-lien-or" href="${R}realisations/">Toutes les références →</a>
  </div>
  <div class="nl-grille nl-grille--320">
${refs}
  </div>
</section>

<section class="nl-conteneur nl-section" aria-labelledby="titre-dedie">
  <div class="nl-dedie">
    <div class="nl-dedie__texte">
      <p class="nl-surtitre nl-surtitre--dept">Contact dédié</p>
      <h2 id="titre-dedie">${E(`Parlez directement à l’équipe ${d.court}`)}</h2>
      <div class="nl-personne">
        <span class="nl-avatar nl-avatar--64 nl-vide" aria-hidden="true"></span>
        <span class="nl-personne__textes"><span class="nl-personne__nom">[Prénom Nom]</span><span class="nl-personne__role">${E(d.role)}</span></span>
      </div>
    </div>
    <div class="nl-dedie__canaux">
${canaux}
    </div>
  </div>
</section>

${autres}`;
    return page({ titre: `${d.nom} — ${d.domaine} | NOLOUT`, description: d.pitch, actif: 'departements', contenu, pied: piedCompact(`${d.nom} est un département de ${G.raisonSociale}`), styleMain: styleDept(d), dept: d });
  }

  // ── Contact (formulaire intelligent) ──────────────────────────────────────

  function pageContact() {
    R = '../';
    const choix = DEPTS.map((d) => `          <label class="nl-choix" style="${styleDept(d)}">
            <input type="radio" name="departement" value="${d.code}" data-nom="${E(d.nom)}" data-email="${d.email}" data-rgb="${d.rgb}" data-exemple="${E(d.exempleMessage)}">
            <span class="nl-icone-dept nl-icone-dept--30">${svg(d.icone, 16)}</span>
            <span class="nl-choix__nom">${E(d.nom)}</span>
            <span class="nl-choix__rond" aria-hidden="true"></span>
          </label>`);
    choix.push(`          <label class="nl-choix" style="--c:#C8CCD1;--c-rgb:233,168,37">
            <input type="radio" name="departement" value="?" data-nom="NOLOUT" data-email="${G.email}" data-rgb="233,168,37" data-exemple="${E('Expliquez votre besoin, nous le transmettrons au bon département.')}">
            <span class="nl-icone-dept nl-icone-dept--30">${svg('q', 16)}</span>
            <span class="nl-choix__nom">Je ne sais pas encore</span>
            <span class="nl-choix__rond" aria-hidden="true"></span>
          </label>`);
    const wa = lienWhatsApp(G.whatsapp, 'Bonjour NOLOUT, ');
    const waHero = ou(wa, '#formulaire');
    const canaux = joindre([
      canal('wa', 'WhatsApp — réponse rapide', WA_AFFICHE, ou(wa, '#formulaire'), Boolean(wa)),
      canal('phone', 'Téléphone', TEL_AFFICHE, ou(lienTel(G.telephone), '#formulaire')),
      canal('mail', 'E-mail', G.email, `mailto:${G.email}`),
    ]);
    const horaires = joindre((G.horaires || []).map((h) => `<dt>${E(h.jours)}</dt><dd>${E(h.heures)}</dd>`));
    const itineraire = ou(G.itineraire, 'https://www.google.com/maps/search/?api=1&query=' + escapeDataString(G.adresse));

    const contenu = `<div class="nl-scene">
  <div class="nl-halo nl-halo--contact" data-halo aria-hidden="true"></div>
  <div class="nl-trame nl-trame--haut" aria-hidden="true"></div>

  <section class="nl-conteneur nl-page-hero__in nl-page-hero__in--contact" aria-labelledby="titre-contact">
    <nav class="nl-ariane" aria-label="Fil d’Ariane"><a href="../">NOLOUT</a><span aria-hidden="true">›</span><span aria-current="page">Contact</span></nav>
    <div class="nl-page-hero__cols">
      <div class="nl-page-hero__texte">
        <p class="nl-pastille">Réponse sous 48 h ouvrées</p>
        <h1 id="titre-contact" class="nl-h1">Parlons de votre projet</h1>
        <p class="nl-corps-l nl-corps-l--hero">${E('Choisissez le département concerné : votre message arrive directement à la bonne équipe.')}</p>
        <div class="nl-actions">
          <a class="nl-btn nl-btn--or" href="#formulaire">Remplir le formulaire</a>
          <a class="nl-btn nl-btn--verre" href="${E(waHero)}">Écrire sur WhatsApp</a>
        </div>
      </div>
      <div class="nl-page-hero__visuel">
        <div class="nl-fenetre">
          <div class="nl-fenetre__barre" aria-hidden="true"><span class="nl-fenetre__point"></span><span class="nl-fenetre__point"></span><span class="nl-fenetre__point"></span><span class="nl-fenetre__trait"></span></div>
          ${visuel(null, 'Photo réelle à venir : accueil du siège ou équipe NOLOUT')}
        </div>
      </div>
    </div>
  </section>

  <section id="formulaire" class="nl-conteneur nl-section nl-contact" aria-label="Formulaire de contact">
    <form class="nl-form" id="nl-formulaire" novalidate data-endpoint="${E(G.formulaireEndpoint)}">
      <div class="nl-alerte nl-alerte--ok" role="status" data-succes hidden></div>
      <div class="nl-alerte nl-alerte--erreur" role="alert" data-resume hidden></div>
      <p class="nl-sr" aria-hidden="true"><label for="c-site">Ne pas remplir ce champ</label><input id="c-site" name="site_web" type="text" tabindex="-1" autocomplete="off"></p>

      <fieldset class="nl-etape">
        <legend class="nl-etape__titre"><span class="nl-etape__num" aria-hidden="true">1</span><span>${E('Quel département est concerné ?')}</span></legend>
        <div class="nl-choix-depts">
${joindre(choix)}
        </div>
        <p class="nl-erreur" data-erreur-departement hidden>${E('⚠ Choisissez un département, ou « Je ne sais pas encore ».')}</p>
        <p class="nl-orientation" data-orientation aria-live="polite" hidden></p>
      </fieldset>

      <fieldset class="nl-etape nl-etape--champs">
        <legend class="nl-etape__titre"><span class="nl-etape__num" aria-hidden="true">2</span><span>Vos coordonnées</span></legend>
        <div class="nl-champs">
          <div class="nl-champ">
            <label class="nl-champ__label" for="c-nom">Nom complet <span>(obligatoire)</span></label>
            <input class="nl-champ__input" id="c-nom" name="nom" type="text" autocomplete="name" aria-describedby="c-nom-msg">
            <p class="nl-champ__msg" id="c-nom-msg" data-aide=""></p>
          </div>
          <div class="nl-champ">
            <label class="nl-champ__label" for="c-entreprise">Entreprise ou organisation <span>(facultatif)</span></label>
            <input class="nl-champ__input" id="c-entreprise" name="entreprise" type="text" autocomplete="organization" aria-describedby="c-entreprise-msg">
            <p class="nl-champ__msg" id="c-entreprise-msg"></p>
          </div>
          <div class="nl-champ">
            <label class="nl-champ__label" for="c-email">Adresse e-mail <span>(obligatoire)</span></label>
            <input class="nl-champ__input" id="c-email" name="email" type="email" autocomplete="email" placeholder="nom@domaine.cd" aria-describedby="c-email-msg">
            <p class="nl-champ__msg" id="c-email-msg" data-aide="Pour vous envoyer notre réponse.">Pour vous envoyer notre réponse.</p>
          </div>
          <div class="nl-champ">
            <label class="nl-champ__label" for="c-telephone">Téléphone / WhatsApp <span>(facultatif)</span></label>
            <input class="nl-champ__input" id="c-telephone" name="telephone" type="tel" autocomplete="tel" placeholder="+243 …" aria-describedby="c-telephone-msg">
            <p class="nl-champ__msg" id="c-telephone-msg">Si vous préférez être rappelé.</p>
          </div>
        </div>
      </fieldset>

      <fieldset class="nl-etape nl-etape--champs">
        <legend class="nl-etape__titre"><span class="nl-etape__num" aria-hidden="true">3</span><span>Votre demande</span></legend>
        <div class="nl-champ">
          <label class="nl-champ__label" for="c-message">Message <span>(obligatoire)</span></label>
          <textarea class="nl-champ__input" id="c-message" name="message" rows="5" placeholder="Décrivez votre besoin." aria-describedby="c-message-msg"></textarea>
          <p class="nl-champ__msg" id="c-message-msg" data-aide="Plus votre message est précis, plus notre réponse le sera.">Plus votre message est précis, plus notre réponse le sera.</p>
        </div>
      </fieldset>

      <div class="nl-form__pied">
        <p class="nl-form__mention">Vos données servent uniquement à traiter votre demande. <a href="${R}confidentialite/">Politique de confidentialité</a></p>
        <button type="submit" class="nl-btn nl-btn--or nl-form__envoyer">Envoyer la demande →</button>
      </div>
    </form>

    <aside class="nl-aside" aria-label="Coordonnées du siège">
      <div class="nl-carte nl-aside__bloc">
        <p class="nl-aside__titre">Contact direct</p>
${canaux}
      </div>
      <div class="nl-carte nl-siege">
        ${visuel(null, 'Carte du siège à venir', '16-10')}
        <div class="nl-siege__corps">
          <h2 class="nl-siege__nom">Siège NOLOUT</h2>
          <address class="nl-siege__adresse">${E(G.adresse)}</address>
          <dl class="nl-horaires">${horaires}</dl>
          <a class="nl-lien-or nl-lien-or--petit" href="${E(itineraire)}" target="_blank" rel="noopener">${E('Ouvrir l’itinéraire →')}</a>
        </div>
      </div>
    </aside>
  </section>

${bandeauDepts('Découvrir nos départements', DEPTS)}
</div>`;
    return page({ titre: 'Contact — NOLOUT SARLU', description: 'Écrivez à NOLOUT SARLU : choisissez le département concerné, votre demande arrive directement à la bonne équipe. Réponse sous 48 h ouvrées.', actif: 'contact', contenu, pied: piedCompact(`© ${G.annee} ${G.raisonSociale}`) });
  }

  // ── Pages en préparation (groupe, réalisations, carrières…) ───────────────

  function pagePreparation(p) {
    R = '../';
    const contenu = `<div class="nl-scene">
  <div class="nl-halo" aria-hidden="true"></div>
  <div class="nl-trame nl-trame--dept" aria-hidden="true"></div>
  <section class="nl-conteneur nl-page-hero__in" aria-labelledby="titre-page">
    <nav class="nl-ariane" aria-label="Fil d’Ariane"><a href="../">NOLOUT</a><span aria-hidden="true">›</span><span aria-current="page">${E(p.titre)}</span></nav>
    <div class="nl-page-hero__texte nl-preparation__texte">
      <p class="nl-pastille">Page en préparation</p>
      <h1 id="titre-page" class="nl-h1">${E(p.titre)}</h1>
      <p class="nl-corps-l nl-corps-l--hero">${E(p.texte)} Cette page est en cours de préparation.</p>
      <div class="nl-actions">
        <a class="nl-btn nl-btn--or" href="../contact/">Nous contacter</a>
        <a class="nl-btn nl-btn--verre" href="../departements/">Découvrir les départements</a>
      </div>
    </div>
  </section>
</div>

${bandeauDepts('Découvrir nos départements', DEPTS)}`;
    return page({ titre: `${p.titre} — NOLOUT SARLU`, description: p.texte, actif: p.page, contenu, pied: piedComplet() });
  }

  // Page introuvable : chemins absolus (préfixe « / »), car l'adresse demandée peut avoir n'importe quelle profondeur
  function page404() {
    R = '/';
    const contenu = `<div class="nl-scene">
  <div class="nl-halo" aria-hidden="true"></div>
  <div class="nl-trame nl-trame--dept" aria-hidden="true"></div>
  <section class="nl-conteneur nl-page-hero__in" aria-labelledby="titre-page">
    <div class="nl-page-hero__texte nl-preparation__texte">
      <p class="nl-pastille">Erreur 404</p>
      <h1 id="titre-page" class="nl-h1">Page introuvable</h1>
      <p class="nl-corps-l nl-corps-l--hero">Cette adresse ne correspond à aucune page du site NOLOUT. Elle a peut-être changé ou n’existe plus.</p>
      <div class="nl-actions">
        <a class="nl-btn nl-btn--or" href="/">Retour à l’accueil</a>
        <a class="nl-btn nl-btn--verre" href="/departements/">Découvrir les départements</a>
      </div>
    </div>
  </section>
</div>`;
    return page({ titre: 'Page introuvable — NOLOUT SARLU', description: 'Cette page n’existe pas ou a changé d’adresse.', actif: '', contenu, pied: piedComplet() });
  }

  // ── Adresses du site ──────────────────────────────────────────────────────

  // Liste des pages : chemin du fichier (…/index.html) et fonction qui la fabrique
  function pages() {
    const liste = [['index.html', pageAccueil], ['departements/index.html', pagePasserelle]];
    for (const d of DEPTS) liste.push([`departements/${d.slug}/index.html`, () => pageDepartement(d)]);
    liste.push(['contact/index.html', pageContact]);
    for (const p of C.pagesEnPreparation || []) liste.push([`${p.page}/index.html`, () => pagePreparation(p)]);
    return liste;
  }

  // Page correspondant à une adresse (« / », « /departements/nolout-game/ »…), ou null
  function rendreAdresse(adresse) {
    const nettoyee = String(adresse || '/').split(/[?#]/)[0].replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    const fichier = nettoyee ? `${nettoyee}/index.html` : 'index.html';
    const trouve = pages().find(([chemin]) => chemin === fichier);
    return trouve ? trouve[1]() : null;
  }

  return {
    pages,
    rendreAdresse,
    page404,
    rendreTout: () => pages().map(([chemin, fabriquer]) => [chemin, fabriquer()]),
  };
}

# Site NOLOUT SARLU

Reproduction des maquettes v2 (thème sombre) du dossier `A2` : cahier de passation, PDF « NOLOUT Site v2 » et dossier `design_handoff_nolout_site` (README et maquettes `.dc.html`).

## Organisation

En ligne, Vercel fabrique chaque page à la demande à partir du contenu publié dans la base Neon, puis la garde une minute en cache. Les textes se modifient depuis l'administration (`/admin/`, onglet « Contenus »).

- `site/` : fichiers servis tels quels.
  - `assets/css/nolout.css` : tokens du design system (couleurs groupe et départements, typographie, rayons) et composants.
  - `assets/js/nolout.js` : mégamenu, menu mobile, schéma des départements, compteurs, publicité vidéo, formulaire de contact.
  - `assets/img/` : logo, favicon, logos du bandeau, visuels des départements et photos de réalisations.
  - `assets/video/` : vidéo publicitaire de l'accueil et son image d'affiche.
  - `admin/` : page d'administration (`index.html`, `admin.css`, `admin.js`).
- `lib/` : code partagé par les fonctions.
  - `rendu.js` : fabrique les pages HTML à partir du contenu (réécriture JavaScript de l'ancien générateur PowerShell, pages identiques au caractère près).
  - `contenu.js` : lit le contenu publié ou le brouillon dans la table `contenus` de Neon, vérifie un contenu avant son enregistrement et vide le cache des pages après une publication.
  - `base.js` : connexion à Neon et création des tables. `auth.js` : mots de passe et sessions de l'administration.
- `api/` : fonctions Vercel. `page.js` fabrique les pages publiques, `contact.js` enregistre les demandes du formulaire, `admin.js` sert l'administration, `apercu.js` montre le brouillon à l'équipe connectée (`/apercu/…`).
- `vercel.json` : routage. Les fichiers de `site/` d'abord, puis les fonctions, puis `/apercu/…` vers `api/apercu.js`, puis toute autre adresse vers `api/page.js`.
- `sources/` : contenu initial et outils du poste.
  - `contenu.json` : contenu de départ, versé dans la base au premier lancement. Il sert aussi de contenu de secours si la base est injoignable, et d'aperçu local. Une fois le site en ligne, les textes se modifient dans l'administration : changer ce fichier ne modifie plus le site.
  - `generer.cmd` : fabrique les pages dans `site/` à partir de `contenu.json`, pour l'aperçu sur ce poste (avec Node.js).
  - `preparer-video.cmd` (et `preparer-video.ps1`) : glisser une vidéo dessus pour en faire la version web de la publicité.
- `scripts/` : `generer.mjs` (pages locales) et `serveur-local.mjs` (aperçu qui imite Vercel : `node scripts/serveur-local.mjs`, puis http://localhost:3000/).

La feuille de style, le JavaScript et les images se modifient dans `site/assets/`, puis s'envoient sur GitHub. Vercel met alors le site à jour tout seul.

## Administration

Adresse : https://nolout-beta.vercel.app/admin/

- **Connexion :** chaque membre de l'équipe a son compte. Les mots de passe sont chiffrés (scrypt) dans la table `comptes`, et la session tient dans un cookie signé, valable 12 heures. Après 5 essais manqués, un compte est bloqué 15 minutes.
- **Premier compte :** il ne se crée que depuis l'adresse propre au déploiement (du type `https://nolout-xxxx-nolout.vercel.app/admin/`, visible dans Vercel, onglet Deployments). Vercel protège cette adresse et exige d'être connecté au compte Vercel du site. Ensuite, on ajoute les autres membres depuis l'onglet « Équipe ».
- **Demandes :** celles du formulaire de contact, avec filtres, statut (nouvelle, en cours, traitée) et suppression.
- **Contenus :** les textes de l'accueil (publicité « À l'affiche », haut de page, chiffres clés, méthode, réalisations, témoignages), ceux des six départements, les coordonnées et mentions légales, les pages en préparation, le menu et la mesure d'audience.
  - Chaque saisie s'enregistre une seconde plus tard dans un brouillon (table `contenus`, clé `brouillon`), invisible pour les visiteurs. Une pastille dorée signale les sections modifiées et pas encore publiées, et les textes provisoires entre crochets sont signalés.
  - « Voir l'aperçu » ouvre `/apercu/…` : le site tel qu'il sera publié, réservé à l'équipe connectée, jamais mis en cache ni indexé.
  - « Publier » vérifie le brouillon (liens, adresses e-mail, fichiers, et fabrication de toutes les pages), le met en ligne puis vide le cache des pages (étiquette `pages`). Le site est à jour aussitôt, ou au plus tard une minute après.
  - La version remplacée part dans `contenus_historique`. L'historique permet de la remettre dans le brouillon, puis de la publier à nouveau. « Annuler les modifications » ramène le brouillon à la version en ligne.
  - Si deux personnes modifient le brouillon en même temps, la seconde est prévenue au lieu d'écraser le travail de la première.
  - Les photos, les logos et la vidéo se changeront depuis l'administration à l'étape suivante (envoi de fichiers).

## Pages

| Adresse | Page |
|---|---|
| `/` | Accueil |
| `/departements/` | Les six départements |
| `/departements/hekima-consulting/` … `/departements/nolout-transport/` | Pages département (un seul gabarit) |
| `/contact/` | Formulaire en 3 étapes, routé par département |
| `/groupe/`, `/realisations/`, `/actualites/`, `/carrieres/`, `/investisseurs/`, `/mentions-legales/`, `/confidentialite/` | Pages « en préparation » (pas encore dessinées) |

## Données à fournir par le client

Les textes entre `[crochets]` restent visibles tant qu'ils ne sont pas remplacés : logo SVG officiel, logo de Nolout Game, RCCM, ID Nat., N° impôt, adresse du siège, téléphones et WhatsApp (groupe et départements), année de création, effectif, chiffres clés, logos clients, références et photos, témoignages, statut de Nolout Transport, vidéo publicitaire avec son titre et son texte.

Tant qu'un numéro de téléphone ou WhatsApp est vide (administration, « Contenus »), le site affiche « +243 [numéro] » et le lien mène au formulaire de contact.

**Bandeau de logos (« Les marques du groupe NOLOUT »).** Les logos défilent en continu, sur le modèle de n8n.io : Hekima Consulting, Nolout Construction, Le Bazar de Chacha et Loulou, Nolout Communication et Nolout Transport. Ils ont été préparés à partir des originaux du dossier `Logo entreprise`, recadrés au ras du logo puis réduits. Celui de Nolout Game reste à fournir. Ajouter un logo, d'une marque ou d'un client, se fera depuis l'administration avec l'envoi de fichiers (étape suivante). Le logo doit être en SVG ou en PNG transparent, recadré au ras du logo (sans marge autour). Dans le contenu, chaque logo est une entrée de `accueil.partenaires.logos`, avec `nom` et `fichier`.

Chaque logo garde ses couleurs, sur une carte claire. Pour un logo clair, donnez une autre couleur de carte avec `fond`. Pour une photo qui doit remplir la carte, ajoutez `"ajustement": "cover"` : c'est le cas de Nolout Construction, dont le logo n'existe qu'en maquette photo sur fond sombre.

On peut mettre autant de logos qu'on veut : la bande se complète toute seule pour couvrir l'écran, et `rangees` règle une ou deux bandes. Un bouton pause arrête le défilement (exigence d'accessibilité), et le bandeau reste fixe pour les visiteurs qui ont réduit les animations sur leur appareil.

## Photos de réalisations

Les cartes « Réalisations » (accueil) et « Références » (pages département) sont au format 16:10. Une photo verticale y serait coupée au milieu, visage compris : on la recadre donc d'abord en 1200 × 750, cadrée sur le sujet, et on garde l'original dans `sources/photos/`. Les photos s'enverront depuis l'administration à l'étape suivante. Dans le contenu, une photo s'indique soit dans `accueil.realisations` (`image` et `alt`), soit dans `references.photos` du département (jusqu'à trois, avec `fichier` et `alt`).

Photos en place, pour Nolout Communication : un portrait en studio (carte de l'accueil et première référence) et une intervenante au micro lors d'un événement, en noir et blanc (deuxième référence).

## Publicité vidéo (accueil)

Sous le bandeau de logos, la zone « À l'affiche » présente une publicité, sur le modèle du lecteur vidéo d'ena.cd : le texte à gauche, la vidéo à droite, ou l'un sous l'autre sur téléphone. Sans vidéo, elle affiche l'emplacement « Vidéo publicitaire à venir ».

Vidéo en place : `kev-appel-en-action.mp4`, version web (1280 × 720, 25 images/s, 8,7 Mo, son conservé) de l'original 4K « Kev Appel en ACTION.mp4 » (386 Mo), avec son affiche `kev-appel-en-action.jpg` (l'image à 23 s).

Pour changer de publicité :

1. Glissez la vidéo originale sur `sources/preparer-video.cmd`. En une à deux minutes, il crée dans `site/assets/video/` la version web (MP4 H.264 720p d'environ 9 Mo pour 30 s, index en tête du fichier pour que la lecture démarre tout de suite) et son image d'affiche. L'original n'est pas modifié. Une vidéo tournée en 4K pèse des centaines de Mo et ne doit pas aller telle quelle sur le site. Pour choisir l'image d'affiche, lancez `preparer-video.ps1` avec `-Affiche` suivi de l'instant en secondes (2 s par défaut).
2. La vidéo s'enverra depuis l'administration à l'étape suivante (envoi de fichiers). Dans le contenu, elle s'indique dans `accueil.pub.videos` (`fichier` et `affiche`).

Le titre, le texte et le lien facultatif sous le texte (ex. `contact/#formulaire`) se changent dans l'administration : « Contenus », section « Publicité « À l'affiche » ».

La vidéo démarre dès qu'elle est à moitié visible, sans le son, car les navigateurs n'acceptent la lecture automatique que sans le son. Elle tourne en boucle et s'arrête quand on quitte la zone. Le visiteur peut la mettre en pause, activer le son ou passer en plein écran, et une pause demandée est respectée. Les commandes sont placées sous l'image, pour ne rien cacher de la publicité (le numéro WhatsApp s'affiche en bas de l'image). Pour plusieurs publicités, ajoutez une entrée par vidéo dans `videos` : elles s'enchaînent, puis la liste recommence. La vidéo ne démarre pas seule pour les visiteurs qui ont réduit les animations ou activé l'économie de données : ils la lancent d'un clic. Comme elle démarre sans le son, prévoyez des sous-titres incrustés si elle contient des paroles.

Une vidéo YouTube reste possible, mais YouTube dépose des cookies : il faudrait alors l'ajouter à la gestion du consentement.

## Formulaire de contact

Le formulaire envoie en JSON `departement`, `equipe`, `destinataire`, `nom`, `entreprise`, `email`, `telephone` et `message` à `api/contact.js` (réglage `groupe.formulaireEndpoint` : `/api/contact`). La demande est enregistrée dans la table `demandes` de Neon et arrive dans l'administration, onglet « Demandes ». Le site affiche alors « Demande envoyée. L'équipe X vous répondra sous 48 h ouvrées. » Un champ invisible écarte les robots.

## Cookies

Au premier passage, un bandeau propose « Tout refuser », « Tout accepter » ou « Personnaliser mes choix », avec une case par catégorie : mesure d'audience et marketing. Les cookies nécessaires sont toujours actifs. Le choix est gardé six mois dans le navigateur. Ensuite, un bouton rond en bas à gauche (repris de n8n.io, il s'élargit au survol) et le lien « Cookies » du pied de page rouvrent les réglages. Si le visiteur retire un accord, les cookies de mesure déjà déposés sont effacés.

Aucun outil de mesure n'est installé pour l'instant. Pour en ajouter, renseignez leur identifiant dans l'administration : « Contenus », section « Mesure d'audience » (rubrique `cookies` du contenu).

- `googleAnalytics` : identifiant GA4 (ex. `G-ABC123XYZ`), chargé seulement si le visiteur accepte la mesure d'audience ;
- `metaPixel` : identifiant du pixel Meta/Facebook, chargé seulement si le visiteur accepte le marketing.

Pour tout autre outil, écrivez son script avec `type="text/plain"` et `data-consentement="mesure"` ou `"marketing"` : il ne s'exécutera qu'avec l'accord du visiteur.

## Écarts avec le cahier de passation

- Site statique HTML/CSS/JS au lieu d'Astro : Node.js n'est pas installé sur ce poste. Le rendu est le même et les contenus sont déjà regroupés en collection (`contenu.json`), prêts pour une migration vers Astro.
- Version anglaise (`/en/`) pas encore faite : le sélecteur « FR · EN » est affiché, « EN » n'est pas encore un lien.
- Logo Hekima : version blanche et or refaite à partir du logo HEKIMA en haute définition (celle des maquettes faisait 152 px de large). L'original bleu et or est conservé dans `sources/logos/hekima-logo-original.png`.
- Logo Nolout Transport posé sur fond clair, car son texte noir disparaît sur le bleu nuit.
- Zone publicitaire vidéo « À l'affiche » ajoutée à l'accueil, sous le bandeau de logos. Elle ne figure pas dans les maquettes.
- Témoignages : effets repris de campus.ena.gouv.cd. Grands guillemets à la couleur du département ; au survol, la carte se soulève de 12 px, grossit de 3 % et prend une ombre et un liseré à la couleur du département ; les cartes apparaissent l'une après l'autre au défilement (montée, zoom de 90 à 100 % et légère bascule, en 0,8 s). Les animations sont coupées pour les visiteurs qui ont réduit les animations.
- Bandeau de logos de l'accueil : en attendant les logos clients, il présente les marques du groupe. Son titre devient donc « Les marques du groupe NOLOUT » au lieu de « Ils travaillent avec nos départements ». Les logos sont posés sur des cartes claires, dans leurs couleurs, au lieu d'être affichés à 75 % d'opacité sur le fond sombre : la plupart sont sombres et un logo ne se redessine pas.
- Schéma de l'accueil : les six départements tournent autour de NOLOUT (un tour par minute) au lieu d'être fixes. La rotation s'arrête au survol, avec le bouton pause, et pour les visiteurs qui ont réduit les animations. L'orbite se calcule sur la taille du cadre, si bien qu'aucune case n'en sort. La place de départ de chaque département se règle avec `orbite` dans `contenu.json`.
- Sur téléphone (moins de 720 px), le schéma passe en grille de tuiles fixes (la maquette défilait horizontalement).
- Chiffres clés : le chiffre garde 48 px mais rétrécit si sa carte devient trop étroite, pour que « [nombre] » ne fasse plus déborder la page.
- En-tête : barre flottante en verre sur le modèle de n8n.io, au lieu d'une bande pleine largeur. Elle est fixée à 12 px du haut, avec des coins arrondis, un fond translucide flouté et un liseré clair. Elle contient la pastille « FR · EN » et le bouton or verre « Nous contacter ». Elle se cache quand on descend et réapparaît dès qu'on remonte. Le hero passe sous la barre, ce qui laisse voir son halo à travers le verre.
- Boutons du hero de l'accueil : ils suivent le modèle n8n.io (dégradé qui pivote au survol, flèche qui apparaît pendant que le libellé glisse), avec un effet verre. « Explorer les départements » est en or avec un reflet de verre, « Demander un devis » en verre dépoli. Pour appliquer ce modèle à un autre bouton, utilisez `boutonFleche` dans `lib/rendu.js`, avec la variante `or-glass` ou `glass`.

## Mise en ligne

**Adresse du site : https://nolout-beta.vercel.app** (aussi https://nolout-nolout.vercel.app).

**Vercel, depuis GitHub.** Le dossier `nolout/` est un dépôt Git, envoyé sur GitHub : https://github.com/ninjaproduction062-netizen/nolout. Vercel (équipe Nolout) y est relié et utilise `site/` comme racine : chaque envoi sur la branche `main` met le site en ligne à jour. Pour publier une modification du code ou des fichiers de `site/`, enregistrez et envoyez les changements : `git add -A`, `git commit -m "…"` et `git push`. Les textes, eux, se publient depuis l'administration. Le projet garde la protection standard de Vercel : l'adresse publique du site est ouverte à tous, les versions de test sont réservées à l'équipe.

Le dépôt est public. N'y mettez jamais de mot de passe ni de clé. Les photos originales de `sources/photos/` restent sur ce PC : elles sont exclues par `.gitignore`.

**Base de données Neon.** Elle a été créée depuis le projet Vercel (onglet Storage > Neon), qui fournit lui-même la variable `DATABASE_URL`. Les tables se créent seules au premier appel : `contenus` (brouillon et version en ligne), `contenus_historique`, `demandes`, `comptes` et `connexions_echouees`.

**Hébergement de nolout.cd (hosting.cd).** `nolout-site.zip` contient le site prêt à téléverser. Dans le cPanel, ouvrez Gestionnaire de fichiers > `public_html`, choisissez « Charger », puis « Extraire ». Les dossiers des sous-domaines (admin, administration, gestion, nocom) ne sont pas touchés.

## Aperçu local

`node scripts/serveur-local.mjs`, puis http://localhost:3000/ : les pages sont fabriquées comme sur Vercel, à partir de `sources/contenu.json`. Sans base de données, l'administration et le formulaire répondent « base de données non reliée ».

La configuration « nolout » de `.claude/launch.json` sert, elle, les pages produites dans `site/` par `generer.cmd` (`http://localhost:8097/nolout/site/`).

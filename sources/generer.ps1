# ==========================================================================
#  NOLOUT SARLU - générateur des pages du site
#  Lit sources/contenu.json et écrit les pages HTML dans site/.
#  La feuille de style, le JavaScript et les images (site/assets/) se
#  modifient directement : seules les pages .html sont générées ici.
#  Lancement : double-clic sur sources/generer.cmd
# ==========================================================================
param([string]$Racine)

$ErrorActionPreference = 'Stop'
if (-not $Racine) { $Racine = Split-Path -Parent $PSScriptRoot }

$Sources = Join-Path $Racine 'sources'
$Site = Join-Path $Racine 'site'
$C = [IO.File]::ReadAllText((Join-Path $Sources 'contenu.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$G = $C.groupe
$DEPTS = @($C.departements)
$PAR_CODE = @{}
foreach ($d in $DEPTS) { $PAR_CODE[$d.code] = $d }

$UTF8 = New-Object System.Text.UTF8Encoding($false)
$NBSP = [string][char]0x00A0
$script:R = ''      # préfixe vers la racine du site pour la page en cours ('' , '../' ou '../../')
$script:Pages = 0

# ── Outils ────────────────────────────────────────────────────────────────

# Échappe le HTML et pose les espaces insécables de la typographie française
function E($texte) {
  if ($null -eq $texte) { return '' }
  $t = ([string]$texte).Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
  $t = [regex]::Replace($t, ' (?=[:;!?%' + [char]0x00BB + '])', $NBSP)
  return $t.Replace([string][char]0x00AB + ' ', [string][char]0x00AB + $NBSP)
}

function Joindre($elements) { return (@($elements) -join "`n") }

function Ecrire([string]$chemin, [string]$html) {
  $complet = Join-Path $Site $chemin
  $dossier = Split-Path -Parent $complet
  if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Force $dossier | Out-Null }
  [IO.File]::WriteAllText($complet, $html, $UTF8)
  $script:Pages++
  Write-Host "  $chemin"
}

# Tracés d'icônes (trait 1,5 à 2 px, grille 24), repris des maquettes
$ICONES = @{
  target = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
  build  = 'M4 21V9l8-5 8 5v12M9 21v-7h6v7'
  bag    = 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2'
  mega   = 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6'
  game   = 'M6 8h12a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8zM8 11v2M7 12h2M15 12h.01M17 12h.01'
  truck  = 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
  phone  = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z'
  wa     = 'M4 20l1.3-3.9A8 8 0 1 1 8 19zM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z'
  mail   = 'M3 6h18v12H3zM3 6l9 7 9-7'
  org    = 'M9 3h6v5H9zM4 16h6v5H4zM14 16h6v5h-6zM12 8v4M7 16v-4h10v4'
  flag   = 'M5 21V4h11l-2 4 2 4H5'
  users  = 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 6v1'
  plan   = 'M3 4h18v16H3zM3 10h8v10M11 4v6M15 14h6'
  tools  = 'M14 6l4 4-9 9H5v-4zM12 8l4 4M16 3l5 5'
  check  = 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'
  q      = 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01'
}

# Nombre écrit avec un point décimal, quelle que soit la langue de Windows (CSS et SVG l'exigent)
function N($valeur) { return ([double]$valeur).ToString('0.##', [Globalization.CultureInfo]::InvariantCulture) }

# Bouton pause / lecture d'une animation (cible de 44 px)
function BoutonPause([string]$libelle, [string]$attribut, [string]$classe = '', [switch]$Cache) {
  $masque = if ($Cache) { ' hidden' } else { '' }
  return @"
<button type="button" class="nl-pause$classe" aria-pressed="false" aria-label="$(E $libelle)" $attribut$masque>
        <svg class="nl-pause__pause" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="2.5" height="9" rx="1" fill="currentColor"/><rect x="7.5" y="1.5" width="2.5" height="9" rx="1" fill="currentColor"/></svg>
        <svg class="nl-pause__lecture" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5z" fill="currentColor"/></svg>
      </button>
"@
}

# Bouton sur le modèle n8n : libellé + flèche qui apparaît au survol
# $variante : 'or-glass' (or, reflet de verre) ou 'glass' (verre dépoli)
function BoutonFleche([string]$variante, [string]$href, [string]$libelle) {
  return "<a class=""nl-btn nl-btn--$variante nl-btn--fleche"" href=""$href""><span class=""nl-btn__libelle"">$(E $libelle)</span><span class=""nl-btn__icone"" aria-hidden=""true""><svg width=""16"" height=""16"" viewBox=""0 0 24 24"" fill=""none"" stroke=""currentColor"" stroke-width=""2"" stroke-linecap=""round"" stroke-linejoin=""round""><path d=""M5 12h14M13 6l6 6-6 6""/></svg></span></a>"
}

function Svg([string]$nom, [int]$taille = 18, [string]$trait = '1.75') {
  return "<svg width=""$taille"" height=""$taille"" viewBox=""0 0 24 24"" fill=""none"" stroke=""currentColor"" stroke-width=""$trait"" stroke-linecap=""round"" stroke-linejoin=""round"" aria-hidden=""true""><path d=""$($ICONES[$nom])""/></svg>"
}

# Variables CSS d'un département : --c (base), --c-clair, --c-rgb
function StyleDept($d) { return "--c:$($d.base);--c-clair:$($d.clair);--c-rgb:$($d.rgb)" }

function LienTel($numero) {
  if ($numero) { return 'tel:' + ($numero -replace '[^\d+]', '') }
  return $null
}
function LienWhatsApp($numero, $message) {
  if (-not $numero) { return $null }
  $lien = 'https://wa.me/' + ($numero -replace '\D', '')
  if ($message) { $lien += '?text=' + [uri]::EscapeDataString($message) }
  return $lien
}
function Ou($valeur, $secours) { if ($valeur) { return $valeur } return $secours }

$LEGAL = "RCCM $($G.rccm) · ID Nat. $($G.idNat) · N° impôt $($G.numeroImpot)"
$TEL_AFFICHE = Ou $G.telephone '+243 [numéro]'
$WA_AFFICHE = '+243 [numéro]'
if ($G.whatsapp) { $WA_AFFICHE = '+' + ($G.whatsapp -replace '\D', '') }

# Visuel : image réelle ou emplacement « photo à venir » (aplat bleu nuit + trame or)
function Visuel($image, [string]$legende, [string]$format = '', [switch]$Prioritaire) {
  $R = $script:R
  $classeFormat = if ($format) { " nl-visuel--$format" } else { '' }
  if ($image -and $image.fichier) {
    $ajuste = switch ($image.ajustement) { 'contain' { ' nl-visuel--contain' } 'logo' { ' nl-visuel--logo' } default { '' } }
    $fond = if ($image.fond) { " style=""--fond:$($image.fond)""" } else { '' }
    $charge = if ($Prioritaire) { 'fetchpriority="high"' } else { 'loading="lazy"' }
    return "<div class=""nl-visuel$ajuste$classeFormat""$fond><img src=""${R}assets/img/$($image.fichier)"" alt=""$(E $image.alt)"" $charge decoding=""async""></div>"
  }
  return "<div class=""nl-visuel nl-vide$classeFormat"" role=""img"" aria-label=""$(E $legende)""><span class=""nl-vide__legende""><span>$(E $legende)</span></span></div>"
}

function Canal([string]$icone, [string]$libelle, [string]$valeur, [string]$href, [switch]$Externe) {
  $cible = if ($Externe) { ' target="_blank" rel="noopener"' } else { '' }
  return "<a class=""nl-canal"" href=""$(E $href)""$cible><span class=""nl-canal__icone"">$(Svg $icone 22 '1.5')</span><span class=""nl-canal__textes""><span class=""nl-canal__libelle"">$(E $libelle)</span><span class=""nl-canal__valeur"">$(E $valeur)</span></span><span class=""nl-canal__fleche"" aria-hidden=""true"">→</span></a>"
}

function TuileDept($d, [string]$href) {
  return "<a class=""nl-tuile-dept"" href=""$href"" style=""$(StyleDept $d)""><span class=""nl-icone-dept nl-icone-dept--30"">$(Svg $d.icone 16)</span><span class=""nl-tuile-dept__nom"">$(E $d.nom)</span></a>"
}

function BandeauDepts([string]$titre, $liste) {
  $R = $script:R
  $tuiles = Joindre ($liste | ForEach-Object { TuileDept $_ "${R}departements/$($_.slug)/" })
  return @"
<section class="nl-conteneur nl-section--96 nl-bandeau-depts" aria-label="$(E $titre)">
  <p class="nl-legende">$(E $titre)</p>
  <div class="nl-grille nl-grille--tuiles">
$tuiles
  </div>
</section>
"@
}

# ── En-tête, menus, pied de page ──────────────────────────────────────────

function Entete([string]$actif) {
  $R = $script:R
  $accueil = Ou $R './'
  $megaLiens = Joindre ($DEPTS | ForEach-Object {
    "<a class=""nl-mega__lien"" href=""${R}departements/$($_.slug)/"" style=""$(StyleDept $_)""><span class=""nl-icone-dept"">$(Svg $_.icone 17)</span><span class=""nl-mega__textes""><span class=""nl-mega__nom"">$(E $_.nom)</span><span class=""nl-mega__domaine"">$(E $_.domaine)</span></span></a>"
  })
  $nav = Joindre ($C.navigation | ForEach-Object {
    if ($_.megamenu) {
      $classe = if ($actif -eq 'departements') { 'nl-nav__lien is-actif' } else { 'nl-nav__lien' }
@"
<button type="button" class="$classe" aria-expanded="false" aria-controls="nl-mega" data-megamenu>$(E $_.libelle)<span class="nl-nav__chevron" aria-hidden="true">&#9662;</span></button>
        <div class="nl-mega" id="nl-mega" hidden>
          <div class="nl-mega__panneau">
            <div class="nl-mega__intro">
              <span class="nl-mega__intro-surtitre">Nos départements</span>
              <span class="nl-mega__intro-titre">Six métiers, une même exigence.</span>
              <a class="nl-lien-or" href="${R}departements/">Vue d’ensemble →</a>
            </div>
            <div class="nl-mega__grille">
$megaLiens
            </div>
          </div>
        </div>
"@
    } else {
      $attrs = if ($actif -eq $_.page) { 'class="nl-nav__lien is-actif" aria-current="page"' } else { 'class="nl-nav__lien"' }
      "<a $attrs href=""$R$($_.page)/"">$(E $_.libelle)</a>"
    }
  })
  $contactActif = if ($actif -eq 'contact') { ' nl-btn--actif" aria-current="page' } else { '' }
  return @"
<header class="nl-entete">
  <div class="nl-entete__barre">
    <a class="nl-marque" href="$accueil" aria-label="NOLOUT, accueil">
      <img class="nl-marque__logo" src="${R}assets/img/logo-nolout.webp" alt="" width="38" height="38">
      <span class="nl-marque__nom">NOLOUT</span>
    </a>
    <nav class="nl-nav" aria-label="Navigation principale">
        $nav
    </nav>
    <div class="nl-entete__fin">
      <p class="nl-langue nl-langue--pilule"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><span aria-current="true">FR</span> · <span lang="en" title="Version anglaise en préparation">EN</span></p>
      <a class="nl-btn nl-btn--or-glass nl-entete__contact$contactActif" href="${R}contact/">Nous contacter</a>
      <button type="button" class="nl-burger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="nl-menu" data-burger><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
"@
}

function MenuMobile {
  $R = $script:R
  $tuiles = Joindre ($DEPTS | ForEach-Object {
    "<li><a class=""nl-menu__tuile"" href=""${R}departements/$($_.slug)/"" style=""$(StyleDept $_)""><span class=""nl-icone-dept nl-icone-dept--28"">$(Svg $_.icone 15)</span>$(E $_.nom)</a></li>"
  })
  $rubriques = Joindre ($C.navigation | Where-Object { -not $_.megamenu } | ForEach-Object {
    "<li><a class=""nl-menu__rubrique"" href=""$R$($_.page)/"">$(E $_.libelle)</a></li>"
  })
  $wa = Ou (LienWhatsApp $G.whatsapp 'Bonjour NOLOUT, ') "${R}contact/#formulaire"
  return @"
<dialog class="nl-menu" id="nl-menu" aria-label="Menu">
  <div class="nl-menu__tete">
    <span class="nl-marque__nom">NOLOUT</span>
    <button type="button" class="nl-menu__fermer" data-fermer-menu aria-label="Fermer le menu">×</button>
  </div>
  <nav class="nl-menu__corps" aria-label="Menu mobile">
    <p class="nl-menu__titre">Départements</p>
    <ul class="nl-menu__liste">
$tuiles
    </ul>
    <ul class="nl-menu__rubriques">
$rubriques
      <li><a class="nl-menu__rubrique" href="${R}contact/">Contact</a></li>
    </ul>
    <p class="nl-langue nl-menu__langue"><span aria-current="true">FR</span> · <span lang="en" title="Version anglaise en préparation">EN</span></p>
  </nav>
  <div class="nl-menu__pied">
    <a class="nl-btn nl-btn--verre" href="$(E $wa)">WhatsApp</a>
    <a class="nl-btn nl-btn--or" href="${R}contact/">Nous contacter</a>
  </div>
</dialog>
"@
}

# Barre d'action fixe sur mobile : Appeler · WhatsApp · Devis
function BarreMobile($d) {
  $R = $script:R
  if ($d) {
    $tel = Ou (LienTel (Ou $d.telephone $G.telephone)) "${R}contact/?departement=$($d.code)#formulaire"
    $wa = Ou (LienWhatsApp (Ou $d.whatsapp $G.whatsapp) "Bonjour $($d.nom), ") "${R}contact/?departement=$($d.code)#formulaire"
    $devis = "${R}contact/?departement=$($d.code)#formulaire"
  } else {
    $tel = Ou (LienTel $G.telephone) "${R}contact/"
    $wa = Ou (LienWhatsApp $G.whatsapp 'Bonjour NOLOUT, ') "${R}contact/#formulaire"
    $devis = "${R}contact/#formulaire"
  }
  return @"
<nav class="nl-barre-mobile" aria-label="Actions rapides">
  <a class="nl-btn nl-btn--verre" href="$(E $tel)">Appeler</a>
  <a class="nl-btn nl-btn--verre" href="$(E $wa)">WhatsApp</a>
  <a class="nl-btn nl-btn--or" href="$(E $devis)">Devis</a>
</nav>
"@
}

function PiedComplet {
  $R = $script:R
  $accueil = Ou $R './'
  $depts = Joindre ($DEPTS | ForEach-Object { "<li><a href=""${R}departements/$($_.slug)/"">$(E $_.nom)</a></li>" })
  $tel = Ou (LienTel $G.telephone) "${R}contact/"
  $wa = Ou (LienWhatsApp $G.whatsapp 'Bonjour NOLOUT, ') "${R}contact/#formulaire"
  return @"
<footer class="nl-pied">
  <div class="nl-conteneur nl-pied__grille">
    <div class="nl-pied__marque">
      <a class="nl-pied__logo" href="$accueil"><img src="${R}assets/img/logo-nolout.webp" alt="" width="34" height="34" loading="lazy"><span>NOLOUT</span></a>
      <p class="nl-pied__signature">$(E $G.signature)</p>
    </div>
    <div class="nl-pied__colonne">
      <h2 class="nl-pied__titre">Départements</h2>
      <ul>
$depts
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
        <li><a href="$(E $tel)">$(E $TEL_AFFICHE)</a></li>
        <li><a href="mailto:$($G.email)">$(E $G.email)</a></li>
        <li><a href="$(E $wa)">WhatsApp</a></li>
        <li><span>$(E $G.adresseCourte)</span></li>
      </ul>
    </div>
  </div>
  <div class="nl-conteneur">
    <div class="nl-pied__legal">
      <span>© $($G.annee) $(E $G.raisonSociale) · $(E $LEGAL)</span>
      <nav aria-label="Informations légales"><a href="${R}mentions-legales/">Mentions légales</a><a href="${R}confidentialite/">Confidentialité</a><button type="button" class="nl-pied__cookies" data-cookies="personnaliser">Cookies</button></nav>
    </div>
  </div>
</footer>
"@
}

function PiedCompact([string]$texte) {
  return @"
<footer class="nl-pied">
  <div class="nl-conteneur nl-pied__compact">
    <span><strong>NOLOUT</strong><span>$(E $texte)</span></span>
    <span class="nl-pied__droite"><span>$(E $LEGAL)</span><button type="button" class="nl-pied__cookies" data-cookies="personnaliser">Cookies</button></span>
  </div>
</footer>
"@
}

# ── Cookies : bandeau de consentement, réglages et bouton flottant ────────
# Le bouton rond (en bas à gauche) reprend celui de n8n.io : il s'élargit au survol.
# Les outils de mesure (contenu.json → cookies) ne se chargent qu'avec l'accord du visiteur.

$ICONE_COOKIE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.5A9 9 0 1 1 11.5 3a3 3 0 0 0 3.5 3.5 3 3 0 0 0 3.5 3.5 3 3 0 0 0 2.5 2.5z"/><path d="M8.5 9.5h.01M8 15h.01M12.5 12.5h.01M15.5 16h.01"/></svg>'

function BanniereCookies {
  $R = $script:R
  return @"
<section class="nl-cookies" role="region" aria-labelledby="cookies-titre" data-cookies-banniere hidden>
  <h2 class="nl-cookies__titre" id="cookies-titre"><span class="nl-cookies__icone">$ICONE_COOKIE</span>Cookies et vie privée</h2>
  <p class="nl-cookies__texte">Nous utilisons des cookies nécessaires au fonctionnement du site. Avec votre accord, nous utilisons aussi des cookies de mesure d’audience et de marketing pour améliorer nos services. Vous pouvez changer d’avis à tout moment. <a href="${R}confidentialite/">Politique de confidentialité</a></p>
  <div class="nl-cookies__actions">
    <button type="button" class="nl-btn nl-btn--verre nl-btn--petit" data-cookies="refuser">Tout refuser</button>
    <button type="button" class="nl-btn nl-btn--or nl-btn--petit" data-cookies="accepter">Tout accepter</button>
  </div>
  <button type="button" class="nl-cookies__perso" data-cookies="personnaliser">Personnaliser mes choix</button>
</section>
"@
}

function CategorieCookie([string]$code, [string]$titre, [string]$texte) {
  return @"
      <li class="nl-cookies-categorie">
        <label class="nl-cookies-categorie__textes" for="cc-$($code)"><span class="nl-cookies-categorie__titre" id="cc-$($code)-titre">$titre</span><span class="nl-cookies-categorie__texte" id="cc-$($code)-texte">$texte</span></label>
        <input class="nl-interrupteur" type="checkbox" role="switch" id="cc-$($code)" data-categorie="$($code)" aria-labelledby="cc-$($code)-titre" aria-describedby="cc-$($code)-texte">
      </li>
"@
}

# Scripts des outils de mesure, neutralisés (type="text/plain") jusqu'au consentement
function ScriptsConsentement {
  $s = @()
  $ga = ([string]$C.cookies.googleAnalytics) -replace '[^\w-]', ''
  if ($ga) {
    $s += "<script type=""text/plain"" data-consentement=""mesure"" data-src=""https://www.googletagmanager.com/gtag/js?id=$ga""></script>"
    $s += "<script type=""text/plain"" data-consentement=""mesure"">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','$ga');</script>"
  }
  $pixel = ([string]$C.cookies.metaPixel) -replace '\D', ''
  if ($pixel) {
    $s += "<script type=""text/plain"" data-consentement=""marketing"">!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/fr_FR/fbevents.js');fbq('init','$pixel');fbq('track','PageView');</script>"
  }
  return Joindre $s
}

function ReglagesCookies {
  $mesure = CategorieCookie 'mesure' "Mesure d’audience" 'Statistiques de fréquentation (pages consultées, durée des visites) pour améliorer le site.'
  $marketing = CategorieCookie 'marketing' 'Marketing' "Mesure de l’efficacité de nos publicités et contenus adaptés sur les réseaux sociaux."
  return @"
<dialog class="nl-cookies-reglages" id="nl-cookies-reglages" aria-labelledby="cookies-reglages-titre">
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
$mesure
$marketing
    </ul>
  </div>
  <div class="nl-cookies-reglages__pied">
    <button type="button" class="nl-btn nl-btn--verre nl-btn--petit" data-cookies="refuser">Tout refuser</button>
    <button type="button" class="nl-btn nl-btn--verre nl-btn--petit" data-cookies="accepter">Tout accepter</button>
    <button type="button" class="nl-btn nl-btn--or nl-btn--petit" data-cookies="enregistrer">Enregistrer mes choix</button>
  </div>
</dialog>
<button type="button" class="nl-cookies-badge" data-cookies="personnaliser" hidden><span class="nl-cookies-badge__icone">$ICONE_COOKIE</span><span class="nl-cookies-badge__texte">Gérer les cookies</span></button>
$(ScriptsConsentement)
"@
}

# Squelette commun à toutes les pages
function Page {
  param([string]$Titre, [string]$Description, [string]$Actif, [string]$Contenu, [string]$Pied, [string]$StyleMain = '', $Dept = $null, [string]$Tete = '')
  $R = $script:R
  $style = if ($StyleMain) { " style=""$StyleMain""" } else { '' }
  return @"
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>$(E $Titre)</title>
<meta name="description" content="$(E $Description)">
<meta name="theme-color" content="#061120">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NOLOUT SARLU">
<meta property="og:title" content="$(E $Titre)">
<meta property="og:description" content="$(E $Description)">
<meta property="og:locale" content="fr_FR">
<link rel="icon" href="${R}assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="${R}assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&amp;family=Poppins:wght@400;500&amp;display=swap">
<link rel="stylesheet" href="${R}assets/css/nolout.css">
<script src="${R}assets/js/nolout.js" defer></script>
$Tete
</head>
<body>
<a class="nl-evitement" href="#contenu">Aller au contenu</a>
$(BanniereCookies)
$(Entete $Actif)
<main id="contenu"$style>
$Contenu
</main>
$Pied
$(MenuMobile)
$(BarreMobile $Dept)
$(ReglagesCookies)
</body>
</html>
"@
}

# Bloc d'appel final « Un projet ? Parlons-en. »
function BlocCta {
  $R = $script:R
  $wa = Ou (LienWhatsApp $G.whatsapp 'Bonjour NOLOUT, ') "${R}contact/#formulaire"
  return @"
<section class="nl-conteneur nl-section" aria-labelledby="titre-cta">
  <div class="nl-cta">
    <h2 id="titre-cta">$(E 'Un projet ? Parlons-en.')</h2>
    <p>Indiquez le département concerné, votre demande arrive directement à la bonne équipe. Réponse sous 48 h ouvrées.</p>
    <div class="nl-actions">
      <a class="nl-btn nl-btn--or" href="${R}contact/#formulaire">Demander un devis</a>
      <a class="nl-btn nl-btn--verre" href="$(E $wa)">Écrire sur WhatsApp</a>
    </div>
  </div>
</section>
"@
}

# ── Logos clients : bandes qui défilent en continu (repris de n8n.io) ─────

function TuileClient($logo, [bool]$masque, [bool]$repete) {
  $R = $script:R
  $classe = if ($repete) { 'nl-logo-client nl-logo-client--repete' } else { 'nl-logo-client' }
  if ($logo.fichier) {
    # Carte claire par défaut ; fond : autre couleur ; ajustement cover : l'image remplit la carte (photo)
    $classe += ' nl-logo-client--image'
    if ($logo.ajustement -eq 'cover') { $classe += ' nl-logo-client--cover' }
    $fond = if ($logo.fond) { " style=""--fond:$($logo.fond)""" } else { '' }
    $cache = if ($masque) { ' aria-hidden="true"' } else { '' }
    $alt = if ($masque) { '' } else { E $logo.nom }
    # Pas de chargement différé : les copies cachées par la bande n'apparaîtraient qu'en entrant, avec un blanc
    return "<li class=""$classe""$fond$cache><img src=""${R}assets/img/$($logo.fichier)"" alt=""$alt"" decoding=""async""></li>"
  }
  return "<li class=""$classe nl-logo-client--vide"" aria-hidden=""true""><span>[logo]</span></li>"
}

# Une bande : la liste est répétée jusqu'à couvrir la largeur de l'écran (8 cartes au moins),
# puis doublée pour que la boucle (translation de -50 %) ne marque aucun saut. Seule la
# première occurrence de chaque logo est lue par les lecteurs d'écran.
function BandeDefilante($logos, [int]$decalage, [bool]$inverse) {
  $n = $logos.Count
  $tours = [int][math]::Ceiling(8 / $n)
  $tuiles = New-Object System.Collections.Generic.List[string]
  foreach ($copie in 0, 1) {
    for ($t = 0; $t -lt $tours; $t++) {
      for ($i = 0; $i -lt $n; $i++) {
        $repete = ($copie -eq 1) -or ($t -gt 0)
        $tuiles.Add((TuileClient $logos[($i + $decalage) % $n] ($inverse -or $repete) $repete))
      }
    }
  }
  $classe = if ($inverse) { 'nl-defilant nl-defilant--inverse' } else { 'nl-defilant' }
  $duree = $n * $tours * 8   # 8 s par carte de 200 px : environ 25 px/s, proche de n8n.io
  return "<div class=""$classe"" style=""--duree:${duree}s""><ul class=""nl-defilant__piste"">`n$($tuiles -join "`n")`n</ul></div>"
}

function BandeauClients($titre, $partenaires) {
  $logos = @($partenaires.logos)
  $bandes = @(BandeDefilante $logos 0 $false)
  if ([int]$partenaires.rangees -ge 2) { $bandes += BandeDefilante $logos ([int][math]::Floor($logos.Count / 2)) $true }
  $aucunLogo = -not ($logos | Where-Object { $_.fichier })
  $annonce = if ($aucunLogo) { '<p class="nl-sr">Les logos de nos clients seront bientôt affichés ici.</p>' } else { '' }
  return @"
<section class="nl-partenaires" aria-labelledby="titre-clients">
  <div class="nl-conteneur nl-partenaires__in">
    <div class="nl-partenaires__tete">
      <p class="nl-legende" id="titre-clients">$(E $titre)</p>
      $(BoutonPause 'Mettre en pause le défilement des logos' 'data-pause-defilement')
    </div>
    <div class="nl-defilants" data-defilants>
$(Joindre $bandes)
    </div>
    $annonce
  </div>
</section>
"@
}

# ── Publicité vidéo : lue en boucle et sans le son quand elle est à l'écran ─

# Chemin d'un fichier vidéo : dans site/assets/video/, ou adresse complète (https://…)
function CheminVideo([string]$fichier) {
  if ($fichier -match '^https?://') { return $fichier }
  return $script:R + 'assets/video/' + ((($fichier -split '/') | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/')
}

function ZonePub($pub) {
  $R = $script:R
  $videos = @($pub.videos | Where-Object { $_.fichier })
  $lien = ''
  if ($pub.lien -and $pub.lien.libelle -and $pub.lien.href) {
    $href = if ($pub.lien.href -match '^(https?:|mailto:|tel:|#)') { $pub.lien.href } else { $R + $pub.lien.href }
    $lien = "<a class=""nl-lien-or"" href=""$(E $href)"">$(E $pub.lien.libelle) →</a>"
  }
  $iconeLecture = '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z" fill="currentColor"/></svg>'

  if ($videos.Count) {
    $premiere = $videos[0]
    $affiche = if ($premiere.affiche) { " poster=""$(CheminVideo $premiere.affiche)""" } else { '' }
    # Une vidéo : elle boucle d'elle-même. Plusieurs : elles s'enchaînent, puis la liste recommence.
    $boucle = if ($videos.Count -eq 1) { ' loop' } else { " data-pub-liste=""$(($videos | ForEach-Object { CheminVideo $_.fichier }) -join ' ')""" }
    # Sans JavaScript : lecteur natif (controls). Le script le remplace par les commandes du site,
    # placées sous l'image pour ne rien cacher de la publicité (numéro, logo en bas de l'image).
    $ecran = @"
<div class="nl-pub__lecteur" data-pub>
    <div class="nl-pub__ecran">
      <video class="nl-pub__video" src="$(CheminVideo $premiere.fichier)"$affiche muted playsinline controls preload="none"$boucle aria-label="$(E "Vidéo : $($pub.titre)")" data-pub-video></video>
      <button type="button" class="nl-pub__lancer" tabindex="-1" aria-hidden="true" data-pub-lancer hidden>$iconeLecture</button>
    </div>
    <div class="nl-pub__barre" data-pub-barre hidden>
      $(BoutonPause 'Mettre la vidéo en pause' 'data-pub-pause')
      <span class="nl-pub__progression" aria-hidden="true"><span data-pub-progression></span></span>
      <button type="button" class="nl-pause" aria-pressed="false" aria-label="Activer le son" data-pub-son>
        <svg class="nl-son__coupe" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6H5l3.5-3v10L5 10H2.5z" fill="currentColor"/><path d="M11 6.2l3.6 3.6M14.6 6.2L11 9.8"/></svg>
        <svg class="nl-son__actif" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6H5l3.5-3v10L5 10H2.5z" fill="currentColor"/><path d="M11 5.8a3.2 3.2 0 0 1 0 4.4M12.9 3.8a6 6 0 0 1 0 8.4"/></svg>
      </button>
      <button type="button" class="nl-pause" aria-label="Afficher la vidéo en plein écran" data-pub-plein-ecran>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>
      </button>
    </div>
  </div>
"@
  } else {
    $ecran = "<div class=""nl-pub__lecteur""><div class=""nl-pub__ecran nl-vide"" role=""img"" aria-label=""Vidéo publicitaire à venir""><span class=""nl-pub__lancer"" aria-hidden=""true"">$iconeLecture</span><span class=""nl-vide__legende""><span>Vidéo publicitaire à venir</span></span></div></div>"
  }

  return @"
<section class="nl-conteneur nl-pub" aria-labelledby="titre-pub">
  <div class="nl-pub__texte">
    <p class="nl-surtitre">$(E $pub.surtitre)</p>
    <h2 id="titre-pub" class="nl-h2">$(E $pub.titre)</h2>
    <p class="nl-corps-l">$(E $pub.texte)</p>
    $lien
  </div>
  $ecran
</section>
"@
}

# ── Accueil ───────────────────────────────────────────────────────────────

function PageAccueil {
  $script:R = ''
  $A = $C.accueil

  $lignes = @(); $noeuds = @(); $fiches = @()
  for ($i = 0; $i -lt $DEPTS.Count; $i++) {
    $d = $DEPTS[$i]
    $actif = ($i -eq 0)
    # Position de départ sur l'orbite (ellipse de 33 % × 38 % du cadre) ; le JavaScript fait ensuite tourner
    $radians = [double]$d.orbite * [math]::PI / 180
    $x = N (50 + 33 * [math]::Cos($radians))
    $y = N (50 + 38 * [math]::Sin($radians))
    $classeLigne = if ($actif) { ' class="is-actif"' } else { '' }
    $lignes += "<line data-ligne x1=""50"" y1=""50"" x2=""$x"" y2=""$y"" vector-effect=""non-scaling-stroke""$classeLigne style=""--c-clair:$($d.clair)""/>"
    $noeuds += "<button type=""button"" class=""nl-hub__noeud"" data-noeud data-angle=""$(N $d.orbite)"" aria-pressed=""$(([string]$actif).ToLower())"" aria-controls=""hub-fiches"" style=""--x:$x%;--y:$y%;$(StyleDept $d)""><span class=""nl-icone-dept"">$(Svg $d.icone 18)</span><span class=""nl-hub__noeud-textes""><span class=""nl-hub__noeud-nom"">$(E $d.court)</span><span class=""nl-hub__noeud-tag"">$(E $d.tag)</span></span></button>"
    $services = Joindre ($d.servicesCles | ForEach-Object { "<li>$(E $_)</li>" })
    $cache = if ($actif) { '' } else { ' hidden' }
    $fiches += @"
<div class="nl-hub__fiche" data-fiche style="$(StyleDept $d)"$cache>
            <p class="nl-hub__surtitre"><span class="nl-puce" aria-hidden="true"></span><span>$(E $d.domaine)</span></p>
            <h2 class="nl-hub__nom">$(E $d.nom)</h2>
            <p class="nl-hub__desc">$(E $d.resume)</p>
            <ul class="nl-hub__services">
$services
            </ul>
            <a class="nl-hub__entrer" href="departements/$($d.slug)/">Entrer dans le département →</a>
          </div>
"@
  }

  $chiffres = Joindre ($A.chiffres | ForEach-Object {
    $compteur = if ($_.compteur) { " data-compteur=""$($_.valeur)""" } else { '' }
    "<div class=""nl-chiffre""><span class=""nl-chiffre__valeur""$compteur>$(E $_.valeur)</span><span class=""nl-chiffre__libelle"">$(E $_.libelle)</span></div>"
  })
  $n = 0
  $etapes = Joindre ($A.etapes | ForEach-Object {
    $n++
    "<div class=""nl-carte nl-carte--degrade nl-etape-carte""><span class=""nl-etape-carte__num"" aria-hidden=""true"">$n</span><h3><span class=""nl-sr"">Étape $n : </span>$(E $_.titre)</h3><p>$(E $_.texte)</p></div>"
  })
  $realisations = Joindre ($A.realisations | ForEach-Object {
    $d = $PAR_CODE[$_.departement]
    $image = if ($_.image) { [pscustomobject]@{ fichier = $_.image; alt = (Ou $_.alt $_.titre); ajustement = 'cover'; fond = '' } } else { $null }
    "<a class=""nl-carte nl-realisation"" href=""realisations/"" style=""$(StyleDept $d)"">$(Visuel $image "Photo à venir · $($d.court)" '16-10')<div class=""nl-realisation__corps""><span class=""nl-etiquette""><span class=""nl-puce"" aria-hidden=""true""></span>$(E $d.nom)</span><span class=""nl-realisation__titre"">$(E $_.titre)</span><span class=""nl-realisation__meta"">$(E $_.meta)</span></div></a>"
  })
  $temoignages = Joindre ($A.temoignages | ForEach-Object {
    $d = $PAR_CODE[$_.departement]
    "<figure class=""nl-carte nl-temoignage"" style=""$(StyleDept $d)""><span class=""nl-temoignage__guillemet"" aria-hidden=""true"">&ldquo;</span><blockquote>« $(E $_.texte) »</blockquote><span class=""nl-temoignage__guillemet nl-temoignage__guillemet--fin"" aria-hidden=""true"">&rdquo;</span><figcaption><span class=""nl-avatar nl-vide"" aria-hidden=""true""></span><span class=""nl-temoignage__auteur""><span class=""nl-temoignage__nom"">$(E $_.auteur)</span><span class=""nl-temoignage__client"">Client $(E $d.nom)</span></span></figcaption></figure>"
  })

  $jsonld = [ordered]@{
    '@context' = 'https://schema.org'
    '@type' = 'Organization'
    name = $G.raisonSociale
    slogan = $G.signature
    email = $G.email
    address = [ordered]@{ '@type' = 'PostalAddress'; addressLocality = 'Kinshasa'; addressCountry = 'CD' }
    subOrganization = @($DEPTS | ForEach-Object { [ordered]@{ '@type' = 'Organization'; name = $_.nom; email = $_.email } })
  } | ConvertTo-Json -Depth 5 -Compress

  $contenu = @"
<section class="nl-scene" aria-labelledby="titre-accueil">
  <div class="nl-halo" aria-hidden="true"></div>
  <div class="nl-trame" aria-hidden="true"></div>
  <div class="nl-conteneur nl-hero__in">
    <p class="nl-pastille nl-pastille--groupe"><span class="nl-pastille__badge">Groupe</span>$(E $A.pastille)</p>
    <h1 id="titre-accueil" class="nl-h1-accueil">$(E $A.titre) <span class="nl-or">$(E $A.titreOr)</span></h1>
    <p class="nl-corps-l">$(E $A.intro)</p>
    <div class="nl-actions">
      $(BoutonFleche 'or-glass' '#hub' 'Explorer les départements')
      $(BoutonFleche 'glass' 'contact/#formulaire' 'Demander un devis')
    </div>
  </div>

  <div id="hub" class="nl-conteneur nl-hub">
    <div class="nl-fenetre">
      <div class="nl-fenetre__barre nl-fenetre__barre--44"><span class="nl-fenetre__point" aria-hidden="true"></span><span class="nl-fenetre__point" aria-hidden="true"></span><span class="nl-fenetre__point" aria-hidden="true"></span><span class="nl-fenetre__titre">Cliquez sur un département</span>
      $(BoutonPause 'Mettre en pause la rotation des départements' 'data-pause-orbite' ' nl-pause--barre' -Cache)
      </div>
      <div class="nl-hub__corps" data-hub>
        <div class="nl-hub__schema">
          <div class="nl-hub__zone" data-orbite>
            <svg class="nl-hub__lignes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
<ellipse class="nl-hub__anneau" data-anneau cx="50" cy="50" rx="33" ry="38" vector-effect="non-scaling-stroke"/>
$(Joindre $lignes)
            </svg>
            <div class="nl-hub__centre"><img src="assets/img/logo-nolout.webp" alt="" width="60" height="60"><span>NOLOUT</span></div>
$(Joindre $noeuds)
          </div>
        </div>
        <div class="nl-hub__panneau" id="hub-fiches" aria-live="polite">
          $(Joindre $fiches)
        </div>
      </div>
    </div>
  </div>
</section>

$(BandeauClients $A.partenairesTitre $A.partenaires)

$(ZonePub $A.pub)

<section class="nl-conteneur nl-chiffres" aria-label="Chiffres clés">
  <div class="nl-grille nl-grille--220">
$chiffres
  </div>
</section>

<section class="nl-conteneur nl-section" aria-labelledby="titre-methode">
  <div class="nl-section__tete">
    <p class="nl-surtitre">$(E $A.methodeSurtitre)</p>
    <h2 id="titre-methode" class="nl-h2">$(E $A.methodeTitre)</h2>
  </div>
  <div class="nl-grille nl-grille--300">
$etapes
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
$realisations
  </div>
</section>

<section class="nl-conteneur nl-section" aria-label="Témoignages">
  <div class="nl-grille nl-grille--340 nl-temoignages">
$temoignages
  </div>
</section>

$(BlocCta)
"@

  return Page -Titre $A.titrePage -Description $A.description -Actif 'accueil' -Contenu $contenu -Pied (PiedComplet) -Tete "<script type=""application/ld+json"">$jsonld</script>"
}

# ── Passerelle « Nos départements » ───────────────────────────────────────

function PagePasserelle {
  $script:R = '../'
  $cartes = Joindre ($DEPTS | ForEach-Object {
    "<a class=""nl-carte-dept"" href=""$($_.slug)/"" style=""$(StyleDept $_)""><span class=""nl-icone-dept nl-icone-dept--40"">$(Svg $_.icone 20)</span><span class=""nl-carte-dept__domaine"">$(E $_.domaine)</span><span class=""nl-carte-dept__nom"">$(E $_.nom)</span><span class=""nl-carte-dept__desc"">$(E $_.resume)</span><span class=""nl-carte-dept__entrer"" aria-hidden=""true"">Entrer →</span></a>"
  })
  $contenu = @"
<div class="nl-scene">
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
$cartes
    </div>
  </section>
</div>

$(BlocCta)
"@
  return Page -Titre 'Nos départements — NOLOUT SARLU' -Description 'Les six départements de NOLOUT SARLU : conseil, construction, commerce, communication, gaming et transport.' -Actif 'departements' -Contenu $contenu -Pied (PiedComplet)
}

# ── Département (gabarit unique) ──────────────────────────────────────────

function PageDepartement($d) {
  $script:R = '../../'
  $R = $script:R
  $selecteur = Joindre ($DEPTS | ForEach-Object {
    $courant = if ($_.code -eq $d.code) { ' aria-current="page"' } else { '' }
    "<a href=""../$($_.slug)/"" style=""$(StyleDept $_)""$courant><span class=""nl-puce"" aria-hidden=""true""></span>$(E $_.court)</a>"
  })
  $services = Joindre ($d.services | ForEach-Object {
    "<div class=""nl-carte nl-carte--degrade nl-carte--survol nl-service""><span class=""nl-service__icone"">$(Svg $_.icone 22 '1.5')</span><h3>$(E $_.titre)</h3><p>$(E $_.texte)</p></div>"
  })
  # Trois références ; les photos de references.photos remplissent les premières, les autres restent « photo à venir »
  $photos = @($d.references.photos | Where-Object { $_ -and $_.fichier })
  $refs = Joindre (1..3 | ForEach-Object {
    $photo = if ($_ -le $photos.Count) { $photos[$_ - 1] } else { $null }
    $image = if ($photo) { [pscustomobject]@{ fichier = $photo.fichier; alt = $photo.alt; ajustement = 'cover'; fond = '' } } else { $null }
    "<a class=""nl-carte nl-realisation nl-realisation--ref"" href=""${R}realisations/"">$(Visuel $image "Photo à venir · $($d.references.etiquette) $_" '16-10')<div class=""nl-realisation__corps""><span class=""nl-realisation__meta"">$(E $d.references.meta)</span><span class=""nl-realisation__titre"">$(E $d.references.titre)</span></div></a>"
  })
  $formulaire = "${R}contact/?departement=$($d.code)#formulaire"
  $telDept = Ou $d.telephone $G.telephone
  $canaux = Joindre @(
    (Canal 'wa' 'WhatsApp' (Ou $d.whatsapp "+243 [numéro $($d.court)]") (Ou (LienWhatsApp $d.whatsapp "Bonjour $($d.nom), ") $formulaire) -Externe:([bool]$d.whatsapp)),
    (Canal 'phone' 'Téléphone' (Ou $telDept '+243 [numéro]') (Ou (LienTel $telDept) $formulaire)),
    (Canal 'mail' 'E-mail' $d.email "mailto:$($d.email)")
  )
  $autres = BandeauDepts 'Les autres départements NOLOUT' ($DEPTS | Where-Object { $_.code -ne $d.code })

  $contenu = @"
<section class="nl-scene" aria-labelledby="titre-dept">
  <div class="nl-halo nl-halo--dept" aria-hidden="true"></div>
  <div class="nl-trame nl-trame--dept" aria-hidden="true"></div>
  <div class="nl-conteneur nl-page-hero__in">
    <div class="nl-page-hero__haut">
      <nav class="nl-ariane" aria-label="Fil d’Ariane"><a href="${R}">NOLOUT</a><span aria-hidden="true">›</span><a href="../">Départements</a><span aria-hidden="true">›</span><span aria-current="page">$(E $d.court)</span></nav>
      <nav class="nl-selecteur" aria-label="Changer de département">
$selecteur
      </nav>
    </div>
    <div class="nl-page-hero__cols">
      <div class="nl-page-hero__texte">
        <p class="nl-pastille nl-pastille--dept"><span class="nl-pastille__icone">$(Svg $d.icone 13 '2')</span>$(E $d.domaine)</p>
        <h1 id="titre-dept" class="nl-h1 nl-h1--capitales">$(E $d.nom)</h1>
        <p class="nl-corps-l nl-corps-l--hero">$(E $d.pitch)</p>
        <div class="nl-actions">
          <a class="nl-btn nl-btn--or" href="$formulaire">$(E $d.cta)</a>
          <a class="nl-btn nl-btn--verre" href="#references">Nos références</a>
        </div>
      </div>
      <div class="nl-page-hero__visuel">
        <div class="nl-fenetre">
          <div class="nl-fenetre__barre" aria-hidden="true"><span class="nl-fenetre__point"></span><span class="nl-fenetre__point"></span><span class="nl-fenetre__point"></span><span class="nl-fenetre__trait"></span></div>
          $(Visuel $d.image "Photo réelle du département $($d.nom) à venir" -Prioritaire)
        </div>
      </div>
    </div>
  </div>
</section>

<section class="nl-conteneur nl-section" aria-labelledby="titre-services">
  <div class="nl-section__tete">
    <p class="nl-surtitre nl-surtitre--dept">Nos services</p>
    <h2 id="titre-services" class="nl-h2">$(E $d.servicesTitre)</h2>
    <p class="nl-intro">$(E $d.servicesIntro)</p>
  </div>
  <div class="nl-grille nl-grille--400">
$services
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
$refs
  </div>
</section>

<section class="nl-conteneur nl-section" aria-labelledby="titre-dedie">
  <div class="nl-dedie">
    <div class="nl-dedie__texte">
      <p class="nl-surtitre nl-surtitre--dept">Contact dédié</p>
      <h2 id="titre-dedie">$(E "Parlez directement à l’équipe $($d.court)")</h2>
      <div class="nl-personne">
        <span class="nl-avatar nl-avatar--64 nl-vide" aria-hidden="true"></span>
        <span class="nl-personne__textes"><span class="nl-personne__nom">[Prénom Nom]</span><span class="nl-personne__role">$(E $d.role)</span></span>
      </div>
    </div>
    <div class="nl-dedie__canaux">
$canaux
    </div>
  </div>
</section>

$autres
"@
  return Page -Titre "$($d.nom) — $($d.domaine) | NOLOUT" -Description $d.pitch -Actif 'departements' -Contenu $contenu -Pied (PiedCompact "$($d.nom) est un département de $($G.raisonSociale)") -StyleMain (StyleDept $d) -Dept $d
}

# ── Contact (formulaire intelligent) ──────────────────────────────────────

function PageContact {
  $script:R = '../'
  $R = $script:R
  $choix = @($DEPTS | ForEach-Object {
@"
          <label class="nl-choix" style="$(StyleDept $_)">
            <input type="radio" name="departement" value="$($_.code)" data-nom="$(E $_.nom)" data-email="$($_.email)" data-rgb="$($_.rgb)" data-exemple="$(E $_.exempleMessage)">
            <span class="nl-icone-dept nl-icone-dept--30">$(Svg $_.icone 16)</span>
            <span class="nl-choix__nom">$(E $_.nom)</span>
            <span class="nl-choix__rond" aria-hidden="true"></span>
          </label>
"@
  })
  $choix += @"
          <label class="nl-choix" style="--c:#C8CCD1;--c-rgb:233,168,37">
            <input type="radio" name="departement" value="?" data-nom="NOLOUT" data-email="$($G.email)" data-rgb="233,168,37" data-exemple="$(E 'Expliquez votre besoin, nous le transmettrons au bon département.')">
            <span class="nl-icone-dept nl-icone-dept--30">$(Svg 'q' 16)</span>
            <span class="nl-choix__nom">Je ne sais pas encore</span>
            <span class="nl-choix__rond" aria-hidden="true"></span>
          </label>
"@
  $wa = LienWhatsApp $G.whatsapp 'Bonjour NOLOUT, '
  $waHero = Ou $wa '#formulaire'
  $canaux = Joindre @(
    (Canal 'wa' 'WhatsApp — réponse rapide' $WA_AFFICHE (Ou $wa '#formulaire') -Externe:([bool]$wa)),
    (Canal 'phone' 'Téléphone' $TEL_AFFICHE (Ou (LienTel $G.telephone) '#formulaire')),
    (Canal 'mail' 'E-mail' $G.email "mailto:$($G.email)")
  )
  $horaires = Joindre ($G.horaires | ForEach-Object { "<dt>$(E $_.jours)</dt><dd>$(E $_.heures)</dd>" })
  $itineraire = Ou $G.itineraire ('https://www.google.com/maps/search/?api=1&query=' + [uri]::EscapeDataString($G.adresse))

  $contenu = @"
<div class="nl-scene">
  <div class="nl-halo nl-halo--contact" data-halo aria-hidden="true"></div>
  <div class="nl-trame nl-trame--haut" aria-hidden="true"></div>

  <section class="nl-conteneur nl-page-hero__in nl-page-hero__in--contact" aria-labelledby="titre-contact">
    <nav class="nl-ariane" aria-label="Fil d’Ariane"><a href="../">NOLOUT</a><span aria-hidden="true">›</span><span aria-current="page">Contact</span></nav>
    <div class="nl-page-hero__cols">
      <div class="nl-page-hero__texte">
        <p class="nl-pastille">Réponse sous 48 h ouvrées</p>
        <h1 id="titre-contact" class="nl-h1">Parlons de votre projet</h1>
        <p class="nl-corps-l nl-corps-l--hero">$(E 'Choisissez le département concerné : votre message arrive directement à la bonne équipe.')</p>
        <div class="nl-actions">
          <a class="nl-btn nl-btn--or" href="#formulaire">Remplir le formulaire</a>
          <a class="nl-btn nl-btn--verre" href="$(E $waHero)">Écrire sur WhatsApp</a>
        </div>
      </div>
      <div class="nl-page-hero__visuel">
        <div class="nl-fenetre">
          <div class="nl-fenetre__barre" aria-hidden="true"><span class="nl-fenetre__point"></span><span class="nl-fenetre__point"></span><span class="nl-fenetre__point"></span><span class="nl-fenetre__trait"></span></div>
          $(Visuel $null 'Photo réelle à venir : accueil du siège ou équipe NOLOUT')
        </div>
      </div>
    </div>
  </section>

  <section id="formulaire" class="nl-conteneur nl-section nl-contact" aria-label="Formulaire de contact">
    <form class="nl-form" id="nl-formulaire" novalidate data-endpoint="$(E $G.formulaireEndpoint)">
      <div class="nl-alerte nl-alerte--ok" role="status" data-succes hidden></div>
      <div class="nl-alerte nl-alerte--erreur" role="alert" data-resume hidden></div>
      <p class="nl-sr" aria-hidden="true"><label for="c-site">Ne pas remplir ce champ</label><input id="c-site" name="site_web" type="text" tabindex="-1" autocomplete="off"></p>

      <fieldset class="nl-etape">
        <legend class="nl-etape__titre"><span class="nl-etape__num" aria-hidden="true">1</span><span>$(E 'Quel département est concerné ?')</span></legend>
        <div class="nl-choix-depts">
$(Joindre $choix)
        </div>
        <p class="nl-erreur" data-erreur-departement hidden>$(E '⚠ Choisissez un département, ou « Je ne sais pas encore ».')</p>
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
$canaux
      </div>
      <div class="nl-carte nl-siege">
        $(Visuel $null 'Carte du siège à venir' '16-10')
        <div class="nl-siege__corps">
          <h2 class="nl-siege__nom">Siège NOLOUT</h2>
          <address class="nl-siege__adresse">$(E $G.adresse)</address>
          <dl class="nl-horaires">$horaires</dl>
          <a class="nl-lien-or nl-lien-or--petit" href="$(E $itineraire)" target="_blank" rel="noopener">$(E "Ouvrir l’itinéraire →")</a>
        </div>
      </div>
    </aside>
  </section>

$(BandeauDepts 'Découvrir nos départements' $DEPTS)
</div>
"@
  return Page -Titre 'Contact — NOLOUT SARLU' -Description 'Écrivez à NOLOUT SARLU : choisissez le département concerné, votre demande arrive directement à la bonne équipe. Réponse sous 48 h ouvrées.' -Actif 'contact' -Contenu $contenu -Pied (PiedCompact "© $($G.annee) $($G.raisonSociale)")
}

# ── Pages en préparation (groupe, réalisations, carrières…) ───────────────

function PagePreparation($p) {
  $script:R = '../'
  $contenu = @"
<div class="nl-scene">
  <div class="nl-halo" aria-hidden="true"></div>
  <div class="nl-trame nl-trame--dept" aria-hidden="true"></div>
  <section class="nl-conteneur nl-page-hero__in" aria-labelledby="titre-page">
    <nav class="nl-ariane" aria-label="Fil d’Ariane"><a href="../">NOLOUT</a><span aria-hidden="true">›</span><span aria-current="page">$(E $p.titre)</span></nav>
    <div class="nl-page-hero__texte nl-preparation__texte">
      <p class="nl-pastille">Page en préparation</p>
      <h1 id="titre-page" class="nl-h1">$(E $p.titre)</h1>
      <p class="nl-corps-l nl-corps-l--hero">$(E $p.texte) Cette page est en cours de préparation.</p>
      <div class="nl-actions">
        <a class="nl-btn nl-btn--or" href="../contact/">Nous contacter</a>
        <a class="nl-btn nl-btn--verre" href="../departements/">Découvrir les départements</a>
      </div>
    </div>
  </section>
</div>

$(BandeauDepts 'Découvrir nos départements' $DEPTS)
"@
  return Page -Titre "$($p.titre) — NOLOUT SARLU" -Description $p.texte -Actif $p.page -Contenu $contenu -Pied (PiedComplet)
}

# ── Génération ────────────────────────────────────────────────────────────

Write-Host "Génération du site NOLOUT dans $Site"
Ecrire 'index.html' (PageAccueil)
Ecrire 'departements/index.html' (PagePasserelle)
foreach ($d in $DEPTS) { Ecrire "departements/$($d.slug)/index.html" (PageDepartement $d) }
Ecrire 'contact/index.html' (PageContact)
foreach ($p in $C.pagesEnPreparation) { Ecrire "$($p.page)/index.html" (PagePreparation $p) }
Write-Host "Terminé : $($script:Pages) pages générées."

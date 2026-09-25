# ==========================================================================
#  NOLOUT SARLU - préparation d'une vidéo publicitaire pour le site
#  Version web : MP4 H.264 1280 x 720, 25 i/s, ~2,5 Mbit/s, son AAC 128 kbit/s,
#  index placé en tête du fichier pour que la lecture démarre tout de suite,
#  et image d'affiche JPG. Écrit dans site/assets/video/ ; l'original n'est pas modifié.
#  Outils de Windows (Media Foundation) : ni ffmpeg ni logiciel à installer.
#  Lancement : glisser la vidéo sur sources/preparer-video.cmd
# ==========================================================================
param(
  [string]$Racine,
  [Parameter(Mandatory = $true)] [string]$Source,
  [string]$Nom,                # nom des fichiers produits ; par défaut celui de la vidéo, simplifié
  [double]$Affiche = 2,        # instant de l'image d'affiche, en secondes
  [int]$Debit = 2500000        # débit vidéo, en bit/s
)

$ErrorActionPreference = 'Stop'
if (-not $Racine) { $Racine = Split-Path -Parent $PSScriptRoot }
$Source = (Resolve-Path -LiteralPath $Source).Path
$dossierVideo = Join-Path $Racine 'site\assets\video'
New-Item -ItemType Directory -Force $dossierVideo | Out-Null

# Nom de fichier web : minuscules, sans accents ni espaces (« Kev Appel en ACTION » → kev-appel-en-action)
if (-not $Nom) { $Nom = [IO.Path]::GetFileNameWithoutExtension($Source) }
$Nom = $Nom.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
$Nom = ($Nom.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
$mp4 = Join-Path $dossierVideo "$Nom.mp4"
$jpg = Join-Path $dossierVideo "$Nom.jpg"
$provisoire = Join-Path ([IO.Path]::GetTempPath()) "nolout-$Nom-$PID.mp4"

# ── WinRT depuis PowerShell 5.1 ───────────────────────────────────────────
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Editing.MediaComposition, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Media.Editing.MediaClip, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Media.Transcoding.MediaTranscoder, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Media.Transcoding.PrepareTranscodeResult, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.ImageStream, Windows.Graphics, ContentType = WindowsRuntime]

$methodes = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = $methodes | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$asTaskProg = $methodes | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' } | Select-Object -First 1
function Attendre($operation, [Type]$type) {
  $tache = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($operation))
  $tache.Wait() | Out-Null
  return $tache.Result
}
function Fichier([string]$chemin) { Attendre ([Windows.Storage.StorageFile]::GetFileFromPathAsync($chemin)) ([Windows.Storage.StorageFile]) }

# ── Index en tête (comme ffmpeg -movflags +faststart) ────────────────────
# La boîte moov passe avant mdat ; les positions des morceaux (stco/co64) sont décalées d'autant.
if (-not ('NoloutFastStart' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

public static class NoloutFastStart {
  static long U32(byte[] d, long p) { return ((long)d[p] << 24) | ((long)d[p + 1] << 16) | ((long)d[p + 2] << 8) | d[p + 3]; }
  static void W32(byte[] d, long p, long v) { d[p] = (byte)(v >> 24); d[p + 1] = (byte)(v >> 16); d[p + 2] = (byte)(v >> 8); d[p + 3] = (byte)v; }
  static long U64(byte[] d, long p) { return (U32(d, p) << 32) | U32(d, p + 4); }
  static void W64(byte[] d, long p, long v) { W32(d, p, (v >> 32) & 0xFFFFFFFF); W32(d, p + 4, v & 0xFFFFFFFF); }
  struct Boite { public string Type; public long Debut, Taille, Entete; }

  static List<Boite> Lire(byte[] d, long debut, long fin) {
    var liste = new List<Boite>();
    for (long p = debut; p + 8 <= fin; ) {
      long taille = U32(d, p), entete = 8;
      string type = Encoding.ASCII.GetString(d, (int)p + 4, 4);
      if (taille == 1) { taille = U64(d, p + 8); entete = 16; }
      else if (taille == 0) taille = fin - p;
      if (taille < entete || p + taille > fin) throw new InvalidDataException("Boîte " + type + " invalide à " + p);
      liste.Add(new Boite { Type = type, Debut = p, Taille = taille, Entete = entete });
      p += taille;
    }
    return liste;
  }

  static int Decaler(byte[] d, long debut, long fin, long decalage) {
    int n = 0;
    foreach (var b in Lire(d, debut, fin)) {
      long corps = b.Debut + b.Entete, bout = b.Debut + b.Taille;
      if (b.Type == "moov" || b.Type == "trak" || b.Type == "mdia" || b.Type == "minf" || b.Type == "stbl") n += Decaler(d, corps, bout, decalage);
      else if (b.Type == "stco") {
        for (long i = 0, nb = U32(d, corps + 4); i < nb; i++) {
          long p = corps + 8 + i * 4, v = U32(d, p) + decalage;
          if (v > 0xFFFFFFFFL) throw new InvalidDataException("Fichier trop grand pour stco");
          W32(d, p, v);
        }
        n++;
      } else if (b.Type == "co64") {
        for (long i = 0, nb = U32(d, corps + 4); i < nb; i++) { long p = corps + 8 + i * 8; W64(d, p, U64(d, p) + decalage); }
        n++;
      }
    }
    return n;
  }

  public static string Traiter(string source, string sortie) {
    byte[] d = File.ReadAllBytes(source);
    var boites = Lire(d, 0, d.Length);
    int iMoov = boites.FindIndex(b => b.Type == "moov"), iMdat = boites.FindIndex(b => b.Type == "mdat");
    if (iMoov < 0 || iMdat < 0) throw new InvalidDataException("moov ou mdat introuvable");
    if (iMoov < iMdat) { File.Copy(source, sortie, true); return "index déjà en tête"; }
    var moov = boites[iMoov];
    byte[] m = new byte[moov.Taille];
    Array.Copy(d, moov.Debut, m, 0, moov.Taille);
    int tables = Decaler(m, 0, m.Length, moov.Taille);
    using (var f = new FileStream(sortie, FileMode.Create, FileAccess.Write)) {
      for (int i = 0; i < iMdat; i++) f.Write(d, (int)boites[i].Debut, (int)boites[i].Taille);
      f.Write(m, 0, m.Length);
      for (int i = iMdat; i < boites.Count; i++) if (i != iMoov) f.Write(d, (int)boites[i].Debut, (int)boites[i].Taille);
    }
    return "index placé en tête, " + tables + " table(s) corrigée(s)";
  }
}
'@
}

Write-Host "Vidéo : $Source"
try {
  # 1. Conversion (accélération matérielle si disponible, mise à l'échelle haute qualité)
  $dossierTemp = Attendre ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync((Split-Path -Parent $provisoire))) ([Windows.Storage.StorageFolder])
  $dest = Attendre ($dossierTemp.CreateFileAsync((Split-Path -Leaf $provisoire), [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
  $profil = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateMp4([Windows.Media.MediaProperties.VideoEncodingQuality]::HD720p)
  $profil.Video.Width = 1280
  $profil.Video.Height = 720
  $profil.Video.Bitrate = $Debit
  $profil.Video.FrameRate.Numerator = 25
  $profil.Video.FrameRate.Denominator = 1
  $profil.Video.PixelAspectRatio.Numerator = 1
  $profil.Video.PixelAspectRatio.Denominator = 1
  $profil.Audio.Bitrate = 128000
  $profil.Audio.SampleRate = 48000
  $profil.Audio.ChannelCount = 2
  $tc = New-Object Windows.Media.Transcoding.MediaTranscoder
  $tc.HardwareAccelerationEnabled = $true
  $tc.VideoProcessingAlgorithm = [Windows.Media.Transcoding.MediaVideoProcessingAlgorithm]::MrfCrf444
  $prep = Attendre ($tc.PrepareFileTranscodeAsync((Fichier $Source), $dest, $profil)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
  if (-not $prep.CanTranscode) { throw "Conversion impossible : $($prep.FailureReason)" }
  Write-Host 'Conversion en cours (une à deux minutes)...'
  $tache = $asTaskProg.MakeGenericMethod([double]).Invoke($null, @($prep.TranscodeAsync()))
  $tache.Wait() | Out-Null

  # 2. Index en tête
  Write-Host ([NoloutFastStart]::Traiter($provisoire, $mp4))
} finally {
  Remove-Item -LiteralPath $provisoire -ErrorAction SilentlyContinue
}

# 3. Image d'affiche : l'image de la vidéo à l'instant choisi, en JPEG qualité 82
$clip = Attendre ([Windows.Media.Editing.MediaClip]::CreateFromFileAsync((Fichier $mp4))) ([Windows.Media.Editing.MediaClip])
$compo = New-Object Windows.Media.Editing.MediaComposition
# PowerShell 5.1 ne voit pas Add sur une collection WinRT : appel par l'interface .NET
[System.Collections.Generic.ICollection[Windows.Media.Editing.MediaClip]].GetMethod('Add').Invoke($compo.Clips, [object[]]@($clip)) | Out-Null
$instant = [TimeSpan]::FromSeconds([math]::Min($Affiche, [math]::Max(0, $clip.OriginalDuration.TotalSeconds - 0.5)))
$flux = Attendre ($compo.GetThumbnailAsync($instant, 1280, 720, [Windows.Media.Editing.VideoFramePrecision]::NearestFrame)) ([Windows.Graphics.Imaging.ImageStream])
$lecture = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($flux)
$image = [Drawing.Image]::FromStream($lecture)
try {
  $codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $parametres = New-Object Drawing.Imaging.EncoderParameters 1
  $parametres.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 82L
  $image.Save($jpg, $codec, $parametres)
} finally { $image.Dispose(); $lecture.Close() }

Write-Host ''
Write-Host ("Prêt : {0} ({1:N1} Mo) et {2} ({3:N0} Ko)" -f "$Nom.mp4", ((Get-Item -LiteralPath $mp4).Length / 1MB), "$Nom.jpg", ((Get-Item -LiteralPath $jpg).Length / 1KB))
Write-Host 'Dans sources/contenu.json, rubrique accueil.pub.videos, indiquez :'
Write-Host ('  { "fichier": "' + $Nom + '.mp4", "affiche": "' + $Nom + '.jpg" }')
Write-Host 'puis régénérez les pages (generer.cmd).'

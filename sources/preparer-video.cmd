@echo off
rem Prepare une video publicitaire pour le site : glissez la video sur ce fichier.
rem Resultat dans site\assets\video\ (MP4 720p et image d'affiche). L'original n'est pas modifie.
cd /d "%~dp0.."
if "%~1"=="" (
  echo Glissez une video sur ce fichier pour la preparer pour le site.
  pause
  exit /b
)
set "VIDEO=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$sb = [scriptblock]::Create([IO.File]::ReadAllText('sources\preparer-video.ps1', [Text.Encoding]::UTF8)); & $sb -Racine (Get-Location).Path -Source $env:VIDEO"
echo.
pause

@echo off
rem Fabrique les pages du site dans site\ a partir de sources\contenu.json (apercu sur ce poste).
rem En ligne, Vercel fabrique les memes pages a la demande, avec le contenu de la base Neon.
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" scripts\generer.mjs
echo.
pause

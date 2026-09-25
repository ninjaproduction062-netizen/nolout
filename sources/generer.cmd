@echo off
rem Regenere les pages HTML du site NOLOUT (dossier site\) a partir de sources\contenu.json.
rem Le script est lu en UTF-8 pour conserver les accents, quelle que soit la version de PowerShell.
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -Command "$sb = [scriptblock]::Create([IO.File]::ReadAllText('sources\generer.ps1', [Text.Encoding]::UTF8)); & $sb -Racine (Get-Location).Path"
echo.
pause

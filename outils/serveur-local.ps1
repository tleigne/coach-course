# Petit serveur web local pour tester l'appli (Python/Node ne sont pas nécessaires).
# Usage : powershell -ExecutionPolicy Bypass -File outils/serveur-local.ps1 [-Port 8080]
param([int]$Port = 8080)

$racine = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$prefixe = "http://localhost:$Port/"
$listener.Prefixes.Add($prefixe)
$listener.Start()
Write-Host "Serveur local demarre sur $prefixe (racine : $racine)"
Write-Host "Ctrl+C pour arreter."

$typesMime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.svg'  = 'image/svg+xml'
    '.gpx'  = 'application/gpx+xml'
    '.ico'  = 'image/x-icon'
}

try {
    while ($listener.IsListening) {
        $contexte = $listener.GetContext()
        try {
            $requete = $contexte.Request
            $reponse = $contexte.Response

            $chemin = $requete.Url.AbsolutePath
            if ($chemin -eq '/') { $chemin = '/index.html' }
            $cheminFichier = Join-Path $racine ($chemin.TrimStart('/'))

            if (Test-Path $cheminFichier -PathType Leaf) {
                $extension = [System.IO.Path]::GetExtension($cheminFichier)
                $typeContenu = $typesMime[$extension]
                if (-not $typeContenu) { $typeContenu = 'application/octet-stream' }
                $octets = [System.IO.File]::ReadAllBytes($cheminFichier)
                $reponse.ContentType = $typeContenu
                $reponse.ContentLength64 = $octets.Length
                $reponse.OutputStream.Write($octets, 0, $octets.Length)
            } else {
                $reponse.StatusCode = 404
                $texteErreur = [System.Text.Encoding]::UTF8.GetBytes('404 - fichier non trouve')
                $reponse.OutputStream.Write($texteErreur, 0, $texteErreur.Length)
            }
        } catch {
            # Une requête individuelle en erreur (connexion coupée, etc.) ne doit pas arrêter le serveur.
            Write-Host "Requete en erreur : $($_.Exception.Message)"
        } finally {
            $contexte.Response.OutputStream.Close()
        }
    }
} finally {
    $listener.Stop()
}

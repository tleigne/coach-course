# Génère un fichier GPX d'exemple (~5 km, avec une côte) pour tester l'import.

$pointDepartLat = 48.8566
$pointDepartLon = 2.3522
$nbPoints = 120
$rayonBoucleKm = 0.8

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$sb.AppendLine('<gpx version="1.1" creator="CoachCourse" xmlns="http://www.topografix.com/GPX/1/1">')
[void]$sb.AppendLine('  <trk>')
[void]$sb.AppendLine('    <name>Boucle exemple - 5 km avec cote</name>')
[void]$sb.AppendLine('    <trkseg>')

for ($i = 0; $i -le $nbPoints; $i++) {
    $t = $i / $nbPoints # 0 -> 1 sur toute la boucle
    $angle = $t * 2 * [Math]::PI

    # Trajectoire en forme de boucle légèrement irrégulière
    $lat = $pointDepartLat + ($rayonBoucleKm / 111.0) * [Math]::Sin($angle)
    $lon = $pointDepartLon + ($rayonBoucleKm / 111.0) * (1 - [Math]::Cos($angle)) * 1.3

    # Profil d'altitude : montée régulière de 0 à 2 km, redescente, puis côte raide vers 4 km
    $distanceApproxKm = $t * 5.0
    if ($distanceApproxKm -lt 2.0) {
        $ele = 60 + ($distanceApproxKm / 2.0) * 35
    } elseif ($distanceApproxKm -lt 3.2) {
        $ele = 95 - (($distanceApproxKm - 2.0) / 1.2) * 30
    } elseif ($distanceApproxKm -lt 3.8) {
        $ele = 65 + (($distanceApproxKm - 3.2) / 0.6) * 45
    } else {
        $ele = 110 - (($distanceApproxKm - 3.8) / 1.2) * 50
    }

    $latTxt = $lat.ToString('F6', [System.Globalization.CultureInfo]::InvariantCulture)
    $lonTxt = $lon.ToString('F6', [System.Globalization.CultureInfo]::InvariantCulture)
    $eleTxt = $ele.ToString('F1', [System.Globalization.CultureInfo]::InvariantCulture)

    [void]$sb.AppendLine("      <trkpt lat=`"$latTxt`" lon=`"$lonTxt`"><ele>$eleTxt</ele></trkpt>")
}

[void]$sb.AppendLine('    </trkseg>')
[void]$sb.AppendLine('  </trk>')
[void]$sb.AppendLine('</gpx>')

$racine = Split-Path -Parent $PSScriptRoot
$dossier = Join-Path $racine 'exemples'
if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Path $dossier | Out-Null }
$chemin = Join-Path $dossier 'parcours-exemple.gpx'

[System.IO.File]::WriteAllText($chemin, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "GPX exemple genere : $chemin"

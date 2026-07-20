# Génère les icônes PNG de l'appli (192, 512, et une version "maskable" pour Android)
# via GDI+ (System.Drawing), sans dépendance externe. À exécuter une seule fois ;
# relance-le si tu veux changer le design des icônes.

Add-Type -AssemblyName System.Drawing

function New-IconeCoach {
    param(
        [int]$Taille,
        [string]$CheminSortie,
        [double]$MargeSecurite = 0.0 # marge à laisser vide pour les icônes "maskable" (0 à 0.5)
    )

    $bmp = New-Object System.Drawing.Bitmap($Taille, $Taille)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $fondCouleur = [System.Drawing.ColorTranslator]::FromHtml('#ff7a1a')
    $blanc = [System.Drawing.Color]::White
    $g.Clear($fondCouleur)

    $marge = [double]$Taille * $MargeSecurite
    $zone = [double]$Taille - (2.0 * $marge)
    $cx = [double]$Taille / 2.0
    $cy = [double]$Taille / 2.0

    $penEpaisseur = $zone * 0.085
    $pen = New-Object System.Drawing.Pen($blanc, $penEpaisseur)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $ox = $cx - $zone * 0.06
    $oy = $cy - $zone * 0.30

    $rTete = $zone * 0.09
    $brosseBlanche = New-Object System.Drawing.SolidBrush($blanc)
    $teteX = $ox + $zone * 0.03
    $teteY = $oy
    $g.FillEllipse($brosseBlanche, [float]($teteX - $rTete), [float]($teteY - $rTete), [float]($rTete*2), [float]($rTete*2))

    $coupX = $ox + $zone*0.05;      $coupY = $oy + $rTete*0.8
    $hancheX = $ox - $zone*0.06;    $hancheY = $oy + $zone*0.28
    $g.DrawLine($pen, [float]$coupX, [float]$coupY, [float]$hancheX, [float]$hancheY)

    $genouArriereX = $hancheX - $zone*0.16; $genouArriereY = $hancheY + $zone*0.10
    $piedArriereX  = $hancheX - $zone*0.02; $piedArriereY  = $hancheY + $zone*0.26
    $g.DrawLine($pen, [float]$hancheX, [float]$hancheY, [float]$genouArriereX, [float]$genouArriereY)
    $g.DrawLine($pen, [float]$genouArriereX, [float]$genouArriereY, [float]$piedArriereX, [float]$piedArriereY)

    $genouAvantX = $hancheX + $zone*0.20; $genouAvantY = $hancheY + $zone*0.14
    $piedAvantX  = $hancheX + $zone*0.30; $piedAvantY  = $hancheY + $zone*0.30
    $g.DrawLine($pen, [float]$hancheX, [float]$hancheY, [float]$genouAvantX, [float]$genouAvantY)
    $g.DrawLine($pen, [float]$genouAvantX, [float]$genouAvantY, [float]$piedAvantX, [float]$piedAvantY)

    $coudeAvantX = $coupX + $zone*0.15; $coudeAvantY = $coupY + $zone*0.06
    $mainAvantX  = $coupX + $zone*0.09; $mainAvantY  = $coupY + $zone*0.20
    $g.DrawLine($pen, [float]$coupX, [float]$coupY, [float]$coudeAvantX, [float]$coudeAvantY)
    $g.DrawLine($pen, [float]$coudeAvantX, [float]$coudeAvantY, [float]$mainAvantX, [float]$mainAvantY)

    $coudeArriereX = $coupX - $zone*0.16; $coudeArriereY = $coupY + $zone*0.04
    $mainArriereX  = $coupX - $zone*0.08; $mainArriereY  = $coupY - $zone*0.06
    $g.DrawLine($pen, [float]$coupX, [float]$coupY, [float]$coudeArriereX, [float]$coudeArriereY)
    $g.DrawLine($pen, [float]$coudeArriereX, [float]$coudeArriereY, [float]$mainArriereX, [float]$mainArriereY)

    # Ondes vocales (à droite, façon coaching audio)
    $penOnde = New-Object System.Drawing.Pen($blanc, ($zone * 0.035))
    $penOnde.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $penOnde.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $baseX = $cx + $zone * 0.22
    for ($i = 1; $i -le 3; $i++) {
        $rayon = $zone * (0.10 + $i * 0.09)
        $rectOnde = New-Object System.Drawing.RectangleF([float]($baseX - $rayon), [float]($cy - $rayon), [float]($rayon*2), [float]($rayon*2))
        $g.DrawArc($penOnde, $rectOnde, -55, 110)
    }

    $g.Dispose()
    $bmp.Save($CheminSortie, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$racine = Split-Path -Parent $PSScriptRoot
$dossierIcones = Join-Path $racine 'icons'
if (-not (Test-Path $dossierIcones)) {
    New-Item -ItemType Directory -Path $dossierIcones | Out-Null
}

New-IconeCoach -Taille 192 -CheminSortie (Join-Path $dossierIcones 'icon-192.png') -MargeSecurite 0.0
New-IconeCoach -Taille 512 -CheminSortie (Join-Path $dossierIcones 'icon-512.png') -MargeSecurite 0.0
New-IconeCoach -Taille 512 -CheminSortie (Join-Path $dossierIcones 'icon-maskable-512.png') -MargeSecurite 0.14

Write-Host "Icones generees dans $dossierIcones"

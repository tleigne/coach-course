// Export de la trace GPS enregistrée pendant une course, au format GPX
// (pour import manuel dans Strava ou une autre plateforme).

function echapperXML(texte) {
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Construit un fichier GPX (texte) à partir de la trace enregistrée pendant
 * une course : [{lat, lon, ele, t}] où `t` est un timestamp en ms. */
export function genererGPXDepuisTrace(trace, nomCourse) {
  const points = trace
    .map((p) => {
      const iso = new Date(p.t).toISOString();
      return `      <trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele.toFixed(1)}</ele><time>${iso}</time></trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CoachCourse" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${echapperXML(nomCourse)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}

/** Déclenche le téléchargement d'un fichier texte côté navigateur. */
export function telechargerFichier(nomFichier, contenu, typeMime = 'application/gpx+xml') {
  const blob = new Blob([contenu], { type: typeMime });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

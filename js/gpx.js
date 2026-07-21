// Parsing d'un fichier GPX : extraction des points, distance cumulée, dénivelé.
import { distanceHaversine } from './utils.js';

/**
 * Lisse une série d'altitudes avec une moyenne glissante pour réduire le bruit
 * GPS/baromètre avant de calculer le dénivelé.
 */
function lisserAltitudes(altitudes, fenetre = 5) {
  const demi = Math.floor(fenetre / 2);
  return altitudes.map((_, i) => {
    const debut = Math.max(0, i - demi);
    const fin = Math.min(altitudes.length, i + demi + 1);
    const tranche = altitudes.slice(debut, fin);
    return tranche.reduce((a, b) => a + b, 0) / tranche.length;
  });
}

/**
 * Parse le texte d'un fichier GPX et retourne la description du parcours.
 * Lève une erreur (avec message destiné à l'utilisateur) si le fichier est invalide.
 */
export function parserGPX(texteXML) {
  const dom = new DOMParser().parseFromString(texteXML, 'application/xml');

  if (dom.querySelector('parsererror')) {
    throw new Error("Ce fichier n'est pas un GPX valide.");
  }

  const trkpts = Array.from(dom.querySelectorAll('trkpt'));
  const source = trkpts.length > 0 ? trkpts : Array.from(dom.querySelectorAll('rtept'));

  if (source.length < 2) {
    throw new Error('Ce fichier GPX ne contient pas assez de points de parcours.');
  }

  const brut = source.map((pt) => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    const eleNode = pt.querySelector('ele');
    const ele = eleNode ? parseFloat(eleNode.textContent) : 0;
    return { lat, lon, ele: isNaN(ele) ? 0 : ele };
  });

  const altitudesLissees = lisserAltitudes(brut.map((p) => p.ele));

  let distanceCumulee = 0;
  let denivelePositif = 0;
  let deniveleNegatif = 0;
  const points = brut.map((p, i) => {
    if (i > 0) {
      distanceCumulee += distanceHaversine(brut[i - 1].lat, brut[i - 1].lon, p.lat, p.lon);
      const delta = altitudesLissees[i] - altitudesLissees[i - 1];
      if (delta > 0) denivelePositif += delta;
      else deniveleNegatif += -delta;
    }
    return {
      lat: p.lat,
      lon: p.lon,
      ele: altitudesLissees[i],
      distanceCumulee, // km depuis le départ
    };
  });

  const nomNode = dom.querySelector('trk > name') || dom.querySelector('metadata > name');
  const nom = nomNode && nomNode.textContent.trim() ? nomNode.textContent.trim() : 'Parcours importé';

  return {
    nom,
    points,
    distanceTotale: distanceCumulee, // km
    denivelePositif: Math.round(denivelePositif), // m
    deniveleNegatif: Math.round(deniveleNegatif), // m
  };
}

/**
 * Somme le dénivelé positif restant entre `distanceActuelleKm` et la fin du
 * parcours. Utilisé pour estimer si un objectif de temps reste tenable.
 */
export function denivelePositifRestant(parcours, distanceActuelleKm) {
  const { points } = parcours;
  let iDepart = points.findIndex((p) => p.distanceCumulee >= distanceActuelleKm);
  if (iDepart === -1) return 0;

  let denivele = 0;
  for (let i = iDepart; i < points.length - 1; i++) {
    const delta = points[i + 1].ele - points[i].ele;
    if (delta > 0) denivele += delta;
  }
  return Math.round(denivele);
}

/**
 * Cherche s'il y a une montée significative dans les `distanceLookaheadKm`
 * prochains kilomètres à partir de `distanceActuelleKm`. Retourne
 * { distanceAvantKm, deniveleM } ou null si rien de notable.
 */
export function chercherMonteeAVenir(parcours, distanceActuelleKm, distanceLookaheadKm = 1) {
  const { points } = parcours;
  const seuilPenteMinPourcent = 4; // pente moyenne à partir de laquelle on prévient
  const distanceMinSegmentKm = 0.15; // on ignore les micro-bosses

  let iDepart = points.findIndex((p) => p.distanceCumulee >= distanceActuelleKm);
  if (iDepart === -1) return null;

  let i = iDepart;
  while (i < points.length - 1 && points[i].distanceCumulee < distanceActuelleKm + distanceLookaheadKm) {
    // Cherche le début d'une montée soutenue à partir du point i
    let j = i;
    let deniveleSegment = 0;
    while (
      j < points.length - 1 &&
      points[j + 1].ele >= points[j].ele &&
      points[j].distanceCumulee - points[i].distanceCumulee < 0.6
    ) {
      deniveleSegment += points[j + 1].ele - points[j].ele;
      j++;
    }
    const distanceSegmentKm = points[j].distanceCumulee - points[i].distanceCumulee;
    if (distanceSegmentKm >= distanceMinSegmentKm) {
      const penteMoyennePourcent = (deniveleSegment / (distanceSegmentKm * 1000)) * 100;
      if (penteMoyennePourcent >= seuilPenteMinPourcent && deniveleSegment >= 8) {
        return {
          distanceAvantKm: points[i].distanceCumulee - distanceActuelleKm,
          deniveleM: Math.round(deniveleSegment),
        };
      }
    }
    i++;
  }
  return null;
}

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
 * Construit la description d'un parcours (distance cumulée, dénivelé) à
 * partir d'une liste brute de points {lat, lon, ele}. Partagé par les
 * parsers GPX et KML/KMZ pour éviter de dupliquer ce calcul. `pointsInteret`
 * (waypoints nommés : ravitaillements, sommets...) est optionnel.
 */
export function construireParcours(nom, brut, pointsInteret = []) {
  if (brut.length < 2) {
    throw new Error('Ce fichier ne contient pas assez de points de parcours.');
  }

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

  return {
    nom: nom && nom.trim() ? nom.trim() : 'Parcours importé',
    points,
    distanceTotale: distanceCumulee, // km
    denivelePositif: Math.round(denivelePositif), // m
    deniveleNegatif: Math.round(deniveleNegatif), // m
    pointsInteret, // [{nom, lat, lon}] : ravitaillements, sommets, etc.
  };
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

  const nomNode = dom.querySelector('trk > name') || dom.querySelector('metadata > name');
  const nom = nomNode ? nomNode.textContent : '';

  const pointsInteret = Array.from(dom.querySelectorAll('wpt'))
    .map((pt) => {
      const lat = parseFloat(pt.getAttribute('lat'));
      const lon = parseFloat(pt.getAttribute('lon'));
      const nomPointNode = pt.querySelector('name');
      return { nom: nomPointNode ? nomPointNode.textContent.trim() : 'Point', lat, lon };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));

  return construireParcours(nom, brut, pointsInteret);
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

/** Cap (bearing) en degrés (0-360, 0 = nord, 90 = est) entre deux points GPS. */
export function bearingEntre(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Différence angulaire signée de `a` vers `b`, ramenée dans [-180, 180]. */
function differenceAngle(a, b) {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/** Cherche, à partir de l'index `indexDepart`, le point situé à `distanceKm`
 * plus loin sur le parcours (distanceKm négatif = en arrière). */
function trouverPointADistance(points, indexDepart, distanceKm) {
  const cible = points[indexDepart].distanceCumulee + distanceKm;
  if (distanceKm >= 0) {
    for (let j = indexDepart; j < points.length; j++) {
      if (points[j].distanceCumulee >= cible) return points[j];
    }
    return points[points.length - 1];
  }
  for (let j = indexDepart; j >= 0; j--) {
    if (points[j].distanceCumulee <= cible) return points[j];
  }
  return points[0];
}

const FENETRE_VIRAGE_KM = 0.02; // ~20 m avant/après pour lisser le bruit GPS
const SEUIL_ANGLE_VIRAGE_DEGRES = 35; // en dessous, on considère que c'est juste la route qui ondule

/**
 * Cherche s'il y a un virage significatif dans les `distanceLookaheadKm`
 * prochains kilomètres à partir de `distanceActuelleKm`. Retourne
 * { distanceAvantKm, angle } (angle positif = à droite, négatif = à gauche)
 * ou null si rien de notable.
 */
export function chercherVirageAVenir(parcours, distanceActuelleKm, distanceLookaheadKm = 0.15) {
  const { points } = parcours;

  let iDepart = points.findIndex((p) => p.distanceCumulee >= distanceActuelleKm);
  if (iDepart === -1) return null;

  let meilleurAngle = 0;
  let meilleurPoint = null;

  for (let i = iDepart; i < points.length; i++) {
    if (points[i].distanceCumulee > distanceActuelleKm + distanceLookaheadKm) break;
    if (points[i].distanceCumulee - FENETRE_VIRAGE_KM < 0) continue;

    const avant = trouverPointADistance(points, i, -FENETRE_VIRAGE_KM);
    const apres = trouverPointADistance(points, i, FENETRE_VIRAGE_KM);
    if (avant === points[i] || apres === points[i]) continue;

    const capAvant = bearingEntre(avant.lat, avant.lon, points[i].lat, points[i].lon);
    const capApres = bearingEntre(points[i].lat, points[i].lon, apres.lat, apres.lon);
    const angle = differenceAngle(capAvant, capApres);

    if (Math.abs(angle) > Math.abs(meilleurAngle)) {
      meilleurAngle = angle;
      meilleurPoint = points[i];
    }
  }

  if (!meilleurPoint || Math.abs(meilleurAngle) < SEUIL_ANGLE_VIRAGE_DEGRES) return null;

  return {
    distanceAvantKm: meilleurPoint.distanceCumulee - distanceActuelleKm,
    angle: meilleurAngle,
  };
}

// Records personnels : meilleurs temps sur les distances usuelles, retrouvés
// dans les courses déjà enregistrées.
//
// Principe (le même que Strava ou une montre de sport) : on ne regarde pas
// seulement les courses qui font *exactement* 5 km. On cherche, à l'intérieur
// de chaque course, la portion de 5 km la plus rapide — un 5 km rapide couru
// au milieu d'une sortie de 12 km compte donc comme un record.

export const DISTANCES_STANDARD = [
  { nom: '400 m', km: 0.4 },
  { nom: '800 m', km: 0.8 },
  { nom: '1500 m', km: 1.5 },
  { nom: '3 km', km: 3 },
  { nom: '5 km', km: 5 },
  { nom: '10 km', km: 10 },
  { nom: 'Semi-marathon', km: 21.0975 },
  { nom: 'Marathon', km: 42.195 },
];

/**
 * Meilleur temps réalisé sur `distanceKm` à l'intérieur d'un profil
 * [{d: km cumulés, t: secondes}]. Retourne les secondes, ou null si la course
 * est trop courte.
 *
 * Fenêtre glissante : pour chaque point de fin `j`, on avance le point de
 * départ `i` tant que la portion reste au moins aussi longue que la distance
 * visée. On interpole ensuite entre `i-1` et `i` pour tomber pile sur la
 * distance demandée, sinon un point GPS tous les 15 m fausserait un 400 m.
 */
export function meilleurTempsSurDistance(profil, distanceKm) {
  if (!Array.isArray(profil) || profil.length < 2) return null;

  let meilleur = null;
  let i = 0;

  for (let j = 1; j < profil.length; j++) {
    // On avance i tant que la fenêtre [i+1, j] couvre encore la distance.
    while (i + 1 < j && profil[j].d - profil[i + 1].d >= distanceKm) i++;

    if (profil[j].d - profil[i].d < distanceKm) continue;

    // Point de départ exact, entre i et i+1 : c'est là que la portion
    // atteignant pile `distanceKm` avant j commence.
    const depart = profil[j].d - distanceKm;
    const suivant = profil[i + 1];
    const actuel = profil[i];
    const ecartD = suivant.d - actuel.d;
    const ratio = ecartD > 0 ? (depart - actuel.d) / ecartD : 0;
    const tDepart = actuel.t + ratio * (suivant.t - actuel.t);

    const duree = profil[j].t - tDepart;
    if (duree > 0 && (meilleur === null || duree < meilleur)) meilleur = duree;
  }

  return meilleur;
}

/**
 * Parcourt l'historique et retourne, pour chaque distance standard, le meilleur
 * temps trouvé et la course qui le détient. Les courses enregistrées avant
 * l'ajout du profil distance/temps n'en ont pas : elles sont simplement
 * ignorées (pas de records rétroactifs possibles, faute de données).
 */
export function calculerRecords(courses) {
  return DISTANCES_STANDARD.map((distance) => {
    let meilleur = null;

    for (const course of courses) {
      if (!course.profil || course.profil.length < 2) continue;
      const temps = meilleurTempsSurDistance(course.profil, distance.km);
      if (temps === null) continue;
      if (meilleur === null || temps < meilleur.tempsSec) {
        meilleur = { tempsSec: temps, nomCourse: course.nomParcours, date: course.date };
      }
    }

    return {
      ...distance,
      tempsSec: meilleur ? meilleur.tempsSec : null,
      allureSecParKm: meilleur ? meilleur.tempsSec / distance.km : null,
      nomCourse: meilleur ? meilleur.nomCourse : null,
      date: meilleur ? meilleur.date : null,
    };
  });
}

/** Vrai si au moins une course de l'historique permet de calculer des records. */
export function historiqueExploitablePourRecords(courses) {
  return courses.some((c) => c.profil && c.profil.length >= 2);
}

/**
 * Temps réalisé sur chaque kilomètre entier de la course (« splits »), comme
 * sur une montre de sport. Le dernier kilomètre est partiel la plupart du
 * temps : on le renvoie avec `partiel: true` et sa distance réelle, pour ne
 * pas afficher un temps au km trompeur.
 */
export function calculerSplitsParKm(profil) {
  if (!Array.isArray(profil) || profil.length < 2) return [];

  const distanceTotale = profil[profil.length - 1].d;
  const splits = [];
  let precedentT = profil[0].t;

  for (let km = 1; km <= Math.ceil(distanceTotale); km++) {
    const borne = Math.min(km, distanceTotale);
    const t = tempsALaDistance(profil, borne);
    if (t === null) break;

    const partiel = borne < km;
    const distance = borne - (km - 1);
    if (distance <= 0.001) break; // reste négligeable : pas un split à afficher

    splits.push({
      numero: km,
      dureeSec: t - precedentT,
      distanceKm: distance,
      partiel,
      allureSecParKm: (t - precedentT) / distance,
    });
    precedentT = t;
  }

  return splits;
}

/** Temps écoulé au moment précis où la distance `distanceKm` a été atteinte
 * (interpolé entre les deux points GPS qui l'encadrent). */
function tempsALaDistance(profil, distanceKm) {
  if (distanceKm <= profil[0].d) return profil[0].t;
  for (let i = 1; i < profil.length; i++) {
    if (profil[i].d < distanceKm) continue;
    const ecartD = profil[i].d - profil[i - 1].d;
    const ratio = ecartD > 0 ? (distanceKm - profil[i - 1].d) / ecartD : 0;
    return profil[i - 1].t + ratio * (profil[i].t - profil[i - 1].t);
  }
  return null;
}

/**
 * Compare une course qui vient d'être terminée aux records établis par les
 * courses précédentes, et retourne les distances où le record tombe.
 *
 * Choix assumé : une distance jamais courue auparavant ne compte pas comme un
 * record. Sinon la toute première course annoncerait fièrement huit records
 * d'un coup, ce qui n'a aucun sens.
 */
export function detecterNouveauxRecords(profilNouvelleCourse, coursesPrecedentes) {
  if (!Array.isArray(profilNouvelleCourse) || profilNouvelleCourse.length < 2) return [];

  const ancienRecords = calculerRecords(coursesPrecedentes);

  return DISTANCES_STANDARD.map((distance, index) => {
    const ancien = ancienRecords[index].tempsSec;
    if (ancien === null) return null; // distance jamais courue : voir ci-dessus

    const nouveau = meilleurTempsSurDistance(profilNouvelleCourse, distance.km);
    if (nouveau === null || nouveau >= ancien) return null;

    return { ...distance, tempsSec: nouveau, ancienTempsSec: ancien, gainSec: ancien - nouveau };
  }).filter(Boolean);
}

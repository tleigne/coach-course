// Export et restauration de toutes les données de l'appli, dans un fichier.
//
// Tout vit dans le téléphone (aucun serveur) : ce fichier est donc le seul
// moyen de ne pas tout perdre en changeant d'appareil, et le seul pont entre
// deux téléphones.
//
// Principe de la restauration : **on ajoute, on n'écrase pas**. Une course
// déjà présente n'est pas dupliquée, et rien de ce qui existe localement
// n'est perdu. Restaurer deux fois le même fichier doit donner exactement le
// même résultat que de le restaurer une fois.

import { listerCourses, remplacerCourses, lireObjectifHebdo, ecrireObjectifHebdo } from './historique.js';
import { lirePlan, sauvegarderPlan } from './plan.js';

const VERSION_SAUVEGARDE = 2;

/** Contenu du fichier de sauvegarde (texte JSON). */
export function genererSauvegarde() {
  return JSON.stringify(
    {
      application: 'coach-course',
      version: VERSION_SAUVEGARDE,
      exporteLe: new Date().toISOString(),
      objectifHebdoKm: lireObjectifHebdo(),
      plan: lirePlan(),
      courses: listerCourses(),
    },
    null,
    2
  );
}

/**
 * Restaure une sauvegarde en la fusionnant avec ce qui est déjà là.
 *
 * Le fichier vient de l'extérieur : sa structure est vérifiée champ par champ
 * et seuls les champs attendus sont recopiés — un fichier corrompu ou
 * étranger à l'appli ne doit pas pouvoir abîmer les données existantes.
 *
 * Retourne un compte-rendu { ajoutees, deja, enrichies, planRestaure } ou
 * { erreur } (message destiné à l'utilisateur).
 */
export function restaurerSauvegarde(texte) {
  let donnees;
  try {
    donnees = JSON.parse(texte);
  } catch (e) {
    return { erreur: "Ce fichier n'est pas une sauvegarde valide." };
  }

  if (!donnees || donnees.application !== 'coach-course' || !Array.isArray(donnees.courses)) {
    return { erreur: "Ce fichier ne semble pas être une sauvegarde de Coach Course." };
  }

  const importees = donnees.courses.filter(estCourseValide).map(nettoyerCourse);
  if (importees.length === 0) {
    return { erreur: 'Cette sauvegarde ne contient aucune course exploitable.' };
  }

  const fusion = fusionnerCourses(listerCourses(), importees);

  if (!remplacerCourses(fusion.courses)) {
    return { erreur: "Impossible d'enregistrer : l'espace de stockage est plein." };
  }

  // L'objectif hebdomadaire et le plan ne sont repris que s'il n'y en a pas
  // déjà un : restaurer ne doit jamais effacer un plan en cours, dont la
  // progression serait perdue.
  if (lireObjectifHebdo() <= 0 && typeof donnees.objectifHebdoKm === 'number' && donnees.objectifHebdoKm > 0) {
    ecrireObjectifHebdo(donnees.objectifHebdoKm);
  }

  let planRestaure = false;
  if (!lirePlan() && planValide(donnees.plan)) {
    planRestaure = sauvegarderPlan(donnees.plan);
  }

  return { ...fusion.compte, planRestaure };
}

/**
 * Fusionne deux listes de courses sans créer de doublon.
 *
 * Deux courses enregistrées à la milliseconde près sont forcément la même :
 * la date sert donc d'identifiant naturel, sans avoir à en inventer un.
 * Quand une course est déjà connue mais que la version importée contient un
 * profil distance/temps absent localement (cas d'un vieil historique tronqué
 * pour libérer de la place), on récupère ce profil au passage.
 */
function fusionnerCourses(existantes, importees) {
  const parDate = new Map(existantes.map((c) => [c.date, c]));
  let ajoutees = 0;
  let deja = 0;
  let enrichies = 0;

  for (const course of importees) {
    const presente = parDate.get(course.date);
    if (!presente) {
      parDate.set(course.date, course);
      ajoutees++;
    } else if (!presente.profil && course.profil) {
      parDate.set(course.date, { ...presente, profil: course.profil });
      enrichies++;
    } else {
      deja++;
    }
  }

  const courses = [...parDate.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
  return { courses, compte: { ajoutees, deja, enrichies, total: courses.length } };
}

function estCourseValide(course) {
  return (
    course &&
    typeof course === 'object' &&
    typeof course.nomParcours === 'string' &&
    typeof course.date === 'string' &&
    !Number.isNaN(new Date(course.date).getTime())
  );
}

/** Ne recopie que les champs attendus, avec le bon type : on n'injecte pas
 * dans l'appli des propriétés arbitraires venues d'un fichier externe. */
function nettoyerCourse(course) {
  const nombreOuNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const profilValide =
    Array.isArray(course.profil) &&
    course.profil.every((p) => p && typeof p.d === 'number' && typeof p.t === 'number');

  return {
    nomParcours: course.nomParcours.slice(0, 200),
    date: course.date,
    distanceKm: nombreOuNull(course.distanceKm) || 0,
    dureeSec: nombreOuNull(course.dureeSec) || 0,
    allureMoyenneSecParKm: nombreOuNull(course.allureMoyenneSecParKm),
    configSeance: course.configSeance && typeof course.configSeance === 'object' ? course.configSeance : null,
    profil: profilValide ? course.profil : null,
  };
}

/** Contrôle minimal de forme avant de réinstaller un plan venu d'un fichier. */
function planValide(plan) {
  return (
    plan &&
    typeof plan === 'object' &&
    typeof plan.objectifNom === 'string' &&
    typeof plan.creeLe === 'string' &&
    Array.isArray(plan.semaines) &&
    plan.semaines.length > 0 &&
    plan.semaines.every((s) => Number.isFinite(s.numero) && Array.isArray(s.seances))
  );
}

// Profil de performance du coureur, utilisé pour juger si un objectif reste
// envisageable compte tenu de la suite du parcours (voir ROADMAP.md).
//
// Valeurs calculées à partir de l'historique Strava réel de Thibault
// (juillet 2026) : zones d'allure de course (API Strava, basées sur ses
// performances récentes, meilleure perf 5 km ≈ 25:56) et son ratio réel
// vitesse/dénivelé observé sur une sortie très pentue (La Rhune, ~72 m de D+
// par km, allure passée d'environ 6:00/km à plat à ~11:20/km en montée).
// À recalculer si le profil de performance évolue nettement (nouvelle saison,
// blessure, forme différente).
export const PROFIL_COUREUR = {
  allureConfortableSecParKm: 360, // 6:00/km — rythme tenable longtemps sans forcer
  allureTempoSecParKm: 336, // 5:36/km — effort soutenu mais sous-maximal, entre confortable et seuil
  allureSeuilSecParKm: 313, // 5:13/km — rythme "seuil", tenable seulement sur un effort soutenu
  allureVMASecParKm: 275, // 4:35/km — vitesse maximale aérobie, tenue seulement sur de courtes répétitions
  penaliteDeniveleSecParKmParMParKm: 4.4, // ralentissement (sec/km) par mètre de D+ par km de pente
};

/**
 * Estime si le rythme nécessaire pour respecter l'objectif sur la distance
 * restante est réaliste compte tenu du profil du coureur et du dénivelé
 * restant. Retourne 'large', 'jouable' ou 'difficile'.
 */
export function evaluerFaisabilite(allureNecessaireSecParKm, deniveleRestantM, distanceRestanteKm) {
  if (!isFinite(allureNecessaireSecParKm) || distanceRestanteKm <= 0) return null;

  const deniveleParKm = deniveleRestantM / distanceRestanteKm;
  const penalite = deniveleParKm * PROFIL_COUREUR.penaliteDeniveleSecParKmParMParKm;
  const allureEquivalentPlat = allureNecessaireSecParKm - penalite;

  if (allureEquivalentPlat >= PROFIL_COUREUR.allureConfortableSecParKm) return 'large';
  if (allureEquivalentPlat >= PROFIL_COUREUR.allureSeuilSecParKm) return 'jouable';
  return 'difficile';
}

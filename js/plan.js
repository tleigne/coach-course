// Plan d'entraînement sur plusieurs semaines, façon programme de coach.
//
// Les séances individuelles existent déjà (js/seances.js) : ce module ne les
// remplace pas, il décide *quoi faire quand*, semaine après semaine, jusqu'à
// une date d'objectif.
//
// Les règles appliquées ici sont les principes classiques de la planification
// en course à pied, pas des choix arbitraires :
//   - progression du volume limitée à ~8 % entre deux semaines de
//     développement consécutives, la fameuse « règle des 10 % » qui limite le
//     risque de blessure. La reprise après une semaine allégée repart
//     logiquement au-dessus du dernier palier : c'est le principe même de la
//     surcompensation, pas un dépassement de la règle ;
//   - une semaine allégée toutes les 4 semaines : la forme se construit
//     pendant la récupération, pas pendant l'effort ;
//   - répartition polarisée ~80/20 : l'essentiel du volume en endurance
//     facile, une seule (ou deux) séance dure par semaine ;
//   - affûtage sur les dernières semaines : le volume baisse mais l'intensité
//     reste, pour arriver frais le jour J ;
//   - une sortie longue hebdomadaire, plafonnée selon l'objectif.

import { PROFIL_COUREUR } from './profil.js';

export const OBJECTIFS = [
  { id: '5km', nom: '5 km', km: 5, volumePicKm: 35, sortieLongueMaxKm: 12, ecartAllureSeuil: -8 },
  { id: '10km', nom: '10 km', km: 10, volumePicKm: 45, sortieLongueMaxKm: 16, ecartAllureSeuil: 6 },
  { id: 'semi', nom: 'Semi-marathon', km: 21.0975, volumePicKm: 60, sortieLongueMaxKm: 22, ecartAllureSeuil: 16 },
  { id: 'marathon', nom: 'Marathon', km: 42.195, volumePicKm: 80, sortieLongueMaxKm: 32, ecartAllureSeuil: 28 },
];

export const SEMAINES_MIN = 4;
export const SEMAINES_MAX = 24;

// Jour de la semaine attribué à chaque séance, selon le nombre de séances
// hebdomadaires. On laisse toujours au moins un jour de repos entre deux
// séances dures, et la sortie longue tombe le dimanche.
const REPARTITION_JOURS = {
  3: ['mardi', 'jeudi', 'dimanche'],
  4: ['mardi', 'jeudi', 'samedi', 'dimanche'],
  5: ['mardi', 'mercredi', 'jeudi', 'samedi', 'dimanche'],
};

const LIBELLE_TYPE = {
  endurance: 'Endurance',
  sortie_longue: 'Sortie longue',
  tempo: 'Tempo',
  seuil: 'Seuil',
  vma: 'VMA',
  fractionne: 'Fractionné',
};

export function libelleType(type) {
  return LIBELLE_TYPE[type] || type;
}

/** Allure visée le jour de l'objectif, déduite du profil du coureur : plus la
 * distance est longue, plus l'allure tenable s'éloigne du seuil. */
export function allureObjectif(objectif) {
  return PROFIL_COUREUR.allureSeuilSecParKm + objectif.ecartAllureSeuil;
}

/** Nombre de semaines entières entre aujourd'hui et la date d'objectif. */
export function semainesJusqua(dateObjectif) {
  const jours = (new Date(dateObjectif).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  return Math.floor(jours / 7);
}

/**
 * Construit le plan complet.
 *
 * `volumeDepartKm` doit refléter ce que le coureur encaisse *aujourd'hui*
 * (calculé depuis son historique par l'appelant) : un plan qui démarre
 * au-dessus du volume actuel est le meilleur moyen de se blesser dès la
 * première semaine.
 */
export function genererPlan({ objectifId, dateObjectif, seancesParSemaine, volumeDepartKm }) {
  const objectif = OBJECTIFS.find((o) => o.id === objectifId);
  if (!objectif) return { erreur: 'Objectif inconnu.' };

  const nbSemaines = semainesJusqua(dateObjectif);
  if (nbSemaines < SEMAINES_MIN) {
    return { erreur: `Il faut au moins ${SEMAINES_MIN} semaines avant l'objectif pour bâtir un plan utile.` };
  }
  if (nbSemaines > SEMAINES_MAX) {
    return { erreur: `Au-delà de ${SEMAINES_MAX} semaines, un plan devient trop théorique. Choisis une date plus proche.` };
  }
  if (!REPARTITION_JOURS[seancesParSemaine]) {
    return { erreur: 'Choisis entre 3 et 5 séances par semaine.' };
  }

  const volumeDepart = Math.max(10, volumeDepartKm || 0);
  const nbAffutage = nbSemaines >= 8 ? 2 : 1;
  const nbConstruction = nbSemaines - nbAffutage;

  // Seules les semaines de développement font monter le volume. Les semaines
  // allégées ne consomment pas de palier : sinon la reprise devrait rattraper
  // deux paliers d'un coup (~17 %), ce qui est exactement le genre de bond qui
  // blesse — alors qu'une reprise doit repartir juste au-dessus du dernier
  // palier travaillé.
  let nbDeveloppement = 0;
  for (let n = 1; n <= nbConstruction; n++) if (n % 4 !== 0) nbDeveloppement++;

  // Deux garde-fous cumulés : on ne dépasse ni le volume raisonnable pour
  // l'objectif visé, ni ce qu'une progression de ~8 % par palier permet
  // d'atteindre depuis le volume actuel.
  const nbPaliers = Math.max(1, nbDeveloppement - 1);
  const volumePic = Math.min(objectif.volumePicKm, volumeDepart * Math.pow(1.08, nbPaliers));

  const semaines = [];
  let indexDeveloppement = 0;
  let dernierVolumeDeveloppement = volumeDepart;

  for (let numero = 1; numero <= nbSemaines; numero++) {
    const restantes = nbSemaines - numero;
    let typeSemaine;
    let volumeKm;

    if (restantes < nbAffutage) {
      typeSemaine = 'affutage';
      // Dernière semaine = celle de la course : volume très réduit.
      volumeKm = volumePic * (restantes === 0 ? 0.5 : 0.7);
    } else if (numero % 4 === 0) {
      typeSemaine = 'recuperation';
      volumeKm = dernierVolumeDeveloppement * 0.7;
    } else {
      typeSemaine = 'developpement';
      volumeKm = interpolerVolume(indexDeveloppement, nbPaliers, volumeDepart, volumePic);
      indexDeveloppement++;
      dernierVolumeDeveloppement = volumeKm;
    }

    semaines.push({
      numero,
      typeSemaine,
      volumeKm: Math.round(volumeKm * 10) / 10,
      seances: construireSeancesSemaine({
        objectif,
        numero,
        nbSemaines,
        typeSemaine,
        volumeKm,
        seancesParSemaine,
      }),
    });
  }

  return {
    plan: {
      objectifId,
      objectifNom: objectif.nom,
      objectifKm: objectif.km,
      dateObjectif,
      seancesParSemaine,
      volumeDepartKm: Math.round(volumeDepart * 10) / 10,
      volumePicKm: Math.round(volumePic * 10) / 10,
      creeLe: new Date().toISOString(),
      semaines,
    },
  };
}

/**
 * Progression *géométrique* et non linéaire : chaque semaine augmente du même
 * pourcentage, et non du même nombre de kilomètres. Avec une progression
 * linéaire, un palier fixe de 2,5 km représente +10 % quand on part de 25 km
 * mais seulement +6 % à 42 km — donc une charge bien plus agressive au début,
 * exactement là où le coureur est le moins préparé. La forme géométrique
 * répartit l'effort uniformément et respecte la règle des ~10 %.
 */
function interpolerVolume(indexDeveloppement, nbPaliers, volumeDepart, volumePic) {
  if (nbPaliers <= 0) return volumePic;
  const progression = Math.min(1, indexDeveloppement / nbPaliers);
  return volumeDepart * Math.pow(volumePic / volumeDepart, progression);
}

/**
 * Compose les séances d'une semaine : une séance dure (deux à partir de 5
 * séances hebdo), une sortie longue, et le reste du volume en endurance
 * facile — c'est la répartition ~80/20 évoquée en tête de fichier.
 */
function construireSeancesSemaine({ objectif, numero, nbSemaines, typeSemaine, volumeKm, seancesParSemaine }) {
  const jours = REPARTITION_JOURS[seancesParSemaine];
  const deuxSeancesDures = seancesParSemaine >= 5 && typeSemaine === 'developpement';

  const sortieLongueKm = Math.min(objectif.sortieLongueMaxKm, volumeKm * 0.33);
  const seanceDure = choisirSeanceDure({ objectif, numero, nbSemaines, typeSemaine });
  const volumeSeanceDure = 8; // échauffement + effort + retour au calme, en ordre de grandeur

  const nbEndurance = seancesParSemaine - 1 - (deuxSeancesDures ? 2 : 1);
  const volumeEndurance = Math.max(
    3,
    (volumeKm - sortieLongueKm - volumeSeanceDure * (deuxSeancesDures ? 2 : 1)) / Math.max(1, nbEndurance)
  );

  const seances = [seanceDure];
  if (deuxSeancesDures) {
    seances.push(choisirSeanceDure({ objectif, numero: numero + 2, nbSemaines, typeSemaine }));
  }
  for (let i = 0; i < nbEndurance; i++) {
    seances.push({
      type: 'endurance',
      nom: `Endurance ${arrondirDemi(volumeEndurance)} km`,
      distanceKm: arrondirDemi(volumeEndurance),
      allureCibleSecParKm: PROFIL_COUREUR.allureConfortableSecParKm,
      description: 'Footing facile, tu dois pouvoir tenir une conversation.',
    });
  }
  seances.push({
    type: 'sortie_longue',
    nom: `Sortie longue ${arrondirDemi(sortieLongueKm)} km`,
    distanceKm: arrondirDemi(sortieLongueKm),
    allureCibleSecParKm: PROFIL_COUREUR.allureConfortableSecParKm,
    description: "C'est la séance qui construit ton endurance. Reste facile, ne cours pas après le chrono.",
  });

  // La dernière semaine, la sortie longue laisse la place à la course elle-même.
  if (numero === nbSemaines) {
    seances[seances.length - 1] = {
      type: 'objectif',
      nom: `Jour J — ${objectif.nom}`,
      distanceKm: Math.round(objectif.km * 10) / 10,
      allureCibleSecParKm: allureObjectif(objectif),
      description: 'Le jour de ton objectif. Tout le plan a servi à ça.',
    };
  }

  return seances.map((seance, index) => ({ ...seance, jour: jours[index], faite: false }));
}

/**
 * Choisit le type de séance dure selon l'avancement dans le plan : on part du
 * travail foncier (tempo, seuil) pour aller vers du plus spécifique et plus
 * rapide (VMA, fractionné à l'allure objectif) à l'approche de l'échéance.
 */
function choisirSeanceDure({ objectif, numero, nbSemaines, typeSemaine }) {
  const avancement = numero / nbSemaines;
  const allureCible = allureObjectif(objectif);

  if (typeSemaine === 'recuperation') {
    return {
      type: 'tempo',
      nom: 'Tempo 15 min',
      dureeMin: 15,
      allureCibleSecParKm: PROFIL_COUREUR.allureTempoSecParKm,
      description: 'Semaine allégée : on entretient sans creuser la fatigue.',
    };
  }

  if (typeSemaine === 'affutage') {
    return {
      type: 'fractionne',
      nom: '4 x 400 m à allure objectif',
      repetitions: 4,
      distanceEffortM: 400,
      distanceRecupM: 400,
      allureCibleSecParKm: allureCible,
      description: "Rappel de vitesse, court et facile : on entretient les sensations sans se fatiguer.",
    };
  }

  if (avancement < 0.35) {
    const duree = 20 + Math.min(10, numero * 2);
    return {
      type: 'tempo',
      nom: `Tempo ${duree} min`,
      dureeMin: duree,
      allureCibleSecParKm: PROFIL_COUREUR.allureTempoSecParKm,
      description: 'Travail foncier : effort soutenu mais contrôlé, pour élever ta base.',
    };
  }

  if (avancement < 0.6) {
    const duree = 20 + Math.min(15, numero);
    return {
      type: 'seuil',
      nom: `Seuil ${duree} min`,
      dureeMin: duree,
      allureCibleSecParKm: PROFIL_COUREUR.allureSeuilSecParKm,
      description: 'Séance clé : elle repousse le rythme que tu peux tenir longtemps.',
    };
  }

  if (avancement < 0.8) {
    return {
      type: 'vma',
      nom: 'VMA 10 x 30s / 30s',
      repetitions: 10,
      dureeEffortSec: 30,
      dureeRecupSec: 30,
      allureCibleSecParKm: PROFIL_COUREUR.allureVMASecParKm,
      description: 'Travail de vitesse pure : court, rapide, avec récupération complète.',
    };
  }

  // Phase spécifique : on répète l'allure exacte du jour J.
  const repetitions = objectif.km >= 21 ? 3 : 5;
  const distanceEffortM = objectif.km >= 21 ? 2000 : 1000;
  return {
    type: 'fractionne',
    nom: `${repetitions} x ${distanceEffortM} m à allure objectif`,
    repetitions,
    distanceEffortM,
    distanceRecupM: 400,
    allureCibleSecParKm: allureCible,
    description: "Séance la plus spécifique : c'est l'allure exacte que tu vises le jour J.",
  };
}

function arrondirDemi(valeur) {
  return Math.round(valeur * 2) / 2;
}

// ===================== SUIVI ET STOCKAGE =====================

const CLE_PLAN = 'coach-course-plan';

export function sauvegarderPlan(plan) {
  try {
    localStorage.setItem(CLE_PLAN, JSON.stringify(plan));
    return true;
  } catch (e) {
    return false;
  }
}

export function lirePlan() {
  try {
    const brut = localStorage.getItem(CLE_PLAN);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    return null;
  }
}

export function supprimerPlan() {
  try {
    localStorage.removeItem(CLE_PLAN);
  } catch (e) {
    // ignore
  }
}

export function basculerSeanceFaite(plan, numeroSemaine, indexSeance) {
  const semaine = plan.semaines.find((s) => s.numero === numeroSemaine);
  if (!semaine || !semaine.seances[indexSeance]) return plan;
  semaine.seances[indexSeance].faite = !semaine.seances[indexSeance].faite;
  return plan;
}

/**
 * Semaine en cours du plan, déduite de sa date de création : le plan avance
 * avec le calendrier, pas avec les cases cochées — sauter une séance ne doit
 * pas figer le programme.
 */
export function semaineCourante(plan) {
  const joursEcoules = (Date.now() - new Date(plan.creeLe).getTime()) / (24 * 60 * 60 * 1000);
  const numero = Math.floor(joursEcoules / 7) + 1;
  return Math.min(Math.max(1, numero), plan.semaines.length);
}

export function avancementPlan(plan) {
  const toutes = plan.semaines.flatMap((s) => s.seances);
  const faites = toutes.filter((s) => s.faite).length;
  return {
    total: toutes.length,
    faites,
    pourcentage: toutes.length ? Math.round((faites / toutes.length) * 100) : 0,
  };
}

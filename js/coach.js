// Coaching vocal : synthèse vocale en français (Web Speech API) + banques de phrases.
import { formatDureeParlee, formatAllure } from './utils.js';

const CLE_VOIX_PREFEREE = 'coach-course-voix-preferee';

// Fragments de noms couramment utilisés par les moteurs de synthèse vocale
// pour indiquer le genre de la voix. Purement indicatif (l'API Web Speech ne
// fournit pas de champ "genre" standard) : sert seulement à étiqueter les
// voix dans l'écran de réglages, jamais à filtrer ou décider à la place de
// l'utilisateur — il choisit toujours en écoutant un aperçu.
const INDICES_VOIX_FEMININE = ['hortense', 'amelie', 'amélie', 'audrey', 'julie', 'marie', 'virginie', 'celine', 'céline', 'chantal', 'female', 'femme'];
const INDICES_VOIX_MASCULINE = ['paul', 'thomas', 'nicolas', 'daniel', 'henri', 'bruno', 'male', 'homme'];

/** Devine (au mieux) le genre d'une voix à partir de son nom. Retourne
 * 'feminine', 'masculine' ou null si indéterminé. */
export function deviterGenreVoix(nomVoix) {
  const nom = (nomVoix || '').toLowerCase();
  if (INDICES_VOIX_FEMININE.some((mot) => nom.includes(mot))) return 'feminine';
  if (INDICES_VOIX_MASCULINE.some((mot) => nom.includes(mot))) return 'masculine';
  return null;
}

export class CoachVocal {
  constructor() {
    this.voixFR = null;
    this.voixDisponibles = [];
    this.pret = false;
    if ('speechSynthesis' in window) {
      this._chargerVoix();
      speechSynthesis.onvoiceschanged = () => this._chargerVoix();
    }
  }

  _chargerVoix() {
    const toutesVoix = speechSynthesis.getVoices();
    const voixFrancaises = toutesVoix.filter((v) => v.lang && v.lang.toLowerCase().startsWith('fr'));

    // Certains navigateurs/moteurs TTS annoncent la même voix plusieurs fois
    // (même nom + même langue) : on ne garde que la première occurrence.
    const nomsVus = new Set();
    this.voixDisponibles = voixFrancaises.filter((v) => {
      const cle = `${v.name}|${v.lang}`;
      if (nomsVus.has(cle)) return false;
      nomsVus.add(cle);
      return true;
    });

    let nomPrefere = null;
    try {
      nomPrefere = localStorage.getItem(CLE_VOIX_PREFEREE);
    } catch (e) {
      // Stockage indisponible : on garde le choix par défaut.
    }
    const voixPreferee = nomPrefere && this.voixDisponibles.find((v) => v.name === nomPrefere);
    this.voixFR = voixPreferee || this.voixDisponibles[0] || null;
    this.pret = true;
  }

  /** Voix françaises détectées sur cet appareil (peut être vide si la page
   * vient de charger et que le navigateur n'a pas encore annoncé ses voix). */
  listerVoixDisponibles() {
    return this.voixDisponibles;
  }

  voixActuelle() {
    return this.voixFR;
  }

  /** Change la voix utilisée pour le coaching, et retient ce choix. */
  definirVoixPreferee(nomVoix) {
    const voix = this.voixDisponibles.find((v) => v.name === nomVoix);
    if (!voix) return;
    this.voixFR = voix;
    try {
      localStorage.setItem(CLE_VOIX_PREFEREE, nomVoix);
    } catch (e) {
      // Stockage indisponible : le choix reste actif pour cette session seulement.
    }
  }

  /** Fait entendre un exemple avec une voix donnée, sans changer la voix
   * active du coaching (pour comparer avant de choisir). */
  previsualiserVoix(nomVoix, texte = 'Bonjour, je suis ton coach vocal pour cette course.') {
    if (!this.disponible()) return;
    const voix = this.voixDisponibles.find((v) => v.name === nomVoix);
    speechSynthesis.cancel();
    const enonce = new SpeechSynthesisUtterance(texte);
    enonce.lang = 'fr-FR';
    if (voix) enonce.voice = voix;
    speechSynthesis.speak(enonce);
  }

  disponible() {
    return 'speechSynthesis' in window;
  }

  /**
   * Parle immédiatement (annule ce qui était en cours). À appeler dans un
   * gestionnaire de clic pour la toute première fois (politique autoplay).
   */
  parler(texte, { prioritaire = false } = {}) {
    if (!this.disponible()) return;
    if (prioritaire) speechSynthesis.cancel();
    const enonce = new SpeechSynthesisUtterance(texte);
    enonce.lang = 'fr-FR';
    if (this.voixFR) enonce.voice = this.voixFR;
    enonce.rate = 1.0;
    enonce.pitch = 1.0;
    speechSynthesis.speak(enonce);
  }

  arreterTout() {
    if (this.disponible()) speechSynthesis.cancel();
  }
}

const ENCOURAGEMENTS = [
  'Belle allure, continue comme ça !',
  "Tu gères bien, garde ce rythme.",
  'Superbe, ne lâche rien !',
  'Tout va bien, respire, tu es dans ton effort.',
  'Bon rythme, reste concentré sur ta foulée.',
  'Ça avance bien, garde confiance.',
];

export function phraseEncouragementAleatoire(eviter) {
  const choix = ENCOURAGEMENTS.filter((p) => p !== eviter);
  return choix[Math.floor(Math.random() * choix.length)];
}

export function phraseHydratation() {
  return "Pense à boire une gorgée d'eau.";
}

export function phraseMontee(distanceAvantM) {
  const distanceArrondie = Math.round(distanceAvantM / 50) * 50;
  if (distanceArrondie <= 100) {
    return 'Attention, une montée arrive tout de suite.';
  }
  return `Attention, une montée arrive dans environ ${distanceArrondie} mètres.`;
}

/** Indication directionnelle façon copilote de rallye. `angle` positif =
 * virage à droite, négatif = à gauche (voir chercherVirageAVenir). */
export function phraseVirage(distanceAvantM, angle) {
  const direction = angle > 0 ? 'droite' : 'gauche';
  const magnitude = Math.abs(angle);
  const distanceArrondie = Math.round(distanceAvantM / 25) * 25;

  let indication;
  if (magnitude >= 120) indication = `épingle à ${direction}`;
  else if (magnitude >= 70) indication = `vire à ${direction}`;
  else indication = `tourne légèrement à ${direction}`;

  if (distanceArrondie <= 30) {
    return `Attention, ${indication} tout de suite.`;
  }
  return `Dans ${distanceArrondie} mètres, ${indication}.`;
}

/** Annonce d'un point d'intérêt du parcours (ravitaillement, sommet...). */
export function phrasePointInteret(nom, distanceAvantM) {
  const distanceArrondie = Math.round(distanceAvantM / 50) * 50;
  if (distanceArrondie <= 50) {
    return `Tu arrives à ${nom}.`;
  }
  return `Dans environ ${distanceArrondie} mètres : ${nom}.`;
}

export function phraseDepart() {
  return "C'est parti, bonne course !";
}

export function phraseFin(distanceKm, dureeSec) {
  return `Course terminée. ${distanceKm} kilomètres parcourus en ${formatDureeParlee(dureeSec)}. Bravo !`;
}

export function phraseAvanceRetard(ecartSec) {
  const absMin = Math.round(Math.abs(ecartSec) / 60);
  if (Math.abs(ecartSec) < 20) {
    return "Tu es exactement dans ton objectif de temps, continue ainsi.";
  }
  if (ecartSec > 0) {
    return absMin >= 1
      ? `Tu es en avance d'environ ${absMin} minute${absMin > 1 ? 's' : ''} sur ton objectif.`
      : "Tu es légèrement en avance sur ton objectif.";
  }
  return absMin >= 1
    ? `Tu es en retard d'environ ${absMin} minute${absMin > 1 ? 's' : ''} sur ton objectif, essaie d'accélérer un peu.`
    : 'Tu es légèrement en retard, essaie de reprendre un peu de rythme.';
}

export function phraseRapportAllure(allureTexte) {
  return `Ton allure actuelle est de ${allureTexte}.`;
}

/** Complète l'annonce d'un retard par une estimation de faisabilité,
 * basée sur le profil de performance et la suite du parcours. */
export function phraseFaisabilite(niveau) {
  if (niveau === 'large') return 'Vu la suite du parcours, tu as largement de quoi rattraper ça.';
  if (niveau === 'jouable') return "C'est jouable si tu restes régulier, sans t'affoler.";
  if (niveau === 'difficile') {
    return 'Ce sera difficile à rattraper vu la suite du parcours : mieux vaut assurer une allure stable plutôt que de vouloir tout rattraper d\'un coup.';
  }
  return '';
}

/** Annonce le début d'un nouveau segment d'une séance structurée
 * (échauffement, effort, récupération, retour au calme). */
export function phraseSegment(segment) {
  const allureTexte = segment.allureCibleSecParKm ? `, allure cible ${formatAllure(segment.allureCibleSecParKm)}` : ', allure libre';
  const repTexte = segment.numeroRepetition ? ` numéro ${segment.numeroRepetition} sur ${segment.totalRepetitions}` : '';

  if (segment.type === 'echauffement') return `Échauffement${allureTexte}.`;
  if (segment.type === 'effort') return `Top, effort${repTexte}${allureTexte} !`;
  if (segment.type === 'recuperation') return `Récupération${repTexte}, ralentis.`;
  if (segment.type === 'retour_au_calme') return 'Retour au calme, ralentis progressivement.';
  return '';
}

export function phraseFinSeance() {
  return 'Séance terminée, bravo pour ce travail !';
}

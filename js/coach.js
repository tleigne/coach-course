// Coaching vocal : synthèse vocale en français (Web Speech API) + banques de phrases.

export class CoachVocal {
  constructor() {
    this.voixFR = null;
    this.pret = false;
    if ('speechSynthesis' in window) {
      this._chargerVoix();
      speechSynthesis.onvoiceschanged = () => this._chargerVoix();
    }
  }

  _chargerVoix() {
    const voix = speechSynthesis.getVoices();
    this.voixFR = voix.find((v) => v.lang && v.lang.toLowerCase().startsWith('fr')) || null;
    this.pret = true;
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

export function phraseDepart() {
  return "C'est parti, bonne course !";
}

export function phraseFin(distanceKm, dureeTexte) {
  return `Course terminée. ${distanceKm} kilomètres parcourus en ${dureeTexte}. Bravo !`;
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

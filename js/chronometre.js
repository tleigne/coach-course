// Chronomètre autonome avec tours, indépendant du suivi GPS/parcours — utile
// par exemple pour chronométrer manuellement des répétitions sur piste.

export class Chronometre {
  constructor() {
    this.etat = 'arret'; // 'arret' | 'en_cours' | 'pause'
    this.dejaEcouleMs = 0; // temps accumulé avant le segment en cours (pause/reprise)
    this.debutMs = 0; // horodatage de la dernière reprise
    this.tempsDernierTourMs = 0; // temps cumulé au dernier tour enregistré
    this.tours = []; // [{numero, tempsTourMs, tempsCumuleMs}], le plus récent en dernier
  }

  demarrer() {
    if (this.etat === 'en_cours') return;
    this.debutMs = Date.now();
    this.etat = 'en_cours';
  }

  mettreEnPause() {
    if (this.etat !== 'en_cours') return;
    this.dejaEcouleMs += Date.now() - this.debutMs;
    this.etat = 'pause';
  }

  /** Temps total écoulé en millisecondes, à tout moment. */
  tempsEcouleMs() {
    if (this.etat === 'en_cours') return this.dejaEcouleMs + (Date.now() - this.debutMs);
    return this.dejaEcouleMs;
  }

  /** Enregistre un tour (uniquement possible pendant que le chrono tourne).
   * Retourne le tour enregistré, ou null si le chrono n'est pas en cours. */
  enregistrerTour() {
    if (this.etat !== 'en_cours') return null;
    const tempsCumuleMs = this.tempsEcouleMs();
    const tour = {
      numero: this.tours.length + 1,
      tempsTourMs: tempsCumuleMs - this.tempsDernierTourMs,
      tempsCumuleMs,
    };
    this.tours.push(tour);
    this.tempsDernierTourMs = tempsCumuleMs;
    return tour;
  }

  reinitialiser() {
    this.etat = 'arret';
    this.dejaEcouleMs = 0;
    this.debutMs = 0;
    this.tempsDernierTourMs = 0;
    this.tours = [];
  }
}

// ========================================
// 📅 Utilitaire Mois Calendaire
//
// But : convertir un numéro de mensualité relatif (1, 2, 3...)
// en un vrai mois calendaire ("2026-02") calculé à partir de la
// date de démarrage réelle de l'étudiant, et le formater pour
// l'affichage ("Février 2026").
//
// Ça permet de faire des statistiques par mois réel, même si deux
// étudiants n'ont pas démarré le même mois.
// ========================================

const NOMS_MOIS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  
  /**
   * Calcule la clé technique du mois calendaire (format "YYYY-MM")
   * pour la Nème mensualité d'un étudiant.
   *
   * @param {Date|string} dateDemarrage - date de démarrage de l'étudiant
   * @param {number} numeroMois - numéro de la mensualité (1, 2, 3...)
   * @returns {string} ex: "2026-02"
   */
  export function calculerMoisCalendaire(dateDemarrage, numeroMois) {
    if (!dateDemarrage || !numeroMois) return null;
  
    const d = new Date(dateDemarrage);
    d.setDate(1); // évite les décalages de fin de mois (ex: 31 janvier + 1 mois)
    d.setMonth(d.getMonth() + (numeroMois - 1));
  
    const annee = d.getFullYear();
    const mois = String(d.getMonth() + 1).padStart(2, '0');
    return `${annee}-${mois}`;
  }
  
  /**
   * Formate une clé de mois calendaire pour l'affichage humain.
   *
   * @param {string} moisCalendaire - ex: "2026-02"
   * @returns {string|null} ex: "Février 2026"
   */
  export function formaterMoisCalendaire(moisCalendaire) {
    if (!moisCalendaire) return null;
    const [annee, mois] = moisCalendaire.split('-');
    const index = parseInt(mois, 10) - 1;
    if (index < 0 || index > 11) return null;
    return `${NOMS_MOIS[index]} ${annee}`;
  }
  
  /**
   * Génère la liste complète des mois d'une formation, avec label lisible,
   * à partir de la date de démarrage et du nombre de mois.
   *
   * Utile pour afficher à l'étudiant/admin le calendrier complet de paiement
   * (ex: "Mensualité 1 → Février 2026", "Mensualité 2 → Mars 2026"...).
   *
   * @param {Date|string} dateDemarrage
   * @param {number} nombreMois
   * @returns {Array<{numero: number, moisCalendaire: string, label: string}>}
   */
  export function genererMoisFormation(dateDemarrage, nombreMois) {
    const liste = [];
    for (let i = 1; i <= nombreMois; i++) {
      const cle = calculerMoisCalendaire(dateDemarrage, i);
      liste.push({
        numero: i,
        moisCalendaire: cle,
        label: formaterMoisCalendaire(cle)
      });
    }
    return liste;
  }
  
  /**
   * Calcule la date de fin de formation à partir de la date de démarrage
   * et du nombre de mois.
   *
   * @param {Date|string} dateDemarrage
   * @param {number} nombreMois
   * @returns {Date}
   */
  export function calculerDateFinFormation(dateDemarrage, nombreMois) {
    const d = new Date(dateDemarrage);
    d.setMonth(d.getMonth() + parseInt(nombreMois, 10));
    return d;
  }
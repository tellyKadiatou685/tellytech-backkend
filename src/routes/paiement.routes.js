import express from 'express';
import { 
  getDashboardEtudiant,
  demanderPaiement,
  getPaiementsEnAttente,
  getPaiementsValides,
  validerPaiement,
  rejeterPaiement,
  getStatistiquesPaiements,
  telechargerRecu,
  getEtudiantsPaiementsNonPayes,
  envoyerRappelsPaiements,
  getStatistiquesDetailleesParMois,
  getStatistiquesParMois,
  getRevenusParMoisCalendaire, // 🆕
  getDetailsEtudiant,
  getFormationsDisponibles,
  getCohortesDisponibles
} from '../controllers/paiement.controller.js';

const router = express.Router();

// ========================================
// 🎓 ROUTES ÉTUDIANT
// ========================================
router.get('/etudiant/:email/dashboard', getDashboardEtudiant);
router.post('/etudiant/:email/demander', demanderPaiement);
router.get('/etudiant/recu/:paiementId', telechargerRecu); 

// ========================================
// 🔐 ROUTES ADMIN
// ========================================
router.get('/admin/en-attente', getPaiementsEnAttente);
router.get('/admin/valides', getPaiementsValides);
router.post('/admin/valider/:id', validerPaiement);
router.post('/admin/rejeter/:id', rejeterPaiement);
router.get('/admin/stats', getStatistiquesPaiements);
router.get('/admin/stats-detaillees', getStatistiquesDetailleesParMois);   
// Routes admin
router.get('/admin/non-payes', getEtudiantsPaiementsNonPayes);
router.post('/admin/rappels', envoyerRappelsPaiements);

// Avec filtres ?formation=Web%20Development
// 📊 Vue par mois avec filtres (mois RELATIF, ex: "Mois 3" de chaque étudiant)
// GET /api/paiements/admin/stats-mois?formation=Marketing&cohorte=1
router.get('/admin/stats-mois', getStatistiquesParMois);

// 🆕 📊 Vue par MOIS CALENDAIRE réel (ex: "Février 2026"), toutes cohortes
// et dates de démarrage confondues. Répond à "combien j'ai reçu en Février 2026 ?"
// GET /api/paiements/admin/stats-mois-calendaire?formation=Marketing&cohorte=1
router.get('/admin/stats-mois-calendaire', getRevenusParMoisCalendaire);

// 👤 Détails d'un étudiant spécifique
// GET /api/paiements/admin/etudiant/123
router.get('/admin/etudiant/:id', getDetailsEtudiant);

// 📋 Listes de référence pour les filtres
// GET /api/paiements/admin/formations
router.get('/admin/formations', getFormationsDisponibles);

// GET /api/paiements/admin/cohortes?formation=Marketing
router.get('/admin/cohortes', getCohortesDisponibles);

export default router;
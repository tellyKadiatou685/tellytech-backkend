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
  getStatistiquesDetailleesParMois
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

export default router;
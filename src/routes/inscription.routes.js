import express from 'express';
import { 
  inscrireFormation, 
  getInscriptionsPendantes,
  getInscriptionsValidees,
  validerInscription,
  getStatistiques,
  marquerEtudiantInactif,
  reactiverEtudiant
 
} from '../controllers/inscription.controller.js';

const router = express.Router();

// Route publique : inscription client
router.post('/inscrire', inscrireFormation);

// 🔐 Routes ADMIN (à protéger plus tard avec middleware auth)
router.get('/admin/pending', getInscriptionsPendantes);      // Toutes les inscriptions en attente
router.get('/admin/validated', getInscriptionsValidees);     // Toutes les inscriptions validées
router.post('/admin/valider/:id', validerInscription);       // Valider une inscription
router.get('/admin/stats', getStatistiques);      
// ✅ CORRECTION : Enlève le préfixe '/inscriptions' en doublon
router.patch('/:id/marquer-inactif', marquerEtudiantInactif);
router.patch('/:id/reactiver', reactiverEtudiant);         // Stats globales

export default router;
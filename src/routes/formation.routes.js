import express from 'express';
import formationController from '../controllers/formation.controller.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Récupérer toutes les formations
router.get('/', formationController.getAll);

// Récupérer une formation par slug
router.get('/slug/:slug', formationController.getBySlug);

// Récupérer les formations par catégorie
router.get('/categorie/:categorie', formationController.getByCategorie);

// Récupérer une formation par ID
router.get('/:id', formationController.getById);

// Créer une formation
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'brochure', maxCount: 1 }
  ]),
  formationController.create
);

// Mettre à jour une formation
router.put(
  '/:id',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'brochure', maxCount: 1 }
  ]),
  formationController.update
);

// Supprimer une formation
router.delete('/:id', formationController.delete);

export default router;
import express from 'express';
import formationController from '../controllers/formation.controller.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Champs acceptés pour l'upload
const uploadFields = upload.fields([
  { name: 'image',          maxCount: 1  },
  { name: 'brochure',       maxCount: 1  },
  { name: 'imagesCarousel', maxCount: 10 }
]);

// ── PUBLIC ───────────────────────────────────────────────────
router.get('/',                      formationController.getAll);
router.get('/search',                formationController.search);
router.get('/slug/:slug',            formationController.getBySlug);
router.get('/categorie/:categorie',  formationController.getByCategorie);
router.get('/:id',                   formationController.getById);

// ── ADMIN ────────────────────────────────────────────────────
router.post('/',              uploadFields, formationController.create);
router.put('/:id',            uploadFields, formationController.update);
router.patch('/:id/toggle',              formationController.toggleActivation);
router.delete('/:id',                    formationController.delete);

export default router;
import prisma from '../config/database.js';
import courseService from '../services/course.service.js';

class CourseController {

  // ── MODULES ──────────────────────────────────────────────
  async creerModule(req, res) {
    try {
      const { formation, titre, ordre, description, duree, objectifs } = req.body;
      if (!formation || !titre || ordre === undefined) {
        return res.status(400).json({ success: false, message: 'formation, titre et ordre sont obligatoires' });
      }
      const module = await courseService.creerModule({ formation, titre, ordre, description, duree, objectifs });
      res.status(201).json({ success: true, message: 'Module créé', module });
    } catch (error) {
      console.error('❌ creerModule:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async modifierModule(req, res) {
    try {
      const module = await courseService.modifierModule(req.params.id, req.body);
      res.json({ success: true, message: 'Module modifié', module });
    } catch (error) {
      console.error('❌ modifierModule:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async supprimerModule(req, res) {
    try {
      await courseService.supprimerModule(req.params.id);
      res.json({ success: true, message: 'Module supprimé' });
    } catch (error) {
      console.error('❌ supprimerModule:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── LEÇONS ────────────────────────────────────────────────
  async creerLecon(req, res) {
    try {
      const { moduleId, titre, ordre, description, duree, videoUrl, consigneExo, requiresPreviousValidation } = req.body;

      if (!moduleId || !titre || ordre === undefined) {
        return res.status(400).json({ success: false, message: 'moduleId, titre et ordre sont obligatoires' });
      }

      // Récupérer la formation depuis le module
      const module = await prisma.courseModule.findUnique({ where: { id: moduleId } });
      if (!module) {
        return res.status(404).json({ success: false, message: 'Module introuvable' });
      }

      const videoFile = req.files?.video?.[0] || null;
      const pdfFile   = req.files?.pdf?.[0]   || null;

      const lecon = await courseService.creerLecon({
        moduleId, titre, ordre, description, duree,
        videoUrl, consigneExo, requiresPreviousValidation,
        formation: module.formation,
        videoFile,
        pdfFile,
      });

      res.status(201).json({ success: true, message: 'Leçon créée', lecon });
    } catch (error) {
      console.error('❌ creerLecon:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async modifierLecon(req, res) {
    try {
      const videoFile = req.files?.video?.[0] || null;
      const pdfFile   = req.files?.pdf?.[0]   || null;

      const lecon = await courseService.modifierLecon(req.params.id, req.body, videoFile, pdfFile);
      res.json({ success: true, message: 'Leçon modifiée', lecon });
    } catch (error) {
      console.error('❌ modifierLecon:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async supprimerLecon(req, res) {
    try {
      await courseService.supprimerLecon(req.params.id);
      res.json({ success: true, message: 'Leçon supprimée' });
    } catch (error) {
      console.error('❌ supprimerLecon:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── LECTURE ───────────────────────────────────────────────
  async getCoursAvecProgression(req, res) {
    try {
      const { formation } = req.params;
      const inscriptionId = req.user.inscriptionId;

      const modules = await courseService.getCoursAvecProgression(formation, inscriptionId);

      if (!modules.length) {
        return res.status(404).json({ success: false, message: 'Aucun cours trouvé' });
      }

      res.json({ success: true, modules });
    } catch (error) {
      console.error('❌ getCoursAvecProgression:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAllCours(req, res) {
    try {
      const cours = await courseService.getAllCours();
      res.json({ success: true, cours });
    } catch (error) {
      console.error('❌ getAllCours:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new CourseController();
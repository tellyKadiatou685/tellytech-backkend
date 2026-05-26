import prisma from '../config/database.js';
import courseService from '../services/course.service.js';

class CourseController {

  // ── MODULES ──────────────────────────────────────────────
  async creerModule(req, res) {
    try {
      console.log('🔵 [CONTROLLER] creerModule - Body:', req.body);
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
      console.log('🔵 [CONTROLLER] modifierModule - ID:', req.params.id);
      const module = await courseService.modifierModule(req.params.id, req.body);
      res.json({ success: true, message: 'Module modifié', module });
    } catch (error) {
      console.error('❌ modifierModule:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async supprimerModule(req, res) {
    try {
      console.log('🔵 [CONTROLLER] supprimerModule - ID:', req.params.id);
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
      console.log('🔵 [CONTROLLER] creerLecon ==========');
      console.log('📝 req.body:', req.body);
      console.log('📝 req.files:', req.files);
      
      const {
        moduleId, titre, ordre, description, duree,
        videoUrl, consigneExo, requiresPreviousValidation,
      } = req.body;

      if (!moduleId || !titre || ordre === undefined) {
        return res.status(400).json({ success: false, message: 'moduleId, titre et ordre sont obligatoires' });
      }

      const module = await prisma.courseModule.findUnique({ where: { id: moduleId } });
      if (!module) {
        return res.status(404).json({ success: false, message: 'Module introuvable' });
      }

      // ✅ CORRECTION - Utilise les noms exacts envoyés par le frontend
      const videoFile  = req.files?.video?.[0]  || null;
      const pdfFile    = req.files?.pdf?.[0]    || null;
      const pdfExoFile = req.files?.pdfExo?.[0] || null;   // ← "pdfExo" pas "pdfExoFile"
      
      console.log('📁 Fichiers reçus:');
      console.log('  - videoFile:', videoFile?.originalname || 'null');
      console.log('  - pdfFile:', pdfFile?.originalname || 'null');
      console.log('  - pdfExoFile:', pdfExoFile?.originalname || 'null');

      const lecon = await courseService.creerLecon({
        moduleId, titre, ordre, description, duree,
        videoUrl, consigneExo, requiresPreviousValidation,
        formation: module.formation,
        videoFile,
        pdfFile,
        pdfExoFile,
      });

      console.log('✅ Leçon créée, pdfExoUrl:', lecon.pdfExoUrl);
      res.status(201).json({ success: true, message: 'Leçon créée', lecon });
    } catch (error) {
      console.error('❌ creerLecon:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async modifierLecon(req, res) {
    try {
      console.log('🔵 [CONTROLLER] modifierLecon - ID:', req.params.id);
      
      // ✅ CORRECTION - Utilise les noms exacts
      const videoFile  = req.files?.video?.[0]  || null;
      const pdfFile    = req.files?.pdf?.[0]    || null;
      const pdfExoFile = req.files?.pdfExo?.[0] || null;   // ← "pdfExo"

      const lecon = await courseService.modifierLecon(
        req.params.id,
        req.body,
        videoFile,
        pdfFile,
        pdfExoFile,
      );
      
      res.json({ success: true, message: 'Leçon modifiée', lecon });
    } catch (error) {
      console.error('❌ modifierLecon:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async supprimerLecon(req, res) {
    try {
      console.log('🔵 [CONTROLLER] supprimerLecon - ID:', req.params.id);
      await courseService.supprimerLecon(req.params.id);
      res.json({ success: true, message: 'Leçon supprimée' });
    } catch (error) {
      console.error('❌ supprimerLecon:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── SOUMISSIONS ÉTUDIANTS ─────────────────────────────────
  async soumettre(req, res) {
    try {
      console.log('🔵 [CONTROLLER] soumettre ==========');
      console.log('📝 req.body:', req.body);
      console.log('📝 req.file:', req.file);
      
      const { lessonId, link } = req.body;
      const inscriptionId      = req.user.inscriptionId;
      const uploadFile         = req.file || null;

      if (!lessonId) {
        return res.status(400).json({ success: false, message: 'lessonId est obligatoire' });
      }
      if (!link && !uploadFile) {
        return res.status(400).json({ success: false, message: 'Fournir un lien ou un fichier' });
      }

      const lecon = await prisma.courseLesson.findUnique({
        where:   { id: lessonId },
        include: { module: true },
      });
      if (!lecon) {
        return res.status(404).json({ success: false, message: 'Leçon introuvable' });
      }

      const submission = await courseService.soumettreLessonSubmission({
        lessonId,
        inscriptionId,
        link:       link || null,
        uploadFile,
        formation:  lecon.module.formation,
      });

      console.log('✅ Soumission créée');
      res.status(201).json({ success: true, message: 'Devoir soumis', submission });
    } catch (error) {
      console.error('❌ soumettre:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── LECTURE ───────────────────────────────────────────────
  async getCoursAvecProgression(req, res) {
    try {
      console.log('🔵 [CONTROLLER] getCoursAvecProgression ==========');
      const { formation } = req.params;
      const inscriptionId = req.user.inscriptionId;
      
      const modules = await courseService.getCoursAvecProgression(formation, inscriptionId);

      // Vérification des pdfExoUrl
      if (modules && modules.length > 0 && modules[0].lessons && modules[0].lessons.length > 0) {
        console.log('🔍 Vérification pdfExoUrl:', {
          titre: modules[0].lessons[0].titre,
          pdfExoUrl: modules[0].lessons[0].pdfExoUrl
        });
      }

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
import courseService from '../services/course.service.js';
import progressService from '../services/progress.service.js';
import prisma from '../config/database.js';

class CourseController {
  /**
   * 📚 Liste de toutes les formations disponibles (PUBLIC)
   */
  async getAllFormations(req, res) {
    try {
      const formations = await courseService.getAllFormations();

      res.json({
        success: true,
        count: formations.length,
        formations
      });
    } catch (error) {
      console.error('❌ Erreur getAllFormations:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des formations'
      });
    }
  }

  /**
   * 📖 Récupérer mon cours avec progression (ÉTUDIANT)
   */
  async getMyCourse(req, res) {
    try {
      console.log('📚 getMyCourse - req.user:', req.user);
      
      const inscriptionId = req.user.inscriptionId;
      const formation = req.user.formation;

      console.log('📚 Paramètres:', { inscriptionId, formation });

      // ✅ Vérifier si l'étudiant a accès à une formation avec cours JSON
      if (formation !== 'dev-web') {
        return res.status(403).json({
          success: false,
          message: `Le cours pour la formation "${formation}" n'est pas encore disponible.`
        });
      }

      // ✅ CORRECTION: Passer les paramètres dans le bon ordre (formation, inscriptionId)
      const courseWithProgress = await progressService.getCourseWithProgress(
        formation,
        inscriptionId
      );

      if (!courseWithProgress) {
        return res.status(404).json({
          success: false,
          message: 'Cours introuvable.'
        });
      }

      res.json({
        success: true,
        data: courseWithProgress
      });

    } catch (error) {
      console.error('❌ Erreur getMyCourse:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du cours'
      });
    }
  }

  /**
   * 📊 Progression globale de l'étudiant (ÉTUDIANT)
   */
  async getMyProgress(req, res) {
    try {
      const inscriptionId = req.user.inscriptionId;
      const formation = req.user.formation;

      const progress = await progressService.getStudentProgress(
        inscriptionId,
        formation
      );

      if (!progress) {
        return res.status(404).json({
          success: false,
          message: 'Impossible de calculer la progression'
        });
      }

      res.json({
        success: true,
        progress
      });
    } catch (error) {
      console.error('❌ Erreur getMyProgress:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la progression'
      });
    }
  }

  /**
   * 📖 Récupérer une leçon spécifique (ÉTUDIANT)
   */
  async getLesson(req, res) {
    try {
      const { moduleId, lessonId } = req.params;
      const inscriptionId = req.user.inscriptionId;
      const formation = req.user.formation;

      // Vérifier l'accessibilité
      const isAccessible = await progressService.isLessonAccessible(
        formation,
        moduleId,
        lessonId,
        inscriptionId
      );

      if (!isAccessible) {
        return res.status(403).json({
          success: false,
          message: 'Cette leçon est verrouillée. Validez la leçon précédente pour y accéder.',
          locked: true
        });
      }

      // Récupérer la leçon
      const lesson = await courseService.getLesson(formation, moduleId, lessonId);

      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'Leçon non trouvée'
        });
      }

      // Récupérer la soumission si elle existe
      const assignment = await prisma.assignment.findFirst({
        where: {
          lessonId,
          moduleId,
          formation
        }
      });

      let submission = null;
      if (assignment) {
        submission = await prisma.submission.findFirst({
          where: {
            assignmentId: assignment.id,
            inscriptionId
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      res.json({
        success: true,
        lesson: {
          ...lesson,
          submission: submission ? {
            status: submission.status,
            feedback: submission.feedback,
            link: submission.link,
            submittedAt: submission.createdAt
          } : null
        }
      });
    } catch (error) {
      console.error('❌ Erreur getLesson:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la leçon'
      });
    }
  }

  /**
   * 🎯 Prochaine leçon à faire (ÉTUDIANT)
   */
  async getNextLesson(req, res) {
    try {
      const inscriptionId = req.user.inscriptionId;
      const formation = req.user.formation;

      const nextLesson = await progressService.getNextLesson(
        formation,
        inscriptionId
      );

      if (!nextLesson) {
        return res.status(404).json({
          success: false,
          message: 'Impossible de déterminer la prochaine leçon'
        });
      }

      res.json({
        success: true,
        next: nextLesson
      });
    } catch (error) {
      console.error('❌ Erreur getNextLesson:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la prochaine leçon'
      });
    }
  }

  /**
   * 📊 Progression par module (ÉTUDIANT)
   */
  async getModuleProgress(req, res) {
    try {
      const { moduleId } = req.params;
      const inscriptionId = req.user.inscriptionId;
      const formation = req.user.formation;

      const moduleProgress = await progressService.getModuleProgress(
        formation,
        moduleId,
        inscriptionId
      );

      if (!moduleProgress) {
        return res.status(404).json({
          success: false,
          message: 'Module non trouvé'
        });
      }

      res.json({
        success: true,
        progress: moduleProgress
      });
    } catch (error) {
      console.error('❌ Erreur getModuleProgress:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la progression du module'
      });
    }
  }

  /**
   * 📊 Statistiques d'un cours (ADMIN)
   */
  async getCourseStats(req, res) {
    try {
      const { formation } = req.params;

      const stats = await courseService.getCourseStats(formation);

      if (!stats) {
        return res.status(404).json({
          success: false,
          message: 'Formation non trouvée'
        });
      }

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('❌ Erreur getCourseStats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

export default new CourseController();
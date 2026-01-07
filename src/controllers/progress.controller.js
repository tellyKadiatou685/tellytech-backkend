// controllers/progress.controller.js

import prisma from '../config/database.js';

/**
 * 📊 Contrôleur pour la progression des étudiants
 * Version avec partId
 */
class ProgressController {
  
  /**
   * 📊 Récupérer ma progression (avec partId)
   */
  async getMyProgress(req, res) {
    try {
      const inscriptionId = req.user.inscriptionId;
      const formation = req.user.formation;

      console.log('📊 getMyProgress pour:', inscriptionId, formation);

      // Récupérer toutes les soumissions de l'étudiant
      const submissions = await prisma.submission.findMany({
        where: { inscriptionId },
        select: {
          id: true,
          link: true,
          status: true,
          feedback: true,
          createdAt: true,
          updatedAt: true,
          assignment: {
            select: {
              partId: true,      // ✅ AJOUTÉ
              lessonId: true,
              moduleId: true,
              instruction: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Formater les soumissions pour le frontend
      const formattedSubmissions = submissions.map(sub => ({
        id: sub.id,
        partId: sub.assignment?.partId || '',        // ✅ AJOUTÉ
        lessonId: sub.assignment?.lessonId || '',
        moduleId: sub.assignment?.moduleId || '',
        partTitle: sub.assignment?.instruction || '', // ✅ AJOUTÉ
        status: sub.status,
        feedback: sub.feedback,
        link: sub.link,
        submittedAt: sub.createdAt.toISOString(),
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString()
      }));

      // Calculer les statistiques PAR PARTIE
      const completed = submissions.filter(s => s.status === 'APPROVED').length;
      const pending = submissions.filter(s => s.status === 'PENDING').length;
      const rejected = submissions.filter(s => s.status === 'REJECTED').length;

      console.log('✅ Progression calculée:', {
        total: submissions.length,
        completed,
        pending,
        rejected
      });

      res.json({
        success: true,
        data: {
          submissions: formattedSubmissions,
          stats: {
            completed,
            pending,
            rejected,
            total: submissions.length
          }
        }
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
   * 📖 Vérifier l'accessibilité d'une partie
   */
  async checkPartAccess(req, res) {
    try {
      const { partId } = req.params;
      const inscriptionId = req.user.inscriptionId;
      const formation = req.user.formation;

      console.log('🔍 checkPartAccess:', { partId, inscriptionId, formation });

      // Récupérer l'assignment correspondant
      const assignment = await prisma.assignment.findFirst({
        where: {
          partId,
          formation
        }
      });

      if (!assignment) {
        // Pas d'assignment = partie accessible sans restriction
        return res.json({
          success: true,
          part: {
            id: partId,
            accessible: true
          },
          locked: false
        });
      }

      // Récupérer la soumission de l'étudiant pour cette partie
      const submission = await prisma.submission.findFirst({
        where: {
          inscriptionId,
          assignmentId: assignment.id
        },
        orderBy: { createdAt: 'desc' }
      });

      // Si soumission existe, retourner ses infos
      if (submission) {
        return res.json({
          success: true,
          part: {
            id: partId,
            accessible: true,
            submission: {
              id: submission.id,
              status: submission.status,
              feedback: submission.feedback,
              link: submission.link,
              submittedAt: submission.createdAt.toISOString()
            }
          },
          locked: false
        });
      }

      // Pas de soumission = vérifier si accessible via partie précédente
      // TODO: Implémenter la logique de vérification avec partAccessService
      
      res.json({
        success: true,
        part: {
          id: partId,
          accessible: true
        },
        locked: false
      });

    } catch (error) {
      console.error('❌ Erreur checkPartAccess:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification de l\'accessibilité'
      });
    }
  }

  /**
   * 📊 Statistiques globales pour un admin
   */
  async getGlobalStats(req, res) {
    try {
      const { formation, cohorte } = req.query;

      console.log('📊 getGlobalStats:', { formation, cohorte });

      const whereInscription = {};
      if (formation) {
        whereInscription.formation = { contains: formation, mode: 'insensitive' };
      }
      if (cohorte) {
        whereInscription.cohorte = parseInt(cohorte);
      }

      // Compter les soumissions par statut
      const [total, pending, approved, rejected] = await Promise.all([
        prisma.submission.count({
          where: { inscription: whereInscription }
        }),
        prisma.submission.count({
          where: {
            status: 'PENDING',
            inscription: whereInscription
          }
        }),
        prisma.submission.count({
          where: {
            status: 'APPROVED',
            inscription: whereInscription
          }
        }),
        prisma.submission.count({
          where: {
            status: 'REJECTED',
            inscription: whereInscription
          }
        })
      ]);

      // Compter les étudiants actifs
      const activeStudents = await prisma.inscription.count({
        where: {
          ...whereInscription,
          status: 'VALIDATED'
        }
      });

      res.json({
        success: true,
        stats: {
          submissions: {
            total,
            pending,
            approved,
            rejected,
            approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
          },
          students: {
            active: activeStudents
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur getGlobalStats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

export default new ProgressController();
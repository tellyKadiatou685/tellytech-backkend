import prisma from '../config/database.js';
import submissionNotificationService from '../services/submission-notification.service.js';
import partAccessService from '../services/part-access.service.js';

class SubmissionController {
  /**
   * 📤 Étudiant soumet un TD (PARTIE PAR PARTIE)
   */
  async soumettreTD(req, res) {
    try {
      const { partId, lessonId, moduleId, link, partTitle, lessonTitle } = req.body;
      const userEmail = req.user.email;

      console.log('📤 Soumission TD:', { partId, lessonId, moduleId, userEmail });

      // Validation des données
      if (!partId || !lessonId || !moduleId || !link || !partTitle) {
        return res.status(400).json({
          success: false,
          message: 'Tous les champs sont obligatoires (partId, lessonId, moduleId, link, partTitle)'
        });
      }

      // 1️⃣ Récupérer l'inscription
      const inscription = await prisma.inscription.findUnique({
        where: { email: userEmail }
      });

      if (!inscription) {
        return res.status(404).json({
          success: false,
          message: 'Inscription non trouvée'
        });
      }

      console.log('✅ Inscription:', inscription.id);

      // 2️⃣ Vérifier la progression : la partie précédente doit être validée
      const isAccessible = await partAccessService.isPartAccessible(
        partId,
        inscription.id,
        inscription.formation
      );

      if (!isAccessible) {
        return res.status(403).json({
          success: false,
          message: 'Vous devez valider la partie précédente avant de soumettre celle-ci'
        });
      }

      // 3️⃣ Trouver ou créer l'assignment POUR CETTE PARTIE
      let assignment = await prisma.assignment.findFirst({
        where: {
          partId,
          formation: inscription.formation
        }
      });

      if (!assignment) {
        console.log('🆕 Création assignment pour la partie:', partId);
        assignment = await prisma.assignment.create({
          data: {
            partId,
            lessonId,
            moduleId,
            formation: inscription.formation,
            instruction: partTitle
          }
        });
      }

      console.log('✅ Assignment:', assignment.id);

      // 4️⃣ Vérifier si déjà soumis POUR CETTE PARTIE
      const existante = await prisma.submission.findFirst({
        where: {
          assignmentId: assignment.id,
          inscriptionId: inscription.id
        }
      });

      let submission;

      if (existante) {
        if (existante.status === 'APPROVED') {
          return res.status(400).json({
            success: false,
            message: 'Cette partie a déjà été validée'
          });
        }
        
        if (existante.status === 'PENDING') {
          return res.status(400).json({
            success: false,
            message: 'Votre devoir pour cette partie est en cours de correction'
          });
        }
        
        // ✅ Si REJECTED, on UPDATE au lieu de CREATE
        if (existante.status === 'REJECTED') {
          console.log('🔄 Mise à jour de la soumission rejetée:', existante.id);
          
          submission = await prisma.submission.update({
            where: { id: existante.id },
            data: {
              link,
              status: 'PENDING',
              feedback: null, // Reset le feedback
              updatedAt: new Date()
            },
            include: {
              assignment: true,
              inscription: true
            }
          });
        }
      } else {
        // 5️⃣ Créer une nouvelle soumission
        submission = await prisma.submission.create({
          data: {
            assignmentId: assignment.id,
            inscriptionId: inscription.id,
            link,
            status: 'PENDING'
          },
          include: {
            assignment: true,
            inscription: true
          }
        });
      }

      console.log('✅ Soumission créée:', submission.id);

      // 6️⃣ Envoyer les emails
      Promise.all([
        submissionNotificationService.confirmerSoumission(
          inscription, 
          `${lessonTitle} - ${partTitle}`
        ),
        submissionNotificationService.notifierAdminNouveauTD(
          inscription, 
          `${lessonTitle} - ${partTitle}`, 
          link
        )
      ]).catch(error => {
        console.error('❌ Erreur envoi emails:', error);
      });

      res.status(201).json({
        success: true,
        message: 'Devoir soumis avec succès !',
        submission: {
          id: submission.id,
          partId: assignment.partId,
          lessonId: assignment.lessonId,
          moduleId: assignment.moduleId,
          link: submission.link,
          status: submission.status,
          createdAt: submission.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur soumission TD:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la soumission',
        error: error.message
      });
    }
  }

  /**
   * 📋 Récupérer les soumissions d'un étudiant (PAR PARTIE)
   */
  async getMesSoumissions(req, res) {
    try {
      const userEmail = req.user.email;

      const inscription = await prisma.inscription.findUnique({
        where: { email: userEmail }
      });

      if (!inscription) {
        return res.status(404).json({
          success: false,
          message: 'Inscription non trouvée'
        });
      }

      const submissions = await prisma.submission.findMany({
        where: { inscriptionId: inscription.id },
        include: {
          assignment: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Formater les réponses avec partId
      const formatted = submissions.map(sub => ({
        id: sub.id,
        partId: sub.assignment.partId,
        lessonId: sub.assignment.lessonId,
        moduleId: sub.assignment.moduleId,
        partTitle: sub.assignment.instruction,
        link: sub.link,
        status: sub.status,
        coachFeedback: sub.feedback,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt
      }));

      res.json({
        success: true,
        count: formatted.length,
        submissions: formatted
      });

    } catch (error) {
      console.error('❌ Erreur récupération soumissions:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération'
      });
    }
  }

  /**
   * ✅ Admin valide un TD (validation de PARTIE)
   */
  async validerTD(req, res) {
    try {
      const { id } = req.params;
      const { partTitle } = req.body;

      const submission = await prisma.submission.update({
        where: { id: parseInt(id) },
        data: {
          status: 'APPROVED',
          updatedAt: new Date()
        },
        include: {
          inscription: true,
          assignment: true
        }
      });

      // Notifier l'étudiant
      submissionNotificationService.notifierEtudiantValidation(
        submission.inscription,
        partTitle || submission.assignment.instruction
      ).catch(error => {
        console.error('❌ Erreur envoi email validation:', error);
      });

      res.json({
        success: true,
        message: 'Partie validée avec succès',
        submission: {
          id: submission.id,
          partId: submission.assignment.partId,
          status: submission.status
        }
      });

    } catch (error) {
      console.error('❌ Erreur validation TD:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la validation'
      });
    }
  }

  /**
   * ❌ Admin rejette un TD
   */
  async rejeterTD(req, res) {
    try {
      const { id } = req.params;
      const { feedback, partTitle } = req.body;

      if (!feedback || feedback.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Le feedback est obligatoire'
        });
      }

      const submission = await prisma.submission.update({
        where: { id: parseInt(id) },
        data: {
          status: 'REJECTED',
          feedback,
          updatedAt: new Date()
        },
        include: {
          inscription: true,
          assignment: true
        }
      });

      // Notifier l'étudiant
      submissionNotificationService.notifierEtudiantRejet(
        submission.inscription,
        partTitle || submission.assignment.instruction,
        feedback
      ).catch(error => {
        console.error('❌ Erreur envoi email rejet:', error);
      });

      res.json({
        success: true,
        message: 'Partie rejetée avec feedback',
        submission: {
          id: submission.id,
          partId: submission.assignment.partId,
          status: submission.status,
          feedback: submission.feedback
        }
      });

    } catch (error) {
      console.error('❌ Erreur rejet TD:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du rejet'
      });
    }
  }

  /**
   * 📋 Toutes les soumissions (admin)
   */
  async getToutesSoumissions(req, res) {
    try {
      const { status, formation, cohorte } = req.query;

      const where = {};
      if (status) where.status = status;

      const submissions = await prisma.submission.findMany({
        where,
        include: {
          inscription: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              formation: true,
              cohorte: true
            }
          },
          assignment: {
            select: {
              partId: true,
              lessonId: true,
              moduleId: true,
              instruction: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Filtrer
      let filtered = submissions;
      if (formation) {
        filtered = filtered.filter(s => 
          s.inscription.formation.toLowerCase().includes(formation.toLowerCase())
        );
      }
      if (cohorte) {
        filtered = filtered.filter(s => 
          s.inscription.cohorte === parseInt(cohorte)
        );
      }

      // Formater
      const formatted = filtered.map(sub => ({
        id: sub.id,
        partId: sub.assignment.partId,
        lessonId: sub.assignment.lessonId,
        moduleId: sub.assignment.moduleId,
        partTitle: sub.assignment.instruction,
        lessonTitle: sub.assignment.instruction, // Pour compatibilité frontend
        link: sub.link,
        status: sub.status,
        coachFeedback: sub.feedback,
        createdAt: sub.createdAt,
        student: sub.inscription
      }));

      res.json({
        success: true,
        count: formatted.length,
        submissions: formatted
      });

    } catch (error) {
      console.error('❌ Erreur récupération soumissions:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération'
      });
    }
  }

  /**
   * 📊 Statistiques
   */
  async getStatistiquesSoumissions(req, res) {
    try {
      const { formation, cohorte } = req.query;

      const whereInscription = {};
      if (formation) whereInscription.formation = { contains: formation, mode: 'insensitive' };
      if (cohorte) whereInscription.cohorte = parseInt(cohorte);

      const [total, enAttente, validees, rejetees] = await Promise.all([
        prisma.submission.count({ where: { inscription: whereInscription } }),
        prisma.submission.count({ where: { status: 'PENDING', inscription: whereInscription } }),
        prisma.submission.count({ where: { status: 'APPROVED', inscription: whereInscription } }),
        prisma.submission.count({ where: { status: 'REJECTED', inscription: whereInscription } })
      ]);

      res.json({
        success: true,
        stats: {
          total,
          enAttente,
          validees,
          rejetees,
          tauxValidation: total > 0 ? Math.round((validees / total) * 100) : 0
        }
      });

    } catch (error) {
      console.error('❌ Erreur statistiques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

export default new SubmissionController();
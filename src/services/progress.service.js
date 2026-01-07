import prisma from '../config/database.js';
import courseService from './course.service.js';

class ProgressService {
  /**
   * 📊 Calculer la progression globale d'un étudiant
   */
  async getStudentProgress(inscriptionId, formation) {
    try {
      const course = await courseService.getCourseContent(formation);
      if (!course) return null;

      const totalLessons = course.modules.reduce(
        (sum, module) => sum + module.lessons.length, 
        0
      );

      const submissions = await prisma.submission.findMany({
        where: { inscriptionId },
        include: { assignment: true }
      });

      const lessonStatusMap = {};
      submissions.forEach(sub => {
        const lessonId = sub.assignment.lessonId;
        if (lessonId) {
          lessonStatusMap[lessonId] = sub.status;
        }
      });

      let completed = 0;
      let inProgress = 0;
      let locked = 0;

      course.modules.forEach(module => {
        module.lessons.forEach(lesson => {
          const status = lessonStatusMap[lesson.id];
          
          if (status === 'APPROVED') {
            completed++;
          } else if (status === 'PENDING' || status === 'REJECTED') {
            inProgress++;
          } else {
            locked++;
          }
        });
      });

      return {
        totalLessons,
        completed,
        inProgress,
        locked,
        percentage: totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0,
        lastActivity: submissions.length > 0 ? submissions[0].createdAt : null
      };

    } catch (error) {
      console.error('❌ Erreur getStudentProgress:', error);
      return null;
    }
  }

  /**
   * 📋 Récupérer le cours avec progression de l'étudiant
   */
  async getCourseWithProgress(formation, inscriptionId) {
    try {
      console.log('📋 getCourseWithProgress:', { formation, inscriptionId });
      
      const course = await courseService.getCourseContent(formation);
      if (!course) return null;

      // Récupérer toutes les soumissions
      const submissions = await prisma.submission.findMany({
        where: { 
          inscriptionId,
          assignment: { formation }
        },
        include: { assignment: true }
      });

      console.log('📝 Submissions:', submissions.length);

      // Créer un mapping lessonId → submission
      const submissionMap = {};
      submissions.forEach(sub => {
        submissionMap[sub.assignment.lessonId] = sub;
      });

      // Créer un set des leçons approuvées
      const approvedLessons = new Set(
        submissions
          .filter(s => s.status === 'APPROVED')
          .map(s => s.assignment.lessonId)
      );

      console.log('✅ Leçons approuvées:', Array.from(approvedLessons));

      // Enrichir le cours avec la progression
      course.modules.forEach((module, moduleIndex) => {
        module.lessons.forEach((lesson, lessonIndex) => {
          const submission = submissionMap[lesson.id];

          // 🎯 LOGIQUE DE STATUT CORRIGÉE
          let status;

          if (submission) {
            // ✅ Si soumission existe, utiliser son statut
            status = submission.status;
            console.log(`📝 ${lesson.id}: ${status} (soumission trouvée)`);
          } else {
            // ❓ Pas de soumission : déterminer si accessible ou verrouillée
            
            // 1️⃣ Première leçon du premier module → TOUJOURS accessible
            if (moduleIndex === 0 && lessonIndex === 0) {
              status = undefined; // ← PAS DE STATUT = Accessible
              console.log(`🔓 ${lesson.id}: ACCESSIBLE (1ère leçon absolue)`);
            }
            // 2️⃣ Première leçon de chaque module (lessonIndex = 0) → TOUJOURS accessible
            else if (lessonIndex === 0) {
              status = undefined; // ← PAS DE STATUT = Accessible
              console.log(`🔓 ${lesson.id}: ACCESSIBLE (1ère leçon du module)`);
            }
            // 3️⃣ requiresPreviousValidation = false → Accessible
            else if (lesson.requiresPreviousValidation === false) {
              status = undefined; // ← PAS DE STATUT = Accessible
              console.log(`🔓 ${lesson.id}: ACCESSIBLE (pas de validation requise)`);
            }
            // 4️⃣ Vérifier si leçon précédente est approuvée
            else {
              const prevLesson = module.lessons[lessonIndex - 1];
              if (prevLesson && approvedLessons.has(prevLesson.id)) {
                status = undefined; // ← Accessible
                console.log(`🔓 ${lesson.id}: ACCESSIBLE (leçon précédente validée)`);
              } else {
                status = 'LOCKED'; // ← Verrouillée
                console.log(`🔒 ${lesson.id}: LOCKED (leçon précédente non validée)`);
              }
            }
          }

          // Ajouter le progress à la leçon
          lesson.progress = {
            status: status,
            feedback: submission?.feedback,
            link: submission?.link,
            submittedAt: submission?.createdAt
          };

          // 🐛 DEBUG: Afficher le statut final
          console.log(`🎯 ${lesson.id} (${lesson.titre}): status = ${status || 'ACCESSIBLE'}`);
        });
      });

      console.log('✅ Cours enrichi avec progression');
      return course;

    } catch (error) {
      console.error('❌ Erreur getCourseWithProgress:', error);
      throw error;
    }
  }

  /**
   * ✅ Vérifier si une leçon est accessible
   */
  async isLessonAccessible(formation, moduleId, lessonId, inscriptionId) {
    try {
      const course = await courseService.getCourseContent(formation);
      if (!course) return false;

      const module = course.modules.find(m => m.id === moduleId);
      if (!module) return false;

      const lessonIndex = module.lessons.findIndex(l => l.id === lessonId);
      if (lessonIndex === -1) return false;

      const lesson = module.lessons[lessonIndex];

      // Première leçon du module → toujours accessible
      if (lessonIndex === 0) return true;

      // Si pas de validation requise → accessible
      if (lesson.requiresPreviousValidation === false) return true;

      // Vérifier si la leçon précédente est validée
      const prevLesson = module.lessons[lessonIndex - 1];
      if (!prevLesson) return true;

      const prevAssignment = await prisma.assignment.findFirst({
        where: {
          lessonId: prevLesson.id,
          moduleId: moduleId,
          formation
        }
      });

      if (!prevAssignment) return true; // Pas d'assignment = pas de blocage

      const prevSubmission = await prisma.submission.findFirst({
        where: {
          inscriptionId,
          assignmentId: prevAssignment.id,
          status: 'APPROVED'
        }
      });

      return !!prevSubmission;

    } catch (error) {
      console.error('❌ Erreur isLessonAccessible:', error);
      return false;
    }
  }

  /**
   * 📊 Progression par module
   */
  async getModuleProgress(formation, moduleId, inscriptionId) {
    try {
      const module = await courseService.getModule(formation, moduleId);
      if (!module) return null;

      const submissions = await prisma.submission.findMany({
        where: { inscriptionId },
        include: { assignment: true }
      });

      const lessonStatusMap = {};
      submissions.forEach(sub => {
        if (sub.assignment.moduleId === moduleId) {
          lessonStatusMap[sub.assignment.lessonId] = sub.status;
        }
      });

      let completed = 0;
      let inProgress = 0;
      let locked = 0;

      module.lessons.forEach(lesson => {
        const status = lessonStatusMap[lesson.id];
        
        if (status === 'APPROVED') {
          completed++;
        } else if (status === 'PENDING' || status === 'REJECTED') {
          inProgress++;
        } else {
          locked++;
        }
      });

      return {
        moduleId: module.id,
        moduleTitre: module.titre,
        totalLessons: module.lessons.length,
        completed,
        inProgress,
        locked,
        percentage: module.lessons.length > 0 
          ? Math.round((completed / module.lessons.length) * 100) 
          : 0
      };

    } catch (error) {
      console.error('❌ Erreur getModuleProgress:', error);
      return null;
    }
  }

  /**
   * 🎯 Prochaine leçon à faire
   */
  async getNextLesson(formation, inscriptionId) {
    try {
      const course = await courseService.getCourseContent(formation);
      if (!course) return null;

      const submissions = await prisma.submission.findMany({
        where: { inscriptionId },
        include: { assignment: true }
      });

      const approvedLessons = new Set(
        submissions
          .filter(s => s.status === 'APPROVED')
          .map(s => s.assignment.lessonId)
      );

      for (const module of course.modules) {
        for (const lesson of module.lessons) {
          if (!approvedLessons.has(lesson.id)) {
            const isAccessible = await this.isLessonAccessible(
              formation,
              module.id,
              lesson.id,
              inscriptionId
            );

            if (isAccessible) {
              return {
                module: {
                  id: module.id,
                  titre: module.titre
                },
                lesson: {
                  id: lesson.id,
                  titre: lesson.titre,
                  description: lesson.description,
                  ordre: lesson.ordre
                }
              };
            } else {
              return {
                blocked: true,
                message: 'Vous devez valider la leçon précédente'
              };
            }
          }
        }
      }

      return {
        completed: true,
        message: 'Félicitations ! Vous avez terminé toute la formation.'
      };

    } catch (error) {
      console.error('❌ Erreur getNextLesson:', error);
      return null;
    }
  }
}

export default new ProgressService();
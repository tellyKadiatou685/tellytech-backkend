// services/part-access.service.js

import prisma from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PartAccessService {
  
  /**
   * 📚 Charger le cours JSON
   */
  async loadCourse(formation) {
    try {
      const coursePath = path.join(__dirname, '..', 'data', 'courses', `${formation}.json`);
      const courseData = await fs.readFile(coursePath, 'utf-8');
      return JSON.parse(courseData);
    } catch (error) {
      console.error(`❌ Erreur chargement cours ${formation}:`, error);
      return null;
    }
  }

  /**
   * 🔍 Trouver une partie dans le cours et obtenir son contexte
   */
  findPartInCourse(partId, course) {
    for (const [moduleIndex, module] of course.modules.entries()) {
      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        for (const [partIndex, part] of lesson.parts.entries()) {
          if (part.id === partId) {
            return {
              part,
              lesson,
              module,
              partIndex,
              lessonIndex,
              moduleIndex
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * ⬅️ Obtenir la partie précédente dans l'ordre du cours
   */
  getPreviousPart(moduleIndex, lessonIndex, partIndex, course) {
    // Si ce n'est pas la première partie de la leçon
    if (partIndex > 0) {
      const lesson = course.modules[moduleIndex].lessons[lessonIndex];
      return {
        part: lesson.parts[partIndex - 1],
        lesson: lesson,
        module: course.modules[moduleIndex]
      };
    }

    // Si c'est la première partie mais pas la première leçon
    if (lessonIndex > 0) {
      const prevLesson = course.modules[moduleIndex].lessons[lessonIndex - 1];
      const lastPartIndex = prevLesson.parts.length - 1;
      return {
        part: prevLesson.parts[lastPartIndex],
        lesson: prevLesson,
        module: course.modules[moduleIndex]
      };
    }

    // Si c'est la première partie de la première leçon mais pas le premier module
    if (moduleIndex > 0) {
      const prevModule = course.modules[moduleIndex - 1];
      const lastLessonIndex = prevModule.lessons.length - 1;
      const lastLesson = prevModule.lessons[lastLessonIndex];
      const lastPartIndex = lastLesson.parts.length - 1;
      return {
        part: lastLesson.parts[lastPartIndex],
        lesson: lastLesson,
        module: prevModule
      };
    }

    // C'est la toute première partie du cours
    return null;
  }

  /**
   * 🔒 Vérifier si une partie est accessible pour un étudiant
   * Une partie est accessible si :
   * 1. C'est la toute première partie du cours
   * 2. La partie précédente a été APPROVED
   */
  async isPartAccessible(partId, inscriptionId, formation) {
    try {
      console.log(`🔍 Vérification accès partie ${partId} pour inscription ${inscriptionId}`);

      // 1️⃣ Charger le cours
      const course = await this.loadCourse(formation);
      if (!course) {
        console.error('❌ Cours introuvable');
        return false;
      }

      // 2️⃣ Trouver la partie dans le cours
      const context = this.findPartInCourse(partId, course);
      if (!context) {
        console.error('❌ Partie introuvable dans le cours');
        return false;
      }

      const { moduleIndex, lessonIndex, partIndex } = context;
      console.log(`📍 Position: Module ${moduleIndex}, Leçon ${lessonIndex}, Partie ${partIndex}`);

      // 3️⃣ Première partie du cours = toujours accessible
      if (moduleIndex === 0 && lessonIndex === 0 && partIndex === 0) {
        console.log('✅ Première partie du cours - ACCESSIBLE');
        return true;
      }

      // 4️⃣ Obtenir la partie précédente
      const previousContext = this.getPreviousPart(moduleIndex, lessonIndex, partIndex, course);
      if (!previousContext) {
        console.log('✅ Pas de partie précédente - ACCESSIBLE');
        return true;
      }

      console.log(`🔍 Partie précédente: ${previousContext.part.id}`);

      // 5️⃣ Vérifier si la partie précédente est validée
      const previousAssignment = await prisma.assignment.findFirst({
        where: {
          partId: previousContext.part.id,
          formation: formation
        }
      });

      if (!previousAssignment) {
        console.log('⚠️ Pas d\'assignment pour la partie précédente - ACCESSIBLE (pas de blocage)');
        return true;
      }

      const previousSubmission = await prisma.submission.findFirst({
        where: {
          inscriptionId: inscriptionId,
          assignmentId: previousAssignment.id,
          status: 'APPROVED'
        }
      });

      if (previousSubmission) {
        console.log('✅ Partie précédente validée - ACCESSIBLE');
        return true;
      } else {
        console.log('❌ Partie précédente NON validée - BLOQUÉ');
        return false;
      }

    } catch (error) {
      console.error('❌ Erreur isPartAccessible:', error);
      return false;
    }
  }

  /**
   * 📊 Obtenir le statut de toutes les parties pour un étudiant
   */
  async getPartsStatus(inscriptionId, formation) {
    try {
      const course = await this.loadCourse(formation);
      if (!course) return [];

      const partsStatus = [];

      // Récupérer toutes les soumissions de l'étudiant
      const submissions = await prisma.submission.findMany({
        where: { inscriptionId },
        include: { assignment: true }
      });

      // Créer un map partId → submission
      const submissionMap = new Map();
      submissions.forEach(sub => {
        submissionMap.set(sub.assignment.partId, sub);
      });

      // Parcourir toutes les parties
      for (const module of course.modules) {
        for (const lesson of module.lessons) {
          for (const part of lesson.parts) {
            const submission = submissionMap.get(part.id);
            const isAccessible = await this.isPartAccessible(part.id, inscriptionId, formation);

            partsStatus.push({
              partId: part.id,
              lessonId: lesson.id,
              moduleId: module.id,
              partTitle: part.titre,
              status: submission?.status || (isAccessible ? 'ACCESSIBLE' : 'LOCKED'),
              link: submission?.link,
              feedback: submission?.feedback,
              submittedAt: submission?.createdAt
            });
          }
        }
      }

      return partsStatus;

    } catch (error) {
      console.error('❌ Erreur getPartsStatus:', error);
      return [];
    }
  }
}

export default new PartAccessService();
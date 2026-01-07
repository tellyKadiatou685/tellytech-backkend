import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CourseService {
  constructor() {
    this.coursesPath = path.join(__dirname, '../data/courses');
  }

  /**
   * 📖 Charger un cours complet depuis JSON
   */
  async getCourseContent(formation) {
    try {
      const filePath = path.join(this.coursesPath, `${formation}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Erreur chargement cours ${formation}:`, error);
      return null;
    }
  }

  /**
   * 📋 Liste de toutes les formations disponibles
   */
  async getAllFormations() {
    try {
      const files = await fs.readdir(this.coursesPath);
      const formations = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const formationSlug = file.replace('.json', '');
          const course = await this.getCourseContent(formationSlug);
          
          if (course) {
            formations.push({
              slug: course.formation,
              titre: course.titre,
              description: course.description,
              duree: course.duree,
              niveau: course.niveau,
              modulesCount: course.modules.length,
              lessonsCount: course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
            });
          }
        }
      }

      return formations;
    } catch (error) {
      console.error('❌ Erreur getAllFormations:', error);
      return [];
    }
  }

  /**
   * 🔍 Récupérer un module spécifique
   */
  async getModule(formation, moduleId) {
    const course = await this.getCourseContent(formation);
    if (!course) return null;

    return course.modules.find(m => m.id === moduleId);
  }

  /**
   * 📖 Récupérer une leçon spécifique
   */
  async getLesson(formation, moduleId, lessonId) {
    const module = await this.getModule(formation, moduleId);
    if (!module) return null;

    return module.lessons.find(l => l.id === lessonId);
  }

  /**
   * ⬅️ Récupérer la leçon précédente dans le même module
   */
  async getPreviousLesson(formation, moduleId, lessonId) {
    const module = await this.getModule(formation, moduleId);
    if (!module) return null;

    const currentIndex = module.lessons.findIndex(l => l.id === lessonId);
    if (currentIndex <= 0) return null;

    return module.lessons[currentIndex - 1];
  }

  /**
   * ➡️ Récupérer la leçon suivante
   */
  async getNextLesson(formation, moduleId, lessonId) {
    const module = await this.getModule(formation, moduleId);
    if (!module) return null;

    const currentIndex = module.lessons.findIndex(l => l.id === lessonId);
    if (currentIndex === -1 || currentIndex === module.lessons.length - 1) {
      return null;
    }

    return module.lessons[currentIndex + 1];
  }

  /**
   * 📊 Statistiques d'un cours
   */
  async getCourseStats(formation) {
    const course = await this.getCourseContent(formation);
    if (!course) return null;

    const stats = {
      modulesCount: course.modules.length,
      lessonsCount: 0,
      partsCount: 0,
      exercisesCount: 0,
      assignmentsCount: 0
    };

    course.modules.forEach(module => {
      stats.lessonsCount += module.lessons.length;
      
      module.lessons.forEach(lesson => {
        if (lesson.parts) {
          stats.partsCount += lesson.parts.length;
          stats.exercisesCount += lesson.parts.filter(p => p.exercise).length;
        }
        if (lesson.assignment) {
          stats.assignmentsCount++;
        }
      });
    });

    return stats;
  }
}

export default new CourseService();
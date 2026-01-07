import express from 'express';
import CourseController from '../controllers/course.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import adminMiddleware from '../middleware/admin.middleware.js';

const router = express.Router();

/* 🌍 PUBLIC */
router.get('/formations', CourseController.getAllFormations);

/* 🎓 ÉTUDIANT */
router.get('/my-course', authenticate, CourseController.getMyCourse);
router.get('/my-progress', authenticate, CourseController.getMyProgress);
router.get('/next-lesson', authenticate, CourseController.getNextLesson);
router.get(
  '/modules/:moduleId/lessons/:lessonId',
  authenticate,
  CourseController.getLesson
);
router.get(
  '/modules/:moduleId/progress',
  authenticate,
  CourseController.getModuleProgress
);

/* 🛠️ ADMIN */
router.get(
  '/:formation/stats',
  authenticate,
  adminMiddleware,
  CourseController.getCourseStats
);

export default router;

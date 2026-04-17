import prisma from '../config/database.js';
import uploadService from './upload.service.js';

class CourseService {

  // ========================================
  // 📦 MODULES
  // ========================================

  async creerModule({ formation, titre, ordre, description, duree, objectifs }) {
    return prisma.courseModule.create({
      data: {
        formation,
        titre,
        ordre:       parseInt(ordre),
        description: description || '',
        duree:       duree || '',
        objectifs:   Array.isArray(objectifs) ? objectifs : [],
      },
      include: { lessons: { orderBy: { ordre: 'asc' } } }
    });
  }

  async modifierModule(id, data) {
    return prisma.courseModule.update({
      where: { id },
      data: {
        ...(data.titre       && { titre: data.titre }),
        ...(data.ordre       !== undefined && { ordre: parseInt(data.ordre) }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.duree       && { duree: data.duree }),
        ...(data.objectifs   && { objectifs: Array.isArray(data.objectifs) ? data.objectifs : [] }),
      },
      include: { lessons: { orderBy: { ordre: 'asc' } } }
    });
  }

  async supprimerModule(id) {
    const lecons = await prisma.courseLesson.findMany({
      where:  { moduleId: id },
      select: { videoUrl: true, videoType: true, pdfUrl: true }
    });

    await Promise.all(
      lecons.flatMap(l => [
        uploadService.deleteVideo(l.videoUrl),
        uploadService.deletePdf(l.pdfUrl),
      ])
    );

    return prisma.courseModule.delete({ where: { id } });
  }

  async getModulesByFormation(formation) {
    return prisma.courseModule.findMany({
      where:   { formation },
      orderBy: { ordre: 'asc' },
      include: { lessons: { orderBy: { ordre: 'asc' } } }
    });
  }

  // ========================================
  // 📖 LEÇONS
  // ========================================

  async creerLecon({ moduleId, titre, ordre, description, duree,
                     videoUrl, consigneExo, requiresPreviousValidation,
                     videoFile, pdfFile, formation }) {

    // ── Vidéo ──────────────────────────────────────────────────
    let videoData = { type: null, url: null, publicId: null };

    if (videoFile) {
      // Fichier uploadé → Cloudinary
      videoData = await uploadService.uploadVideo(videoFile, formation);
    } else if (videoUrl && videoUrl.trim()) {
      // Lien YouTube → stockage direct
      videoData = await uploadService.uploadVideo(videoUrl.trim(), formation);
    }

    // ── PDF ────────────────────────────────────────────────────
    let pdfData = { url: null, publicId: null };

    if (pdfFile) {
      pdfData = await uploadService.uploadPdf(pdfFile, formation);
    }

    console.log('📹 videoData:', videoData);
    console.log('📄 pdfData:', pdfData);

    return prisma.courseLesson.create({
      data: {
        moduleId,
        titre,
        ordre:         parseInt(ordre),
        description:   description || '',
        duree:         duree || '',
        videoUrl:      videoData.url,
        videoType:     videoData.type,
        videoPublicId: videoData.publicId,
        pdfUrl:        pdfData.url,
        pdfPublicId:   pdfData.publicId,
        consigneExo:   consigneExo || null,
        requiresPreviousValidation:
          requiresPreviousValidation !== false &&
          requiresPreviousValidation !== 'false',
      },
      include: { module: true }
    });
  }

  async modifierLecon(id, data, videoFile, pdfFile) {
    // ✅ Inclure module pour récupérer formation
    const leconActuelle = await prisma.courseLesson.findUnique({
      where:   { id },
      include: { module: true },   // ← bug corrigé ici
    });
    if (!leconActuelle) throw new Error('Leçon introuvable');

    const formation = leconActuelle.module?.formation || 'general';

    // ── Vidéo ──────────────────────────────────────────────────
    let videoUpdate = {};

    if (videoFile) {
      // Nouveau fichier vidéo uploadé
      await uploadService.deleteVideo(leconActuelle.videoUrl);
      const videoData = await uploadService.uploadVideo(videoFile, formation);
      videoUpdate = {
        videoUrl:      videoData.url,
        videoType:     videoData.type,
        videoPublicId: videoData.publicId,
      };
    } else if (data.videoUrl && data.videoUrl.trim()) {
      // Nouveau lien YouTube
      await uploadService.deleteVideo(leconActuelle.videoUrl);
      const videoData = await uploadService.uploadVideo(data.videoUrl.trim(), formation);
      videoUpdate = {
        videoUrl:      videoData.url,
        videoType:     videoData.type,
        videoPublicId: videoData.publicId,
      };
    } else if (data.videoUrl === '') {
      // L'admin a effacé la vidéo
      await uploadService.deleteVideo(leconActuelle.videoUrl);
      videoUpdate = { videoUrl: null, videoType: null, videoPublicId: null };
    }

    // ── PDF ────────────────────────────────────────────────────
    let pdfUpdate = {};

    if (pdfFile) {
      await uploadService.deletePdf(leconActuelle.pdfUrl);
      const pdfData = await uploadService.uploadPdf(pdfFile, formation);
      pdfUpdate = { pdfUrl: pdfData.url, pdfPublicId: pdfData.publicId };
    } else if (data.pdfUrl === '') {
      await uploadService.deletePdf(leconActuelle.pdfUrl);
      pdfUpdate = { pdfUrl: null, pdfPublicId: null };
    }

    return prisma.courseLesson.update({
      where: { id },
      data: {
        ...(data.titre       && { titre: data.titre }),
        ...(data.ordre       !== undefined && { ordre: parseInt(data.ordre) }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.duree       && { duree: data.duree }),
        ...(data.consigneExo !== undefined && { consigneExo: data.consigneExo || null }),
        ...(data.requiresPreviousValidation !== undefined && {
          requiresPreviousValidation:
            data.requiresPreviousValidation !== false &&
            data.requiresPreviousValidation !== 'false',
        }),
        ...videoUpdate,
        ...pdfUpdate,
      },
      include: { module: true }
    });
  }

  async supprimerLecon(id) {
    const lecon = await prisma.courseLesson.findUnique({ where: { id } });
    if (!lecon) throw new Error('Leçon introuvable');

    await Promise.all([
      uploadService.deleteVideo(lecon.videoUrl),
      uploadService.deletePdf(lecon.pdfUrl),
    ]);

    return prisma.courseLesson.delete({ where: { id } });
  }

  // ========================================
  // 📊 COURS AVEC PROGRESSION (étudiant)
  // ========================================

  async getCoursAvecProgression(formation, inscriptionId) {
    const modules = await prisma.courseModule.findMany({
      where:   { formation },
      orderBy: { ordre: 'asc' },
      include: {
        lessons: {
          orderBy: { ordre: 'asc' },
          include: {
            submissions: {
              where:  { inscriptionId },
              select: {
                id: true, status: true, note: true,
                feedback: true, link: true,
                fileUrl: true, fileName: true, createdAt: true,
              }
            }
          }
        }
      }
    });

    return modules.map((module, moduleIndex) => ({
      ...module,
      lessons: module.lessons.map((lecon, leconIndex) => {
        const submission = lecon.submissions[0] || null;
        const accessible = this._isAccessible(modules, moduleIndex, leconIndex);

        return {
          ...lecon,
          submissions: undefined,
          submission,
          accessible,
          status: submission?.status || (accessible ? 'ACCESSIBLE' : 'LOCKED'),
        };
      })
    }));
  }

  _isAccessible(modules, moduleIndex, leconIndex) {
    if (moduleIndex === 0 && leconIndex === 0) return true;

    let prevLecon;
    if (leconIndex > 0) {
      prevLecon = modules[moduleIndex].lessons[leconIndex - 1];
    } else if (moduleIndex > 0) {
      const prevModule = modules[moduleIndex - 1];
      prevLecon = prevModule.lessons[prevModule.lessons.length - 1];
    }

    if (!prevLecon) return true;

    const currentLecon = modules[moduleIndex].lessons[leconIndex];
    if (!currentLecon.requiresPreviousValidation) return true;

    const prevSubmission = prevLecon.submissions?.[0];
    return prevSubmission?.status === 'APPROVED';
  }

  // ========================================
  // 📋 LISTE ADMIN (toutes formations)
  // ========================================

  async getAllCours() {
    return prisma.courseModule.findMany({
      orderBy: [{ formation: 'asc' }, { ordre: 'asc' }],
      include: {
        lessons: {
          orderBy: { ordre: 'asc' },
          include: {
            _count: { select: { submissions: true } }
          }
        }
      }
    });
  }
}

export default new CourseService();
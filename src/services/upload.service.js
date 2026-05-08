import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from '../utils/cloudinary.js';

class UploadService {

  // ========================================
  // 🎬 VIDÉO (fichier buffer ou URL YouTube)
  // ========================================

  isYouTubeUrl(url) {
    return typeof url === 'string' && /youtube\.com|youtu\.be/.test(url);
  }

  async uploadVideo(videoFileOrUrl, formation) {

    // ── YouTube → stockage direct, pas de Cloudinary ──────────
    if (typeof videoFileOrUrl === 'string') {
      const youtubeMatch = videoFileOrUrl.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbedded)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/
      );
      if (youtubeMatch) {
        return { type: 'youtube', url: videoFileOrUrl, publicId: null };
      }
    }

    // ── Fichier vidéo → Cloudinary v2 (upload_stream) ─────────
    try {
      const folder = `tellytech/videos/${formation}`;

      // Récupère le buffer (multer memoryStorage)
      const buffer = videoFileOrUrl.buffer ?? videoFileOrUrl;
      if (!Buffer.isBuffer(buffer)) {
        throw new Error('Fichier vidéo invalide : buffer introuvable.');
      }

      const result = await new Promise((resolve, reject) => {
        // upload_stream = méthode v2 pour streamer un buffer vers Cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder,
            // eager_async évite le timeout "too large to process synchronously"
            eager:       [{ format: 'mp4', quality: 'auto' }],
            eager_async: true,
            chunk_size:  6_000_000, // chunks de 6 Mo — recommandé pour les grandes vidéos
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        Readable.from(buffer).pipe(uploadStream);
      });

      return {
        type:     'cloudinary',
        url:      result.secure_url,
        publicId: result.public_id,
      };

    } catch (err) {
      console.error('❌ Erreur upload Cloudinary vidéo:', err);
      throw err;
    }
  }

  // ========================================
  // 📄 PDF
  // ========================================

  async uploadPdf(file, formation = 'general') {
    const result = await uploadToCloudinary(file.buffer, {
      folder:        `tellytech/pdfs/${formation}`,
      resource_type: 'raw',
      type:          'upload',
    });

    return {
      url:      result.secure_url,
      publicId: result.public_id,
    };
  }

  // ========================================
  // 📎 SOUMISSION ÉTUDIANT (PDF, ZIP, image)
  // ========================================

  async uploadSubmission(file, inscriptionId) {
    const allowedTypes = [
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'image/png',
      'image/jpeg',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Format non supporté. Utilisez PDF, ZIP ou image.');
    }

    const isPdf = file.mimetype === 'application/pdf';

    const result = await uploadToCloudinary(file.buffer, {
      folder:        `tellytech/submissions/${inscriptionId}`,
      resource_type: isPdf ? 'image' : 'raw',
      ...(isPdf && { format: 'pdf' }),
    });

    return {
      url:      result.secure_url,
      publicId: result.public_id,
      fileName: file.originalname,
    };
  }

  // ========================================
  // 🖼️ IMAGE GÉNÉRIQUE
  // ========================================

  async uploadImage(file, folder = 'general') {
    const result = await uploadToCloudinary(file.buffer, {
      folder:        `tellytech/${folder}`,
      resource_type: 'image',
    });

    return {
      url:      result.secure_url,
      publicId: result.public_id,
    };
  }

  // ========================================
  // 🗑️ SUPPRESSION
  // ========================================

  async deleteFile(url, resourceType = 'image') {
    if (!url) return;
    try {
      const publicId = extractPublicId(url);
      if (!publicId) return;
      await deleteFromCloudinary(publicId, resourceType);
    } catch (error) {
      console.error('❌ Erreur suppression Cloudinary:', error.message);
    }
  }

  async deleteVideo(url) {
    if (!url || this.isYouTubeUrl(url)) return;
    await this.deleteFile(url, 'video');
  }

  async deletePdf(url) {
    if (!url) return;
    await this.deleteFile(url, 'raw');
  }
}

export default new UploadService();
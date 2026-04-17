import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from '../utils/cloudinary.js';

class UploadService {

  // ========================================
  // 🎬 VIDÉO (fichier buffer ou URL YouTube)
  // ========================================

  isYouTubeUrl(url) {
    return typeof url === 'string' && /youtube\.com|youtu\.be/.test(url);
  }

  async uploadVideo(file, formation = 'general') {
    // Lien YouTube → stockage direct, pas d'upload Cloudinary
    if (typeof file === 'string' && this.isYouTubeUrl(file)) {
      return { type: 'youtube', url: file, publicId: null };
    }

    // Fichier vidéo → upload Cloudinary
    const result = await uploadToCloudinary(file.buffer, {
      folder:        `tellytech/videos/${formation}`,
      resource_type: 'video',
      transformation: [
        { quality: 'auto:good', fetch_format: 'mp4' },
      ],
    });

    return {
      type:     'cloudinary',
      url:      result.secure_url,   // ✅ result est l'objet complet
      publicId: result.public_id,
      duration: result.duration ?? null,
    };
  }

  // ========================================
  // 📄 PDF
  // ========================================

  async uploadPdf(file, formation = 'general') {
    const result = await uploadToCloudinary(file.buffer, {
      folder:        `tellytech/pdfs/${formation}`,
      resource_type: 'raw',  // ← changer image → raw
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
    await this.deleteFile(url, 'raw'); // ← 'image' → 'raw'
  }
}

export default new UploadService();
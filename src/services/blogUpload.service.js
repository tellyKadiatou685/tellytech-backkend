import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from '../utils/cloudinary.js';

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbedded)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;

class BlogUploadService {

  isYouTubeUrl(url) {
    return typeof url === 'string' && YOUTUBE_REGEX.test(url);
  }

  // ========================================
  // 🖼️ IMAGE DE COUVERTURE / GALERIE ARTICLE
  // ========================================

  async uploadArticleImage(file) {
    const result = await uploadToCloudinary(file.buffer, {
      folder: 'tellytech/blog',
      resource_type: 'image',
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  async uploadArticleGallery(files = []) {
    // Upload en parallèle, cohérent avec les autres méthodes de UploadService
    return Promise.all(files.map((file) => this.uploadArticleImage(file)));
  }

  // ========================================
  // 🎬 VIDÉO ARTICLE (fichier buffer OU lien YouTube)
  // ========================================

  async uploadArticleVideo(videoFileOrUrl) {
    // ── YouTube → on stocke juste le lien, pas d'upload Cloudinary ──
    if (typeof videoFileOrUrl === 'string') {
      if (this.isYouTubeUrl(videoFileOrUrl)) {
        return { type: 'youtube', url: videoFileOrUrl, publicId: null };
      }
      // Autre lien texte (ex: Cloudinary déjà hébergé ailleurs) : on le garde tel quel
      return { type: 'lien', url: videoFileOrUrl, publicId: null };
    }

    // ── Fichier vidéo → Cloudinary (upload_stream via uploadToCloudinary) ──
    const buffer = videoFileOrUrl.buffer ?? videoFileOrUrl;
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Fichier vidéo invalide : buffer introuvable.');
    }

    const result = await uploadToCloudinary(buffer, {
      folder: 'tellytech/blog/videos',
      resource_type: 'video',
      eager: [{ format: 'mp4', quality: 'auto' }],
      eager_async: true,
      chunk_size: 6_000_000,
    });

    return { type: 'cloudinary', url: result.secure_url, publicId: result.public_id };
  }

  // ========================================
  // 🗑️ SUPPRESSION (par URL, comme le reste du projet)
  // ========================================

  async deleteArticleFile(url, resourceType = 'image') {
    if (!url) return;
    try {
      const publicId = extractPublicId(url);
      if (!publicId) return; // ex: lien YouTube, rien à supprimer côté Cloudinary
      await deleteFromCloudinary(publicId, resourceType);
    } catch (error) {
      console.error('❌ Erreur suppression Cloudinary (blog):', error.message);
    }
  }

  async deleteArticleVideo(url) {
    if (!url || this.isYouTubeUrl(url)) return;
    await this.deleteArticleFile(url, 'video');
  }
}

export default new BlogUploadService();

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout:    120000,
});

// ── Compression image ─────────────────────────────────────────
const compressImage = async (buffer) => buffer;

/**
 * Upload un buffer vers Cloudinary.
 * ✅ Retourne l'objet result COMPLET (secure_url, public_id, duration…)
 *
 * @param {Buffer} fileBuffer
 * @param {object} options  — toutes les options Cloudinary (folder, resource_type, format…)
 * @returns {Promise<object>} result Cloudinary complet
 */
export const uploadToCloudinary = async (fileBuffer, options = {}) => {
  const resourceType = options.resource_type || 'auto';
  // ✅ On considère que c'est un PDF si resource_type='raw' OU format='pdf'
  const isPDF = resourceType === 'raw' || options.format === 'pdf';

  let bufferToUpload = fileBuffer;

  // Compression uniquement pour les vraies images (pas PDF, pas raw, pas vidéo)
  if (!isPDF && resourceType === 'image') {
    try {
      bufferToUpload = await compressImage(fileBuffer);
      const before = (fileBuffer.length / 1024).toFixed(0);
      const after  = (bufferToUpload.length / 1024).toFixed(0);
      console.log(`🗜️ Compression image : ${before} Ko → ${after} Ko`);
    } catch (err) {
      console.warn('⚠️ Compression ignorée:', err.message);
      bufferToUpload = fileBuffer;
    }
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        timeout: 120000,
        // Options Cloudinary passées en paramètre
        ...options,
        // ✅ Optimisation auto UNIQUEMENT pour les vraies images (jamais pour les PDF/raw)
        ...(!isPDF && resourceType === 'image' && {
          quality:      'auto:good',
          fetch_format: 'auto',
        }),
      },
      (error, result) => {
        if (error) {
          console.error("❌ Erreur upload Cloudinary:", error);
          return reject(error);
        }
        console.log("✅ Uploadé:", result.secure_url, "| public_id:", result.public_id);
        // ✅ On retourne l'objet COMPLET, pas juste l'URL
        resolve(result);
      }
    );

    uploadStream.end(bufferToUpload);
  });
};

/**
 * Supprimer un fichier de Cloudinary
 */
export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log("🗑️ Supprimé de Cloudinary:", publicId, result);
    return result;
  } catch (error) {
    console.error("❌ Erreur suppression Cloudinary:", error);
    throw error;
  }
};

/**
 * Extraire le public_id depuis une URL Cloudinary
 * Gère les URLs avec ou sans version (v1234567890)
 */
export const extractPublicId = (url) => {
  if (!url) return null;
  try {
    const parts       = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;

    const afterUpload = parts.slice(uploadIndex + 1);
    // Sauter le segment de version s'il existe (ex: v1750000000)
    const startIndex  = afterUpload[0]?.match(/^v\d+$/) ? 1 : 0;
    const pathParts   = afterUpload.slice(startIndex);

    // Retirer l'extension
    return pathParts.join('/').replace(/\.[^/.]+$/, '');
  } catch (error) {
    console.error("❌ Erreur extraction public_id:", error);
    return null;
  }
};

export default { uploadToCloudinary, deleteFromCloudinary, extractPublicId, cloudinary };
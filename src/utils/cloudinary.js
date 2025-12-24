import { v2 as cloudinary } from "cloudinary";

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload un fichier vers Cloudinary depuis un buffer
 * @param {Buffer} fileBuffer - Buffer du fichier (depuis req.file.buffer)
 * @param {string} folder - Dossier dans Cloudinary (ex: 'formations', 'brochures')
 * @param {string} resourceType - Type de ressource ('image', 'raw', 'auto')
 * @returns {Promise<string>} URL sécurisée du fichier uploadé
 */
export const uploadToCloudinary = (fileBuffer, folder = "tellytech", resourceType = "auto") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: resourceType,
        // Optimisation automatique pour les images
        transformation: resourceType === 'image' ? [
          { width: 1500, height: 1500, crop: "limit", quality: "auto" }
        ] : undefined
      },
      (error, result) => {
        if (error) {
          console.error("❌ Erreur upload Cloudinary:", error);
          reject(error);
        } else {
          console.log("✅ Fichier uploadé:", result.secure_url);
          resolve(result.secure_url);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Supprimer un fichier de Cloudinary
 * @param {string} publicId - ID public du fichier (extrait de l'URL)
 * @param {string} resourceType - Type de ressource ('image', 'raw')
 */
export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    console.log("🗑️ Fichier supprimé de Cloudinary:", result);
    return result;
  } catch (error) {
    console.error("❌ Erreur suppression Cloudinary:", error);
    throw error;
  }
};

/**
 * Extraire le public_id d'une URL Cloudinary
 * @param {string} url - URL Cloudinary complète
 * @returns {string} public_id du fichier
 */
export const extractPublicId = (url) => {
  if (!url) return null;
  
  try {
    // Exemple URL: https://res.cloudinary.com/demo/image/upload/v1234567/folder/filename.jpg
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    
    if (uploadIndex === -1) return null;
    
    // Récupérer tout après 'upload/vXXXXXX/'
    const pathParts = parts.slice(uploadIndex + 2);
    const fullPath = pathParts.join('/');
    
    // Retirer l'extension
    return fullPath.replace(/\.[^/.]+$/, '');
  } catch (error) {
    console.error("❌ Erreur extraction public_id:", error);
    return null;
  }
};

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
  cloudinary
};
import multer from "multer";

// Stockage en mémoire : on ne garde jamais le fichier sur disque,
// on le passe directement en buffer à Cloudinary (voir utils/cloudinaryUpload.js)
const storage = multer.memoryStorage();

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

function fileFilter(req, file, cb) {
  if (file.fieldname === "video") {
    if (!VIDEO_TYPES.includes(file.mimetype)) {
      return cb(new Error("Format vidéo non supporté (mp4, webm, mov uniquement)"));
    }
  } else {
    // "image" (couverture) et "medias" (galerie)
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error("Format image non supporté (jpeg, png, webp, gif uniquement)"));
    }
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 Mo max par fichier (large pour vidéo courte)
  },
});

// Champs acceptés sur les routes de création/modification d'article :
// - image  : 1 fichier, image de couverture
// - medias : jusqu'à 3 fichiers, galerie de l'article
// - video  : 1 fichier, vidéo optionnelle (alternative à videoUrl en texte)
export const uploadArticleFiles = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "medias", maxCount: 3 },
  { name: "video", maxCount: 1 },
]);

// Middleware d'erreur Multer, à placer juste après uploadArticleFiles dans les routes
export function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
}

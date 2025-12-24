import multer from 'multer';
import path from 'path';

// ✅ Utiliser memoryStorage au lieu de diskStorage (compatible Vercel)
const storage = multer.memoryStorage();

// Filtrer les types de fichiers
const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const docTypes = /pdf|doc|docx/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  if (file.fieldname === 'image') {
    if (imageTypes.test(extname) && mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images (JPEG, JPG, PNG, GIF, WEBP) sont autorisées'));
    }
  } else if (file.fieldname === 'brochure') {
    if (docTypes.test(extname) || mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF, DOC, DOCX sont autorisés pour les brochures'));
    }
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: fileFilter
});

export default upload;
import express from 'express';
import { login ,logout,verifyToken} from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);

// 🔍 Vérifier si le token est valide (protégé)
router.get('/verify',verifyToken);


export default router;
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

// ========================================
// 🔐 AUTHENTIFICATION
// ========================================

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Utilisateur introuvable' });
    }

    // Pour les étudiants (USER) → on récupère l'inscription
    if (user.role === 'USER') {
      // ✅ findFirst sans filtre status — on fait confiance au token
      const inscription = await prisma.inscription.findFirst({
        where: { email: user.email },
        select: {
          id:        true,
          formation: true,
          cohorte:   true,
          status:    true,
          estActif:  true,
        },
      });

      console.log('🔍 [auth] user.email:', user.email);
      console.log('🔍 [auth] inscription:', inscription);

      req.user = {
        ...user,
        inscriptionId: inscription?.id        ?? null,
        formation:     inscription?.formation  ?? user.formation ?? null,
        cohorte:       inscription?.cohorte    ?? user.cohorte   ?? null,
      };
    } else {
      // ADMIN / COACH → pas besoin d'inscription
      req.user = {
        ...user,
        inscriptionId: null,
      };
    }

    next();
  } catch (err) {
    console.error('❌ [auth] Erreur middleware:', err.message);
    return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

// ========================================
// 🛡️ AUTHORIZE (générique par rôle)
// ========================================

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôle requis : ${roles.join(' ou ')}`,
      });
    }
    next();
  };
};

// ========================================
// 🛡️ RACCOURCIS PRATIQUES
// ========================================

/** ADMIN uniquement */
export const requireAdmin = authorize('ADMIN');

/** ADMIN ou COACH */
export const requireAdminOrCoach = authorize('ADMIN', 'COACH');

/** ADMIN, COACH ou USER */
export const requireAuth = authorize('ADMIN', 'COACH', 'USER');

// Export par défaut pour compatibilité avec l'ancien adminMiddleware
export default requireAdmin;
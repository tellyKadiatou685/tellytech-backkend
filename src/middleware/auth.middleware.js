import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

/* 🔐 AUTH */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({ success: false });
    }

    if (user.role === 'USER') {
      const inscription = await prisma.inscription.findUnique({
        where: { email: user.email }
      });

      req.user = {
        ...user,
        inscriptionId: inscription?.id,
        formation: inscription?.formation
      };
    } else {
      req.user = user;
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false });
  }
};

/* 🛡️ AUTHORIZE */
export const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false });
    }
    next();
  };
};

/* 🛡️ ADMIN */
const adminMiddleware = authorize(['ADMIN']);
export default adminMiddleware;

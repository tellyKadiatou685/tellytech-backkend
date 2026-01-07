import { authorize } from './auth.middleware.js';

/**
 * 🛡️ Middleware ADMIN
 * Autorise uniquement les utilisateurs ayant le rôle ADMIN
 */
const adminMiddleware = authorize(['ADMIN']);

export default adminMiddleware;

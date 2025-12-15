import express from 'express';
import * as messageController from '../controllers/message.controller.js';

const router = express.Router();

// @route   POST /api/messages
// @desc    Envoyer un nouveau message
// @access  Public
router.post('/', messageController.sendMessage);

// @route   GET /api/messages
// @desc    Récupérer tous les messages
// @access  Private (Admin)
router.get('/', messageController.getAllMessages);

// ⚠️ IMPORTANT: Les routes spécifiques AVANT les routes avec paramètres
// @route   GET /api/messages/stats/overview
// @desc    Obtenir les statistiques des messages
// @access  Private (Admin)
router.get('/stats/overview', messageController.getStats);

// @route   POST /api/messages/bulk-delete
// @desc    Supprimer plusieurs messages
// @access  Private (Admin)
router.post('/bulk-delete', messageController.bulkDelete);

// Routes avec paramètres (:id) en dernier
// @route   GET /api/messages/:id
// @desc    Récupérer un message par ID
// @access  Private (Admin)
router.get('/:id', messageController.getMessageById);

// @route   PATCH /api/messages/:id/read
// @desc    Marquer un message comme lu
// @access  Private (Admin)
router.patch('/:id/read', messageController.markAsRead);

// @route   PATCH /api/messages/:id/unread
// @desc    Marquer un message comme non lu
// @access  Private (Admin)
router.patch('/:id/unread', messageController.markAsUnread);

// @route   DELETE /api/messages/:id
// @desc    Supprimer un message
// @access  Private (Admin)
router.delete('/:id', messageController.deleteMessage);

// @route   POST /api/messages/bulk-delete
// @desc    Supprimer plusieurs messages
// @access  Private (Admin)
router.post('/bulk-delete', messageController.bulkDelete);

export default router;


// ============================================
// 3. Ajouter dans votre src/api/index.js existant
// ============================================

/*
import messageRoutes from '../routes/message.routes.js';
router.use('/messages', messageRoutes);
*/
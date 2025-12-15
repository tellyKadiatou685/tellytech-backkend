import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Envoyer un message
export const sendMessage = async (req, res) => {
  try {
    const { prenom, nom, email, telephone, sujet, message } = req.body;

    // Validation des données
    if (!prenom || !nom || !email || !sujet || !message) {
      return res.status(400).json({
        success: false,
        error: 'Tous les champs obligatoires doivent être remplis',
      });
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email invalide',
      });
    }

    // Sauvegarder dans la base de données
    const newMessage = await prisma.message.create({
      data: {
        prenom,
        nom,
        email,
        telephone: telephone || '',
        sujet,
        message,
      },
    });

    // Email à l'administrateur
    const adminMailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.ADMIN_EMAIL,
      subject: `Nouveau message: ${sujet}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Nouveau message reçu</h2>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px;">
            <p><strong>De:</strong> ${prenom} ${nom}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Téléphone:</strong> ${telephone || 'Non fourni'}</p>
            <p><strong>Sujet:</strong> ${sujet}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            Message reçu le ${new Date().toLocaleString('fr-FR')}
          </p>
        </div>
      `,
    };

    // Email de confirmation au client
    const clientMailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Confirmation de réception de votre message',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Merci pour votre message!</h2>
          <p>Bonjour ${prenom} ${nom},</p>
          <p>Nous avons bien reçu votre message concernant: <strong>${sujet}</strong></p>
          <p>Notre équipe vous répondra dans les plus brefs délais.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Récapitulatif de votre message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          <p>Cordialement,<br>L'équipe</p>
        </div>
      `,
    };

    // Envoyer les emails
    await Promise.all([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(clientMailOptions),
    ]);

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès',
      data: {
        id: newMessage.id,
        createdAt: newMessage.createdAt,
      },
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi du message',
    });
  }
};

// Récupérer tous les messages
export const getAllMessages = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des messages',
    });
  }
};

// Récupérer un message par ID
export const getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await prisma.message.findUnique({
      where: { id: parseInt(id) },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message non trouvé',
      });
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du message',
    });
  }
};

// Marquer un message comme lu
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await prisma.message.update({
      where: { id: parseInt(id) },
      data: { lu: true },
    });

    res.json({
      success: true,
      message: 'Message marqué comme lu',
      data: message,
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du message',
    });
  }
};

// Marquer un message comme non lu
export const markAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await prisma.message.update({
      where: { id: parseInt(id) },
      data: { lu: false },
    });

    res.json({
      success: true,
      message: 'Message marqué comme non lu',
      data: message,
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du message',
    });
  }
};

// Supprimer un message
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.message.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'Message supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du message',
    });
  }
};

// Supprimer plusieurs messages
export const bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'IDs invalides',
      });
    }

    await prisma.message.deleteMany({
      where: {
        id: { in: ids.map((id) => parseInt(id)) },
      },
    });

    res.json({
      success: true,
      message: `${ids.length} message(s) supprimé(s)`,
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression des messages',
    });
  }
};

// Obtenir les statistiques
export const getStats = async (req, res) => {
  try {
    const total = await prisma.message.count();
    const nonLus = await prisma.message.count({
      where: { lu: false },
    });
    const lus = await prisma.message.count({
      where: { lu: true },
    });

    // Messages des 7 derniers jours
    const derniersSeptJours = new Date();
    derniersSeptJours.setDate(derniersSeptJours.getDate() - 7);

    const recentMessages = await prisma.message.count({
      where: {
        createdAt: {
          gte: derniersSeptJours,
        },
      },
    });

    res.json({
      success: true,
      data: {
        total,
        nonLus,
        lus,
        derniersSeptJours: recentMessages,
      },
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques',
    });
  }
};
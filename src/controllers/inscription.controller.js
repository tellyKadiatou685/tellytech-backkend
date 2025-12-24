import prisma from '../config/database.js';
import { envoyerEmailAdmin, envoyerEmailValidation } from '../services/email.service.js';
import bcrypt from 'bcryptjs';

// Fonction pour générer un code à 4 chiffres
function genererCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ========================================
// 📌 PARTIE PUBLIQUE (CLIENT)
// ========================================

export const inscrireFormation = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, formation } = req.body;

    if (!nom || !prenom || !email || !telephone || !formation) {
      return res.status(400).json({ 
        message: 'Tous les champs sont obligatoires' 
      });
    }

    const existant = await prisma.inscription.findFirst({
      where: { email }
    });

    if (existant) {
      return res.status(400).json({ 
        message: 'Cet email est déjà inscrit' 
      });
    }

    const code = genererCode();

    // ✅ Créer l'inscription sans les montants (définis à la validation)
    const inscription = await prisma.inscription.create({
      data: {
        nom,
        prenom,
        email,
        telephone,
        formation,
        code,
        status: 'PENDING'
      }
    });

    await envoyerEmailAdmin({
      nomComplet: `${prenom} ${nom}`,
      email,
      telephone,
      formation,
      code,
      inscriptionId: inscription.id
    });

    res.status(201).json({
      success: true,
      message: 'Inscription enregistrée avec succès ! Vous recevrez un email de confirmation après validation.',
      inscriptionId: inscription.id
    });

  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'inscription' 
    });
  }
};

// ========================================
// 📌 PARTIE ADMIN
// ========================================

// 📋 Récupérer toutes les inscriptions EN ATTENTE
export const getInscriptionsPendantes = async (req, res) => {
  try {
    const { formation } = req.query;

    const where = { status: 'PENDING' };
    
    if (formation) {
      where.formation = {
        contains: formation,
        mode: 'insensitive'
      };
    }

    const inscriptions = await prisma.inscription.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      count: inscriptions.length,
      inscriptions
    });

  } catch (error) {
    console.error('❌ Erreur récupération inscriptions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération' 
    });
  }
};

// 📋 Récupérer toutes les inscriptions VALIDÉES
export const getInscriptionsValidees = async (req, res) => {
  try {
    const { formation } = req.query;

    const where = { status: 'VALIDATED' };
    
    if (formation) {
      where.formation = {
        contains: formation,
        mode: 'insensitive'
      };
    }

    const inscriptions = await prisma.inscription.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      count: inscriptions.length,
      inscriptions
    });

  } catch (error) {
    console.error('❌ Erreur récupération inscriptions validées:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération' 
    });
  }
};

// ✅ VALIDER UNE INSCRIPTION - VERSION FINALE (avec montantInscription)
export const validerInscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { montantInscription, nombreMois, mensualite } = req.body;

    const inscription = await prisma.inscription.findUnique({
      where: { id: parseInt(id) }
    });

    if (!inscription) {
      return res.status(404).json({ 
        success: false,
        message: 'Inscription introuvable' 
      });
    }

    if (inscription.status === 'VALIDATED') {
      return res.status(400).json({ 
        success: false,
        message: 'Cette inscription est déjà validée' 
      });
    }

    if (!montantInscription || !nombreMois || !mensualite) {
      return res.status(400).json({
        success: false,
        message: 'Tous les montants sont obligatoires'
      });
    }

    // 🔐 HASHER LE CODE AVANT CRÉATION
    const passwordHash = await bcrypt.hash(inscription.code, 10);

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: inscription.email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un compte existe déjà avec cet email'
      });
    }

    // ✅ Créer le compte avec mot de passe hashé
    await prisma.user.create({
      data: {
        nom: `${inscription.prenom} ${inscription.nom}`,
        email: inscription.email,
        password: passwordHash, // ✅ TOUJOURS HASHÉ
        role: 'USER'
      }
    });

    // ✅ Valider l'inscription
    const inscriptionValidee = await prisma.inscription.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'VALIDATED',
        montantInscription: parseInt(montantInscription),
        nombreMois: parseInt(nombreMois),
        mensualite: parseInt(mensualite)
      }
    });

    // ✅ Envoyer l'email avec le code EN CLAIR
    await envoyerEmailValidation({
      nomComplet: `${inscriptionValidee.prenom} ${inscriptionValidee.nom}`,
      email: inscriptionValidee.email,
      formation: inscriptionValidee.formation,
      code: inscriptionValidee.code, // ⚠️ Code en clair dans l'email
      telephone: inscriptionValidee.telephone,
      montantInscription: inscriptionValidee.montantInscription,
      mensualite: inscriptionValidee.mensualite,
      nombreMois: inscriptionValidee.nombreMois,
      inscriptionId: inscriptionValidee.id
    });

    res.json({
      success: true,
      message: 'Inscription validée avec succès !',
      inscription: inscriptionValidee
    });

  } catch (error) {
    console.error('❌ ERREUR:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la validation' 
    });
  }
};

// 📊 Statistiques globales
export const getStatistiques = async (req, res) => {
  try {
    const totalInscriptions = await prisma.inscription.count();
    const enAttente = await prisma.inscription.count({
      where: { status: 'PENDING' }
    });
    const validees = await prisma.inscription.count({
      where: { status: 'VALIDATED' }
    });

    // Stats par formation
    const parFormation = await prisma.inscription.groupBy({
      by: ['formation'],
      _count: {
        formation: true
      },
      orderBy: {
        _count: {
          formation: 'desc'
        }
      }
    });

    res.json({
      success: true,
      stats: {
        total: totalInscriptions,
        enAttente,
        validees,
        parFormation: parFormation.map(f => ({
          formation: f.formation,
          count: f._count.formation
        }))
      }
    });

  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des statistiques' 
    });
  }
};
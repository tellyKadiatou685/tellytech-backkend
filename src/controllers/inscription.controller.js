import prisma from '../config/database.js';
import { envoyerEmailAdmin, envoyerEmailValidation } from '../services/email.service.js';
import bcrypt from 'bcryptjs';

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

    const inscription = await prisma.inscription.create({
      data: {
        nom,
        prenom,
        email,
        telephone,
        formation,
        code,
        status: 'PENDING',
        estActif: true // Par défaut actif lors de l'inscription
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

// 📋 Récupérer inscriptions EN ATTENTE (avec filtre cohorte)
export const getInscriptionsPendantes = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;

    const where = { status: 'PENDING' };
    
    if (formation) {
      where.formation = {
        contains: formation,
        mode: 'insensitive'
      };
    }

    if (cohorte) {
      where.cohorte = parseInt(cohorte);
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

// 📋 Récupérer inscriptions VALIDÉES (avec filtres)
export const getInscriptionsValidees = async (req, res) => {
  try {
    const { formation, cohorte, statut } = req.query;

    const where = { status: 'VALIDATED' };
    
    if (formation) {
      where.formation = {
        contains: formation,
        mode: 'insensitive'
      };
    }

    if (cohorte) {
      where.cohorte = parseInt(cohorte);
    }

    // 🆕 Filtrer par statut actif/inactif
    if (statut === 'actif') {
      where.estActif = true;
    } else if (statut === 'inactif') {
      where.estActif = false;
    }

    const inscriptions = await prisma.inscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        paiements: {
          where: { status: 'VALIDE' }
        }
      }
    });

    // Enrichir avec infos progression
    const inscriptionsEnrichies = inscriptions.map(ins => ({
      ...ins,
      progression: {
        moisPayes: ins.paiements.length,
        moisRestants: ins.nombreMois - ins.paiements.length,
        pourcentage: ins.nombreMois > 0 
          ? Math.round((ins.paiements.length / ins.nombreMois) * 100) 
          : 0
      }
    }));

    res.json({
      success: true,
      count: inscriptionsEnrichies.length,
      inscriptions: inscriptionsEnrichies
    });

  } catch (error) {
    console.error('❌ Erreur récupération inscriptions validées:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération' 
    });
  }
};

// ✅ VALIDER UNE INSCRIPTION (avec cohorte)
export const validerInscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { montantInscription, nombreMois, mensualite, cohorte } = req.body;

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

    if (!montantInscription || !nombreMois || !mensualite || !cohorte) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs (montant, durée, mensualité, cohorte) sont obligatoires'
      });
    }

    const passwordHash = await bcrypt.hash(inscription.code, 10);

    const existingUser = await prisma.user.findUnique({
      where: { email: inscription.email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un compte existe déjà avec cet email'
      });
    }

    // Créer le compte utilisateur
    await prisma.user.create({
      data: {
        nom: `${inscription.prenom} ${inscription.nom}`,
        email: inscription.email,
        password: passwordHash,
        role: 'USER'
      }
    });

    // 🆕 Calculer la date de fin estimée (début + nombre de mois)
    const dateDebut = new Date();
    const dateFin = new Date(dateDebut);
    dateFin.setMonth(dateFin.getMonth() + parseInt(nombreMois));

    // Valider l'inscription avec cohorte
    const inscriptionValidee = await prisma.inscription.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'VALIDATED',
        montantInscription: parseInt(montantInscription),
        nombreMois: parseInt(nombreMois),
        mensualite: parseInt(mensualite),
        cohorte: parseInt(cohorte),
        estActif: true,
        dateFinFormation: dateFin
      }
    });

    await envoyerEmailValidation({
      nomComplet: `${inscriptionValidee.prenom} ${inscriptionValidee.nom}`,
      email: inscriptionValidee.email,
      formation: inscriptionValidee.formation,
      code: inscriptionValidee.code,
      telephone: inscriptionValidee.telephone,
      montantInscription: inscriptionValidee.montantInscription,
      mensualite: inscriptionValidee.mensualite,
      nombreMois: inscriptionValidee.nombreMois,
      cohorte: inscriptionValidee.cohorte,
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

// 🆕 MARQUER UN ÉTUDIANT COMME INACTIF (formation terminée)
export const marquerEtudiantInactif = async (req, res) => {
  try {
    const { id } = req.params;

    const inscription = await prisma.inscription.findUnique({
      where: { id: parseInt(id) }
    });

    if (!inscription) {
      return res.status(404).json({ 
        success: false,
        message: 'Inscription introuvable' 
      });
    }

    const inscriptionMaj = await prisma.inscription.update({
      where: { id: parseInt(id) },
      data: { 
        estActif: false,
        dateFinFormation: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Étudiant marqué comme inactif (formation terminée)',
      inscription: inscriptionMaj
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la mise à jour' 
    });
  }
};

// 🆕 RÉACTIVER UN ÉTUDIANT
export const reactiverEtudiant = async (req, res) => {
  try {
    const { id } = req.params;

    const inscriptionMaj = await prisma.inscription.update({
      where: { id: parseInt(id) },
      data: { 
        estActif: true,
        dateFinFormation: null
      }
    });

    res.json({
      success: true,
      message: 'Étudiant réactivé',
      inscription: inscriptionMaj
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la réactivation' 
    });
  }
};

// 📊 Statistiques globales (avec distinction actif/inactif)
export const getStatistiques = async (req, res) => {
  try {
    const { cohorte, formation } = req.query;

    // Construire le filtre
    const whereBase = {};
    if (cohorte) whereBase.cohorte = parseInt(cohorte);
    if (formation) whereBase.formation = { contains: formation, mode: 'insensitive' };

    // Total inscriptions
    const totalInscriptions = await prisma.inscription.count({ where: whereBase });
    
    // En attente
    const enAttente = await prisma.inscription.count({
      where: { ...whereBase, status: 'PENDING' }
    });
    
    // Validées
    const validees = await prisma.inscription.count({
      where: { ...whereBase, status: 'VALIDATED' }
    });

    // 🆕 Actifs vs Inactifs
    const actifs = await prisma.inscription.count({
      where: { ...whereBase, status: 'VALIDATED', estActif: true }
    });

    const inactifs = await prisma.inscription.count({
      where: { ...whereBase, status: 'VALIDATED', estActif: false }
    });

    // Stats par formation
    const parFormation = await prisma.inscription.groupBy({
      by: ['formation'],
      where: whereBase,
      _count: { formation: true },
      orderBy: { _count: { formation: 'desc' } }
    });

    // 🆕 Stats par cohorte
    const parCohorte = await prisma.inscription.groupBy({
      by: ['cohorte'],
      where: { ...whereBase, cohorte: { not: null } },
      _count: { cohorte: true },
      orderBy: { cohorte: 'asc' }
    });

    res.json({
      success: true,
      stats: {
        total: totalInscriptions,
        enAttente,
        validees,
        actifs,
        inactifs,
        parFormation: parFormation.map(f => ({
          formation: f.formation,
          count: f._count.formation
        })),
        parCohorte: parCohorte.map(c => ({
          cohorte: c.cohorte,
          count: c._count.cohorte
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
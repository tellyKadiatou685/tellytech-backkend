import prisma from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { 
  envoyerEmailDemandeAdmin, 
  genererRecuMensuelPDF, 
  envoyerEmailPaiementValide,
  envoyerEmailRappelPaiement
} from '../services/paiement-email.service.js';

// ======================================== 
// 📌 PARTIE ÉTUDIANT 
// ======================================== 

// 📊 Dashboard étudiant : voir ses paiements AVEC MONTANTS
export const getDashboardEtudiant = async (req, res) => {
  try {
    const { email } = req.params;
    
    const inscription = await prisma.inscription.findUnique({
      where: { email },
      include: { 
        paiements: { 
          orderBy: { mois: 'asc' } 
        } 
      }
    });

    if (!inscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Inscription introuvable' 
      });
    }

    // ✅ CALCULS DES MONTANTS
    const montantTotal = inscription.mensualite * inscription.nombreMois; // Ex: 50000 × 6 = 300000 FCFA
    
    // Somme des paiements validés
    const montantPaye = inscription.paiements
      .filter(p => p.status === 'VALIDE')
      .reduce((sum, p) => sum + p.montant, 0);
    
    const montantRestant = montantTotal - montantPaye;

    // Stats par statut
    const totalPaiements = inscription.paiements.length;
    const paiementsValides = inscription.paiements.filter(p => p.status === 'VALIDE').length;
    const paiementsEnAttente = inscription.paiements.filter(p => p.status === 'EN_ATTENTE').length;
    const paiementsNonPayes = inscription.nombreMois - totalPaiements;

    const paiementsFormates = inscription.paiements.map(p => ({
      id: p.id,
      mois: p.mois,
      montant: p.montant,
      status: p.status,
      dateValidation: p.dateValidation,
      createdAt: p.createdAt,
      urlTelechargement: p.status === 'VALIDE' 
        ? `${process.env.API_URL || 'http://localhost:8000'}/api/paiements/etudiant/recu/${p.id}` 
        : null
    }));

    res.json({
      success: true,
      etudiant: {
        nom: inscription.nom,
        prenom: inscription.prenom,
        email: inscription.email,
        telephone: inscription.telephone,
        formation: inscription.formation,
        nombreMois: inscription.nombreMois,
        mensualite: inscription.mensualite, // ✅ Ajouté
        montantInscription: inscription.montantInscription || 0 // ✅ Ajouté pour affichage
      },
      statistiques: {
        totalMois: inscription.nombreMois,
        paiementsValides,
        paiementsEnAttente,
        paiementsNonPayes,
        // ✅ NOUVEAUX CHAMPS MONTANTS
        montantTotal,        // Ex: 300 000 FCFA
        montantPaye,         // Ex: 150 000 FCFA
        montantRestant       // Ex: 150 000 FCFA
      },
      paiements: paiementsFormates
    });

  } catch (error) {
    console.error('❌ Erreur dashboard étudiant:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération du dashboard' 
    });
  }
};

// 💰 Demander un paiement pour un mois
export const demanderPaiement = async (req, res) => {
  try {
    const { email } = req.params;
    const { mois, montant } = req.body;

    if (!mois || !montant) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le mois et le montant sont obligatoires' 
      });
    }

    const inscription = await prisma.inscription.findUnique({
      where: { email },
      include: { paiements: true }
    });

    if (!inscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Inscription introuvable' 
      });
    }

    const paiementExistant = inscription.paiements.find(p => p.mois === parseInt(mois));
    if (paiementExistant) {
      return res.status(400).json({ 
        success: false, 
        message: `Le mois ${mois} est déjà ${paiementExistant.status === 'VALIDE' ? 'payé' : 'en attente de validation'}` 
      });
    }

    const paiement = await prisma.paiement.create({
      data: {
        inscriptionId: inscription.id,
        mois: parseInt(mois),
        montant: parseInt(montant),
        status: 'EN_ATTENTE'
      }
    });

    await envoyerEmailDemandeAdmin({
      nomComplet: `${inscription.prenom} ${inscription.nom}`,
      email: inscription.email,
      formation: inscription.formation,
      mois: parseInt(mois),
      montant: parseInt(montant),
      paiementId: paiement.id
    });

    res.status(201).json({ 
      success: true, 
      message: 'Demande de paiement enregistrée ! Vous recevrez une confirmation après validation.', 
      paiement 
    });

  } catch (error) {
    console.error('❌ Erreur demande paiement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la demande de paiement' 
    });
  }
};

// 📥 Télécharger un reçu PDF
export const telechargerRecu = async (req, res) => {
  try {
    const { paiementId } = req.params;

    const paiement = await prisma.paiement.findUnique({
      where: { id: parseInt(paiementId) },
      include: { inscription: true }
    });

    if (!paiement) {
      return res.status(404).json({ 
        success: false, 
        message: 'Paiement introuvable' 
      });
    }

    if (paiement.status !== 'VALIDE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce paiement n\'est pas encore validé' 
      });
    }

    if (!paiement.recuUrl || !fs.existsSync(paiement.recuUrl)) {
      console.log('⚠️ PDF introuvable, régénération...');
      
      const nouveauRecuPath = await genererRecuMensuelPDF({
        nomComplet: `${paiement.inscription.prenom} ${paiement.inscription.nom}`,
        email: paiement.inscription.email,
        telephone: paiement.inscription.telephone,
        formation: paiement.inscription.formation,
        mois: paiement.mois,
        montant: paiement.montant,
        paiementId: paiement.id,
        dateValidation: paiement.dateValidation || new Date()
      });

      await prisma.paiement.update({
        where: { id: parseInt(paiementId) },
        data: { recuUrl: nouveauRecuPath }
      });

      return res.download(nouveauRecuPath, `Recu_Mois${paiement.mois}_TellyTech.pdf`, (err) => {
        if (err) {
          console.error('❌ Erreur téléchargement:', err);
          res.status(500).json({ success: false, message: 'Erreur lors du téléchargement' });
        }
      });
    }

    res.download(paiement.recuUrl, `Recu_Mois${paiement.mois}_TellyTech.pdf`, (err) => {
      if (err) {
        console.error('❌ Erreur téléchargement:', err);
        res.status(500).json({ success: false, message: 'Erreur lors du téléchargement' });
      }
    });

  } catch (error) {
    console.error('❌ Erreur téléchargement reçu:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du téléchargement' 
    });
  }
};

// ======================================== 
// 📌 PARTIE ADMIN 
// ======================================== 

// 📋 Récupérer tous les paiements en attente
export const getPaiementsEnAttente = async (req, res) => {
  try {
    const { formation } = req.query;

    const where = { status: 'EN_ATTENTE' };
    if (formation) {
      where.inscription = { formation };
    }

    const paiements = await prisma.paiement.findMany({
      where,
      include: { inscription: true },
      orderBy: { createdAt: 'desc' }
    });

    const paiementsFormates = paiements.map(p => ({
      id: p.id,
      etudiant: `${p.inscription.prenom} ${p.inscription.nom}`,
      email: p.inscription.email,
      telephone: p.inscription.telephone,
      formation: p.inscription.formation,
      mois: p.mois,
      montant: p.montant,
      dateDemande: p.createdAt
    }));

    res.json({ 
      success: true, 
      count: paiementsFormates.length, 
      paiements: paiementsFormates 
    });

  } catch (error) {
    console.error('❌ Erreur récupération paiements:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération' 
    });
  }
};

// 📋 Récupérer tous les paiements validés
export const getPaiementsValides = async (req, res) => {
  try {
    const { formation } = req.query;

    const where = { status: 'VALIDE' };
    if (formation) {
      where.inscription = { formation };
    }

    const paiements = await prisma.paiement.findMany({
      where,
      include: { inscription: true },
      orderBy: { dateValidation: 'desc' }
    });

    const paiementsFormates = paiements.map(p => ({
      id: p.id,
      etudiant: `${p.inscription.prenom} ${p.inscription.nom}`,
      email: p.inscription.email,
      formation: p.inscription.formation,
      mois: p.mois,
      montant: p.montant,
      dateValidation: p.dateValidation
    }));

    res.json({ 
      success: true, 
      count: paiementsFormates.length, 
      paiements: paiementsFormates 
    });

  } catch (error) {
    console.error('❌ Erreur récupération paiements validés:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération' 
    });
  }
};

// 🆕 Récupérer les étudiants avec paiements non effectués
export const getEtudiantsPaiementsNonPayes = async (req, res) => {
  try {
    const { formation } = req.query;

    const where = { status: 'VALIDATED' };
    if (formation) {
      where.formation = formation;
    }

    const inscriptions = await prisma.inscription.findMany({
      where,
      include: { 
        paiements: {
          where: { status: 'VALIDE' }
        }
      }
    });

    const etudiantsAvecRetard = inscriptions
      .map(inscription => {
        const moisPayes = inscription.paiements.length;
        const moisNonPayes = inscription.nombreMois - moisPayes;
        
        if (moisNonPayes > 0) {
          const moisPayesListe = inscription.paiements.map(p => p.mois);
          const moisManquants = [];
          for (let i = 1; i <= inscription.nombreMois; i++) {
            if (!moisPayesListe.includes(i)) {
              moisManquants.push(i);
            }
          }

          return {
            id: inscription.id,
            etudiant: `${inscription.prenom} ${inscription.nom}`,
            email: inscription.email,
            telephone: inscription.telephone,
            formation: inscription.formation,
            nombreMoisTotal: inscription.nombreMois,
            moisPayes,
            moisNonPayes,
            moisManquants,
            dateInscription: inscription.createdAt
          };
        }
        return null;
      })
      .filter(e => e !== null);

    res.json({
      success: true,
      count: etudiantsAvecRetard.length,
      etudiants: etudiantsAvecRetard
    });

  } catch (error) {
    console.error('❌ Erreur récupération étudiants non payés:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération' 
    });
  }
};

// 🆕 Envoyer des rappels de paiement
export const envoyerRappelsPaiements = async (req, res) => {
  try {
    const { formation } = req.query;

    const where = { status: 'VALIDATED' };
    if (formation) {
      where.formation = formation;
    }

    const inscriptions = await prisma.inscription.findMany({
      where,
      include: { 
        paiements: {
          where: { status: 'VALIDE' }
        }
      }
    });

    const rappelsEnvoyes = [];
    const erreursEnvoi = [];

    for (const inscription of inscriptions) {
      const moisPayes = inscription.paiements.length;
      const moisNonPayes = inscription.nombreMois - moisPayes;

      if (moisNonPayes > 0) {
        const moisPayesListe = inscription.paiements.map(p => p.mois);
        const moisManquants = [];
        for (let i = 1; i <= inscription.nombreMois; i++) {
          if (!moisPayesListe.includes(i)) {
            moisManquants.push(i);
          }
        }

        try {
          await envoyerEmailRappelPaiement({
            nomComplet: `${inscription.prenom} ${inscription.nom}`,
            email: inscription.email,
            formation: inscription.formation,
            moisManquants,
            montantMensuel: inscription.mensualite // ✅ Utiliser le montant réel
          });

          rappelsEnvoyes.push({
            email: inscription.email,
            nom: `${inscription.prenom} ${inscription.nom}`,
            moisManquants
          });
        } catch (error) {
          console.error(`❌ Erreur envoi rappel pour ${inscription.email}:`, error);
          erreursEnvoi.push({
            email: inscription.email,
            erreur: error.message
          });
        }
      }
    }

    res.json({
      success: true,
      message: `${rappelsEnvoyes.length} rappel(s) envoyé(s) avec succès`,
      rappelsEnvoyes,
      erreursEnvoi: erreursEnvoi.length > 0 ? erreursEnvoi : undefined
    });

  } catch (error) {
    console.error('❌ Erreur envoi rappels:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'envoi des rappels' 
    });
  }
};
// À ajouter dans paiement.controller.js

// 📊 Statistiques détaillées par mois et formation
export const getStatistiquesDetailleesParMois = async (req, res) => {
  try {
    const { formation, mois } = req.query;

    // Récupérer toutes les inscriptions validées
    const whereInscription = { status: 'VALIDATED' };
    if (formation) {
      whereInscription.formation = formation;
    }

    const inscriptions = await prisma.inscription.findMany({
      where: whereInscription,
      include: {
        paiements: {
          where: { status: 'VALIDE' }
        }
      }
    });

    // Grouper par formation
    const statsParFormation = {};

    for (const inscription of inscriptions) {
      const formationNom = inscription.formation;
      
      if (!statsParFormation[formationNom]) {
        statsParFormation[formationNom] = {
          formation: formationNom,
          etudiants: [],
          totalEtudiants: 0,
          revenus: 0,
        };
      }

      // Ajouter l'étudiant
      const etudiantInfo = {
        id: inscription.id,
        nom: `${inscription.prenom} ${inscription.nom}`,
        email: inscription.email,
        nombreMois: inscription.nombreMois,
        mensualite: inscription.mensualite,
        paiementsValides: inscription.paiements.map(p => p.mois),
      };

      statsParFormation[formationNom].etudiants.push(etudiantInfo);
      statsParFormation[formationNom].totalEtudiants++;

      // Calculer les revenus
      const revenusEtudiant = inscription.paiements.reduce((sum, p) => sum + p.montant, 0);
      statsParFormation[formationNom].revenus += revenusEtudiant;
    }

    // Si un mois spécifique est demandé, calculer les stats pour ce mois
    if (mois) {
      const moisNum = parseInt(mois);
      
      for (const formationNom in statsParFormation) {
        const formation = statsParFormation[formationNom];
        
        let etudiantsDoiventPayer = 0;
        let etudiantsOntPaye = 0;
        let etudiantsNonPaye = 0;

        for (const etudiant of formation.etudiants) {
          // Vérifier si l'étudiant doit payer ce mois
          if (etudiant.nombreMois >= moisNum) {
            etudiantsDoiventPayer++;
            
            // Vérifier si l'étudiant a payé ce mois
            if (etudiant.paiementsValides.includes(moisNum)) {
              etudiantsOntPaye++;
            } else {
              etudiantsNonPaye++;
            }
          }
        }

        formation.mois = moisNum;
        formation.etudiantsDoiventPayer = etudiantsDoiventPayer;
        formation.etudiantsOntPaye = etudiantsOntPaye;
        formation.etudiantsNonPaye = etudiantsNonPaye;
        formation.tauxPaiement = etudiantsDoiventPayer > 0 
          ? ((etudiantsOntPaye / etudiantsDoiventPayer) * 100).toFixed(2) + '%'
          : '0%';
      }
    } else {
      // Stats globales (tous les mois)
      for (const formationNom in statsParFormation) {
        const formation = statsParFormation[formationNom];
        
        let totalMoisAttendus = 0;
        let totalMoisPayes = 0;

        for (const etudiant of formation.etudiants) {
          totalMoisAttendus += etudiant.nombreMois;
          totalMoisPayes += etudiant.paiementsValides.length;
        }

        formation.moisAttendus = totalMoisAttendus;
        formation.moisPayes = totalMoisPayes;
        formation.moisNonPayes = totalMoisAttendus - totalMoisPayes;
        formation.tauxPaiement = totalMoisAttendus > 0 
          ? ((totalMoisPayes / totalMoisAttendus) * 100).toFixed(2) + '%'
          : '0%';
      }
    }

    // Convertir en tableau
    const statsArray = Object.values(statsParFormation);

    res.json({
      success: true,
      stats: statsArray,
      filtreMois: mois ? parseInt(mois) : null,
      filtreFormation: formation || null
    });

  } catch (error) {
    console.error('❌ Erreur stats détaillées:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des statistiques détaillées' 
    });
  }
};

// ✅ Valider un paiement
export const validerPaiement = async (req, res) => {
  try {
    const { id } = req.params;

    const paiement = await prisma.paiement.findUnique({
      where: { id: parseInt(id) },
      include: { inscription: true }
    });

    if (!paiement) {
      return res.status(404).json({ 
        success: false, 
        message: 'Paiement introuvable' 
      });
    }

    if (paiement.status === 'VALIDE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce paiement est déjà validé' 
      });
    }

    const recuPath = await genererRecuMensuelPDF({
      nomComplet: `${paiement.inscription.prenom} ${paiement.inscription.nom}`,
      email: paiement.inscription.email,
      telephone: paiement.inscription.telephone,
      formation: paiement.inscription.formation,
      mois: paiement.mois,
      montant: paiement.montant,
      paiementId: paiement.id,
      dateValidation: new Date()
    });

    const paiementValide = await prisma.paiement.update({
      where: { id: parseInt(id) },
      data: {
        status: 'VALIDE',
        dateValidation: new Date(),
        recuUrl: recuPath
      }
    });

    await envoyerEmailPaiementValide({
      nomComplet: `${paiement.inscription.prenom} ${paiement.inscription.nom}`,
      email: paiement.inscription.email,
      telephone: paiement.inscription.telephone,
      formation: paiement.inscription.formation,
      mois: paiement.mois,
      montant: paiement.montant,
      paiementId: paiement.id,
      recuPath
    });

    res.json({ 
      success: true, 
      message: 'Paiement validé avec succès ! Email envoyé à l\'étudiant.', 
      paiement: paiementValide 
    });

  } catch (error) {
    console.error('❌ Erreur validation paiement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la validation' 
    });
  }
};

// ❌ Rejeter un paiement
export const rejeterPaiement = async (req, res) => {
  try {
    const { id } = req.params;

    const paiement = await prisma.paiement.findUnique({
      where: { id: parseInt(id) }
    });

    if (!paiement) {
      return res.status(404).json({ 
        success: false, 
        message: 'Paiement introuvable' 
      });
    }

    const paiementRejete = await prisma.paiement.update({
      where: { id: parseInt(id) },
      data: { status: 'REJETE' }
    });

    res.json({ 
      success: true, 
      message: 'Paiement rejeté', 
      paiement: paiementRejete 
    });

  } catch (error) {
    console.error('❌ Erreur rejet paiement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du rejet' 
    });
  }
};

// 📊 Statistiques globales
export const getStatistiquesPaiements = async (req, res) => {
  try {
    const { formation } = req.query;

    const where = formation ? { inscription: { formation } } : {};

    const totalPaiements = await prisma.paiement.count({ where });
    const enAttente = await prisma.paiement.count({ 
      where: { ...where, status: 'EN_ATTENTE' } 
    });
    const valides = await prisma.paiement.count({ 
      where: { ...where, status: 'VALIDE' } 
    });
    const rejetes = await prisma.paiement.count({ 
      where: { ...where, status: 'REJETE' } 
    });

    const revenus = await prisma.paiement.aggregate({
      where: { ...where, status: 'VALIDE' },
      _sum: { montant: true }
    });

    const whereInscription = formation 
      ? { formation, status: 'VALIDATED' }
      : { status: 'VALIDATED' };
    
    const statsParFormation = await prisma.inscription.groupBy({
      by: ['formation'],
      where: whereInscription,
      _count: { id: true },
      _sum: { nombreMois: true }
    });

    const formationsDetails = await Promise.all(
      statsParFormation.map(async (stat) => {
        const paiementsFormation = await prisma.paiement.count({
          where: {
            status: 'VALIDE',
            inscription: { formation: stat.formation }
          }
        });

        const revenusFormation = await prisma.paiement.aggregate({
          where: {
            status: 'VALIDE',
            inscription: { formation: stat.formation }
          },
          _sum: { montant: true }
        });

        const moisAttendus = stat._sum.nombreMois || 0;
        const moisPayes = paiementsFormation;
        const moisNonPayes = moisAttendus - moisPayes;

        return {
          formation: stat.formation,
          nombreEtudiants: stat._count.id,
          moisAttendus,
          moisPayes,
          moisNonPayes,
          tauxPaiement: moisAttendus > 0 
            ? ((moisPayes / moisAttendus) * 100).toFixed(2) + '%'
            : '0%',
          revenus: revenusFormation._sum.montant || 0
        };
      })
    );

    res.json({
      success: true,
      stats: {
        total: totalPaiements,
        enAttente,
        valides,
        rejetes,
        revenus: revenus._sum.montant || 0
      },
      statsParFormation: formationsDetails
    });

  } catch (error) {
    console.error('❌ Erreur stats paiements:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des statistiques' 
    });
  }
};
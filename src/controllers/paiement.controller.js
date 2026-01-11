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

    const montantTotal = inscription.mensualite * inscription.nombreMois;
    
    const montantPaye = inscription.paiements
      .filter(p => p.status === 'VALIDE')
      .reduce((sum, p) => sum + p.montant, 0);
    
    const montantRestant = montantTotal - montantPaye;

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
        cohorte: inscription.cohorte,
        nombreMois: inscription.nombreMois,
        mensualite: inscription.mensualite,
        montantInscription: inscription.montantInscription || 0,
        estActif: inscription.estActif,
        dateFinFormation: inscription.dateFinFormation
      },
      statistiques: {
        totalMois: inscription.nombreMois,
        paiementsValides,
        paiementsEnAttente,
        paiementsNonPayes,
        montantTotal,
        montantPaye,
        montantRestant
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

// ✅ MODIFIÉ : Téléchargement du reçu en Buffer
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

    // ✅ Générer le PDF en Buffer (pas de fichier sur disque)
    console.log('⚙️ Génération du PDF en mémoire...');
    
    const pdfBuffer = await genererRecuMensuelPDF({
      nomComplet: `${paiement.inscription.prenom} ${paiement.inscription.nom}`,
      email: paiement.inscription.email,
      telephone: paiement.inscription.telephone,
      formation: paiement.inscription.formation,
      mois: paiement.mois,
      montant: paiement.montant,
      paiementId: paiement.id,
      dateValidation: paiement.dateValidation || new Date()
    });

    // ✅ Envoyer le Buffer directement au client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Recu_Mois${paiement.mois}_TellyTech.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.send(pdfBuffer);
    
    console.log('✅ PDF envoyé avec succès');

  } catch (error) {
    console.error('❌ Erreur téléchargement reçu:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du téléchargement du reçu',
      error: error.message 
    });
  }
};

// ======================================== 
// 📌 PARTIE ADMIN (avec filtres cohorte)
// ======================================== 

export const getPaiementsEnAttente = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;

    const where = { status: 'EN_ATTENTE' };
    const inscriptionWhere = {};
    
    if (formation) inscriptionWhere.formation = formation;
    if (cohorte) inscriptionWhere.cohorte = parseInt(cohorte);
    
    if (Object.keys(inscriptionWhere).length > 0) {
      where.inscription = inscriptionWhere;
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
      cohorte: p.inscription.cohorte,
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

export const getPaiementsValides = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;

    const where = { status: 'VALIDE' };
    const inscriptionWhere = {};
    
    if (formation) inscriptionWhere.formation = formation;
    if (cohorte) inscriptionWhere.cohorte = parseInt(cohorte);
    
    if (Object.keys(inscriptionWhere).length > 0) {
      where.inscription = inscriptionWhere;
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
      cohorte: p.inscription.cohorte,
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

export const getEtudiantsPaiementsNonPayes = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;

    const where = { 
      status: 'VALIDATED',
      estActif: true
    };
    
    if (formation) where.formation = formation;
    if (cohorte) where.cohorte = parseInt(cohorte);

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
            cohorte: inscription.cohorte,
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

export const envoyerRappelsPaiements = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;

    const where = { 
      status: 'VALIDATED',
      estActif: true
    };
    
    if (formation) where.formation = formation;
    if (cohorte) where.cohorte = parseInt(cohorte);

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
            montantMensuel: inscription.mensualite
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

export const getStatistiquesDetailleesParMois = async (req, res) => {
  try {
    const { formation, mois, cohorte } = req.query;

    const whereInscription = { 
      status: 'VALIDATED',
      estActif: true
    };
    
    if (formation) whereInscription.formation = formation;
    if (cohorte) whereInscription.cohorte = parseInt(cohorte);

    const inscriptions = await prisma.inscription.findMany({
      where: whereInscription,
      include: {
        paiements: {
          where: { status: 'VALIDE' }
        }
      }
    });

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

      const etudiantInfo = {
        id: inscription.id,
        nom: `${inscription.prenom} ${inscription.nom}`,
        email: inscription.email,
        cohorte: inscription.cohorte,
        nombreMois: inscription.nombreMois,
        mensualite: inscription.mensualite,
        paiementsValides: inscription.paiements.map(p => p.mois),
      };

      statsParFormation[formationNom].etudiants.push(etudiantInfo);
      statsParFormation[formationNom].totalEtudiants++;

      const revenusEtudiant = inscription.paiements.reduce((sum, p) => sum + p.montant, 0);
      statsParFormation[formationNom].revenus += revenusEtudiant;
    }

    if (mois) {
      const moisNum = parseInt(mois);
      
      for (const formationNom in statsParFormation) {
        const formation = statsParFormation[formationNom];
        
        let etudiantsDoiventPayer = 0;
        let etudiantsOntPaye = 0;
        let etudiantsNonPaye = 0;

        for (const etudiant of formation.etudiants) {
          if (etudiant.nombreMois >= moisNum) {
            etudiantsDoiventPayer++;
            
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

    const statsArray = Object.values(statsParFormation);

    res.json({
      success: true,
      stats: statsArray,
      filtreMois: mois ? parseInt(mois) : null,
      filtreFormation: formation || null,
      filtreCohorte: cohorte ? parseInt(cohorte) : null
    });

  } catch (error) {
    console.error('❌ Erreur stats détaillées:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des statistiques détaillées' 
    });
  }
};

// ✅ MODIFIÉ : Validation avec Buffer pour l'email
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

    // ✅ Générer le PDF en Buffer
    const recuBuffer = await genererRecuMensuelPDF({
      nomComplet: `${paiement.inscription.prenom} ${paiement.inscription.nom}`,
      email: paiement.inscription.email,
      telephone: paiement.inscription.telephone,
      formation: paiement.inscription.formation,
      mois: paiement.mois,
      montant: paiement.montant,
      paiementId: paiement.id,
      dateValidation: new Date()
    });

    // ✅ Mettre à jour le paiement (sans recuUrl car on ne stocke plus sur disque)
    const paiementValide = await prisma.paiement.update({
      where: { id: parseInt(id) },
      data: {
        status: 'VALIDE',
        dateValidation: new Date()
        // ❌ On ne stocke plus recuUrl car le PDF n'est jamais sur disque
      }
    });

    // ✅ Envoyer l'email avec le Buffer
    await envoyerEmailPaiementValide({
      nomComplet: `${paiement.inscription.prenom} ${paiement.inscription.nom}`,
      email: paiement.inscription.email,
      telephone: paiement.inscription.telephone,
      formation: paiement.inscription.formation,
      mois: paiement.mois,
      montant: paiement.montant,
      paiementId: paiement.id,
      recuBuffer // ✅ Passer le Buffer au lieu du path
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
      message: 'Erreur lors de la validation',
      error: error.message 
    });
  }
};

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

export const getStatistiquesPaiements = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;

    const inscriptionWhere = { 
      status: 'VALIDATED',
      estActif: true
    };
    
    if (formation) inscriptionWhere.formation = formation;
    if (cohorte) inscriptionWhere.cohorte = parseInt(cohorte);

    const where = { inscription: inscriptionWhere };

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

    const statsParFormation = await prisma.inscription.groupBy({
      by: ['formation'],
      where: inscriptionWhere,
      _count: { id: true },
      _sum: { nombreMois: true }
    });

    const formationsDetails = await Promise.all(
      statsParFormation.map(async (stat) => {
        const paiementsFormation = await prisma.paiement.count({
          where: {
            status: 'VALIDE',
            inscription: { 
              formation: stat.formation,
              estActif: true
            }
          }
        });

        const revenusFormation = await prisma.paiement.aggregate({
          where: {
            status: 'VALIDE',
            inscription: { 
              formation: stat.formation,
              estActif: true
            }
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
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
        ? `${process.env.API_URL || 'https://tellytech-backkend.vercel.app'}/api/paiements/etudiant/recu/${p.id}` 
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

// 📊 STATISTIQUES DÉTAILLÉES PAR MOIS - VERSION SIMPLIFIÉE
export const getStatistiquesDetailleesParMois = async (req, res) => {
  try {
    const { formation, mois, cohorte } = req.query;

    console.log('📊 Filtres reçus:', { formation, mois, cohorte });

    // ========================================
    // 1️⃣ RÉCUPÉRER LES ÉTUDIANTS ACTIFS
    // ========================================
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

    console.log(`👥 ${inscriptions.length} étudiant(s) actif(s) trouvé(s)`);

    // ========================================
    // 2️⃣ SI FILTRE PAR MOIS : Stats pour CE mois
    // ========================================
    if (mois) {
      const moisNum = parseInt(mois);
      console.log(`🔍 Filtrage pour le mois ${moisNum}`);
      
      const statsParFormation = {};

      for (const inscription of inscriptions) {
        const formationNom = inscription.formation;
        
        // Initialiser la formation si nécessaire
        if (!statsParFormation[formationNom]) {
          statsParFormation[formationNom] = {
            formation: formationNom,
            mois: moisNum,
            etudiantsActifs: 0,
            etudiantsDoiventPayer: 0,
            etudiantsOntPaye: 0,
            etudiantsNonPaye: 0,
            revenus: 0,
            detailsEtudiants: []
          };
        }

        statsParFormation[formationNom].etudiantsActifs++;

        // ✅ Est-ce que cet étudiant doit payer ce mois ?
        const doitPayerCeMois = inscription.nombreMois >= moisNum;
        
        if (doitPayerCeMois) {
          statsParFormation[formationNom].etudiantsDoiventPayer++;
          
          // ✅ A-t-il payé ce mois ?
          const aPaye = inscription.paiements.some(p => p.mois === moisNum);
          
          if (aPaye) {
            statsParFormation[formationNom].etudiantsOntPaye++;
            statsParFormation[formationNom].revenus += inscription.mensualite;
          } else {
            statsParFormation[formationNom].etudiantsNonPaye++;
          }

          // Détails pour debug
          statsParFormation[formationNom].detailsEtudiants.push({
            nom: `${inscription.prenom} ${inscription.nom}`,
            nombreMois: inscription.nombreMois,
            aPaye,
            paiementsValidesM: inscription.paiements.map(p => p.mois)
          });
        }
      }

      // Calculer les taux
      for (const formationNom in statsParFormation) {
        const stats = statsParFormation[formationNom];
        stats.tauxPaiement = stats.etudiantsDoiventPayer > 0 
          ? `${((stats.etudiantsOntPaye / stats.etudiantsDoiventPayer) * 100).toFixed(1)}%`
          : '0%';
      }

      const statsArray = Object.values(statsParFormation);

      console.log('📈 Résultat:', JSON.stringify(statsArray, null, 2));

      return res.json({
        success: true,
        stats: statsArray,
        filtreMois: moisNum,
        filtreFormation: formation || null,
        filtreCohorte: cohorte ? parseInt(cohorte) : null
      });
    }

    // ========================================
    // 3️⃣ SANS FILTRE MOIS : Stats globales
    // ========================================
    const statsParFormation = {};

    for (const inscription of inscriptions) {
      const formationNom = inscription.formation;
      
      if (!statsParFormation[formationNom]) {
        statsParFormation[formationNom] = {
          formation: formationNom,
          totalEtudiants: 0,
          totalMoisAttendus: 0,
          totalMoisPayes: 0,
          totalMoisNonPayes: 0,
          revenus: 0
        };
      }

      statsParFormation[formationNom].totalEtudiants++;
      statsParFormation[formationNom].totalMoisAttendus += inscription.nombreMois;
      statsParFormation[formationNom].totalMoisPayes += inscription.paiements.length;
      
      const revenusEtudiant = inscription.paiements.reduce((sum, p) => sum + p.montant, 0);
      statsParFormation[formationNom].revenus += revenusEtudiant;
    }

    // Calculer mois non payés et taux
    for (const formationNom in statsParFormation) {
      const stats = statsParFormation[formationNom];
      stats.totalMoisNonPayes = stats.totalMoisAttendus - stats.totalMoisPayes;
      stats.tauxPaiement = stats.totalMoisAttendus > 0 
        ? `${((stats.totalMoisPayes / stats.totalMoisAttendus) * 100).toFixed(1)}%`
        : '0%';
    }

    const statsArray = Object.values(statsParFormation);

    res.json({
      success: true,
      stats: statsArray,
      filtreMois: null,
      filtreFormation: formation || null,
      filtreCohorte: cohorte ? parseInt(cohorte) : null
    });

  } catch (error) {
    console.error('❌ Erreur stats détaillées:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des statistiques détaillées',
      error: error.message
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


// 📊 STATISTIQUES PAR MOIS - VERSION INTELLIGENTE
export const getStatistiquesParMois = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;

    // Filtres pour étudiants ACTIFS uniquement
    const whereInscription = { 
      status: 'VALIDATED',
      estActif: true // ✅ Seulement les actifs
    };
    
    if (formation) whereInscription.formation = formation;
    if (cohorte) whereInscription.cohorte = parseInt(cohorte);

    // Récupérer tous les étudiants actifs avec leurs paiements
    const inscriptions = await prisma.inscription.findMany({
      where: whereInscription,
      include: {
        paiements: {
          where: { status: 'VALIDE' }
        }
      },
      orderBy: { nom: 'asc' }
    });

    if (inscriptions.length === 0) {
      return res.json({
        success: true,
        formation: formation || 'Toutes',
        cohorte: cohorte || 'Toutes',
        totalEtudiants: 0,
        statsMois: [],
        etudiants: []
      });
    }

    // Trouver le nombre max de mois dans cette formation
    const maxMois = Math.max(...inscriptions.map(i => i.nombreMois));

    // ========================================
    // 📊 STATISTIQUES PAR MOIS
    // ========================================
    const statsMois = [];

    for (let mois = 1; mois <= maxMois; mois++) {
      let doiventPayer = 0;
      let ontPaye = 0;

      for (const inscription of inscriptions) {
        // Est-ce que cet étudiant doit payer ce mois ?
        if (inscription.nombreMois >= mois) {
          doiventPayer++;
          
          // A-t-il payé ce mois ?
          const aPaye = inscription.paiements.some(p => p.mois === mois);
          if (aPaye) {
            ontPaye++;
          }
        }
      }

      const nonPaye = doiventPayer - ontPaye;
      const tauxPaiement = doiventPayer > 0 
        ? ((ontPaye / doiventPayer) * 100).toFixed(1)
        : '0';

      statsMois.push({
        mois,
        doiventPayer,
        ontPaye,
        nonPaye,
        tauxPaiement: `${tauxPaiement}%`,
        montantAttendu: doiventPayer * (inscriptions[0]?.mensualite || 0),
        montantPercu: ontPaye * (inscriptions[0]?.mensualite || 0)
      });
    }

    // ========================================
    // 👥 LISTE DÉTAILLÉE DES ÉTUDIANTS
    // ========================================
    const etudiants = inscriptions.map(inscription => {
      const moisPayesListe = inscription.paiements.map(p => p.mois).sort((a, b) => a - b);
      const moisManquants = [];
      
      for (let i = 1; i <= inscription.nombreMois; i++) {
        if (!moisPayesListe.includes(i)) {
          moisManquants.push(i);
        }
      }

      const montantTotal = inscription.mensualite * inscription.nombreMois;
      const montantPaye = inscription.paiements.reduce((sum, p) => sum + p.montant, 0);
      const montantRestant = montantTotal - montantPaye;

      return {
        id: inscription.id,
        nom: inscription.nom,
        prenom: inscription.prenom,
        nomComplet: `${inscription.prenom} ${inscription.nom}`,
        email: inscription.email,
        telephone: inscription.telephone,
        formation: inscription.formation,
        cohorte: inscription.cohorte,
        nombreMois: inscription.nombreMois,
        mensualite: inscription.mensualite,
        
        // Progression
        moisPayes: moisPayesListe,
        nombreMoisPayes: moisPayesListe.length,
        moisManquants,
        nombreMoisManquants: moisManquants.length,
        pourcentageProgression: Math.round((moisPayesListe.length / inscription.nombreMois) * 100),
        
        // Finances
        montantTotal,
        montantPaye,
        montantRestant,
        
        // Statut
        estAJour: moisManquants.length === 0,
        estEnRetard: moisManquants.length > 0 && moisPayesListe.length > 0,
        aucunPaiement: moisPayesListe.length === 0
      };
    });

    // ========================================
    // 📈 RÉSUMÉ GLOBAL
    // ========================================
    const totalEtudiants = inscriptions.length;
    const etudiantsAJour = etudiants.filter(e => e.estAJour).length;
    const etudiantsEnRetard = etudiants.filter(e => e.estEnRetard).length;
    const etudiantsSansPaiement = etudiants.filter(e => e.aucunPaiement).length;
    const totalRevenus = etudiants.reduce((sum, e) => sum + e.montantPaye, 0);

    res.json({
      success: true,
      formation: formation || 'Toutes les formations',
      cohorte: cohorte ? parseInt(cohorte) : 'Toutes les cohortes',
      
      // Résumé
      resume: {
        totalEtudiants,
        etudiantsAJour,
        etudiantsEnRetard,
        etudiantsSansPaiement,
        totalRevenus,
        tauxPaiementGlobal: totalEtudiants > 0 
          ? `${((etudiantsAJour / totalEtudiants) * 100).toFixed(1)}%`
          : '0%'
      },
      
      // Stats par mois
      statsMois,
      
      // Liste complète des étudiants
      etudiants
    });

  } catch (error) {
    console.error('❌ Erreur stats par mois:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des statistiques' 
    });
  }
};

// ========================================
// 👤 DÉTAILS D'UN ÉTUDIANT SPÉCIFIQUE
// ========================================
export const getDetailsEtudiant = async (req, res) => {
  try {
    const { id } = req.params;

    const inscription = await prisma.inscription.findUnique({
      where: { id: parseInt(id) },
      include: {
        paiements: {
          orderBy: { mois: 'asc' }
        }
      }
    });

    if (!inscription) {
      return res.status(404).json({
        success: false,
        message: 'Étudiant introuvable'
      });
    }

    // Analyser les paiements par mois
    const paiementsParMois = [];
    const moisPayesListe = inscription.paiements
      .filter(p => p.status === 'VALIDE')
      .map(p => p.mois);

    for (let mois = 1; mois <= inscription.nombreMois; mois++) {
      const paiementMois = inscription.paiements.find(p => p.mois === mois);
      
      paiementsParMois.push({
        mois,
        statut: paiementMois 
          ? paiementMois.status 
          : 'NON_PAYE',
        montant: paiementMois?.montant || inscription.mensualite,
        dateDemande: paiementMois?.createdAt || null,
        dateValidation: paiementMois?.dateValidation || null,
        paiementId: paiementMois?.id || null,
        urlRecu: paiementMois?.status === 'VALIDE' 
          ? `${process.env.API_URL || 'http://localhost:8000'}/api/paiements/etudiant/recu/${paiementMois.id}`
          : null
      });
    }

    const montantTotal = inscription.mensualite * inscription.nombreMois;
    const montantPaye = inscription.paiements
      .filter(p => p.status === 'VALIDE')
      .reduce((sum, p) => sum + p.montant, 0);

    res.json({
      success: true,
      etudiant: {
        id: inscription.id,
        nom: inscription.nom,
        prenom: inscription.prenom,
        nomComplet: `${inscription.prenom} ${inscription.nom}`,
        email: inscription.email,
        telephone: inscription.telephone,
        formation: inscription.formation,
        cohorte: inscription.cohorte,
        estActif: inscription.estActif,
        dateInscription: inscription.createdAt,
        dateFinFormation: inscription.dateFinFormation
      },
      
      finances: {
        montantInscription: inscription.montantInscription || 0,
        mensualite: inscription.mensualite,
        nombreMois: inscription.nombreMois,
        montantTotal,
        montantPaye,
        montantRestant: montantTotal - montantPaye
      },
      
      progression: {
        moisPayes: moisPayesListe.length,
        moisEnAttente: inscription.paiements.filter(p => p.status === 'EN_ATTENTE').length,
        moisNonPayes: inscription.nombreMois - moisPayesListe.length,
        pourcentage: Math.round((moisPayesListe.length / inscription.nombreMois) * 100)
      },
      
      paiementsParMois,
      
      historiquePaiements: inscription.paiements.map(p => ({
        id: p.id,
        mois: p.mois,
        montant: p.montant,
        status: p.status,
        dateDemande: p.createdAt,
        dateValidation: p.dateValidation,
        urlRecu: p.status === 'VALIDE' 
          ? `${process.env.API_URL || 'http://localhost:8000'}/api/paiements/etudiant/recu/${p.id}`
          : null
      }))
    });

  } catch (error) {
    console.error('❌ Erreur détails étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails'
    });
  }
};

// ========================================
// 📋 LISTE DES FORMATIONS DISPONIBLES
// ========================================
export const getFormationsDisponibles = async (req, res) => {
  try {
    const formations = await prisma.inscription.findMany({
      where: {
        status: 'VALIDATED',
        estActif: true
      },
      select: {
        formation: true
      },
      distinct: ['formation']
    });

    const formationsListe = formations.map(f => f.formation).sort();

    res.json({
      success: true,
      formations: formationsListe
    });

  } catch (error) {
    console.error('❌ Erreur formations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

// ========================================
// 📋 LISTE DES COHORTES DISPONIBLES
// ========================================
export const getCohortesDisponibles = async (req, res) => {
  try {
    const { formation } = req.query;

    const where = {
      status: 'VALIDATED',
      estActif: true,
      cohorte: { not: null }
    };

    if (formation) {
      where.formation = formation;
    }

    const cohortes = await prisma.inscription.findMany({
      where,
      select: {
        cohorte: true
      },
      distinct: ['cohorte'],
      orderBy: {
        cohorte: 'asc'
      }
    });

    const cohortesListe = cohortes.map(c => c.cohorte);

    res.json({
      success: true,
      cohortes: cohortesListe
    });

  } catch (error) {
    console.error('❌ Erreur cohortes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};
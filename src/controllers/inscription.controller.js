import prisma from '../config/database.js';
import { envoyerEmailAdmin, envoyerEmailValidation, envoyerEmailInscription } from '../services/email.service.js';
import bcrypt from 'bcryptjs';
import { calculerDateFinFormation } from '../utils/moisCalendaire.js';

function genererCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ========================================
// 📌 PARTIE PUBLIQUE (CLIENT)
// ========================================

export const inscrireFormation = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, formationId } = req.body;

    if (!nom || !prenom || !email || !telephone || !formationId) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }

    const formation = await prisma.formation.findUnique({
      where: { id: parseInt(formationId) }
    });

    if (!formation) {
      return res.status(404).json({ success: false, message: 'Formation introuvable' });
    }

    if (!formation.estActif) {
      return res.status(400).json({ success: false, message: "Cette formation n'est plus disponible" });
    }

    const existant = await prisma.inscription.findFirst({ where: { email } });
    if (existant) {
      return res.status(400).json({ message: 'Cet email est déjà inscrit' });
    }

    const code = genererCode();

    const inscription = await prisma.inscription.create({
      data: {
        nom,
        prenom,
        email,
        telephone,
        formation: formation.titre,
        code,
        status:   'PENDING',
        estActif: true,
      }
    });

    await envoyerEmailAdmin({
      nomComplet:    `${prenom} ${nom}`,
      email,
      telephone,
      formation:     formation.titre,
      code,
      inscriptionId: inscription.id
    });

    try {
      await envoyerEmailInscription({
        nomComplet:    `${prenom} ${nom}`,
        email,
        formation:     formation.titre,
        code,
        inscriptionId: inscription.id
      });
      console.log("✅ Email de confirmation envoyé à l'étudiant");
    } catch (emailError) {
      console.error('❌ Erreur email étudiant (non bloquant):', emailError.message);
    }

    res.status(201).json({
      success:       true,
      message:       'Inscription enregistrée avec succès ! Vous recevrez un email de confirmation après validation.',
      inscriptionId: inscription.id
    });

  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    res.status(500).json({ success: false, message: "Erreur lors de l'inscription" });
  }
};

// ========================================
// 📌 PARTIE ADMIN
// ========================================

export const getInscriptionsPendantes = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;

    const where = { status: 'PENDING' };
    if (formation) where.formation = { contains: formation, mode: 'insensitive' };
    if (cohorte)   where.cohorte   = parseInt(cohorte);

    const inscriptions = await prisma.inscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: inscriptions.length, inscriptions });

  } catch (error) {
    console.error('❌ Erreur récupération inscriptions:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération' });
  }
};

export const getInscriptionsValidees = async (req, res) => {
  try {
    const { formation, cohorte, statut } = req.query;

    const where = { status: 'VALIDATED' };
    if (formation)            where.formation = { contains: formation, mode: 'insensitive' };
    if (cohorte)              where.cohorte   = parseInt(cohorte);
    if (statut === 'actif')   where.estActif  = true;
    if (statut === 'inactif') where.estActif  = false;

    const inscriptions = await prisma.inscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        paiements: { where: { status: 'VALIDE' } },
      }
    });

    const inscriptionsEnrichies = inscriptions.map(ins => {
      // Paiement unique si mensualite est null ou 0
      const estPaiementUnique = !ins.mensualite || ins.mensualite === 0;

      return {
        ...ins,
        typePaiement: estPaiementUnique ? 'UNIQUE' : 'MENSUEL',
        progression: estPaiementUnique
          ? null
          : {
              moisPayes:    ins.paiements.length,
              moisRestants: (ins.nombreMois ?? 0) - ins.paiements.length,
              pourcentage:  ins.nombreMois && ins.nombreMois > 0
                ? Math.round((ins.paiements.length / ins.nombreMois) * 100)
                : 0
            }
      };
    });

    res.json({ success: true, count: inscriptionsEnrichies.length, inscriptions: inscriptionsEnrichies });

  } catch (error) {
    console.error('❌ Erreur récupération inscriptions validées:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération' });
  }
};

// ========================================
// ✅ VALIDATION — mensualité OPTIONNELLE
//
//  Paiement UNIQUE (Bureautique, CM, Audiovisuel…)
//    → body: { montantInscription, nombreMois, cohorte }
//    → ne pas envoyer mensualite (ou envoyer null / 0)
//
//  Paiement MENSUEL (autres formations)
//    → body: { montantInscription, nombreMois, mensualite, cohorte }
//
//  🆕 dateDemarrage (optionnel) : si l'étudiant démarre à une date
//  différente de la validation (ex: rejoint une cohorte déjà en cours,
//  ou l'admin valide en retard). Si absent → date du jour par défaut.
//
//  Dans les deux cas un compte User est créé automatiquement.
// ========================================
export const validerInscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { montantInscription, nombreMois, mensualite, cohorte, dateDemarrage } = req.body;

    // Champs toujours obligatoires
    if (!montantInscription || !nombreMois || !cohorte) {
      return res.status(400).json({
        success: false,
        message: 'Les champs montantInscription, nombreMois et cohorte sont obligatoires'
      });
    }

    // Détecter le type de paiement
    const estPaiementUnique = !mensualite || parseInt(mensualite) === 0;

    const inscription = await prisma.inscription.findUnique({
      where: { id: parseInt(id) }
    });

    if (!inscription) {
      return res.status(404).json({ success: false, message: 'Inscription introuvable' });
    }
    if (inscription.status === 'VALIDATED') {
      return res.status(400).json({ success: false, message: 'Cette inscription est déjà validée' });
    }

    // ── Créer le compte User ──────────────────────────────────────────────
    const existingUser = await prisma.user.findUnique({ where: { email: inscription.email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Un compte existe déjà avec cet email' });
    }

    const passwordHash = await bcrypt.hash(inscription.code, 10);

    await prisma.user.create({
      data: {
        nom:       `${inscription.prenom} ${inscription.nom}`,
        email:     inscription.email,
        password:  passwordHash,
        role:      'USER',
        formation: inscription.formation,
        cohorte:   parseInt(cohorte),
      }
    });
    console.log(`✅ Compte User créé pour ${inscription.email}`);

    // ── 🆕 Date de démarrage réelle + date de fin calculée ─────────────────
    // Par défaut : date du jour (= date de validation admin).
    // L'admin peut envoyer une dateDemarrage précise si l'étudiant démarre
    // à un autre moment (ex: rejoint une cohorte déjà en cours).
    const dateDebut = dateDemarrage ? new Date(dateDemarrage) : new Date();
    const dateFin   = calculerDateFinFormation(dateDebut, nombreMois);

    // ── Mettre à jour l'inscription ───────────────────────────────────────
    const inscriptionValidee = await prisma.inscription.update({
      where: { id: parseInt(id) },
      data: {
        status:             'VALIDATED',
        montantInscription: parseInt(montantInscription),
        nombreMois:         parseInt(nombreMois),
        mensualite:         estPaiementUnique ? null : parseInt(mensualite),
        cohorte:            parseInt(cohorte),
        estActif:           true,
        dateDemarrage:      dateDebut,
        dateFinFormation:   dateFin
      }
    });

    // ── Synchroniser le User (formation + cohorte) ────────────────────────
    await prisma.user.update({
      where: { email: inscriptionValidee.email },
      data: {
        formation: inscriptionValidee.formation,
        cohorte:   parseInt(cohorte),
      }
    });
    console.log(`✅ User synchronisé pour ${inscriptionValidee.email}`);

    // ── Envoyer l'email de validation ─────────────────────────────────────
    await envoyerEmailValidation({
      nomComplet:         `${inscriptionValidee.prenom} ${inscriptionValidee.nom}`,
      email:              inscriptionValidee.email,
      formation:          inscriptionValidee.formation,
      code:               inscriptionValidee.code,
      telephone:          inscriptionValidee.telephone,
      montantInscription: inscriptionValidee.montantInscription,
      nombreMois:         inscriptionValidee.nombreMois,
      mensualite:         inscriptionValidee.mensualite,  // null si paiement unique
      estPaiementUnique,                                  // flag pour adapter l'email
      cohorte:            inscriptionValidee.cohorte,
      inscriptionId:      inscriptionValidee.id
    });

    res.json({
      success:     true,
      message:     'Inscription validée avec succès !',
      inscription: {
        ...inscriptionValidee,
        typePaiement: estPaiementUnique ? 'UNIQUE' : 'MENSUEL'
      }
    });

  } catch (error) {
    console.error('❌ ERREUR validerInscription:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la validation' });
  }
};

// ========================================
// ✅ MODIFIER une inscription
//    Synchronise aussi le User associé
//    🆕 Permet aussi de corriger dateDemarrage après coup
// ========================================
export const modifierInscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email, telephone, formation, cohorte, dateDemarrage } = req.body;

    const inscription = await prisma.inscription.findUnique({
      where: { id: parseInt(id) }
    });

    if (!inscription) {
      return res.status(404).json({ success: false, message: 'Inscription introuvable' });
    }

    // Vérifier unicité email si changé
    if (email && email !== inscription.email) {
      const emailExistant = await prisma.inscription.findUnique({ where: { email } });
      if (emailExistant) {
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé par une autre inscription'
        });
      }
    }

    // 🆕 Si dateDemarrage est corrigée, recalculer dateFinFormation en cohérence
    let nouvelleDateFin;
    if (dateDemarrage && inscription.nombreMois) {
      nouvelleDateFin = calculerDateFinFormation(new Date(dateDemarrage), inscription.nombreMois);
    }

    // ── Mettre à jour l'inscription ───────────────────────────────────────
    const inscriptionMaj = await prisma.inscription.update({
      where: { id: parseInt(id) },
      data: {
        ...(nom       && { nom }),
        ...(prenom    && { prenom }),
        ...(email     && { email }),
        ...(telephone && { telephone }),
        ...(formation && { formation }),
        ...(cohorte !== undefined && { cohorte: cohorte ? parseInt(cohorte) : null }),
        ...(dateDemarrage && { dateDemarrage: new Date(dateDemarrage) }),
        ...(nouvelleDateFin && { dateFinFormation: nouvelleDateFin }),
      }
    });

    // ── Synchroniser le User si il existe ────────────────────────────────
    const ancienEmail  = inscription.email; // email AVANT modification
    const userExistant = await prisma.user.findUnique({ where: { email: ancienEmail } });

    if (userExistant) {
      await prisma.user.update({
        where: { email: ancienEmail },
        data: {
          // Recomposer le nom complet avec les valeurs à jour
          ...((nom || prenom) && {
            nom: `${inscriptionMaj.prenom} ${inscriptionMaj.nom}`
          }),
          // Propager le nouvel email dans User
          ...(email && email !== ancienEmail && { email }),
          ...(formation && { formation }),
          ...(cohorte !== undefined && { cohorte: cohorte ? parseInt(cohorte) : null }),
        }
      });
      console.log(`✅ User synchronisé après modification pour ${ancienEmail}`);
    }

    res.json({ success: true, message: 'Inscription modifiée avec succès', inscription: inscriptionMaj });

  } catch (error) {
    console.error('❌ Erreur modification:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification' });
  }
};

// ========================================
// ✅ SUPPRIMER une inscription
//    Synchronise aussi la suppression du User associé
// ========================================
export const supprimerInscription = async (req, res) => {
  try {
    const { id } = req.params;

    const inscription = await prisma.inscription.findUnique({
      where: { id: parseInt(id) }
    });

    if (!inscription) {
      return res.status(404).json({ success: false, message: 'Inscription introuvable' });
    }

    // ── 1. Supprimer les paiements liés (contrainte FK) ───────────────────
    await prisma.paiement.deleteMany({
      where: { inscriptionId: parseInt(id) }
    });

    // ── 2. Supprimer l'inscription ────────────────────────────────────────
    await prisma.inscription.delete({
      where: { id: parseInt(id) }
    });

    // ── 3. Supprimer le User associé s'il existe ──────────────────────────
    const userExistant = await prisma.user.findUnique({
      where: { email: inscription.email }
    });

    if (userExistant) {
      await prisma.user.delete({ where: { email: inscription.email } });
      console.log(`✅ User supprimé pour ${inscription.email}`);
    } else {
      console.log(`ℹ️ Aucun User trouvé pour ${inscription.email} (inscription PENDING non validée)`);
    }

    res.json({ success: true, message: 'Inscription et compte utilisateur supprimés avec succès' });

  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
};
// ========================================
// ✅ MARQUER INACTIF
// ========================================
export const marquerEtudiantInactif = async (req, res) => {
  try {
    const { id } = req.params;

    const inscription = await prisma.inscription.findUnique({ where: { id: parseInt(id) } });
    if (!inscription) {
      return res.status(404).json({ success: false, message: 'Inscription introuvable' });
    }

    const inscriptionMaj = await prisma.inscription.update({
      where: { id: parseInt(id) },
      data: { estActif: false, dateFinFormation: new Date() }
    });

    res.json({ success: true, message: 'Étudiant marqué comme inactif', inscription: inscriptionMaj });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
  }
};

// ========================================
// ✅ RÉACTIVER UN ÉTUDIANT
// ========================================
export const reactiverEtudiant = async (req, res) => {
  try {
    const { id } = req.params;

    const inscriptionMaj = await prisma.inscription.update({
      where: { id: parseInt(id) },
      data: { estActif: true, dateFinFormation: null }
    });

    res.json({ success: true, message: 'Étudiant réactivé', inscription: inscriptionMaj });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la réactivation' });
  }
};

// ========================================
// ✅ STATISTIQUES
// ========================================
export const getStatistiques = async (req, res) => {
  try {
    const { cohorte, formation } = req.query;

    const whereBase = {};
    if (cohorte)   whereBase.cohorte   = parseInt(cohorte);
    if (formation) whereBase.formation = { contains: formation, mode: 'insensitive' };

    const [totalInscriptions, enAttente, validees, actifs, inactifs, parFormation, parCohorte] =
      await Promise.all([
        prisma.inscription.count({ where: whereBase }),
        prisma.inscription.count({ where: { ...whereBase, status: 'PENDING'   } }),
        prisma.inscription.count({ where: { ...whereBase, status: 'VALIDATED' } }),
        prisma.inscription.count({ where: { ...whereBase, status: 'VALIDATED', estActif: true  } }),
        prisma.inscription.count({ where: { ...whereBase, status: 'VALIDATED', estActif: false } }),
        prisma.inscription.groupBy({
          by: ['formation'],
          where: whereBase,
          _count: { formation: true },
          orderBy: { _count: { formation: 'desc' } }
        }),
        prisma.inscription.groupBy({
          by: ['cohorte'],
          where: { ...whereBase, cohorte: { not: null } },
          _count: { cohorte: true },
          orderBy: { cohorte: 'asc' }
        }),
      ]);

    res.json({
      success: true,
      stats: {
        total:       totalInscriptions,
        enAttente,
        validees,
        actifs,
        inactifs,
        parFormation: parFormation.map(f => ({ formation: f.formation, count: f._count.formation })),
        parCohorte:   parCohorte.map(c => ({ cohorte: c.cohorte, count: c._count.cohorte }))
      }
    });

  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des statistiques' });
  }
};
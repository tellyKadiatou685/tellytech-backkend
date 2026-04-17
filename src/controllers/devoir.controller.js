// src/controllers/devoir.controller.js
import { PrismaClient } from "@prisma/client";
import {
  notifierDevoirDisponible,
  notifierDevoirModifie,
  notifierDevoirSupprime,
  notifierConfirmationSoumission,
  notifierDevoirCorrige,
  notifierMoyenneFinale,
  notifierEtudiantsConcernesDevoir,
} from "../services/devoirEmail.service.js";
import uploadService from "../services/upload.service.js";

const prisma = new PrismaClient();

// ============================================================
// 🔧 HELPER — Calcule et notifie la moyenne si tous corrigés
// ============================================================

const APPRECIATIONS = {
  EXCELLENT:    { label: "Excellent",    min: 16 },
  BIEN:         { label: "Bien",         min: 14 },
  ASSEZ_BIEN:   { label: "Assez bien",   min: 12 },
  PASSABLE:     { label: "Passable",     min: 10 },
  INSUFFISANT:  { label: "Insuffisant",  min: 0  },
};

export const getAppreciation = (note) => {
  if (note >= 16) return APPRECIATIONS.EXCELLENT;
  if (note >= 14) return APPRECIATIONS.BIEN;
  if (note >= 12) return APPRECIATIONS.ASSEZ_BIEN;
  if (note >= 10) return APPRECIATIONS.PASSABLE;
  return APPRECIATIONS.INSUFFISANT;
};

const verifierEtNotifierMoyenne = async (inscriptionId, formation, cohorte) => {
  try {
    // Tous les devoirs actifs de la formation+cohorte
    const devoirs = await prisma.devoir.findMany({
      where: {
        formation,
        actif: true,
        OR: [{ cohorte: null }, { cohorte }],
      },
      select: { id: true, titre: true },
    });

    if (devoirs.length === 0) return;

    const devoirIds = devoirs.map((d) => d.id);

    // Toutes les soumissions corrigées (note non nulle) pour cet étudiant
    const soumissions = await prisma.devoirSubmission.findMany({
      where: {
        inscriptionId,
        devoirId:  { in: devoirIds },
        note:      { not: null },
        status:    "APPROVED",
      },
      include: { devoir: { select: { titre: true } } },
    });

    // Pas encore tous corrigés → on ne fait rien
    if (soumissions.length < devoirs.length) {
      console.log(
        `⏳ Moyenne non déclenchée : ${soumissions.length}/${devoirs.length} devoirs corrigés pour inscription ${inscriptionId}`
      );
      return;
    }

    // Calcul de la moyenne
    const totalNotes = soumissions.reduce((sum, s) => sum + s.note, 0);
    const moyenne    = parseFloat((totalNotes / soumissions.length).toFixed(2));
    const appreciation = getAppreciation(moyenne);

    console.log(
      `🎯 Moyenne calculée pour inscription ${inscriptionId} : ${moyenne}/20 (${appreciation.label})`
    );

    // Récupérer l'étudiant
    const inscription = await prisma.inscription.findUnique({
      where: { id: inscriptionId },
      select: { id: true, nom: true, prenom: true, email: true },
    });

    if (!inscription) return;

    // Envoyer l'email de moyenne finale
    await notifierMoyenneFinale({
      etudiant: inscription,
      formation,
      soumissions,
      moyenne,
      appreciation,
    });

  } catch (err) {
    console.error("❌ Erreur calcul/notification moyenne:", err.message);
  }
};

// ============================================================
// 📝 ADMIN — CRUD DEVOIRS
// ============================================================

export const getAllDevoirs = async (req, res) => {
  try {
    const { page = 1, limit = 20, formation, actif } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (formation) where.formation = formation;
    if (actif !== undefined) where.actif = actif === "true";

    const [devoirs, total] = await Promise.all([
      prisma.devoir.findMany({
        where, orderBy: { deadline: "desc" }, skip, take: parseInt(limit),
        include: { _count: { select: { soumissions: true } } },
      }),
      prisma.devoir.count({ where }),
    ]);
    return res.json({ devoirs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error("[getAllDevoirs]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const getDevoirById = async (req, res) => {
  try {
    const devoir = await prisma.devoir.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        soumissions: {
          include: {
            inscription: {
              select: { id: true, nom: true, prenom: true, email: true, cohorte: true },
            },
          },
          orderBy: { soumisAt: "asc" },
        },
      },
    });
    if (!devoir) return res.status(404).json({ message: "Devoir introuvable." });
    return res.json(devoir);
  } catch (error) {
    console.error("[getDevoirById]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const createDevoir = async (req, res) => {
  try {
    console.log('📥 req.body:', req.body);
    console.log('📎 req.file:', req.file); 
    const { titre, consigne, formation, cohorte, ouvertureAt, deadline, dureeMinutes } = req.body;

    const required = { titre, consigne, formation, ouvertureAt, deadline, dureeMinutes };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0)
      return res.status(400).json({ message: `Champs manquants : ${missing.join(", ")}` });

    const dateOuverture = new Date(ouvertureAt);
    const dateDeadline  = new Date(deadline);
    if (isNaN(dateOuverture.getTime()) || isNaN(dateDeadline.getTime()))
      return res.status(400).json({ message: "Dates invalides." });
    if (dateDeadline <= dateOuverture)
      return res.status(400).json({ message: "La deadline doit être après l'ouverture." });

    let fichierUrl = null, fichierPublicId = null;
    if (req.file) {
      const uploaded  = await uploadService.uploadPdf(req.file, formation);
      fichierUrl      = uploaded.url;
      fichierPublicId = uploaded.publicId;
    }

    const devoir = await prisma.devoir.create({
      data: {
        titre, consigne, formation,
        cohorte:      cohorte ? parseInt(cohorte) : null,
        ouvertureAt:  dateOuverture,
        deadline:     dateDeadline,
        dureeMinutes: parseInt(dureeMinutes),
        fichierUrl, fichierPublicId,
      },
    });

    res.status(201).json({
      ...devoir,
      notification: "En cours d'envoi aux étudiants concernés...",
    });

    notifierEtudiantsConcernesDevoir(
      prisma, formation,
      cohorte ? parseInt(cohorte) : null,
      (etudiant) => notifierDevoirDisponible({ etudiant, devoir })
    ).catch((err) => console.error("❌ Erreur notifications création:", err));

  } catch (error) {
    console.error("[createDevoir]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const updateDevoir = async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, consigne, formation, cohorte, ouvertureAt, deadline, dureeMinutes, actif } = req.body;

    const existing = await prisma.devoir.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return res.status(404).json({ message: "Devoir introuvable." });

    const ancienDevoir = { ...existing };

    if (ouvertureAt && deadline) {
      const dateOuverture = new Date(ouvertureAt);
      const dateDeadline  = new Date(deadline);
      if (dateDeadline <= dateOuverture)
        return res.status(400).json({ message: "La deadline doit être après l'ouverture." });
    }

    let fichierUrl = existing.fichierUrl, fichierPublicId = existing.fichierPublicId;
    if (req.file) {
      if (existing.fichierPublicId) await uploadService.deletePdf(existing.fichierUrl);
      const uploaded  = await uploadService.uploadPdf(req.file, formation || existing.formation);
      fichierUrl      = uploaded.url;
      fichierPublicId = uploaded.publicId;
    }

    const devoir = await prisma.devoir.update({
      where: { id: parseInt(id) },
      data: {
        ...(titre        && { titre }),
        ...(consigne     && { consigne }),
        ...(formation    && { formation }),
        ...(ouvertureAt  && { ouvertureAt: new Date(ouvertureAt) }),
        ...(deadline     && { deadline: new Date(deadline) }),
        ...(dureeMinutes && { dureeMinutes: parseInt(dureeMinutes) }),
        ...(actif !== undefined && { actif: actif === "true" || actif === true }),
        cohorte: cohorte !== undefined ? (cohorte ? parseInt(cohorte) : null) : existing.cohorte,
        fichierUrl, fichierPublicId,
      },
    });

    res.json({
      ...devoir,
      notification: "Étudiants notifiés de la modification...",
    });

    const formationCible = formation || existing.formation;
    const cohorteCible   = cohorte !== undefined
      ? (cohorte ? parseInt(cohorte) : null)
      : existing.cohorte;

    notifierEtudiantsConcernesDevoir(
      prisma, formationCible, cohorteCible,
      (etudiant) => notifierDevoirModifie({ etudiant, ancienDevoir, nouveauDevoir: devoir })
    ).catch((err) => console.error("❌ Erreur notifications modification:", err));

  } catch (error) {
    console.error("[updateDevoir]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteDevoir = async (req, res) => {
  try {
    const existing = await prisma.devoir.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!existing) return res.status(404).json({ message: "Devoir introuvable." });

    const devoirSupprime = { ...existing };

    if (existing.fichierUrl) await uploadService.deletePdf(existing.fichierUrl);
    await prisma.devoir.delete({ where: { id: parseInt(req.params.id) } });

    res.json({
      message: "Devoir supprimé avec succès.",
      notification: "Étudiants notifiés de l'annulation...",
    });

    notifierEtudiantsConcernesDevoir(
      prisma, devoirSupprime.formation, devoirSupprime.cohorte,
      (etudiant) => notifierDevoirSupprime({ etudiant, devoir: devoirSupprime })
    ).catch((err) => console.error("❌ Erreur notifications suppression:", err));

  } catch (error) {
    console.error("[deleteDevoir]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// 🎓 ÉTUDIANT — SOUMISSIONS
// ============================================================

export const getDeviorsEtudiant = async (req, res) => {
  try {
    // Priorité : query param, sinon on cherche via l'email du token
    let inscriptionId = req.query.inscriptionId
      ? parseInt(req.query.inscriptionId)
      : null;

    if (!inscriptionId) {
      // Fallback : chercher l'inscription via l'email injecté par le middleware auth
      const inscription = await prisma.inscription.findFirst({
        where: { email: req.user.email, status: "VALIDATED" },
        select: { id: true },
      });
      if (!inscription)
        return res.status(404).json({ message: "Aucune inscription validée trouvée." });
      inscriptionId = inscription.id;
    }

    const inscription = await prisma.inscription.findUnique({
      where: { id: inscriptionId },
      select: { formation: true, cohorte: true },
    });
    if (!inscription)
      return res.status(404).json({ message: "Inscription introuvable." });

    const now = new Date();
    const devoirs = await prisma.devoir.findMany({
      where: {
        actif: true,
        ouvertureAt: { lte: now },
        formation: inscription.formation,
        OR: [{ cohorte: null }, { cohorte: inscription.cohorte }],
      },
      orderBy: { deadline: "asc" },
      include: {
        soumissions: {
          where: { inscriptionId },
          select: {
            id: true, status: true, note: true,
            appreciation: true, soumisAt: true, fichierUrl: true,
          },
        },
      },
    });

    const enriched = devoirs.map((d) => ({
      ...d,
      estExpire:        now > d.deadline,
      minutesRestantes: Math.max(0, Math.floor((d.deadline - now) / 60000)),
      maSoumission:     d.soumissions[0] || null,
      soumissions:      undefined,
    }));

    return res.json(enriched);
  } catch (error) {
    console.error("[getDeviorsEtudiant]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const soumettreDevoir = async (req, res) => {
  try {
    const { id } = req.params;
    const { inscriptionId } = req.body;

    if (!inscriptionId) return res.status(400).json({ message: "inscriptionId requis." });
    if (!req.file)      return res.status(400).json({ message: "Fichier requis." });

    const devoir = await prisma.devoir.findUnique({ where: { id: parseInt(id) } });
    if (!devoir || !devoir.actif)
      return res.status(404).json({ message: "Devoir introuvable ou inactif." });

    const now = new Date();
    if (now > devoir.deadline)
      return res.status(403).json({ message: "La deadline est dépassée. Soumission refusée.", deadline: devoir.deadline });
    if (now < devoir.ouvertureAt)
      return res.status(403).json({ message: "Ce devoir n'est pas encore ouvert." });

    const existingSoumission = await prisma.devoirSubmission.findUnique({
      where: { devoirId_inscriptionId: { devoirId: parseInt(id), inscriptionId: parseInt(inscriptionId) } },
    });
    if (existingSoumission)
      return res.status(409).json({ message: "Vous avez déjà soumis ce devoir." });

    const inscription = await prisma.inscription.findUnique({
      where: { id: parseInt(inscriptionId) },
      select: { id: true, nom: true, prenom: true, email: true },
    });
    if (!inscription) return res.status(404).json({ message: "Inscription introuvable." });

    const uploaded   = await uploadService.uploadSubmission(req.file, inscriptionId);
    const soumission = await prisma.devoirSubmission.create({
      data: {
        devoirId:        parseInt(id),
        inscriptionId:   parseInt(inscriptionId),
        fichierUrl:      uploaded.url,
        fichierPublicId: uploaded.publicId,
        fileName:        uploaded.fileName,
      },
    });

    res.status(201).json({ message: "Devoir soumis avec succès.", soumission });

    notifierConfirmationSoumission({ etudiant: inscription, devoir, soumission })
      .catch((err) => console.error("❌ Erreur notif confirmation:", err));

  } catch (error) {
    console.error("[soumettreDevoir]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// ✏️ ADMIN/COACH — CORRECTION (note + appréciation + moyenne auto)
// ============================================================

export const getSoumissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    const where = { devoirId: parseInt(id) };
    if (status) where.status = status;

    const soumissions = await prisma.devoirSubmission.findMany({
      where,
      include: {
        inscription: {
          select: { id: true, nom: true, prenom: true, email: true, cohorte: true },
        },
      },
      orderBy: { soumisAt: "asc" },
    });
    return res.json(soumissions);
  } catch (error) {
    console.error("[getSoumissions]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const corrigerSoumission = async (req, res) => {
  try {
    const { soumissionId } = req.params;
    const { note, feedback } = req.body;

    // ── Validation note ──────────────────────────────────────
    if (note === undefined || note === null)
      return res.status(400).json({ message: "La note est requise." });
    const noteInt = parseInt(note);
    if (isNaN(noteInt) || noteInt < 0 || noteInt > 20)
      return res.status(400).json({ message: "La note doit être entre 0 et 20." });

    // ── Récupérer la soumission avec ses relations ───────────
    const existing = await prisma.devoirSubmission.findUnique({
      where: { id: parseInt(soumissionId) },
      include: {
        inscription: {
          select: { id: true, nom: true, prenom: true, email: true, cohorte: true },
        },
        devoir: true,
      },
    });
    if (!existing) return res.status(404).json({ message: "Soumission introuvable." });

    // ── Calcul appréciation automatique ─────────────────────
    const appreciation = getAppreciation(noteInt);

    // ── Mise à jour en base ──────────────────────────────────
    const soumission = await prisma.devoirSubmission.update({
      where: { id: parseInt(soumissionId) },
      data: {
        note:         noteInt,
        appreciation: appreciation.label,
        feedback:     feedback || null,
        status:       "APPROVED",
      },
    });

    // ── Réponse immédiate ────────────────────────────────────
    res.json({
      message:      "Correction enregistrée.",
      soumission,
      appreciation: appreciation.label,
    });

    // ── Notifications en arrière-plan ────────────────────────

    // 1. Email résultat individuel (note + appréciation)
    notifierDevoirCorrige({
      etudiant:   existing.inscription,
      devoir:     existing.devoir,
      soumission: { ...soumission, soumisAt: existing.soumisAt, appreciation: appreciation.label },
    }).catch((err) => console.error("❌ Erreur notif correction:", err));

    // 2. Vérifier si tous les devoirs de la cohorte sont corrigés
    //    → si oui, calcule et envoie la moyenne finale
    verifierEtNotifierMoyenne(
      existing.inscriptionId,
      existing.devoir.formation,
      existing.inscription.cohorte,
    ).catch((err) => console.error("❌ Erreur vérif moyenne:", err));

  } catch (error) {
    console.error("[corrigerSoumission]", error.message);
    return res.status(500).json({ message: error.message });
  }
};
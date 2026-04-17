// src/controllers/devoirSoumission.controller.js
import { PrismaClient } from "@prisma/client";
import {
  notifierSoumissionValidee,
  notifierSoumissionRejetee,
  notifierMessageCoach,
} from "../services/devoirSoumissionEmail.service.js";

const prisma = new PrismaClient();

// ============================================================
// 🔧 HELPER — Récupère soumission + étudiant + devoir
// ============================================================
const getSoumissionAvecRelations = async (soumissionId) => {
  return prisma.devoirSubmission.findUnique({
    where: { id: parseInt(soumissionId) },
    include: {
      inscription: {
        select: { id: true, nom: true, prenom: true, email: true },
      },
      devoir: true,
    },
  });
};

// ============================================================
// ✅ VALIDER une soumission
// PUT /api/devoir/soumissions/:soumissionId/valider
// Body (optionnel) : { feedback: string }
// ============================================================
export const validerSoumission = async (req, res) => {
  try {
    const { soumissionId } = req.params;
    const { feedback } = req.body;

    const existing = await getSoumissionAvecRelations(soumissionId);
    if (!existing)
      return res.status(404).json({ message: "Soumission introuvable." });

    if (existing.status === "APPROVED")
      return res.status(409).json({ message: "Cette soumission est déjà validée." });

    const soumission = await prisma.devoirSubmission.update({
      where: { id: parseInt(soumissionId) },
      data: {
        status: "APPROVED",
        ...(feedback !== undefined && { feedback: feedback || null }),
      },
    });

    res.json({ message: "Soumission validée avec succès.", soumission });

    // 📧 Notification en arrière-plan
    notifierSoumissionValidee({
      etudiant: existing.inscription,
      devoir:   existing.devoir,
      soumission: { ...soumission, soumisAt: existing.soumisAt },
    }).catch((err) => console.error("❌ Erreur notif validation:", err));

  } catch (error) {
    console.error("[validerSoumission]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// ❌ REJETER une soumission
// PUT /api/devoir/soumissions/:soumissionId/rejeter
// Body requis : { motifRejet: string }
// ============================================================
export const rejeterSoumission = async (req, res) => {
  try {
    const { soumissionId } = req.params;
    const { motifRejet } = req.body;

    if (!motifRejet || motifRejet.trim() === "")
      return res.status(400).json({ message: "Le motif du rejet est requis." });

    const existing = await getSoumissionAvecRelations(soumissionId);
    if (!existing)
      return res.status(404).json({ message: "Soumission introuvable." });

    if (existing.status === "REJECTED")
      return res.status(409).json({ message: "Cette soumission est déjà rejetée." });

    const soumission = await prisma.devoirSubmission.update({
      where: { id: parseInt(soumissionId) },
      data: {
        status:  "REJECTED",
        feedback: motifRejet.trim(),
      },
    });

    res.json({ message: "Soumission rejetée.", soumission });

    // 📧 Notification en arrière-plan
    notifierSoumissionRejetee({
      etudiant: existing.inscription,
      devoir:   existing.devoir,
      soumission: {
        ...soumission,
        soumisAt:    existing.soumisAt,
        motifRejet:  motifRejet.trim(),
      },
    }).catch((err) => console.error("❌ Erreur notif rejet:", err));

  } catch (error) {
    console.error("[rejeterSoumission]", error.message);
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// 💬 ENVOYER UN MESSAGE à l'étudiant (sans changer le statut)
// POST /api/devoir/soumissions/:soumissionId/message
// Body requis : { message: string }
// ============================================================
export const envoyerMessage = async (req, res) => {
  try {
    const { soumissionId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === "")
      return res.status(400).json({ message: "Le message est requis." });

    const existing = await getSoumissionAvecRelations(soumissionId);
    if (!existing)
      return res.status(404).json({ message: "Soumission introuvable." });

    // req.user est injecté par le middleware authenticate
    const expediteur = req.user
      ? { prenom: req.user.nom?.split(" ")[0] || "", nom: req.user.nom || "" }
      : null;

    res.json({ message: "Message envoyé à l'étudiant.", sent: true });

    // 📧 Notification en arrière-plan (aucun changement en DB — email pur)
    notifierMessageCoach({
      etudiant:  existing.inscription,
      devoir:    existing.devoir,
      soumission: existing,
      message:   message.trim(),
      expediteur,
    }).catch((err) => console.error("❌ Erreur notif message:", err));

  } catch (error) {
    console.error("[envoyerMessage]", error.message);
    return res.status(500).json({ message: error.message });
  }
};
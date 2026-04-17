// src/controllers/emploiDuTemps.controller.js
import { PrismaClient } from "@prisma/client";
import {
  notifierNouveauCreneau,
  notifierModificationCreneau,
  notifierEmploiDuTempsComplet,
  notifierEtudiantsConcernes,
} from "../services/emploiDuTempsEmail.service.js";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// GET /api/emploie?formation=dev-web&cohorte=Cohorte+1
// ─────────────────────────────────────────────
export const getEmploiDuTemps = async (req, res) => {
  try {
    const { formation, cohorte } = req.query;
    if (!formation)
      return res.status(400).json({ message: "Le paramètre 'formation' est requis." });

    const where = { formation };
    if (cohorte) where.cohorte = cohorte;

    const emploiDuTemps = await prisma.emploiDuTemps.findMany({
      where,
      orderBy: [{ jour: "asc" }, { heureDebut: "asc" }],
    });

    // Format compatible avec DashboardSchedule (frontend)
    const formatted = emploiDuTemps.map((item) => ({
      id: item.id,
      day: item.jour,
      subject: item.matiere,
      time: `${item.heureDebut} - ${item.heureFin}`,
      type: item.type,
      cohorte: item.cohorte,
      salle: item.salle || null,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("[getEmploiDuTemps]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

// ─────────────────────────────────────────────
// GET /api/emploie/all  (Admin)
// ─────────────────────────────────────────────
export const getAllEmploiDuTemps = async (req, res) => {
  try {
    const { page = 1, limit = 50, formation } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (formation) where.formation = formation;

    const [items, total] = await Promise.all([
      prisma.emploiDuTemps.findMany({
        where,
        orderBy: [{ formation: "asc" }, { jour: "asc" }, { heureDebut: "asc" }],
        skip,
        take: parseInt(limit),
      }),
      prisma.emploiDuTemps.count({ where }),
    ]);

    return res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error("[getAllEmploiDuTemps]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

// ─────────────────────────────────────────────
// POST /api/emploie  (Admin)
// Créer 1 créneau + notifier les étudiants
// ─────────────────────────────────────────────
export const createCreneaux = async (req, res) => {
  try {
    const { formation, cohorte, jour, heureDebut, heureFin, matiere, type, salle } = req.body;

    const required = { formation, cohorte, jour, heureDebut, heureFin, matiere, type };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0)
      return res.status(400).json({ message: `Champs manquants : ${missing.join(", ")}` });

    const joursValides = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const typesValides = ["cours", "tp", "projet"];
    if (!joursValides.includes(jour))
      return res.status(400).json({ message: `Jour invalide. Valeurs : ${joursValides.join(", ")}` });
    if (!typesValides.includes(type))
      return res.status(400).json({ message: `Type invalide. Valeurs : ${typesValides.join(", ")}` });

    const creneau = await prisma.emploiDuTemps.create({
      data: { formation, cohorte, jour, heureDebut, heureFin, matiere, type, salle: salle || null },
    });

    // ✅ Réponse immédiate — les emails partent en arrière-plan
    res.status(201).json({
      ...creneau,
      notification: "En cours d'envoi aux étudiants concernés..."
    });

    // 📧 Fire & forget
    notifierEtudiantsConcernes(prisma, formation, cohorte, (etudiant) =>
      notifierNouveauCreneau({ etudiant, creneau })
    ).catch((err) => console.error("❌ Erreur notifications nouveau créneau:", err));

  } catch (error) {
    console.error("[createCreneaux]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

// ─────────────────────────────────────────────
// POST /api/emploie/bulk  (Admin)
// Créer plusieurs créneaux + notifier
// ─────────────────────────────────────────────
export const createBulkCreneaux = async (req, res) => {
  try {
    const { creneaux } = req.body;

    if (!Array.isArray(creneaux) || creneaux.length === 0)
      return res.status(400).json({ message: "'creneaux' doit être un tableau non vide." });

    const result = await prisma.emploiDuTemps.createMany({
      data: creneaux.map((c) => ({
        formation: c.formation,
        cohorte: c.cohorte,
        jour: c.jour,
        heureDebut: c.heureDebut,
        heureFin: c.heureFin,
        matiere: c.matiere,
        type: c.type,
        salle: c.salle || null,
      })),
      skipDuplicates: true,
    });

    // ✅ Réponse immédiate
    res.status(201).json({
      message: `${result.count} créneau(x) créé(s) avec succès.`,
      count: result.count,
      notification: "En cours d'envoi aux étudiants concernés..."
    });

    // 📧 Grouper par (formation, cohorte) → 1 email EDT complet par groupe
    const groupes = creneaux.reduce((acc, c) => {
      const key = `${c.formation}__${c.cohorte}`;
      if (!acc[key]) acc[key] = { formation: c.formation, cohorte: c.cohorte, items: [] };
      acc[key].items.push(c);
      return acc;
    }, {});

    for (const { formation, cohorte, items } of Object.values(groupes)) {
      notifierEtudiantsConcernes(prisma, formation, cohorte, (etudiant) =>
        notifierEmploiDuTempsComplet({ etudiant, creneaux: items, formation, cohorte })
      ).catch((err) => console.error(`❌ Erreur notifications bulk [${formation}–${cohorte}]:`, err));
    }

  } catch (error) {
    console.error("[createBulkCreneaux]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

// ─────────────────────────────────────────────
// PUT /api/emploie/:id  (Admin)
// Modifier un créneau + notifier
// ─────────────────────────────────────────────
export const updateCreneau = async (req, res) => {
  try {
    const { id } = req.params;
    const { formation, cohorte, jour, heureDebut, heureFin, matiere, type, salle } = req.body;

    const ancienCreneau = await prisma.emploiDuTemps.findUnique({ where: { id: parseInt(id) } });
    if (!ancienCreneau)
      return res.status(404).json({ message: "Créneau introuvable." });

    const nouveauCreneau = await prisma.emploiDuTemps.update({
      where: { id: parseInt(id) },
      data: {
        ...(formation  && { formation }),
        ...(cohorte    && { cohorte }),
        ...(jour       && { jour }),
        ...(heureDebut && { heureDebut }),
        ...(heureFin   && { heureFin }),
        ...(matiere    && { matiere }),
        ...(type       && { type }),
        salle: salle !== undefined ? salle : ancienCreneau.salle,
      },
    });

    // ✅ Réponse immédiate
    res.json({
      ...nouveauCreneau,
      notification: "En cours d'envoi aux étudiants concernés..."
    });

    // 📧 Notifier la cohorte concernée
    notifierEtudiantsConcernes(
      prisma,
      nouveauCreneau.formation,
      nouveauCreneau.cohorte,
      (etudiant) => notifierModificationCreneau({ etudiant, ancienCreneau, nouveauCreneau })
    ).catch((err) => console.error("❌ Erreur notifications modification créneau:", err));

  } catch (error) {
    console.error("[updateCreneau]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/emploie/:id  (Admin)
// ─────────────────────────────────────────────
export const deleteCreneau = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.emploiDuTemps.findUnique({ where: { id: parseInt(id) } });
    if (!existing)
      return res.status(404).json({ message: "Créneau introuvable." });

    await prisma.emploiDuTemps.delete({ where: { id: parseInt(id) } });
    return res.json({ message: "Créneau supprimé avec succès." });
  } catch (error) {
    console.error("[deleteCreneau]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/emploie/formation/:formation  (Admin)
// ─────────────────────────────────────────────
export const deleteByFormation = async (req, res) => {
  try {
    const { formation } = req.params;
    const { cohorte } = req.query;

    const where = { formation };
    if (cohorte) where.cohorte = cohorte;

    const result = await prisma.emploiDuTemps.deleteMany({ where });
    return res.json({ message: `${result.count} créneau(x) supprimé(s).`, count: result.count });
  } catch (error) {
    console.error("[deleteByFormation]", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};
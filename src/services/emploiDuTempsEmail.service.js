// src/services/emploiDuTempsEmail.service.js
// Notifications email lors d'ajout/modification de l'emploi du temps
// Compatible avec le transporter nodemailer existant

import nodemailer from 'nodemailer';

// ✅ Réutilise la même configuration SMTP que emailService.js
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { rejectUnauthorized: false, ciphers: 'SSLv3' },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5,
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
  debug: false,
  logger: false
});

// ============================================================
// 🔧 HELPERS
// ============================================================

const getTypeBadge = (type) => {
  const styles = {
    cours: { bg: '#dbeafe', color: '#1d4ed8', label: 'Cours théorique' },
    tp:    { bg: '#dcfce7', color: '#15803d', label: 'Travaux pratiques' },
    projet:{ bg: '#ede9fe', color: '#7c3aed', label: 'Projet' }
  };
  return styles[type] || { bg: '#f3f4f6', color: '#374151', label: type };
};

const getJourEmoji = (jour) => {
  const emojis = {
    Lundi: '📅', Mardi: '📅', Mercredi: '📅',
    Jeudi: '📅', Vendredi: '📅', Samedi: '📅'
  };
  return emojis[jour] || '📅';
};

const formatDate = () =>
  new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// ─── Carte d'un créneau (utilisée dans les emails) ───────────
const creneauCard = (item) => {
  const badge = getTypeBadge(item.type);
  return `
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-left: 4px solid #27446e;
                border-radius: 6px; padding: 16px; margin: 10px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: bold; color: #27446e; font-size: 15px;">
          ${getJourEmoji(item.jour)} ${item.jour}
        </span>
        <span style="background: ${badge.bg}; color: ${badge.color};
                     padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">
          ${badge.label}
        </span>
      </div>
      <p style="margin: 0 0 6px 0; font-size: 14px; color: #1f2937;">
        <strong>Matière :</strong> ${item.matiere}
      </p>
      <p style="margin: 0 0 6px 0; font-size: 14px; color: #1f2937;">
        <strong>Horaire :</strong> ${item.heureDebut} – ${item.heureFin}
      </p>
      <p style="margin: 0; font-size: 14px; color: #1f2937;">
        <strong>Cohorte :</strong> ${item.cohorte}
        ${item.salle ? `&nbsp;|&nbsp;<strong>Salle :</strong> ${item.salle}` : ''}
      </p>
    </div>
  `;
};

// ─── Layout email commun ──────────────────────────────────────
const emailLayout = (title, subtitle, body) => `
  <div style="font-family: 'Georgia', 'Times New Roman', serif;
              max-width: 650px; margin: 0 auto;
              background: #ffffff; border: 1px solid #e5e7eb;">

    <!-- Header -->
    <div style="background: #27446e; padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px;
                 font-weight: normal; letter-spacing: 2px;">TELLYTECH</h1>
      <p style="color: #ffffff; margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">
        École de Formation Professionnelle
      </p>
    </div>

    <!-- Bandeau titre -->
    <div style="background: #e8f0f7; padding: 18px 40px; border-bottom: 2px solid #27446e;">
      <h2 style="margin: 0; color: #27446e; font-size: 18px;">${title}</h2>
      ${subtitle ? `<p style="margin: 6px 0 0 0; color: #673f21; font-size: 13px;">${subtitle}</p>` : ''}
    </div>

    <!-- Corps -->
    <div style="padding: 35px 40px; line-height: 1.8; color: #1f2937;">
      <p style="margin: 0 0 20px 0; font-size: 14px;">Dakar, le ${formatDate()}</p>
      ${body}
      <div style="margin: 40px 0 0 0;">
        <p style="margin: 0; font-weight: bold; color: #27446e; font-size: 14px;">Jean Mamady Cissé</p>
        <p style="margin: 0; font-size: 13px; color: #673f21;">Manager – TellyTech Formation</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 5px 0; color: #27446e; font-size: 13px; font-weight: bold;">Contact</p>
      <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
        Email : technologytelly@gmail.com<br>
        Téléphone : +221 78 111 87 69<br>
        Adresse : Dakar, Sénégal
      </p>
    </div>
  </div>
`;

// ============================================================
// 📧 1. NOTIFICATION — NOUVEAU CRÉNEAU AJOUTÉ
// Envoyé à tous les étudiants concernés (formation + cohorte)
// ============================================================
export const notifierNouveauCreneau = async ({ etudiant, creneau }) => {
  try {
    const body = `
      <p style="margin: 0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin: 0 0 15px 0; text-align: justify;">
        Nous vous informons qu'un nouveau créneau vient d'être ajouté à votre
        emploi du temps pour la formation <strong>${creneau.formation}</strong>.
        Veuillez en prendre note afin d'organiser votre planning en conséquence.
      </p>
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #27446e;">
        📌 Nouveau créneau :
      </p>
      ${creneauCard(creneau)}
      <p style="margin: 20px 0 0 0; text-align: justify; font-size: 14px; color: #374151;">
        Nous vous invitons à consulter l'intégralité de votre emploi du temps
        depuis votre espace étudiant afin d'avoir une vue complète de votre planning.
      </p>
    `;

    const mailOptions = {
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email,
      replyTo: process.env.EMAIL_USER,
      subject: `📅 Nouveau créneau ajouté – ${creneau.formation} | TellyTech`,
      html: emailLayout(
        '📅 Nouveau créneau ajouté à votre emploi du temps',
        `Formation : ${creneau.formation} – ${creneau.cohorte}`,
        body
      )
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Notif nouveau créneau → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };

  } catch (error) {
    console.error(`❌ Erreur notif nouveau créneau → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 2. NOTIFICATION — CRÉNEAU MODIFIÉ
// Envoyé à tous les étudiants concernés
// ============================================================
export const notifierModificationCreneau = async ({ etudiant, ancienCreneau, nouveauCreneau }) => {
  try {
    const body = `
      <p style="margin: 0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin: 0 0 15px 0; text-align: justify;">
        Nous vous informons d'une <strong>modification</strong> dans votre emploi du temps
        pour la formation <strong>${nouveauCreneau.formation}</strong>.
        Merci de mettre à jour votre planning.
      </p>

      <!-- Avant -->
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #dc2626;">
        ❌ Ancien créneau :
      </p>
      <div style="opacity: 0.7; filter: grayscale(30%);">
        ${creneauCard(ancienCreneau)}
      </div>

      <!-- Après -->
      <p style="margin: 15px 0 8px 0; font-weight: bold; color: #16a34a;">
        ✅ Nouveau créneau :
      </p>
      ${creneauCard(nouveauCreneau)}

      <p style="margin: 20px 0 0 0; text-align: justify; font-size: 14px; color: #374151;">
        Pour toute question concernant cette modification, n'hésitez pas à
        contacter l'administration via votre espace étudiant ou par email.
      </p>
    `;

    const mailOptions = {
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email,
      replyTo: process.env.EMAIL_USER,
      subject: `⚠️ Modification de votre emploi du temps – ${nouveauCreneau.formation} | TellyTech`,
      html: emailLayout(
        '⚠️ Modification de votre emploi du temps',
        `Formation : ${nouveauCreneau.formation} – ${nouveauCreneau.cohorte}`,
        body
      )
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Notif modification → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };

  } catch (error) {
    console.error(`❌ Erreur notif modification → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 3. NOTIFICATION — EMPLOI DU TEMPS COMPLET PUBLIÉ (bulk)
// Envoyé après un ajout en masse (POST /bulk)
// ============================================================
export const notifierEmploiDuTempsComplet = async ({ etudiant, creneaux, formation, cohorte }) => {
  try {
    // Grouper les créneaux par jour pour l'affichage
    const joursOrdre = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const groupes = joursOrdre
      .map((jour) => ({ jour, items: creneaux.filter((c) => c.jour === jour) }))
      .filter((g) => g.items.length > 0);

    const creneauxHtml = groupes.map(({ jour, items }) => `
      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0; font-weight: bold; color: #27446e;
                  font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
          ${getJourEmoji(jour)} ${jour}
        </p>
        ${items.map(creneauCard).join('')}
      </div>
    `).join('');

    const body = `
      <p style="margin: 0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin: 0 0 15px 0; text-align: justify;">
        Nous avons le plaisir de vous communiquer votre emploi du temps complet
        pour la formation <strong>${formation}</strong> – <strong>${cohorte}</strong>.
        Veuillez en prendre connaissance et organiser votre planning en conséquence.
      </p>

      <div style="background: #e8f0f7; padding: 4px 16px;
                  border-left: 4px solid #27446e; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 10px 0; font-size: 13px; color: #374151;">
          📊 <strong>${creneaux.length} créneau(x)</strong> au total cette semaine
        </p>
      </div>

      ${creneauxHtml}

      <p style="margin: 20px 0 0 0; text-align: justify; font-size: 14px; color: #374151;">
        💡 <strong>Conseil :</strong> Soyez ponctuel et préparez vos questions à l'avance
        pour profiter au maximum de chaque session. L'emploi du temps complet est
        également disponible depuis votre espace étudiant.
      </p>
    `;

    const mailOptions = {
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email,
      replyTo: process.env.EMAIL_USER,
      subject: `📅 Votre emploi du temps – ${formation} | TellyTech`,
      html: emailLayout(
        '📅 Votre emploi du temps est disponible',
        `Formation : ${formation} – ${cohorte}`,
        body
      )
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Notif EDT complet → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };

  } catch (error) {
    console.error(`❌ Erreur notif EDT complet → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 🚀 DISPATCHER — Envoie à TOUS les étudiants concernés
// Utilisé directement dans le controller
// ============================================================

/**
 * Récupère les étudiants actifs d'une formation + cohorte
 * et envoie les notifications en parallèle (avec rate limiting)
 *
 * @param {PrismaClient} prisma
 * @param {string} formation  - slug de la formation
 * @param {string} cohorte    - ex: "Cohorte 1"
 * @param {Function} sendFn   - fonction async (etudiant) => void
 */
export const notifierEtudiantsConcernes = async (prisma, formation, cohorte, sendFn) => {
  try {
    // Récupère tous les inscrits actifs et validés de la formation + cohorte
    const etudiants = await prisma.inscription.findMany({
      where: {
        formation,
        estActif: true,
        status: 'VALIDATED',
        // La cohorte dans Inscription est un Int (1, 2, ...)
        // On extrait le numéro depuis "Cohorte 1" → 1
        cohorte: parseInt(cohorte.replace(/\D/g, '')) || undefined
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true
      }
    });

    if (etudiants.length === 0) {
      console.log(`ℹ️ Aucun étudiant actif trouvé pour ${formation} – ${cohorte}`);
      return { sent: 0, failed: 0, results: [] };
    }

    console.log(`📨 Envoi notifications à ${etudiants.length} étudiant(s) [${formation} – ${cohorte}]`);

    // Envoi par batch de 5 (respect rate limit SMTP)
    const BATCH_SIZE = 5;
    const results = [];

    for (let i = 0; i < etudiants.length; i += BATCH_SIZE) {
      const batch = etudiants.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(batch.map((etudiant) => sendFn(etudiant)));

      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') results.push(r.value);
        else results.push({ success: false, email: batch[idx].email, error: r.reason?.message });
      });

      // Pause entre les batchs pour ne pas saturer le SMTP
      if (i + BATCH_SIZE < etudiants.length) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    const sent   = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`✅ Notifications EDT : ${sent} envoyées, ${failed} échecs`);
    return { sent, failed, results };

  } catch (error) {
    console.error('❌ Erreur dispatcher notifications EDT:', error);
    throw error;
  }
};
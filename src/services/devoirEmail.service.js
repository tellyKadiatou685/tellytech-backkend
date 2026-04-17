// src/services/devoirEmail.service.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false, ciphers: 'SSLv3' },
  pool: true, maxConnections: 5, maxMessages: 100,
  rateDelta: 1000, rateLimit: 5,
  connectionTimeout: 60000, greetingTimeout: 60000, socketTimeout: 60000,
  debug: false, logger: false
});

// ============================================================
// 🔧 HELPERS
// ============================================================

const formatDate = (date) =>
  new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

const formatDateCourte = () =>
  new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

const devoirCard = (devoir) => `
  <div style="background:#f9fafb;border:1px solid #e5e7eb;
              border-left:4px solid #27446e;border-radius:6px;
              padding:16px;margin:10px 0;">
    <p style="margin:0 0 8px 0;font-weight:bold;color:#27446e;font-size:15px;">
      📝 ${devoir.titre}
    </p>
    <p style="margin:0 0 6px 0;font-size:14px;color:#1f2937;">
      <strong>Formation :</strong> ${devoir.formation}
      ${devoir.cohorte ? `&nbsp;|&nbsp;<strong>Cohorte :</strong> ${devoir.cohorte}` : ' – Toutes cohortes'}
    </p>
    <p style="margin:0 0 6px 0;font-size:14px;color:#1f2937;">
      <strong>Ouverture :</strong> ${formatDate(devoir.ouvertureAt)}
    </p>
    <p style="margin:0 0 6px 0;font-size:14px;color:#dc2626;font-weight:bold;">
      <strong>⏰ Deadline :</strong> ${formatDate(devoir.deadline)}
    </p>
    <p style="margin:0;font-size:14px;color:#1f2937;">
      <strong>Durée :</strong> ${devoir.dureeMinutes} minutes
    </p>
  </div>
`;

const emailLayout = (title, subtitle, body) => `
  <div style="font-family:'Georgia','Times New Roman',serif;
              max-width:650px;margin:0 auto;
              background:#ffffff;border:1px solid #e5e7eb;">
    <div style="background:#27446e;padding:30px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:26px;
                 font-weight:normal;letter-spacing:2px;">TELLYTECH</h1>
      <p style="color:#ffffff;margin:8px 0 0 0;font-size:13px;opacity:0.9;">
        École de Formation Professionnelle
      </p>
    </div>
    <div style="background:#e8f0f7;padding:18px 40px;border-bottom:2px solid #27446e;">
      <h2 style="margin:0;color:#27446e;font-size:18px;">${title}</h2>
      ${subtitle ? `<p style="margin:6px 0 0 0;color:#673f21;font-size:13px;">${subtitle}</p>` : ''}
    </div>
    <div style="padding:35px 40px;line-height:1.8;color:#1f2937;">
      <p style="margin:0 0 20px 0;font-size:14px;">Dakar, le ${formatDateCourte()}</p>
      ${body}
      <div style="margin:40px 0 0 0;">
        <p style="margin:0;font-weight:bold;color:#27446e;font-size:14px;">Jean Mamady Cissé</p>
        <p style="margin:0;font-size:13px;color:#673f21;">Manager – TellyTech Formation</p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 5px 0;color:#27446e;font-size:13px;font-weight:bold;">Contact</p>
      <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
        Email : technologytelly@gmail.com<br>
        Téléphone : +221 78 111 87 69<br>
        Adresse : Dakar, Sénégal
      </p>
    </div>
  </div>
`;

// Badge couleur appréciation
const appreciationBadge = (appreciation, noteAffichee) => {
  const styles = {
    'Excellent':    { bg: '#f0fdf4', border: '#16a34a', text: '#15803d', icon: '🏆' },
    'Bien':         { bg: '#f0fdf4', border: '#16a34a', text: '#15803d', icon: '✅' },
    'Assez bien':   { bg: '#fffbeb', border: '#d97706', text: '#92400e', icon: '👍' },
    'Passable':     { bg: '#fffbeb', border: '#d97706', text: '#92400e', icon: '⚠️' },
    'Insuffisant':  { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', icon: '❌' },
  };
  const s = styles[appreciation] || styles['Insuffisant'];
  return `
    <div style="background:${s.bg};border:1px solid ${s.border};
                border-radius:8px;padding:24px;margin:16px 0;text-align:center;">
      <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;">Note obtenue</p>
      <p style="margin:0 0 8px 0;font-size:48px;font-weight:bold;color:${s.text};">
        ${noteAffichee}<span style="font-size:22px;color:#9ca3af;">/20</span>
      </p>
      <p style="margin:0;font-size:16px;font-weight:bold;color:${s.text};">
        ${s.icon} ${appreciation}
      </p>
    </div>
  `;
};

// ============================================================
// 📧 1. DEVOIR DISPONIBLE (création)
// ============================================================
export const notifierDevoirDisponible = async ({ etudiant, devoir }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Nous vous informons qu'un nouveau devoir est disponible sur votre espace étudiant
        pour la formation <strong>${devoir.formation}</strong>.
        Veuillez en prendre connaissance et soumettre votre travail avant la date limite.
      </p>
      ${devoirCard(devoir)}
      ${devoir.consigne ? `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;
                  padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 6px 0;font-weight:bold;color:#92400e;font-size:13px;">📋 Consigne :</p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;">${devoir.consigne}</p>
      </div>` : ''}
      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Connectez-vous à votre espace étudiant pour télécharger l'énoncé et soumettre votre travail.
        Tout rendu après la deadline sera automatiquement refusé par le système.
      </p>
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `📝 Nouveau devoir disponible – ${devoir.titre} | TellyTech`,
      html: emailLayout('📝 Un nouveau devoir est disponible', `Formation : ${devoir.formation}`, body)
    });
    console.log(`✅ Notif devoir disponible → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif devoir disponible → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 2. DEVOIR MODIFIÉ
// ============================================================
export const notifierDevoirModifie = async ({ etudiant, ancienDevoir, nouveauDevoir }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Nous vous informons d'une <strong>modification</strong> apportée au devoir suivant
        pour la formation <strong>${nouveauDevoir.formation}</strong>.
        Veuillez prendre connaissance des nouvelles informations.
      </p>
      <p style="margin:0 0 8px 0;font-weight:bold;color:#dc2626;">❌ Ancienne version :</p>
      <div style="opacity:0.7;">${devoirCard(ancienDevoir)}</div>
      <p style="margin:15px 0 8px 0;font-weight:bold;color:#16a34a;">✅ Nouvelle version :</p>
      ${devoirCard(nouveauDevoir)}
      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Pour toute question, contactez l'administration via votre espace étudiant.
      </p>
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `⚠️ Modification du devoir – ${nouveauDevoir.titre} | TellyTech`,
      html: emailLayout('⚠️ Un devoir a été modifié', `Formation : ${nouveauDevoir.formation}`, body)
    });
    console.log(`✅ Notif devoir modifié → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif devoir modifié → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 3. DEVOIR SUPPRIMÉ
// ============================================================
export const notifierDevoirSupprime = async ({ etudiant, devoir }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Nous vous informons que le devoir suivant a été <strong>annulé et supprimé</strong>
        pour la formation <strong>${devoir.formation}</strong>.
      </p>
      <div style="opacity:0.7;">${devoirCard(devoir)}</div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;
                  border-radius:6px;padding:14px 16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#991b1b;">
          🗑️ Ce devoir a été annulé. Vous n'avez plus besoin de soumettre de rendu.
          Si vous avez déjà soumis, votre rendu ne sera pas évalué.
        </p>
      </div>
      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Pour toute question, contactez l'administration via votre espace étudiant.
      </p>
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `🗑️ Devoir annulé – ${devoir.titre} | TellyTech`,
      html: emailLayout('🗑️ Un devoir a été annulé', `Formation : ${devoir.formation}`, body)
    });
    console.log(`✅ Notif devoir supprimé → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif devoir supprimé → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 4. RAPPEL 10 MINUTES AVANT DEADLINE
// ============================================================
export const notifierRappelDeadline = async ({ etudiant, devoir }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;
                  border-left:4px solid #dc2626;border-radius:6px;
                  padding:16px;margin:16px 0;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#dc2626;">⏰ Plus que 10 minutes !</p>
        <p style="margin:8px 0 0 0;font-size:14px;color:#7f1d1d;">
          La deadline du devoir <strong>${devoir.titre}</strong> se termine à
          <strong>${formatDate(devoir.deadline)}</strong>
        </p>
      </div>
      <p style="margin:15px 0;text-align:justify;font-size:14px;color:#374151;">
        Si vous n'avez pas encore soumis votre travail, connectez-vous immédiatement.
        Tout rendu après la deadline sera automatiquement refusé.
      </p>
      ${devoirCard(devoir)}
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `⏰ URGENT – 10 min avant la deadline : ${devoir.titre} | TellyTech`,
      html: emailLayout('⏰ Rappel : Deadline dans 10 minutes', `Devoir : ${devoir.titre}`, body)
    });
    console.log(`✅ Notif rappel deadline → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif rappel deadline → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 5. CONFIRMATION SOUMISSION
// ============================================================
export const notifierConfirmationSoumission = async ({ etudiant, devoir, soumission }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Nous confirmons la bonne réception de votre rendu pour le devoir suivant :
      </p>
      ${devoirCard(devoir)}
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                  border-left:4px solid #16a34a;border-radius:6px;
                  padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 6px 0;font-weight:bold;color:#15803d;font-size:13px;">✅ Rendu reçu avec succès</p>
        <p style="margin:0;font-size:14px;color:#1f2937;">
          <strong>Fichier :</strong> ${soumission.fileName || 'Fichier soumis'}<br>
          <strong>Soumis le :</strong> ${formatDate(soumission.soumisAt)}
        </p>
      </div>
      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Votre travail sera corrigé dans les meilleurs délais.
      </p>
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `✅ Rendu confirmé – ${devoir.titre} | TellyTech`,
      html: emailLayout('✅ Votre rendu a bien été reçu', `Devoir : ${devoir.titre}`, body)
    });
    console.log(`✅ Notif confirmation soumission → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif confirmation soumission → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 6. DEVOIR CORRIGÉ (note individuelle + appréciation)
// ============================================================
export const notifierDevoirCorrige = async ({ etudiant, devoir, soumission }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Votre devoir <strong>${devoir.titre}</strong> a été corrigé. Voici votre résultat :
      </p>
      ${appreciationBadge(soumission.appreciation || 'Insuffisant', soumission.note)}
      ${soumission.feedback ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;
                  border-left:4px solid #27446e;border-radius:6px;
                  padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 8px 0;font-weight:bold;color:#27446e;font-size:13px;">💬 Commentaire du correcteur :</p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;">${soumission.feedback}</p>
      </div>` : ''}
      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Votre moyenne finale sera calculée automatiquement une fois tous vos devoirs corrigés.
      </p>
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `📊 Résultat – ${devoir.titre} : ${soumission.note}/20 (${soumission.appreciation}) | TellyTech`,
      html: emailLayout('📊 Votre devoir a été corrigé', `Devoir : ${devoir.titre}`, body)
    });
    console.log(`✅ Notif devoir corrigé → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif devoir corrigé → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 7. MOYENNE FINALE (déclenchée automatiquement)
// ============================================================
export const notifierMoyenneFinale = async ({ etudiant, formation, soumissions, moyenne, appreciation }) => {
  try {
    // Tableau détaillé des devoirs
    const lignesDevoirs = soumissions.map((s) => `
      <tr>
        <td style="padding:10px 14px;font-size:14px;color:#1f2937;
                   border-bottom:1px solid #e5e7eb;">${s.devoir?.titre || '—'}</td>
        <td style="padding:10px 14px;font-size:14px;font-weight:bold;
                   text-align:center;border-bottom:1px solid #e5e7eb;color:#27446e;">
          ${s.note}/20
        </td>
        <td style="padding:10px 14px;font-size:13px;text-align:center;
                   border-bottom:1px solid #e5e7eb;color:#6b7280;">
          ${s.appreciation || '—'}
        </td>
      </tr>
    `).join('');

    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Tous vos devoirs pour la formation <strong>${formation}</strong> ont été corrigés.
        Voici votre bilan de fin de parcours :
      </p>

      <!-- Tableau des devoirs -->
      <table style="width:100%;border-collapse:collapse;margin:16px 0;
                    border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <thead>
          <tr style="background:#e8f0f7;">
            <th style="padding:10px 14px;text-align:left;font-size:13px;
                       color:#27446e;font-weight:bold;border-bottom:2px solid #27446e;">
              Devoir
            </th>
            <th style="padding:10px 14px;text-align:center;font-size:13px;
                       color:#27446e;font-weight:bold;border-bottom:2px solid #27446e;width:80px;">
              Note
            </th>
            <th style="padding:10px 14px;text-align:center;font-size:13px;
                       color:#27446e;font-weight:bold;border-bottom:2px solid #27446e;width:120px;">
              Appréciation
            </th>
          </tr>
        </thead>
        <tbody>
          ${lignesDevoirs}
        </tbody>
      </table>

      <!-- Moyenne finale mise en avant -->
      ${appreciationBadge(appreciation.label, moyenne)}

      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Ce résultat tient compte de l'ensemble de vos devoirs sur la formation.
        Pour toute question, contactez votre coach via votre espace étudiant.
      </p>
    `;

    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `🎓 Bilan final – Moyenne : ${moyenne}/20 (${appreciation.label}) | TellyTech`,
      html: emailLayout(
        '🎓 Votre bilan de formation',
        `Formation : ${formation} – Moyenne générale : ${moyenne}/20`,
        body
      )
    });
    console.log(`✅ Notif moyenne finale → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif moyenne finale → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 🚀 DISPATCHER — Envoie à TOUS les étudiants concernés
// ============================================================
export const notifierEtudiantsConcernesDevoir = async (prisma, formation, cohorte, sendFn) => {
  try {
    console.log('🔍 Recherche étudiants pour devoir:', { formation, cohorte });

    const etudiants = await prisma.inscription.findMany({
      where: {
        formation,
        estActif: true,
        status: 'VALIDATED',
        ...(cohorte ? { cohorte } : {})
      },
      select: { id: true, nom: true, prenom: true, email: true }
    });

    console.log(`👥 Étudiants trouvés: ${etudiants.length}`, etudiants.map(e => e.email));

    if (etudiants.length === 0) {
      console.log(`ℹ️ Aucun étudiant actif trouvé pour formation="${formation}" cohorte=${cohorte ?? 'toutes'}`);
      return { sent: 0, failed: 0, results: [] };
    }

    console.log(`📨 Envoi notifications devoir à ${etudiants.length} étudiant(s)`);

    const BATCH_SIZE = 5;
    const results = [];

    for (let i = 0; i < etudiants.length; i += BATCH_SIZE) {
      const batch = etudiants.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(batch.map((e) => sendFn(e)));
      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') results.push(r.value);
        else results.push({ success: false, email: batch[idx].email, error: r.reason?.message });
      });
      if (i + BATCH_SIZE < etudiants.length) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    const sent   = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`✅ Notifications devoir : ${sent} envoyées, ${failed} échecs`);
    if (failed > 0) console.log('❌ Échecs:', results.filter(r => !r.success));

    return { sent, failed, results };
  } catch (error) {
    console.error('❌ Erreur dispatcher notifications devoir:', error);
    throw error;
  }
};
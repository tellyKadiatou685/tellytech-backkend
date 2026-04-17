// src/services/devoirSoumissionEmail.service.js
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
// 🔧 HELPERS (repris du service existant pour cohérence)
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

const soumissionCard = (devoir, soumission) => `
  <div style="background:#f9fafb;border:1px solid #e5e7eb;
              border-left:4px solid #27446e;border-radius:6px;
              padding:16px;margin:10px 0;">
    <p style="margin:0 0 8px 0;font-weight:bold;color:#27446e;font-size:15px;">
      📝 ${devoir.titre}
    </p>
    <p style="margin:0 0 6px 0;font-size:14px;color:#1f2937;">
      <strong>Formation :</strong> ${devoir.formation}
    </p>
    <p style="margin:0 0 6px 0;font-size:14px;color:#1f2937;">
      <strong>Fichier soumis :</strong> ${soumission.fileName || 'Fichier soumis'}
    </p>
    <p style="margin:0;font-size:14px;color:#1f2937;">
      <strong>Soumis le :</strong> ${formatDate(soumission.soumisAt)}
    </p>
  </div>
`;

// ============================================================
// 📧 1. SOUMISSION VALIDÉE
// ============================================================
export const notifierSoumissionValidee = async ({ etudiant, devoir, soumission }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Nous avons le plaisir de vous informer que votre rendu pour le devoir suivant
        a été <strong>validé</strong> par votre coach.
      </p>
      ${soumissionCard(devoir, soumission)}
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                  border-left:4px solid #16a34a;border-radius:6px;
                  padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 6px 0;font-weight:bold;color:#15803d;font-size:13px;">✅ Rendu validé</p>
        <p style="margin:0;font-size:14px;color:#1f2937;">
          Votre travail a été accepté. Félicitations pour votre implication !
        </p>
      </div>
      ${soumission.feedback ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;
                  border-left:4px solid #27446e;border-radius:6px;
                  padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 8px 0;font-weight:bold;color:#27446e;font-size:13px;">💬 Commentaire du coach :</p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;">${soumission.feedback}</p>
      </div>` : ''}
      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Connectez-vous à votre espace étudiant pour consulter les détails.
      </p>
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `✅ Rendu validé – ${devoir.titre} | TellyTech`,
      html: emailLayout('✅ Votre rendu a été validé', `Devoir : ${devoir.titre}`, body)
    });
    console.log(`✅ Notif soumission validée → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif soumission validée → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 2. SOUMISSION REJETÉE
// ============================================================
export const notifierSoumissionRejetee = async ({ etudiant, devoir, soumission }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Nous vous informons que votre rendu pour le devoir suivant a été
        <strong>rejeté</strong> par votre coach.
      </p>
      ${soumissionCard(devoir, soumission)}
      <div style="background:#fef2f2;border:1px solid #fecaca;
                  border-left:4px solid #dc2626;border-radius:6px;
                  padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 6px 0;font-weight:bold;color:#991b1b;font-size:13px;">❌ Rendu rejeté</p>
        <p style="margin:0;font-size:14px;color:#1f2937;">
          Votre rendu n'a pas été accepté. Veuillez prendre connaissance
          du motif ci-dessous et recontacter votre coach si nécessaire.
        </p>
      </div>
      ${soumission.motifRejet ? `
      <div style="background:#fff7ed;border:1px solid #fed7aa;
                  border-left:4px solid #ea580c;border-radius:6px;
                  padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 8px 0;font-weight:bold;color:#9a3412;font-size:13px;">📋 Motif du rejet :</p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;">${soumission.motifRejet}</p>
      </div>` : ''}
      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Pour toute question, contactez votre coach via votre espace étudiant.
      </p>
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `❌ Rendu rejeté – ${devoir.titre} | TellyTech`,
      html: emailLayout('❌ Votre rendu a été rejeté', `Devoir : ${devoir.titre}`, body)
    });
    console.log(`✅ Notif soumission rejetée → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif soumission rejetée → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};

// ============================================================
// 📧 3. MESSAGE DU COACH / ADMIN
// ============================================================
export const notifierMessageCoach = async ({ etudiant, devoir, soumission, message, expediteur }) => {
  try {
    const body = `
      <p style="margin:0 0 15px 0;">
        Madame, Monsieur <strong>${etudiant.prenom} ${etudiant.nom}</strong>,
      </p>
      <p style="margin:0 0 15px 0;text-align:justify;">
        Vous avez reçu un message de votre coach concernant votre rendu
        pour le devoir <strong>${devoir.titre}</strong>.
      </p>
      ${soumissionCard(devoir, soumission)}
      <div style="background:#f8fafc;border:1px solid #e2e8f0;
                  border-left:4px solid #27446e;border-radius:6px;
                  padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 8px 0;font-weight:bold;color:#27446e;font-size:13px;">
          💬 Message de ${expediteur?.prenom ? `${expediteur.prenom} ${expediteur.nom}` : 'votre coach'} :
        </p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.7;white-space:pre-line;">${message}</p>
      </div>
      <p style="margin:20px 0 0 0;text-align:justify;font-size:14px;color:#374151;">
        Connectez-vous à votre espace étudiant pour consulter et répondre à ce message.
      </p>
    `;
    const info = await transporter.sendMail({
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: etudiant.email, replyTo: process.env.EMAIL_USER,
      subject: `💬 Message coach – ${devoir.titre} | TellyTech`,
      html: emailLayout('💬 Un message de votre coach', `Devoir : ${devoir.titre}`, body)
    });
    console.log(`✅ Notif message coach → ${etudiant.email} | ID: ${info.messageId}`);
    return { success: true, email: etudiant.email, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Erreur notif message coach → ${etudiant.email}:`, error.message);
    return { success: false, email: etudiant.email, error: error.message };
  }
};
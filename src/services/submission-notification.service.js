import nodemailer from 'nodemailer';
import prisma from '../config/database.js';

class SubmissionNotificationService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST,
      port:   parseInt(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // ── Récupérer les emails admin + coach ──────────────────────────────────────
  async getAdminAndCoachEmails() {
    try {
      const users = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'COACH'] } },
        select: { email: true }
      });
      const emails = users.map(u => u.email).filter(Boolean);
      // Ajouter ADMIN_EMAIL depuis .env si pas déjà dedans
      if (process.env.ADMIN_EMAIL && !emails.includes(process.env.ADMIN_EMAIL)) {
        emails.push(process.env.ADMIN_EMAIL);
      }
      return emails.length > 0 ? emails.join(',') : process.env.ADMIN_EMAIL;
    } catch (error) {
      console.error('❌ getAdminAndCoachEmails:', error.message);
      return process.env.ADMIN_EMAIL;
    }
  }

  async notifierAdminNouveauTD(inscription, lessonTitle, submissionLink) {
    try {
      const to = await this.getAdminAndCoachEmails();
      await this.transporter.sendMail({
        from:    process.env.EMAIL_FROM,
        to,
        subject: `📝 Nouveau TD à corriger : ${lessonTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ea580c;">📝 Nouveau TD soumis</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Informations de l'étudiant</h3>
              <p><strong>Nom :</strong> ${inscription.prenom} ${inscription.nom}</p>
              <p><strong>Email :</strong> ${inscription.email}</p>
              <p><strong>Formation :</strong> ${inscription.formation}</p>
              ${inscription.cohorte ? `<p><strong>Cohorte :</strong> ${inscription.cohorte}</p>` : ''}
            </div>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="font-weight: 600; color: #92400e;">📚 Leçon : ${lessonTitle}</p>
              <p><strong>Travail soumis :</strong><br>
                <a href="${submissionLink}" target="_blank" style="color: #ea580c;">${submissionLink}</a>
              </p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/admin/submissions"
                 style="background: #ea580c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Corriger le TD
              </a>
            </div>
            <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 30px;">
              Technology Telly - Plateforme LMS
            </p>
          </div>
        `,
      });
      console.log(`✅ Notification admin/coach envoyée pour ${lessonTitle} → ${to}`);
    } catch (error) {
      console.error('❌ notifierAdminNouveauTD:', error.message);
    }
  }

  async confirmerSoumission(inscription, lessonTitle) {
    try {
      await this.transporter.sendMail({
        from:    process.env.EMAIL_FROM,
        to:      inscription.email,
        subject: `📬 TD reçu : ${lessonTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">TD bien reçu !</h2>
            <p>Bonjour ${inscription.prenom},</p>
            <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #1e40af; margin: 0;">
                ✅ Votre TD "<strong>${lessonTitle}</strong>" a bien été soumis et est en cours de correction.
              </p>
            </div>
            <p style="color: #6b7280;">Vous recevrez un email dès que votre formateur aura évalué votre travail.</p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">Technology Telly - ${inscription.formation}</p>
          </div>
        `,
      });
      console.log(`✅ Confirmation envoyée à ${inscription.email}`);
    } catch (error) {
      console.error('❌ confirmerSoumission:', error.message);
    }
  }

  async notifierEtudiantValidation(inscription, lessonTitle, note = null) {
    try {
      const noteBadge = note !== null
        ? `<div style="background: #dcfce7; border: 2px solid #16a34a; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
             <p style="font-size: 32px; font-weight: 700; color: #15803d; margin: 0;">${note}/20</p>
             <p style="color: #166534; margin: 4px 0 0 0;">Votre note</p>
           </div>`
        : '';

      await this.transporter.sendMail({
        from:    process.env.EMAIL_FROM,
        to:      inscription.email,
        subject: `✅ TD validé : ${lessonTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #16a34a; font-size: 32px; margin: 0;">🎉 Félicitations !</h1>
            </div>
            <div style="background: linear-gradient(135deg, #dcfce7, #bbf7d0); padding: 30px; border-radius: 12px; margin: 20px 0;">
              <h2 style="color: #15803d; margin-top: 0;">Bonjour ${inscription.prenom},</h2>
              <p style="color: #166534; font-size: 16px; line-height: 1.6;">
                Votre TD "<strong>${lessonTitle}</strong>" a été validé par votre formateur.
              </p>
            </div>
            ${noteBadge}
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 20px 0;">
              <p style="color: #15803d; font-weight: 600; margin: 0;">
                ✨ Vous pouvez maintenant accéder à la leçon suivante !
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard/courses"
                 style="background: #16a34a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Continuer ma formation
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
              Technology Telly - ${inscription.formation}
            </p>
          </div>
        `,
      });
      console.log(`✅ Email validation envoyé à ${inscription.email}`);
    } catch (error) {
      console.error('❌ notifierEtudiantValidation:', error.message);
    }
  }

  async notifierEtudiantRejet(inscription, lessonTitle, feedback) {
    try {
      await this.transporter.sendMail({
        from:    process.env.EMAIL_FROM,
        to:      inscription.email,
        subject: `❌ TD à revoir : ${lessonTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #dc2626; font-size: 28px; margin: 0;">📝 Corrections nécessaires</h1>
            </div>
            <div style="background: #fef2f2; padding: 25px; border-radius: 12px; margin: 20px 0;">
              <h2 style="color: #991b1b; margin-top: 0;">Bonjour ${inscription.prenom},</h2>
              <p style="color: #7f1d1d; font-size: 16px; line-height: 1.6;">
                Votre TD "<strong>${lessonTitle}</strong>" nécessite des corrections avant validation.
              </p>
            </div>
            <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
              <h3 style="color: #991b1b; margin-top: 0;">💬 Commentaires du formateur :</h3>
              <div style="background: white; padding: 15px; border-radius: 6px;">
                <p style="color: #374151; margin: 0; white-space: pre-wrap; line-height: 1.6;">${feedback}</p>
              </div>
            </div>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0;">
                ℹ️ <strong>Que faire ?</strong><br>
                Prenez en compte les remarques ci-dessus et soumettez à nouveau votre travail corrigé.
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard/courses"
                 style="background: #dc2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Revoir mon TD
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
              Technology Telly - ${inscription.formation}
            </p>
          </div>
        `,
      });
      console.log(`✅ Email rejet envoyé à ${inscription.email}`);
    } catch (error) {
      console.error('❌ notifierEtudiantRejet:', error.message);
    }
  }
}

export default new SubmissionNotificationService();
import nodemailer from 'nodemailer';

class SubmissionNotificationService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * 📩 TD soumis → Notifier l'admin
   */
  async notifierAdminNouveauTD(inscription, lessonTitle, submissionLink) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.ADMIN_EMAIL,
      subject: `📝 Nouveau TD à corriger : ${lessonTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ea580c;">📝 Nouveau TD soumis</h2>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Informations de l'étudiant</h3>
            <p style="margin: 8px 0;"><strong>Nom :</strong> ${inscription.prenom} ${inscription.nom}</p>
            <p style="margin: 8px 0;"><strong>Email :</strong> ${inscription.email}</p>
            <p style="margin: 8px 0;"><strong>Téléphone :</strong> ${inscription.telephone}</p>
            <p style="margin: 8px 0;"><strong>Formation :</strong> ${inscription.formation}</p>
            ${inscription.cohorte ? `<p style="margin: 8px 0;"><strong>Cohorte :</strong> ${inscription.cohorte}</p>` : ''}
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-weight: 600; color: #92400e;">📚 Leçon : ${lessonTitle}</p>
            <p style="margin: 10px 0 0 0;">
              <strong>Lien du travail :</strong><br>
              <a href="${submissionLink}" target="_blank" style="color: #ea580c; word-break: break-all;">${submissionLink}</a>
            </p>
          </div>

          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://tellytech-backkend.vercel.app'}/admin/submissions" 
               style="display: inline-block; background: #ea580c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Corriger le TD
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center;">
            Technology Telly - Plateforme LMS
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Notification TD envoyée à l'admin pour ${lessonTitle}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi notification TD admin:', error);
      return false;
    }
  }

  /**
   * ✅ TD validé → Notifier l'étudiant
   */
  async notifierEtudiantValidation(inscription, lessonTitle) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: inscription.email,
      subject: `✅ TD validé : ${lessonTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #16a34a; font-size: 32px; margin: 0;">🎉 Félicitations !</h1>
          </div>

          <div style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); padding: 30px; border-radius: 12px; margin: 20px 0;">
            <h2 style="color: #15803d; margin-top: 0;">Bonjour ${inscription.prenom},</h2>
            <p style="color: #166534; font-size: 16px; line-height: 1.6;">
              Votre TD "<strong>${lessonTitle}</strong>" a été validé par votre formateur.
            </p>
          </div>

          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #15803d; font-weight: 600;">
              ✨ Vous pouvez maintenant accéder à la leçon suivante !
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/courses" 
               style="display: inline-block; background: #16a34a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Continuer ma formation
            </a>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 30px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
              💪 Continuez comme ça ! Vous êtes sur la bonne voie.
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; text-align: center;">
            Technology Telly - ${inscription.formation}
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email validation envoyé à ${inscription.email} pour ${lessonTitle}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi email validation étudiant:', error);
      return false;
    }
  }

  /**
   * ❌ TD rejeté → Notifier l'étudiant avec feedback
   */
  async notifierEtudiantRejet(inscription, lessonTitle, feedback) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: inscription.email,
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
            <div style="background: white; padding: 15px; border-radius: 6px; margin-top: 10px;">
              <p style="color: #374151; margin: 0; white-space: pre-wrap; line-height: 1.6;">${feedback}</p>
            </div>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              ℹ️ <strong>Que faire maintenant ?</strong><br>
              Prenez en compte les remarques ci-dessus et soumettez à nouveau votre travail corrigé.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://tellytech-backkend.vercel.app'}/student/courses" 
               style="display: inline-block; background: #dc2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Revoir mon TD
            </a>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 30px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
              💡 Besoin d'aide ? N'hésitez pas à contacter votre formateur.
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; text-align: center;">
            Technology Telly - ${inscription.formation}
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email rejet envoyé à ${inscription.email} pour ${lessonTitle}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi email rejet étudiant:', error);
      return false;
    }
  }

  /**
   * ⏳ TD en attente → Confirmation de soumission à l'étudiant (optionnel)
   */
  async confirmerSoumission(inscription, lessonTitle) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: inscription.email,
      subject: `📬 TD reçu : ${lessonTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">TD bien reçu !</h2>
          
          <p>Bonjour ${inscription.prenom},</p>
          
          <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af;">
              ✅ Votre TD "<strong>${lessonTitle}</strong>" a bien été soumis et est en cours de correction.
            </p>
          </div>

          <p style="color: #6b7280;">
            Vous recevrez un email dès que votre formateur aura évalué votre travail.
          </p>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
            Technology Telly - ${inscription.formation}
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Confirmation soumission envoyée à ${inscription.email}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi confirmation soumission:', error);
      return false;
    }
  }
}

export default new SubmissionNotificationService();
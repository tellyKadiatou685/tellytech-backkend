import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// ✅ Configuration SMTP optimisée pour PDFs
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5,
  connectionTimeout: 60000, // ✅ 60 secondes (était 30s)
  greetingTimeout: 60000,   // ✅ 60 secondes
  socketTimeout: 60000,     // ✅ 60 secondes
  debug: false,
  logger: false
});

// Vérifier la connexion SMTP
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Erreur connexion SMTP:', error);
  } else {
    console.log('✅ Serveur SMTP prêt pour envoi avec pièces jointes');
  }
});

// 📄 Générer le reçu d'inscription PDF (VERSION ALLÉGÉE)
const genererRecuInscriptionPDF = async ({ 
  nomComplet, 
  email, 
  telephone, 
  formation, 
  montantInscription,
  inscriptionId,
  dateInscription = new Date()
}) => {
  return new Promise((resolve, reject) => {
    try {
      const receiptsDir = path.join(process.cwd(), 'receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }

      const fileName = `recu_inscription_${inscriptionId}_${Date.now()}.pdf`;
      const filePath = path.join(receiptsDir, fileName);
      
      // ✅ Options de compression PDF
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        compress: true, // ✅ Active la compression
        autoFirstPage: true
      });
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // En-tête avec logo (VERSION OPTIMISÉE)
      try {
        const logoPath = path.join(process.cwd(), 'assets', 'Logo TELLY TECH.png');
        if (fs.existsSync(logoPath)) {
          // ✅ Réduire la taille de l'image pour alléger le PDF
          doc.image(logoPath, 50, 40, { width: 60, align: 'left' }); // 80 → 60
        }
      } catch (error) {
        console.log('Logo non trouvé, utilisation du texte');
      }
      
      doc.fontSize(26)
         .fillColor('#27446e')
         .text('TELLYTECH', 150, 50, { align: 'left' })
         .fontSize(10)
         .fillColor('#673f21')
         .text('École de Formation Professionnelle', 150, 80, { align: 'left' })
         .text('Dakar, Sénégal', 150, 95, { align: 'left' })
         .text('Tél: +221 78 111 87 69 | Email: technologytelly@gmail.com', 50, 110, { align: 'center' });

      doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#27446e').stroke();

      doc.fontSize(20)
         .fillColor('#27446e')
         .text('REÇU DE PAIEMENT D\'INSCRIPTION', 50, 150, { align: 'center' });

      doc.fontSize(10)
         .fillColor('#673f21')
         .text(`N° ${inscriptionId}`, 50, 190)
         .text(`Date: ${dateInscription.toLocaleDateString('fr-FR')}`, 400, 190);

      let yPos = 230;
      doc.fontSize(14).fillColor('#27446e').text('INFORMATIONS DE L\'ÉTUDIANT', 50, yPos);
      
      yPos += 25;
      doc.fontSize(11).fillColor('#000000')
         .text(`Nom complet:`, 50, yPos).text(nomComplet, 200, yPos);
      
      yPos += 20;
      doc.text(`Email:`, 50, yPos).text(email, 200, yPos);
      
      yPos += 20;
      doc.text(`Téléphone:`, 50, yPos).text(telephone, 200, yPos);

      yPos += 40;
      doc.fontSize(14).fillColor('#27446e').text('FORMATION CHOISIE', 50, yPos);
      
      yPos += 25;
      doc.fontSize(11).fillColor('#000000')
         .text(`Formation:`, 50, yPos).text(formation, 200, yPos);

      yPos += 50;
      doc.rect(50, yPos, 495, 30).fillAndStroke('#f3f4f6', '#27446e');
      doc.fillColor('#27446e').fontSize(11)
         .text('DESCRIPTION', 60, yPos + 10)
         .text('MONTANT', 450, yPos + 10);

      yPos += 30;
      doc.rect(50, yPos, 495, 40).stroke('#e5e7eb');
      doc.fillColor('#000000')
         .text(`Frais d'inscription - ${formation}`, 60, yPos + 12)
         .fontSize(12).fillColor('#673f21')
         .text(`${montantInscription.toLocaleString('fr-FR')} FCFA`, 420, yPos + 12);

      yPos += 40;
      doc.rect(50, yPos, 495, 35).fillAndStroke('#e8f0f7', '#27446e');
      doc.fontSize(14).fillColor('#27446e')
         .text('TOTAL PAYÉ', 60, yPos + 10)
         .fontSize(16).fillColor('#673f21')
         .text(`${montantInscription.toLocaleString('fr-FR')} FCFA`, 400, yPos + 10);

      yPos += 60;
      doc.fontSize(12).fillColor('#27446e')
         .text('PAIEMENT CONFIRMÉ', 50, yPos, { align: 'center' });

      const signatureY = 600;
      
      try {
        const signaturePath = path.join(process.cwd(), 'assets', 'Signature.png');
        if (fs.existsSync(signaturePath)) {
          // ✅ Réduire la taille de la signature
          doc.image(signaturePath, 60, signatureY + 20, { width: 80 }); // 100 → 80
        } else {
          doc.fontSize(16).fillColor('#27446e').font('Helvetica-Oblique')
             .text('Jean Mamady Cissé', 60, signatureY + 25);
        }
      } catch (error) {
        doc.fontSize(16).fillColor('#27446e').font('Helvetica-Oblique')
           .text('Jean Mamady Cissé', 60, signatureY + 25);
      }
      
      doc.fontSize(10).fillColor('#000000').font('Helvetica').text('Jean Mamady Cissé', 80, signatureY);
      doc.fontSize(9).fillColor('#673f21').text('Manager', 80, signatureY + 15);
      doc.fontSize(9).fillColor('#673f21')
         .text('_____________________', 50, signatureY + 50);
      
      const cachetX = 450;
      const cachetY = signatureY + 30;
      
      try {
        const cachetPath = path.join(process.cwd(), 'assets', 'Cachet.png');
        if (fs.existsSync(cachetPath)) {
          // ✅ Réduire la taille du cachet
          doc.image(cachetPath, cachetX - 40, cachetY - 40, { width: 80 }); // 100 → 80
        } else {
          doc.circle(cachetX, cachetY, 35).stroke('#27446e');
          doc.circle(cachetX, cachetY, 33).stroke('#27446e');
          doc.fontSize(8).fillColor('#27446e')
             .text('TELLYTECH', cachetX - 25, cachetY - 10, { width: 50, align: 'center' })
             .text('FORMATION', cachetX - 25, cachetY, { width: 50, align: 'center' })
             .text('DAKAR', cachetX - 25, cachetY + 10, { width: 50, align: 'center' });
        }
      } catch (error) {
        doc.circle(cachetX, cachetY, 35).stroke('#27446e');
        doc.circle(cachetX, cachetY, 33).stroke('#27446e');
        doc.fontSize(8).fillColor('#27446e')
           .text('TELLYTECH', cachetX - 25, cachetY - 10, { width: 50, align: 'center' })
           .text('FORMATION', cachetX - 25, cachetY, { width: 50, align: 'center' })
           .text('DAKAR', cachetX - 25, cachetY + 10, { width: 50, align: 'center' });
      }

      doc.fontSize(9).fillColor('#999999')
         .text('Ce reçu atteste du paiement des frais d\'inscription.', 50, 720, { align: 'center' })
         .text('Conservez ce document précieusement.', { align: 'center' })
         .text('technologytelly@gmail.com | +221 78 111 87 69', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        console.log(`✅ Reçu généré (${(fs.statSync(filePath).size / 1024).toFixed(2)} KB)`);
        resolve(filePath);
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

// 📘 Générer le guide de bienvenue PDF (SIMPLIFIÉ - 1 PAGE)
const genererGuideBienvenuePDF = async ({ 
  nomComplet, 
  formation, 
  nombreMois,
  mensualite,
  inscriptionId
}) => {
  return new Promise((resolve, reject) => {
    try {
      const receiptsDir = path.join(process.cwd(), 'receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }

      const fileName = `guide_bienvenue_${inscriptionId}_${Date.now()}.pdf`;
      const filePath = path.join(receiptsDir, fileName);
      
      // ✅ PDF compressé et UNE SEULE PAGE
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        compress: true
      });
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // En-tête simplifié
      doc.fontSize(24).fillColor('#27446e')
         .text('GUIDE DE BIENVENUE', 50, 40, { align: 'center' });
      
      doc.fontSize(14).fillColor('#673f21')
         .text(`Formation: ${formation}`, 50, 75, { align: 'center' });

      doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#27446e').stroke();

      let yPos = 120;

      doc.fontSize(12).fillColor('#27446e')
         .text(`Cher(e) ${nomComplet},`, 50, yPos);
      
      yPos += 25;
      doc.fontSize(10).fillColor('#000000')
         .text(`Félicitations ! Vous êtes inscrit(e) à la formation "${formation}".`, 50, yPos, { width: 495 });

      // Détails compacts
      yPos += 40;
      doc.fontSize(12).fillColor('#27446e').text('VOTRE FORMATION', 50, yPos);
      yPos += 20;
      doc.fontSize(10).fillColor('#000000')
         .text(`• Durée: ${nombreMois} mois`, 60, yPos)
         .text(`• Mensualité: ${mensualite.toLocaleString('fr-FR')} FCFA`, 60, yPos + 15)
         .text(`• Total: ${(nombreMois * mensualite).toLocaleString('fr-FR')} FCFA`, 60, yPos + 30);

      yPos += 60;
      doc.fontSize(12).fillColor('#27446e').text('RÈGLES DE PAIEMENT', 50, yPos);
      yPos += 20;
      doc.fontSize(10).fillColor('#000000')
         .text('• Paiements avant le 10 de chaque mois via votre espace étudiant', 60, yPos, { width: 485 })
         .text('• Reçu PDF après chaque validation', 60, yPos + 15, { width: 485 })
         .text('• Retard = suspension temporaire', 60, yPos + 30, { width: 485 });

      yPos += 60;
      doc.fontSize(12).fillColor('#27446e').text('CERTIFICATION', 50, yPos);
      yPos += 20;
      doc.fontSize(10).fillColor('#000000')
         .text(`• Payer les ${nombreMois} mois intégralement`, 60, yPos)
         .text('• Valider tous les modules', 60, yPos + 15)
         .text('• Réussir le projet final', 60, yPos + 30)
         .text('• Assiduité 80% minimum', 60, yPos + 45);

      yPos += 75;
      doc.fontSize(12).fillColor('#27446e').text('CONTACT', 50, yPos);
      yPos += 20;
      doc.fontSize(10).fillColor('#000000')
         .text('Email: technologytelly@gmail.com', 60, yPos)
         .text('Tél: +221 78 111 87 69', 60, yPos + 15);

      // Signature compacte
      yPos += 50;
      doc.fontSize(10).fillColor('#27446e').text('Jean Mamady Cissé', 60, yPos);
      doc.fontSize(9).fillColor('#673f21').text('Manager - TellyTech', 60, yPos + 15);

      doc.end();

      stream.on('finish', () => {
        console.log(`✅ Guide généré (${(fs.statSync(filePath).size / 1024).toFixed(2)} KB)`);
        resolve(filePath);
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};
// Ajoutez cette fonction dans votre email.service.js

// 📧 NOUVEAU : Email de confirmation d'inscription (envoyé immédiatement)
// Ajoutez cette fonction dans votre email.service.js

export const envoyerEmailInscription = async ({ 
  nomComplet, 
  email, 
  formation, 
  code,
  inscriptionId 
}) => {
  try {
    console.log(`📤 Envoi email inscription à ${email}...`);
    
    const mailOptions = {
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: email,
      replyTo: process.env.EMAIL_USER,
      subject: `Réception de votre demande d'inscription - TellyTech Formation`,
      html: `
        <div style="font-family: 'Georgia', 'Times New Roman', serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb;">
          
          <!-- En-tête -->
          <div style="background: #27446e; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: normal; letter-spacing: 2px;">TELLYTECH</h1>
            <p style="color: #ffffff; margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">École de Formation Professionnelle</p>
          </div>

          <!-- Corps du message -->
          <div style="padding: 50px 40px; line-height: 1.8; color: #1f2937;">
            
            <p style="margin: 0 0 25px 0; font-size: 15px;">
              Dakar, le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            
            <p style="margin: 0 0 25px 0; font-size: 15px;">
              Madame, Monsieur <strong>${nomComplet}</strong>,
            </p>
            
            <p style="margin: 0 0 20px 0; font-size: 15px; text-align: justify;">
              Nous accusons bonne réception de votre demande d'inscription à notre formation 
              <strong>"${formation}"</strong> et vous en remercions vivement.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 15px; text-align: justify;">
              Votre dossier est actuellement en cours d'examen par notre équipe pédagogique. 
              Un membre de notre service vous contactera sous peu par téléphone afin de confirmer 
              les modalités de votre inscription et de répondre à l'ensemble de vos questions.
            </p>

            <div style="background: #e8f0f7; padding: 25px; margin: 30px 0; border-left: 4px solid #27446e;">
              <p style="margin: 0 0 15px 0; font-size: 15px; color: #27446e; font-weight: bold;">
                À propos de notre plateforme de formation
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.7; text-align: justify;">
                TellyTech met à votre disposition une plateforme d'apprentissage moderne et intuitive, 
                proposant des cours détaillés, des exercices pratiques et un suivi personnalisé. 
                Vous aurez accès à l'ensemble des ressources pédagogiques dès la validation de votre inscription 
                par notre équipe.
              </p>
            </div>

            <p style="margin: 0 0 20px 0; font-size: 15px; text-align: justify;">
              Nous vous invitons à rester attentif à vos emails ainsi qu'à votre téléphone dans les prochains jours. 
              Notre équipe reviendra vers vous dans les meilleurs délais pour finaliser votre inscription.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 15px; text-align: justify;">
              Pour toute question urgente, vous pouvez nous joindre directement par email ou par téléphone 
              aux coordonnées indiquées ci-dessous.
            </p>

            <p style="margin: 30px 0 10px 0; font-size: 15px;">
              Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.
            </p>

            <div style="margin: 40px 0 0 0;">
              <p style="margin: 0 0 5px 0; font-size: 15px; font-weight: bold; color: #27446e;">
                Jean Mamady Cissé
              </p>
              <p style="margin: 0; font-size: 14px; color: #673f21;">
                Manager - TellyTech Formation
              </p>
            </div>

          </div>

          <!-- Pied de page -->
          <div style="background: #f9fafb; padding: 25px 40px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 8px 0; color: #27446e; font-size: 14px; font-weight: bold;">
              Contact
            </p>
            <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
              Email : technologytelly@gmail.com<br>
              Téléphone : +221 78 111 87 69<br>
              Adresse : Dakar, Sénégal
            </p>
          </div>

        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email inscription envoyé à ${email} - MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur email inscription étudiant:', error);
    throw error;
  }
};
// 📧 Email admin (INCHANGÉ)
export const envoyerEmailAdmin = async ({ nomComplet, email, telephone, formation, code, inscriptionId }) => {
  try {
    console.log(`📤 Envoi email admin pour inscription ${inscriptionId}...`);
    
    const mailOptions = {
      from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      replyTo: email,
      subject: `✅ Nouvelle inscription - ${formation}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #27446e;">Nouvelle demande d'inscription</h2>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Nom complet:</strong> ${nomComplet}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Téléphone:</strong> ${telephone}</p>
            <p><strong>Formation:</strong> ${formation}</p>
            <hr style="border: 1px solid #d1d5db; margin: 15px 0;">
            <p style="font-size: 18px;"><strong>CODE:</strong> 
              <span style="background: #673f21; color: white; padding: 5px 15px; border-radius: 5px; font-weight: bold;">${code}</span>
            </p>
          </div>
          
          <div style="background: #e8f0f7; padding: 15px; border-left: 4px solid #27446e; margin: 20px 0;">
            <p style="margin: 0;"><strong>Action requise:</strong></p>
            <ol style="margin: 10px 0;">
              <li>Vérifier le paiement (Wave/Orange Money)</li>
              <li>Valider l'inscription ID: <strong>${inscriptionId}</strong></li>
              <li>L'étudiant recevra automatiquement son email</li>
            </ol>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email admin envoyé - MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur email admin:', error);
    throw error;
  }
};

// 📧 Email validation (VERSION OPTIMISÉE)
export const envoyerEmailValidation = async ({ 
  nomComplet, 
  email, 
  formation, 
  code, 
  telephone,
  montantInscription,
  mensualite,
  nombreMois,
  inscriptionId 
}) => {
  const MAX_RETRIES = 3;
  let lastError;
  let recuPath, guidePath;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📤 [${attempt}/${MAX_RETRIES}] Envoi email à ${email}...`);
      
      // ✅ Générer les PDFs
      recuPath = await genererRecuInscriptionPDF({
        nomComplet, email, telephone, formation,
        montantInscription, inscriptionId,
        dateInscription: new Date()
      });

      guidePath = await genererGuideBienvenuePDF({
        nomComplet, formation, nombreMois, mensualite, inscriptionId
      });

      const totalAPayer = nombreMois * mensualite;

      const mailOptions = {
        from: `"TellyTech Formation" <${process.env.EMAIL_USER}>`,
        to: email,
        replyTo: process.env.EMAIL_USER,
        subject: `Confirmation d'inscription - TellyTech Formation`,
        html: `
          <div style="font-family: 'Georgia', serif; max-width: 650px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb;">
            <div style="background: #27446e; padding: 30px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 26px; letter-spacing: 2px;">TELLYTECH</h1>
              <p style="color: #fff; margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">École de Formation Professionnelle</p>
            </div>

            <div style="padding: 40px; line-height: 1.8; color: #1f2937;">
              <p style="margin: 0 0 20px 0; font-size: 14px;">
                Dakar, le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              
              <p style="margin: 0 0 20px 0;">Madame, Monsieur <strong>${nomComplet}</strong>,</p>
              
              <p style="margin: 0 0 15px 0; text-align: justify;">
                Nous confirmons votre inscription à <strong>"${formation}"</strong>. 
                Votre paiement de <strong>${montantInscription.toLocaleString('fr-FR')} FCFA</strong> a été enregistré.
              </p>

              <p style="margin: 0 0 15px 0;">
                Votre code d'accès : <strong style="color: #27446e; font-size: 16px;">${code}</strong>
              </p>

              <div style="background: #f9fafb; padding: 20px; margin: 20px 0; border-left: 3px solid #673f21;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #673f21;">Modalités</p>
                <p style="margin: 0 0 8px 0;">Durée : <strong>${nombreMois} mois</strong></p>
                <p style="margin: 0 0 8px 0;">Mensualité : <strong>${mensualite.toLocaleString('fr-FR')} FCFA</strong></p>
                <p style="margin: 0;">Total restant : <strong>${totalAPayer.toLocaleString('fr-FR')} FCFA</strong></p>
              </div>

              <p style="margin: 0 0 15px 0; text-align: justify;">
                Les paiements mensuels sont à effectuer avant le 10 de chaque mois. 
                Le certificat sera délivré après validation complète des ${nombreMois} mois et du projet final.
              </p>

              <p style="margin: 30px 0 15px 0;">Veuillez consulter les documents joints pour plus de détails.</p>

              <div style="margin: 30px 0 0 0;">
                <p style="margin: 0; font-weight: bold; color: #27446e;">Jean Mamady Cissé</p>
                <p style="margin: 0; font-size: 13px; color: #673f21;">Manager - TellyTech Formation</p>
              </div>
            </div>

            <div style="background: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 5px 0; color: #27446e; font-size: 13px; font-weight: bold;">Contact</p>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Email : technologytelly@gmail.com<br>
                Tél : +221 78 111 87 69<br>
                Adresse : Dakar, Sénégal
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `Recu_Inscription_${inscriptionId}.pdf`,
            path: recuPath,
            contentType: 'application/pdf'
          },
          {
            filename: `Guide_Bienvenue_${inscriptionId}.pdf`,
            path: guidePath,
            contentType: 'application/pdf'
          }
        ]
      };

      // ✅ Envoi avec timeout étendu
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email envoyé à ${email} - MessageID: ${info.messageId}`);
      
      // Nettoyage
      try {
        if (fs.existsSync(recuPath)) fs.unlinkSync(recuPath);
        if (fs.existsSync(guidePath)) fs.unlinkSync(guidePath);
        console.log('🗑️ PDFs nettoyés');
      } catch (cleanupError) {
        console.warn('⚠️ Nettoyage PDFs:', cleanupError.message);
      }
      
      return { success: true, messageId: info.messageId, email, attempt };
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Tentative ${attempt}/${MAX_RETRIES} échouée:`, error.message);
      
      if (attempt < MAX_RETRIES) {
        const delayMs = attempt * 3000; // 3s, 6s, 9s
        console.log(`⏳ Nouvelle tentative dans ${delayMs/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error(`❌ ÉCHEC après ${MAX_RETRIES} tentatives pour ${email}`);
  throw new Error(`Email non envoyé après ${MAX_RETRIES} tentatives: ${lastError.message}`);
};
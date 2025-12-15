import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true pour le port 465, false pour les autres ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000, // 10 secondes
  greetingTimeout: 10000,
  socketTimeout: 10000
});

// 📄 Générer le reçu d'inscription PDF
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
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);

      // En-tête avec logo
      try {
        const logoPath = path.join(process.cwd(), 'assets', 'Logo TELLY TECH.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 40, { width: 80, align: 'left' });
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

      // Titre
      doc.fontSize(20)
         .fillColor('#27446e')
         .text('REÇU DE PAIEMENT D\'INSCRIPTION', 50, 150, { align: 'center' });

      doc.fontSize(10)
         .fillColor('#673f21')
         .text(`N° ${inscriptionId}`, 50, 190)
         .text(`Date: ${dateInscription.toLocaleDateString('fr-FR')}`, 400, 190);

      // Informations du client
      let yPos = 230;
      doc.fontSize(14).fillColor('#27446e').text('INFORMATIONS DE L\'ÉTUDIANT', 50, yPos);
      
      yPos += 25;
      doc.fontSize(11).fillColor('#000000')
         .text(`Nom complet:`, 50, yPos).text(nomComplet, 200, yPos);
      
      yPos += 20;
      doc.text(`Email:`, 50, yPos).text(email, 200, yPos);
      
      yPos += 20;
      doc.text(`Téléphone:`, 50, yPos).text(telephone, 200, yPos);

      // Formation
      yPos += 40;
      doc.fontSize(14).fillColor('#27446e').text('FORMATION CHOISIE', 50, yPos);
      
      yPos += 25;
      doc.fontSize(11).fillColor('#000000')
         .text(`Formation:`, 50, yPos).text(formation, 200, yPos);

      // Tableau
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

      // Total
      yPos += 40;
      doc.rect(50, yPos, 495, 35).fillAndStroke('#e8f0f7', '#27446e');
      doc.fontSize(14).fillColor('#27446e')
         .text('TOTAL PAYÉ', 60, yPos + 10)
         .fontSize(16).fillColor('#673f21')
         .text(`${montantInscription.toLocaleString('fr-FR')} FCFA`, 400, yPos + 10);

      // Statut
      yPos += 60;
      doc.fontSize(12).fillColor('#27446e')
         .text('PAIEMENT CONFIRMÉ', 50, yPos, { align: 'center' });

      // Signature avec image
      const signatureY = 600;
      
      // Image de signature si elle existe
      try {
        const signaturePath = path.join(process.cwd(), 'assets', 'Signature.png');
        if (fs.existsSync(signaturePath)) {
          doc.image(signaturePath, 60, signatureY + 20, { width: 100 });
        } else {
          // Fallback: signature manuscrite stylisée
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
      
      // Cachet avec image
      const cachetX = 450;
      const cachetY = signatureY + 30;
      
      try {
        const cachetPath = path.join(process.cwd(), 'assets', 'Cachet.png');
        if (fs.existsSync(cachetPath)) {
          doc.image(cachetPath, cachetX - 50, cachetY - 50, { width: 100 }); // Augmenté de 70 à 100
        }
      else {
          // Fallback: cachet dessiné
          doc.circle(cachetX, cachetY, 35).stroke('#27446e');
          doc.circle(cachetX, cachetY, 33).stroke('#27446e');
          doc.fontSize(8).fillColor('#27446e')
             .text('TELLYTECH', cachetX - 25, cachetY - 10, { width: 50, align: 'center' })
             .text('FORMATION', cachetX - 25, cachetY, { width: 50, align: 'center' })
             .text('DAKAR', cachetX - 25, cachetY + 10, { width: 50, align: 'center' });
        }
      } catch (error) {
        // Fallback: cachet dessiné
        doc.circle(cachetX, cachetY, 35).stroke('#27446e');
        doc.circle(cachetX, cachetY, 33).stroke('#27446e');
        doc.fontSize(8).fillColor('#27446e')
           .text('TELLYTECH', cachetX - 25, cachetY - 10, { width: 50, align: 'center' })
           .text('FORMATION', cachetX - 25, cachetY, { width: 50, align: 'center' })
           .text('DAKAR', cachetX - 25, cachetY + 10, { width: 50, align: 'center' });
      }

      // Note de bas de page
      doc.fontSize(9).fillColor('#999999')
         .text('Ce reçu atteste du paiement des frais d\'inscription.', 50, 720, { align: 'center' })
         .text('Conservez ce document précieusement.', { align: 'center' })
         .text('technologytelly@gmail.com | +221 78 111 87 69', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        console.log(`Reçu d'inscription généré: ${fileName}`);
        resolve(filePath);
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

// 📘 Générer le guide de bienvenue PDF
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
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);

      // En-tête avec logo
      try {
        const logoPath = path.join(process.cwd(), 'assets', 'Logo TELLY TECH.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 40, { width: 80, align: 'left' });
        }
      } catch (error) {
        console.log('Logo non trouvé');
      }
      
      doc.fontSize(28).fillColor('#27446e')
         .text('GUIDE DE BIENVENUE', 150, 50, { align: 'left' });
      
      doc.fontSize(16).fillColor('#673f21')
         .text(`Formation: ${formation}`, 50, 100, { align: 'center' });

      doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#27446e').stroke();

      let yPos = 160;

      // Bienvenue personnalisée
      doc.fontSize(14).fillColor('#27446e')
         .text(`Cher(e) ${nomComplet},`, 50, yPos);
      
      yPos += 30;
      doc.fontSize(11).fillColor('#000000')
         .text(`Félicitations et bienvenue chez TellyTech ! Nous sommes ravis de vous accompagner dans votre parcours de formation en ${formation}.`, 50, yPos, { 
           width: 495, 
           align: 'justify' 
         });

      // Section 1: Détails de la formation
      yPos += 60;
      doc.fontSize(16).fillColor('#27446e')
         .text('1. VOTRE FORMATION', 50, yPos);
      
      yPos += 30;
      doc.fontSize(11).fillColor('#000000')
         .text(`Durée: ${nombreMois} mois`, 70, yPos)
         .text(`Mensualité: ${mensualite.toLocaleString('fr-FR')} FCFA`, 70, yPos + 20)
         .text(`Total à payer: ${(nombreMois * mensualite).toLocaleString('fr-FR')} FCFA`, 70, yPos + 40);

      // Section 2: Règles de paiement
      yPos += 90;
      doc.fontSize(16).fillColor('#27446e')
         .text('2. RÈGLES DE PAIEMENT', 50, yPos);
      
      yPos += 30;
      doc.fontSize(11).fillColor('#000000')
         .text('Les paiements mensuels doivent être effectués avant le 10 de chaque mois', 70, yPos, { width: 475 })
         .text('Chaque mois doit être payé individuellement via votre espace étudiant', 70, yPos + 22, { width: 475 })
         .text('Un reçu PDF vous sera envoyé après validation de chaque paiement', 70, yPos + 44, { width: 475 })
         .text('Tout retard de paiement peut entraîner une suspension temporaire de l\'accès', 70, yPos + 66, { width: 475 })
         .text(`Montant total de la formation: ${(nombreMois * mensualite).toLocaleString('fr-FR')} FCFA sur ${nombreMois} mois`, 70, yPos + 88, { width: 475 })
         .text(`Mensualité: ${mensualite.toLocaleString('fr-FR')} FCFA par mois`, 70, yPos + 110, { width: 475 });

      // Section 3: Engagement qualité
      yPos += 160;
      doc.fontSize(16).fillColor('#27446e')
         .text('3. NOTRE ENGAGEMENT QUALITÉ', 50, yPos);
      
      yPos += 30;
      doc.fontSize(11).fillColor('#000000')
         .text('Chez TellyTech, nous prônons l\'excellence et la rigueur:', 70, yPos, { width: 475 })
         .text('Formateurs certifiés et expérimentés', 70, yPos + 22)
         .text('Programme structuré et progressif', 70, yPos + 42)
         .text('Suivi personnalisé de chaque étudiant', 70, yPos + 62)
         .text('Projets pratiques et professionnalisants', 70, yPos + 82)
         .text('Certificat délivré en fin de formation', 70, yPos + 102);

      // Nouvelle page
      doc.addPage();
      yPos = 50;
      
      doc.fontSize(16).fillColor('#27446e')
         .text('4. PROGRAMME DE FORMATION', 50, yPos);
      
      yPos += 30;
      doc.fontSize(11).fillColor('#000000')
         .text(`Votre formation "${formation}" se déroule sur ${nombreMois} mois avec un programme intensif:`, 70, yPos, { width: 475 });

      yPos += 40;
      const moisProgram = [
        'Mois 1-2: Fondamentaux et bases essentielles',
        'Mois 3-4: Pratique et développement de projets',
        'Mois 5-6: Projets avancés et certification'
      ];

      moisProgram.forEach((mois, index) => {
        doc.text(`${mois}`, 70, yPos + (index * 25), { width: 475 });
      });

      // Section 5: Certification
      yPos += 110;
      doc.fontSize(16).fillColor('#27446e')
         .text('5. RÈGLES ET CERTIFICATION', 50, yPos);
      
      yPos += 30;
      doc.fontSize(12).fillColor('#673f21')
         .text('Conditions d\'obtention du certificat:', 70, yPos, { width: 475 });
      
      yPos += 25;
      doc.fontSize(11).fillColor('#000000')
         .text(`Avoir payé et validé l\'intégralité des ${nombreMois} mois de formation (${(nombreMois * mensualite).toLocaleString('fr-FR')} FCFA)`, 70, yPos, { width: 475 })
         .text('Valider tous les devoirs de chaque module avec une note minimale', 70, yPos + 22, { width: 475 })
         .text('Réaliser et présenter le projet final avec succès', 70, yPos + 44, { width: 475 })
         .text('Maintenir une assiduité d\'au moins 80% aux cours', 70, yPos + 66, { width: 475 });
      
      yPos += 100;
      doc.fontSize(12).fillColor('#673f21')
         .text('Code de conduite obligatoire:', 70, yPos, { width: 475 });
      
      yPos += 25;
      doc.fontSize(11).fillColor('#000000')
         .text('Assiduité et ponctualité aux cours', 70, yPos)
         .text('Respect des formateurs et camarades', 70, yPos + 20)
         .text('Investissement personnel dans les projets', 70, yPos + 40)
         .text('Communication transparente en cas de difficulté', 70, yPos + 60);

      // Contact
      yPos += 100;
      doc.fontSize(16).fillColor('#27446e')
         .text('6. NOUS CONTACTER', 50, yPos);
      
      yPos += 30;
      doc.fontSize(11).fillColor('#000000')
         .text('Email: technologytelly@gmail.com', 70, yPos)
         .text('Téléphone: +221 78 111 87 69', 70, yPos + 20)
         .text('Adresse: Dakar, Sénégal', 70, yPos + 40);

      // Signature avec image
      yPos += 80;
      
      try {
        const signaturePath = path.join(process.cwd(), 'assets', 'Signature.png');
        if (fs.existsSync(signaturePath)) {
          doc.image(signaturePath, 60, yPos + 20, { width: 100 });
        } else {
          doc.fontSize(16).fillColor('#27446e').font('Helvetica-Oblique')
             .text('Jean Mamady Cissé', 60, yPos + 25);
        }
      } catch (error) {
        doc.fontSize(16).fillColor('#27446e').font('Helvetica-Oblique')
           .text('Jean Mamady Cissé', 60, yPos + 25);
      }
      
      doc.fontSize(10).fillColor('#000000').font('Helvetica').text('Jean Mamady Cissé', 80, yPos);
      doc.fontSize(9).fillColor('#673f21').text('Manager', 80, yPos + 15);
      doc.fontSize(9).fillColor('#673f21')
         .text('_____________________', 50, yPos + 50);
      
      // Cachet
      const cachetX = 450;
      const cachetY = yPos + 30;
      
      try {
        const cachetPath = path.join(process.cwd(), 'assets', 'Cachet.png');
        if (fs.existsSync(cachetPath)) {
          doc.image(cachetPath, cachetX - 35, cachetY - 35, { width: 70 });
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

      // Message de fin
      yPos += 80;
      doc.fontSize(12).fillColor('#27446e')
         .text('Nous vous souhaitons une excellente formation !', 50, yPos, { align: 'center' });
      
      doc.fontSize(10).fillColor('#673f21')
         .text('L\'équipe TellyTech Formation', 50, yPos + 30, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        console.log(`Guide de bienvenue généré: ${fileName}`);
        resolve(filePath);
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

// 📧 Email à l'admin
export const envoyerEmailAdmin = async ({ nomComplet, email, telephone, formation, code, inscriptionId }) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `Nouvelle inscription - ${formation}`,
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
              <li>Valider l'inscription ID: <strong>${inscriptionId}</strong> dans l'admin</li>
              <li>Le client recevra automatiquement son email de confirmation</li>
            </ol>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Email admin envoyé');
  } catch (error) {
    console.error('Erreur email admin:', error);
    throw error;
  }
};

// 📧 Email professionnel au client après validation
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
  try {
    // Générer les 2 PDF
    const recuPath = await genererRecuInscriptionPDF({
      nomComplet,
      email,
      telephone,
      formation,
      montantInscription,
      inscriptionId,
      dateInscription: new Date()
    });

    const guidePath = await genererGuideBienvenuePDF({
      nomComplet,
      formation,
      nombreMois,
      mensualite,
      inscriptionId
    });

    const totalAPayer = nombreMois * mensualite;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Confirmation d'inscription - TellyTech Formation`,
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
              Nous avons l'honneur de vous confirmer votre inscription à notre formation <strong>"${formation}"</strong>. 
              Votre paiement des frais d'inscription d'un montant de <strong>${montantInscription.toLocaleString('fr-FR')} FCFA</strong> 
              a été dûment enregistré.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 15px; text-align: justify;">
              Votre code d'accès personnel est le suivant : <strong style="color: #27446e; font-size: 18px; letter-spacing: 3px;">${code}</strong>. 
              Nous vous prions de le conserver soigneusement. Ce code vous permettra d'accéder à votre espace étudiant 
              et de consulter l'ensemble des ressources pédagogiques.
            </p>

            <div style="background: #f9fafb; padding: 25px; margin: 30px 0; border-left: 3px solid #673f21;">
              <p style="margin: 0 0 15px 0; font-size: 15px; color: #673f21; font-weight: bold;">
                Modalités de la formation
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px;">
                Durée de la formation : <strong>${nombreMois} mois</strong>
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px;">
                Mensualité : <strong>${mensualite.toLocaleString('fr-FR')} FCFA</strong>
              </p>
              <p style="margin: 0; font-size: 14px;">
                Montant total restant : <strong style="color: #27446e;">${totalAPayer.toLocaleString('fr-FR')} FCFA</strong>
              </p>
            </div>

            <p style="margin: 0 0 20px 0; font-size: 15px; text-align: justify;">
              Les paiements mensuels devront être effectués avant le 10 de chaque mois via votre espace étudiant. 
              Un reçu vous sera transmis après chaque validation de paiement.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 15px; text-align: justify;">
              L'obtention du certificat de fin de formation est conditionnée par le règlement intégral 
              des ${nombreMois} mensualités, la validation de l'ensemble des modules d'apprentissage, 
              ainsi que la réussite du projet final.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 15px; text-align: justify;">
              Nous vous invitons à consulter attentivement les documents joints à ce courrier électronique : 
              votre reçu de paiement et le guide de bienvenue contenant l'ensemble des informations relatives 
              au déroulement de votre formation.
            </p>

            <p style="margin: 30px 0 20px 0; font-size: 15px; text-align: justify;">
              Toute l'équipe TellyTech se tient à votre disposition pour vous accompagner tout au long 
              de votre parcours de formation.
            </p>

            <p style="margin: 0 0 10px 0; font-size: 15px;">
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
      `,
      attachments: [
        {
          filename: `Recu_Inscription_TellyTech_${inscriptionId}.pdf`,
          path: recuPath,
          contentType: 'application/pdf'
        },
        {
          filename: `Guide_Bienvenue_TellyTech_${inscriptionId}.pdf`,
          path: guidePath,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log('Email validation professionnel envoyé avec 2 PDF');
    
  } catch (error) {
    console.error('Erreur email validation:', error);
    throw error;
  }
};
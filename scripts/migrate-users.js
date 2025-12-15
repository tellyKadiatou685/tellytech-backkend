import prisma from '../src/config/database.js';
import bcrypt from 'bcrypt';

async function migrateValidatedInscriptions() {
  try {
    // Récupérer toutes les inscriptions validées
    const inscriptionsValidees = await prisma.inscription.findMany({
      where: { status: 'VALIDATED' }
    });

    console.log(`📊 ${inscriptionsValidees.length} inscriptions validées trouvées`);

    for (const inscription of inscriptionsValidees) {
      // Vérifier si le user existe déjà
      const userExiste = await prisma.user.findUnique({
        where: { email: inscription.email }
      });

      if (userExiste) {
        console.log(`⚠️  User existe déjà: ${inscription.email}`);
        continue;
      }

      // Hasher le code
      const hashedPassword = await bcrypt.hash(inscription.code, 10);

      // Créer le user
      await prisma.user.create({
        data: {
          nom: `${inscription.prenom} ${inscription.nom}`,
          email: inscription.email,
          password: hashedPassword,
          role: 'USER'
        }
      });

      console.log(`✅ User créé: ${inscription.email} - Code: ${inscription.code}`);
    }

    console.log('🎉 Migration terminée !');

  } catch (error) {
    console.error('❌ Erreur migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateValidatedInscriptions();
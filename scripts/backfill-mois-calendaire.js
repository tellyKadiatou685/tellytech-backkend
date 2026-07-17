// ========================================
// 🔧 Script de backfill : dateDemarrage + moisCalendaire
//
// À exécuter UNE SEULE FOIS après la migration Prisma, pour compléter
// les données déjà en base (inscriptions validées avant cette évolution).
//
// Hypothèse utilisée pour dateDemarrage manquante : createdAt de
// l'inscription (meilleure estimation disponible sans info supplémentaire).
// Si tu connais la vraie date de démarrage de certains étudiants,
// corrige-la manuellement après coup via modifierInscription.
//
// Usage : node scripts/backfill-mois-calendaire.js
// ========================================

import prisma from '../src/config/database.js';
import { calculerMoisCalendaire, calculerDateFinFormation } from '../src/utils/moisCalendaire.js';

async function backfillInscriptions() {
  const inscriptions = await prisma.inscription.findMany({
    where: {
      status: 'VALIDATED',
      dateDemarrage: null
    }
  });

  console.log(`📋 ${inscriptions.length} inscription(s) validée(s) sans dateDemarrage trouvée(s)`);

  let maj = 0;
  for (const inscription of inscriptions) {
    const dateDemarrage = inscription.createdAt;
    const dateFinFormation = inscription.nombreMois
      ? calculerDateFinFormation(dateDemarrage, inscription.nombreMois)
      : inscription.dateFinFormation;

    await prisma.inscription.update({
      where: { id: inscription.id },
      data: { dateDemarrage, dateFinFormation }
    });
    maj++;
  }

  console.log(`✅ ${maj} inscription(s) mise(s) à jour avec dateDemarrage`);
}

async function backfillPaiements() {
  const paiements = await prisma.paiement.findMany({
    where: { moisCalendaire: null },
    include: { inscription: true }
  });

  console.log(`💳 ${paiements.length} paiement(s) sans moisCalendaire trouvé(s)`);

  let maj = 0;
  let ignores = 0;

  for (const paiement of paiements) {
    if (!paiement.inscription.dateDemarrage) {
      ignores++;
      continue; // sera traité au prochain passage, après backfillInscriptions()
    }

    const moisCalendaire = calculerMoisCalendaire(paiement.inscription.dateDemarrage, paiement.mois);

    await prisma.paiement.update({
      where: { id: paiement.id },
      data: { moisCalendaire }
    });
    maj++;
  }

  console.log(`✅ ${maj} paiement(s) mis à jour avec moisCalendaire`);
  if (ignores > 0) {
    console.log(`⚠️ ${ignores} paiement(s) ignoré(s) (inscription sans dateDemarrage — ne devrait pas arriver après backfillInscriptions)`);
  }
}

async function main() {
  console.log('🚀 Démarrage du backfill...\n');
  await backfillInscriptions();
  console.log('');
  await backfillPaiements();
  console.log('\n🎉 Backfill terminé !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import prisma from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedCourseFromJSON(jsonPath, adminUserId) {
  try {
    console.log('📚 Chargement du fichier JSON...');
    const data = await fs.readFile(jsonPath, 'utf-8');
    const courseData = JSON.parse(data);

    console.log(`✅ JSON chargé : ${courseData.titre}`);

    // 1️⃣ Créer le cours principal
    console.log('\n📖 Création du cours...');
    const course = await prisma.course.create({
      data: {
        titre: courseData.titre,
        description: courseData.description,
        formation: courseData.formation,
        status: 'PUBLISHED',
        createdById: adminUserId
      }
    });
    console.log(`✅ Cours créé : ${course.titre} (ID: ${course.id})`);

    // 2️⃣ Créer les modules
    console.log('\n📚 Création des modules...');
    for (const moduleData of courseData.modules) {
      console.log(`  → Module : ${moduleData.titre}`);
      
      const module = await prisma.module.create({
        data: {
          titre: moduleData.titre,
          ordre: moduleData.ordre,
          courseId: course.id,
          status: 'PUBLISHED',
          createdById: adminUserId
        }
      });

      // 3️⃣ Créer les leçons
      console.log(`    Création de ${moduleData.lessons.length} leçons...`);
      for (const lessonData of moduleData.lessons) {
        console.log(`      → Leçon : ${lessonData.titre}`);
        
        const lesson = await prisma.lesson.create({
          data: {
            titre: lessonData.titre,
            ordre: lessonData.ordre,
            description: lessonData.description,
            videoUrl: lessonData.videoUrl,
            moduleId: module.id,
            status: 'PUBLISHED',
            createdById: adminUserId
          }
        });

        // 4️⃣ Créer les sous-parties
        if (lessonData.parts && lessonData.parts.length > 0) {
          console.log(`        Création de ${lessonData.parts.length} sous-parties...`);
          
          for (const partData of lessonData.parts) {
            const part = await prisma.lessonPart.create({
              data: {
                titre: partData.titre,
                contenu: partData.contenu,
                ordre: partData.ordre,
                lessonId: lesson.id
              }
            });

            // 5️⃣ Créer l'exercice de la sous-partie
            if (partData.exercise) {
              await prisma.partExercise.create({
                data: {
                  consigne: partData.exercise.consigne,
                  lessonPartId: part.id
                }
              });
            }
          }
        }

        // 6️⃣ Créer l'assignment (TD final)
        if (lessonData.assignment) {
          await prisma.assignment.create({
            data: {
              instruction: lessonData.assignment.instruction,
              lessonId: lesson.id
            }
          });
          console.log(`        ✅ Assignment créé`);
        }
      }
    }

    console.log('\n✅✅✅ Migration terminée avec succès ! ✅✅✅');
    console.log(`\n📊 Résumé :`);
    console.log(`   - 1 cours : ${course.titre}`);
    console.log(`   - ${courseData.modules.length} modules`);
    console.log(`   - ${courseData.modules.reduce((sum, m) => sum + m.lessons.length, 0)} leçons`);

  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error);
    throw error;
  }
}

// 🚀 Exécution
async function main() {
  try {
    console.log('🚀 Démarrage de la migration des cours...\n');

    // Récupérer l'admin (ou créer un compte par défaut)
    let admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!admin) {
      console.log('⚠️ Aucun admin trouvé, création d\'un admin par défaut...');
      const bcrypt = (await import('bcrypt')).default;
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      admin = await prisma.user.create({
        data: {
          nom: 'Admin System',
          email: 'admin@technologytelly.com',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
      console.log('✅ Admin créé : admin@technologytelly.com / admin123\n');
    }

    // Charger le cours dev-web
    const jsonPath = path.join(__dirname, '../data/courses/dev-web.json');
    await seedCourseFromJSON(jsonPath, admin.id);

    console.log('\n🎉 Tous les cours ont été importés !');

  } catch (error) {
    console.error('❌ Erreur fatale :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
import cron from 'node-cron';
import axios from 'axios';

// S'exécute le 10 de chaque mois à 9h
cron.schedule('0 9 10 * *', async () => {
  console.log('📧 Envoi des rappels de paiement...');
  try {
    await axios.post('http://localhost:8000/api/paiements/admin/rappels');
    console.log('✅ Rappels envoyés');
  } catch (error) {
    console.error('❌ Erreur rappels:', error.message);
  }
});
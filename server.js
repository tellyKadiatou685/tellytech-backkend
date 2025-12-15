import dotenv from "dotenv";
dotenv.config(); // Charger les variables d'environnement en premier

import app from "./src/app.js"; // Ton app Express

const PORT = process.env.PORT || 8000;

// Écouter le port uniquement en local ou dev
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📍 URL principale: http://localhost:${PORT}`);
    console.log(`📚 API Formations: http://localhost:${PORT}/api/formations`);
    console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  });

  // Gestion des erreurs non capturées et des promesses rejetées
  process.on("uncaughtException", (error) => {
    console.error("❌ Erreur non capturée:", error);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("❌ Promise rejetée:", reason);
  });
}

// Exporter l'app pour Vercel
export default app;

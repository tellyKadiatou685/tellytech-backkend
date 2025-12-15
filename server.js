import dotenv from "dotenv";

// Charger les variables d'environnement EN PREMIER
dotenv.config();

// Maintenant importer l'app depuis src
import app from "./src/app.js";

const PORT = process.env.PORT || 8000;

// Pour Vercel, ne pas utiliser app.listen() en production
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📍 URL principale: http://localhost:${PORT}`);
    console.log(`📚 API Formations: http://localhost:${PORT}/api/formations`);
    console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  });
}

// Exporter l'app pour Vercel
export default app;

// Gestion des erreurs (garder seulement en local)
if (process.env.NODE_ENV !== "production") {
  process.on("uncaughtException", (error) => {
    console.error("❌ Erreur non capturée:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Promise rejetée:", reason);
    process.exit(1);
  });
}
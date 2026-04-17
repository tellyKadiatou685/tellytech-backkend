import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import formationRoutes from "./routes/formation.routes.js";
import messageRoutes from "./routes/message.routes.js";
import inscriptionRoutes from "./routes/inscription.routes.js";
import authRoutes from './routes/auth.routes.js';
import paiementRoutes from "./routes/paiement.routes.js";
import submissionRoutes from "./routes/submission.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import courseRoutes from './routes/course.routes.js';
import DevoirRoutes from './routes/devoir.routes.js';
import emploiDuTempsRoutes from './routes/emploiDuTemps.routes.js';

dotenv.config();

const app = express();

// ✅ CORS explicite — avant tout le reste
app.use(cors({
  origin: [
    'http://localhost:8081',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ✅ Preflight pour Express 5
app.options('/{*path}', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "TellyTech API fonctionne !",
    endpoints: {
      formations:   "/api/formations",
      inscriptions: "/api/inscriptions",
      paiements:    "/api/paiements",
      messages:     "/api/messages",
      auth:         "/api/auth"
    }
  });
});

app.use("/api/formations",   formationRoutes);
app.use("/api/paiements",    paiementRoutes);
app.use("/api/messages",     messageRoutes);
app.use("/api/inscriptions", inscriptionRoutes);
app.use('/api/auth',         authRoutes);
app.use('/api/submissions',  submissionRoutes);
app.use('/api/courses',      courseRoutes);
app.use('/api/progress',     progressRoutes);
app.use('/api/emploie',      emploiDuTempsRoutes);
app.use('/api/devoir',      DevoirRoutes );

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
    path: req.originalUrl
  });
});

// Erreurs globales
app.use((err, req, res, next) => {
  console.error("❌ Erreur:", err);

  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: "Erreur lors de l'upload du fichier",
      error: err.message
    });
  }

  res.status(500).json({
    success: false,
    message: 'Une erreur est survenue sur le serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
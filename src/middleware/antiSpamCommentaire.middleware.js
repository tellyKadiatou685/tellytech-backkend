// Rate limiting simple en mémoire (suffisant pour un seul serveur / trafic modéré).
// Si tu passes un jour à plusieurs instances serveur, remplace par Redis.
const historique = new Map(); // ip -> [timestamps]

const FENETRE_MS = 10 * 60 * 1000; // 10 minutes
const MAX_COMMENTAIRES = 5; // max 5 commentaires / 10 min / IP

export function antiSpamCommentaire(req, res, next) {
  // 1. Honeypot : champ invisible côté formulaire front, jamais rempli par un humain
  if (req.body.siteWeb) {
    // On répond succès (pour ne pas indiquer au bot qu'il a été détecté),
    // mais on n'insère rien en base.
    return res.status(201).json({ success: true, message: "Commentaire envoyé." });
  }

  // 2. Rate limit par IP
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const maintenant = Date.now();
  const timestamps = (historique.get(ip) || []).filter((t) => maintenant - t < FENETRE_MS);

  if (timestamps.length >= MAX_COMMENTAIRES) {
    return res.status(429).json({
      success: false,
      message: "Trop de commentaires envoyés récemment. Réessaie dans quelques minutes.",
    });
  }

  timestamps.push(maintenant);
  historique.set(ip, timestamps);

  next();
}

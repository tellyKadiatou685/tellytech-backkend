import formationService from '../services/formation.service.js';

const formationController = {

  // POST /api/formations
  create: async (req, res) => {
    try {
      const formation = await formationService.createFormation(req.body, req.files);
      res.status(201).json({ success: true, message: 'Formation créée', data: formation });
    } catch (error) {
      console.error('❌ create:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // GET /api/formations       → public (estActif: true)
  // GET /api/admin/formations → admin (toutes)
  getAll: async (req, res) => {
    try {
      const adminMode = req.baseUrl?.includes('admin') || req.query.admin === 'true';
      const formations = await formationService.getAllFormations({ adminMode });
      res.status(200).json({ success: true, count: formations.length, data: formations });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/formations/:id
  getById: async (req, res) => {
    try {
      const formation = await formationService.getFormationById(req.params.id);
      res.status(200).json({ success: true, data: formation });
    } catch (error) {
      const status = error.message === 'Formation introuvable' ? 404 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  },

  // GET /api/formations/slug/:slug
  getBySlug: async (req, res) => {
    try {
      const formation = await formationService.getFormationBySlug(req.params.slug);
      res.status(200).json({ success: true, data: formation });
    } catch (error) {
      const status = error.message === 'Formation introuvable' ? 404 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  },

  // PUT /api/formations/:id
  update: async (req, res) => {
    try {
      const formation = await formationService.updateFormation(req.params.id, req.body, req.files);
      res.status(200).json({ success: true, message: 'Formation mise à jour', data: formation });
    } catch (error) {
      console.error('❌ update:', error.message);
      const status = error.message === 'Formation introuvable' ? 404 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  },

  // PATCH /api/formations/:id/toggle
  toggleActivation: async (req, res) => {
    try {
      const result = await formationService.toggleActivation(req.params.id);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      const status = error.message === 'Formation introuvable' ? 404 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  },

  // DELETE /api/formations/:id
  delete: async (req, res) => {
    try {
      const result = await formationService.deleteFormation(req.params.id);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      const status = error.message === 'Formation introuvable' ? 404 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  },

  // GET /api/formations/categorie/:categorie
  getByCategorie: async (req, res) => {
    try {
      const formations = await formationService.getFormationsByCategorie(req.params.categorie);
      res.status(200).json({ success: true, count: formations.length, data: formations });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /api/formations/search?q=...
  search: async (req, res) => {
    try {
      if (!req.query.q?.trim()) {
        return res.status(400).json({ success: false, message: 'Paramètre ?q= manquant' });
      }
      const formations = await formationService.searchFormations(req.query.q);
      res.status(200).json({ success: true, count: formations.length, data: formations });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default formationController;
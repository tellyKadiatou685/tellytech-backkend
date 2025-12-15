import formationService from '../services/formation.service.js';

const formationController = {
  // Créer une formation
  create: async (req, res) => {
    try {
      const formation = await formationService.createFormation(req.body, req.files);
      res.status(201).json({
        success: true,
        message: 'Formation créée avec succès',
        data: formation
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Récupérer toutes les formations
  getAll: async (req, res) => {
    try {
      const formations = await formationService.getAllFormations();
      res.status(200).json({
        success: true,
        count: formations.length,
        data: formations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Récupérer une formation par ID
  getById: async (req, res) => {
    try {
      const formation = await formationService.getFormationById(req.params.id);
      res.status(200).json({
        success: true,
        data: formation
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  },

  // Récupérer une formation par slug
  getBySlug: async (req, res) => {
    try {
      const formation = await formationService.getFormationBySlug(req.params.slug);
      res.status(200).json({
        success: true,
        data: formation
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  },

  // Mettre à jour une formation
  update: async (req, res) => {
    try {
      const formation = await formationService.updateFormation(req.params.id, req.body, req.files);
      res.status(200).json({
        success: true,
        message: 'Formation mise à jour avec succès',
        data: formation
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Supprimer une formation
  delete: async (req, res) => {
    try {
      const result = await formationService.deleteFormation(req.params.id);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Récupérer les formations par catégorie
  getByCategorie: async (req, res) => {
    try {
      const formations = await formationService.getFormationsByCategorie(req.params.categorie);
      res.status(200).json({
        success: true,
        count: formations.length,
        data: formations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

export default formationController;
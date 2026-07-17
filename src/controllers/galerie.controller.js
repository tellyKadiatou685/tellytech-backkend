import * as galerieService from "../services/galerie.service.js";

export async function lister(req, res) {
  try {
    const photos = await galerieService.listerPhotos({ categorie: req.query.categorie });
    res.json({ success: true, photos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function alaUne(req, res) {
  try {
    const photo = await galerieService.getPhotoALaUne();
    res.json({ success: true, photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function creer(req, res) {
  try {
    const photo = await galerieService.creerPhoto(req.body, req.file);
    res.status(201).json({ success: true, photo });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function supprimer(req, res) {
  try {
    await galerieService.supprimerPhoto(req.params.id);
    res.json({ success: true, message: "Photo supprimée" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}
import prisma from '../config/database.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// 🔐 LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Récupérer l'utilisateur avec TOUS les champs
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        nom: true,
        role: true,
        formation: true, // ← Peut être null pour admin
        cohorte: true,   // ← Peut être null pour admin
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Générer le JWT avec role
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // ✅ Construire la réponse selon le rôle
    const userResponse = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      role: user.role,
      createdAt: user.createdAt,
    };

    // ✅ Ajouter formation/cohorte UNIQUEMENT pour les étudiants (USER)
    if (user.role === 'USER') {
      userResponse.formation = user.formation; // ← PAS de valeur par défaut !
      userResponse.cohorte = user.cohorte;
      
      // ⚠️ Warning si formation manquante (erreur de données)
      if (!user.formation) {
        console.warn('⚠️ ATTENTION: User étudiant sans formation !', user.email);
      }
    }

    console.log('✅ Login réussi:', user.email, '- Role:', user.role);
    if (user.role === 'USER') {
      console.log('📚 Formation:', userResponse.formation || 'NON DÉFINIE', '- Cohorte:', userResponse.cohorte);
    }

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Erreur login:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  }
};

// 🚪 DÉCONNEXION
export const logout = async (req, res) => {
  try {
    // Côté JWT, pas besoin de faire grand-chose côté serveur
    // La déconnexion se gère principalement côté client en supprimant le token
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('❌ Erreur logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  }
};

// 🔍 VÉRIFIER LE TOKEN
export const verifyToken = async (req, res) => {
  try {
    // req.user est déjà rempli par le middleware auth
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        nom: true,
        role: true,
        formation: true,
        cohorte: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // ✅ Construire la réponse selon le rôle
    const userResponse = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      role: user.role,
      createdAt: user.createdAt,
    };

    // ✅ Ajouter formation/cohorte pour les USER
    if (user.role === 'USER') {
      userResponse.formation = user.formation;
      userResponse.cohorte = user.cohorte;
    }

    res.json({
      success: true,
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Erreur verify token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du token'
    });
  }
};
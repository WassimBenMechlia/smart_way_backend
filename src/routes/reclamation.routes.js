const express = require('express');
const router = express.Router();
const reclamationController = require('../controllers/reclamation.controller');

// Route to get all reclamations
router.get('/', reclamationController.getAllReclamations);

// Route to create a new reclamation
router.post('/', reclamationController.createReclamation);

// Route to delete a reclamation
router.delete('/:reclamationId', reclamationController.deleteReclamation);

module.exports = router;

const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/tokenController');

// GET /api/tokens/check - Checks if registration exists and matches
router.get('/check', tokenController.checkToken);

// POST /api/tokens - Registers/saves a student's FCM token
router.post('/', tokenController.registerToken);

module.exports = router;

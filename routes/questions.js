const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

// POST /api/questions - Creates a new question and notifies the class
router.post('/', questionController.createQuestion);

module.exports = router;

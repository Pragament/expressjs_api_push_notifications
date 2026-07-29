const express = require('express');
const router = express.Router();
const answerController = require('../controllers/answerController');

// POST /api/answers - Submits a response and notifies the question author
router.post('/', answerController.createAnswer);

module.exports = router;

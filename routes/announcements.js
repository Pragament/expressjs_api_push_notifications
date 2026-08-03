const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');

// POST /api/teacher-announcement - Dispatches teacher announcement notifications to class students
router.post('/', announcementController.createAnnouncement);

module.exports = router;
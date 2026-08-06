const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');

// POST /api/announcements - Dispatches a new announcement push notification
router.post('/', announcementController.createAnnouncementNotification);

module.exports = router;

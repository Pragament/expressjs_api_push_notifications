const firestoreService = require('../services/firestoreService');
const notificationService = require('../services/notificationService');
const { isInitialized } = require('../config/firebaseAdmin');

exports.createAnnouncementNotification = async (req, res, next) => {
  console.log('[Controller] Incoming POST request to /api/announcements. Body:', req.body);
  
  try {
    const { classCode, teacherName, title, description, announcementId, createdAt } = req.body;
    
    // Request validation
    if (!classCode || !title || !description) {
      console.warn('[Controller] Validation failed: missing classCode, title, or description');
      return res.status(400).json({
        success: false,
        message: 'Validation failed: classCode, title, and description are required.'
      });
    }

    // Check if Firebase Admin is fully initialized for messaging
    if (!isInitialized()) {
      console.warn('[Controller] Firebase Admin is not initialized. Skipping FCM dispatch.');
      return res.status(201).json({
        success: true,
        message: 'Announcement notification skipped (Firebase Admin uninitialized).'
      });
    }

    // 1. Fetch all students' tokens in the class
    let fcmResult;
    try {
      const { tokens } = await firestoreService.getFcmTokensForClass(classCode, '');
      
      if (tokens.length > 0) {
        // 2. Dispatch multicast notifications
        fcmResult = await notificationService.sendAnnouncementNotification(tokens, {
          announcementId: announcementId || `announcement_${Date.now()}`,
          classCode: classCode,
          teacherName: teacherName || 'Teacher',
          title: title,
          description: description,
          createdAt: createdAt || new Date().toISOString()
        });
      } else {
        console.log('[Controller] No active recipient tokens found in this class. No notifications sent.');
      }
    } catch (fcmError) {
      console.error('[Controller] Notification delivery failed:', fcmError);
      return res.status(500).json({
        success: false,
        message: 'Push notification dispatch failed.',
        error: fcmError.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Push notifications successfully dispatched for announcement.',
      notificationStatus: fcmResult || { success: true, message: 'No target tokens.' }
    });

  } catch (error) {
    console.error('[Controller] Unhandled error in createAnnouncementNotification:', error);
    next(error);
  }
};

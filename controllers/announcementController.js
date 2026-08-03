const firestoreService = require('../services/firestoreService');
const notificationService = require('../services/notificationService');
const { isInitialized } = require('../config/firebaseAdmin');

exports.createAnnouncement = async (req, res, next) => {
  console.log('[Controller] Incoming POST request to /api/teacher-announcement. Body:', req.body);
  
  try {
    const { classCode, teacherId, title, description } = req.body;
    
    // Request validation
    if (!classCode || !description) {
      console.warn('[Controller] Validation failed: missing classCode or description');
      return res.status(400).json({
        success: false,
        message: 'Validation failed: classCode and description are required.'
      });
    }

    // 1. Save announcement to Firestore using Admin SDK
    let announcement;
    try {
      announcement = await firestoreService.saveAnnouncement({
        classCode: String(classCode).trim(),
        teacherId: teacherId ? String(teacherId).trim() : '',
        title: title ? String(title).trim() : '',
        description: String(description).trim()
      });
    } catch (dbError) {
      console.error('[Controller] Firestore save failed:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Failed to write announcement to database.',
        error: dbError.message
      });
    }

    // Check if Firebase Admin is fully initialized for messaging
    if (!isInitialized()) {
      console.warn('[Controller] Firebase Admin is not initialized. Skipping FCM dispatch.');
      return res.status(201).json({
        success: true,
        announcementId: announcement.id,
        message: 'Announcement saved. Push notifications disabled (Firebase Admin uninitialized).'
      });
    }

    // 2. Fetch all students' tokens in the class (no exclusion)
    const { tokens, rollNumbers } = await firestoreService.getFcmTokensForClass(announcement.classCode, '');
    
    let fcmResult;
    if (tokens.length > 0) {
      // 3. Dispatch announcement notifications to class students
      fcmResult = await notificationService.sendTeacherAnnouncementNotification(tokens, {
        announcementId: announcement.id,
        classCode: announcement.classCode,
        title: announcement.title,
        description: announcement.description,
        createdAt: announcement.createdAt.toISOString()
      });
      console.log('[Controller] Announcement FCM dispatch completed successfully. Target tokens count:', tokens.length);
    } else {
      console.log('[Controller] No students found in class to notify.');
    }

    return res.status(200).json({
      success: true,
      announcementId: announcement.id,
      message: 'Announcement processed, saved to Firestore, and notifications dispatched.',
      notifiedDevices: tokens.length,
      fcmResult
    });

  } catch (error) {
    console.error('[Controller] Error in createAnnouncement controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during announcement dispatch.',
      error: error.message
    });
  }
};
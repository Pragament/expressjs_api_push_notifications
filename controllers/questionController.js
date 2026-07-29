const firestoreService = require('../services/firestoreService');
const notificationService = require('../services/notificationService');
const { isInitialized } = require('../config/firebaseAdmin');

exports.createQuestion = async (req, res, next) => {
  console.log('[Controller] Incoming POST request to /api/questions. Body:', req.body);
  
  try {
    const { classCode, rollNumber, studentName, questionTitle, questionDescription, studentCode, editorUrl } = req.body;
    
    // Request validation
    if (!classCode || !rollNumber) {
      console.warn('[Controller] Validation failed: missing classCode or rollNumber');
      return res.status(400).json({
        success: false,
        message: 'Validation failed: classCode and rollNumber are required.'
      });
    }

    // 1. Save question to Firestore
    let question;
    try {
      question = await firestoreService.saveQuestion({
        classCode: String(classCode).trim(),
        rollNumber: String(rollNumber).trim(),
        studentName: studentName ? String(studentName).trim() : '',
        questionTitle: questionTitle ? String(questionTitle).trim() : '',
        questionDescription: questionDescription ? String(questionDescription).trim() : '',
        studentCode: studentCode || '',
        editorUrl: editorUrl || ''
      });
    } catch (dbError) {
      console.error('[Controller] Firestore save failed:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Failed to write question to database.',
        error: dbError.message
      });
    }

    // Check if Firebase Admin is fully initialized for messaging
    if (!isInitialized()) {
      console.warn('[Controller] Firebase Admin is not initialized. Skipping FCM dispatch.');
      return res.status(201).json({
        success: true,
        questionId: question.id,
        message: 'Question saved. Push notifications disabled (Firebase Admin uninitialized).'
      });
    }

    // 2. Fetch all other students' tokens in the class
    let fcmResult;
    try {
      const { tokens, rollNumbers } = await firestoreService.getFcmTokensForClass(question.classCode, question.rollNumber);
      
      if (tokens.length > 0) {
        // 3. Dispatch multicast notifications
        fcmResult = await notificationService.sendNewQuestionNotification(tokens, {
          questionId: question.id,
          classCode: question.classCode,
          rollNumber: question.rollNumber,
          studentName: question.studentName,
          questionTitle: question.questionTitle,
          questionDescription: question.questionDescription,
          studentCode: question.studentCode
        });
      } else {
        console.log('[Controller] No active recipient tokens found. No notifications sent.');
      }
    } catch (fcmError) {
      console.error('[Controller] Notification delivery failed:', fcmError);
      // We still return 201 Created because the question was successfully written to Firestore
      return res.status(201).json({
        success: true,
        questionId: question.id,
        message: 'Question saved, but push notification dispatch failed.',
        error: fcmError.message
      });
    }

    return res.status(201).json({
      success: true,
      questionId: question.id,
      message: 'Question created and push notifications successfully dispatched.',
      notificationStatus: fcmResult || { success: true, message: 'No target tokens.' }
    });

  } catch (error) {
    console.error('[Controller] Unhandled error in createQuestion:', error);
    next(error);
  }
};

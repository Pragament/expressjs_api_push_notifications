const firestoreService = require('../services/firestoreService');
const notificationService = require('../services/notificationService');
const { isInitialized } = require('../config/firebaseAdmin');

exports.createAnswer = async (req, res, next) => {
  console.log('[Controller] Incoming POST request to /api/answers. Body:', req.body);
  
  try {
    const { questionId, solverRollNumber, solverName, correctedCode, explanation } = req.body;
    
    // Request validation
    if (!questionId || !solverRollNumber) {
      console.warn('[Controller] Validation failed: missing questionId or solverRollNumber');
      return res.status(400).json({
        success: false,
        message: 'Validation failed: questionId and solverRollNumber are required.'
      });
    }

    // 1. Save answer/response in Firestore
    let answer;
    try {
      answer = await firestoreService.saveAnswer({
        questionId: String(questionId).trim(),
        solverRollNumber: String(solverRollNumber).trim(),
        solverName: solverName ? String(solverName).trim() : '',
        correctedCode: correctedCode || '',
        explanation: explanation || ''
      });
    } catch (dbError) {
      console.error('[Controller] Firestore save answer failed:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Failed to write answer to database.',
        error: dbError.message
      });
    }

    // Check if Firebase Admin is fully initialized for messaging
    if (!isInitialized()) {
      console.warn('[Controller] Firebase Admin is not initialized. Skipping FCM dispatch.');
      return res.status(201).json({
        success: true,
        answerId: answer.id,
        message: 'Answer saved. Push notifications disabled (Firebase Admin uninitialized).'
      });
    }

    // 2. Find the original question owner details
    let fcmResult;
    try {
      const owner = await firestoreService.getQuestionOwner(questionId);
      if (owner && owner.classCode && owner.rollNumber) {
        // Exclude notifying yourself if you answered your own question
        if (String(owner.rollNumber) !== String(solverRollNumber)) {
          // 3. Fetch original owner's FCM token
          const token = await firestoreService.getTokenForStudent(owner.classCode, owner.rollNumber);
          if (token) {
            // 4. Send notification
            fcmResult = await notificationService.sendAnswerNotification(token, {
              questionId: questionId,
              classCode: owner.classCode,
              askerRollNumber: owner.rollNumber,
              solverRollNumber: solverRollNumber,
              solverName: solverName
            });
          } else {
            console.log(`[Controller] Original question owner Roll ${owner.rollNumber} does not have a registered FCM token.`);
          }
        } else {
          console.log('[Controller] Asker solved their own question. Skipping notification.');
        }
      } else {
        console.warn(`[Controller] Could not find owner details for question ${questionId}. Skipping FCM notification.`);
      }
    } catch (fcmError) {
      console.error('[Controller] Notification delivery failed:', fcmError);
      return res.status(201).json({
        success: true,
        answerId: answer.id,
        message: 'Answer saved, but push notification dispatch failed.',
        error: fcmError.message
      });
    }

    return res.status(201).json({
      success: true,
      answerId: answer.id,
      message: 'Answer created and push notification successfully dispatched.',
      notificationStatus: fcmResult || { success: true, message: 'No target token.' }
    });

  } catch (error) {
    console.error('[Controller] Unhandled error in createAnswer:', error);
    next(error);
  }
};

const { messaging, isInitialized } = require('../config/firebaseAdmin');
const { removeFcmToken } = require('./firestoreService');

async function checkInit() {
  if (!isInitialized()) {
    throw new Error('Firebase Admin SDK is not initialized. Check your credentials file.');
  }
}

/**
 * Sends a multicast notification to a list of student tokens when a question is asked.
 */
async function sendNewQuestionNotification(tokens, payload) {
  await checkInit();
  if (!tokens || tokens.length === 0) {
    console.log('[NotificationService] No tokens provided. Skipping notification dispatch.');
    return { success: true, message: 'No target devices.' };
  }

  console.log(`[NotificationService] Dispatching new question notification to ${tokens.length} tokens...`);

  // Build the FCM message payload according to specifications
  const message = {
    notification: {
      title: '🔔 New Question',
      body: `Roll No. ${payload.rollNumber} has asked a question.\nTitle: ${payload.questionTitle || 'Untitled'}\nDescription: ${payload.questionDescription || ''}`
    },
    data: {
      type: 'new_question',
      questionId: String(payload.questionId),
      classCode: String(payload.classCode),
      rollNumber: String(payload.rollNumber),
      studentName: String(payload.studentName || ''),
      title: String(payload.questionTitle || ''),
      description: String(payload.questionDescription || ''),
      studentCode: String(payload.studentCode || ''),
      createdTime: new Date().toISOString()
    },
    tokens: tokens
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log('[NotificationService] Multicast send response:', response);
    console.log('[NotificationService] Notification send result:', response);
    
    // Process delivery failures and clean up invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          console.warn(`[NotificationService] Failed to deliver notification to token at index ${idx}. Error:`, error.code, error.message);
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-argument' ||
              (error.message && (error.message.includes('registration token') || error.message.includes('not registered')))) {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        console.log(`[NotificationService] Cleaning up ${failedTokens.length} stale/invalid tokens.`);
        for (const token of failedTokens) {
          await removeFcmToken(token).catch(err => {
            console.error('[NotificationService] Error removing stale token:', err);
          });
        }
      }
    }

    return { success: true, response };
  } catch (error) {
    console.error('[NotificationService] Error sending multicast message:', error);
    throw error;
  }
}

/**
 * Sends a single FCM notification to the original asker when their question is answered.
 */
async function sendAnswerNotification(token, payload) {
  await checkInit();
  if (!token) {
    console.log('[NotificationService] No token provided. Skipping notification dispatch.');
    return { success: true, message: 'No target device.' };
  }

  console.log(`[NotificationService] Dispatching answer notification to token for Roll ${payload.askerRollNumber}...`);

  const message = {
    notification: {
      title: '✅ Your Question Has Been Answered',
      body: `Roll No. ${payload.solverRollNumber} has answered your question.`
    },
    data: {
      type: 'answer_notification',
      questionId: String(payload.questionId),
      classCode: String(payload.classCode),
      rollNumber: String(payload.askerRollNumber),
      solverRollNumber: String(payload.solverRollNumber),
      solverName: String(payload.solverName || '')
    },
    token: token
  };

  try {
    const response = await messaging.send(message);
    console.log('[NotificationService] Single send response successful:', response);
    console.log('[NotificationService] Notification send result:', response);
    return { success: true, response };
  } catch (error) {
    console.error('[NotificationService] Error sending answer notification:', error);
    
    // Clean up if token is invalid
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-argument' ||
        (error.message && (error.message.includes('registration token') || error.message.includes('not registered')))) {
      console.log(`[NotificationService] Token is invalid. Cleaning up: ${token}`);
      await removeFcmToken(token).catch(err => {
        console.error('[NotificationService] Error removing invalid token:', err);
      });
    }
    
    throw error;
  }
}

/**
 * Sends a multicast notification to a list of student tokens when an announcement is published.
 */
async function sendAnnouncementNotification(tokens, payload) {
  await checkInit();
  if (!tokens || tokens.length === 0) {
    console.log('[NotificationService] No tokens provided. Skipping notification dispatch.');
    return { success: true, message: 'No target devices.' };
  }

  console.log(`[NotificationService] Dispatching new announcement notification to ${tokens.length} tokens...`);

  // Build the FCM message payload according to specifications
  const message = {
    notification: {
      title: '📢 New Announcement',
      body: `${payload.teacherName} posted a new announcement: ${payload.title}`
    },
    data: {
      type: 'announcement',
      announcementId: String(payload.announcementId),
      classCode: String(payload.classCode),
      teacherName: String(payload.teacherName),
      title: String(payload.title),
      description: String(payload.description),
      createdAt: String(payload.createdAt || new Date().toISOString())
    },
    tokens: tokens
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log('[NotificationService] Multicast send response:', response);
    
    // Process delivery failures and clean up invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          console.warn(`[NotificationService] Failed to deliver announcement notification to token at index ${idx}. Error:`, error.code, error.message);
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-argument' ||
              (error.message && (error.message.includes('registration token') || error.message.includes('not registered')))) {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        console.log(`[NotificationService] Cleaning up ${failedTokens.length} stale/invalid tokens.`);
        for (const token of failedTokens) {
          await removeFcmToken(token).catch(err => {
            console.error('[NotificationService] Error removing stale token:', err);
          });
        }
      }
    }

    return { success: true, response };
  } catch (error) {
    console.error('[NotificationService] Error sending multicast message:', error);
    throw error;
  }
}

module.exports = {
  sendNewQuestionNotification,
  sendAnswerNotification,
  sendAnnouncementNotification
};

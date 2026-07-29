const { db, isInitialized } = require('../config/firebaseAdmin');

async function checkInit() {
  if (!isInitialized()) {
    throw new Error('Firebase Admin SDK is not initialized. Check your credentials file.');
  }
}

/**
 * Saves a new question to the Firestore questions collection.
 */
async function saveQuestion(payload) {
  await checkInit();
  console.log('[Firestore] Saving new question to Firestore...', {
    classCode: payload.classCode,
    rollNumber: payload.rollNumber,
    studentName: payload.studentName,
    questionTitle: payload.questionTitle
  });
  
  const questionData = {
    classCode: payload.classCode,
    rollNumber: payload.rollNumber,
    studentName: payload.studentName || '',
    questionTitle: payload.questionTitle || '',
    questionDescription: payload.questionDescription || '',
    studentCode: payload.studentCode || '',
    createdTime: new Date(),
    status: payload.status || 'Open',
    repliesCount: 0,
    editorUrl: payload.editorUrl || ''
  };

  const docRef = await db.collection('questions').add(questionData);
  console.log(`[Firestore] Question successfully saved with Document ID: ${docRef.id}`);
  return { id: docRef.id, ...questionData };
}

/**
 * Retrieves all FCM tokens for a class, excluding a specific roll number.
 */
async function getFcmTokensForClass(classCode, excludeRollNumber) {
  await checkInit();
  console.log(`[Firestore] Fetching student FCM tokens for Class Code: ${classCode}`);
  console.log(`[Firestore] Express token lookup. Class Code: ${classCode}`);
  
  const snapshot = await db.collection('studentFcmTokens')
    .where('classCode', '==', classCode)
    .get();

  const tokens = [];
  const rollNumbers = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.fcmToken) {
      if (String(data.rollNumber) !== String(excludeRollNumber)) {
        tokens.push(data.fcmToken);
        rollNumbers.push(data.rollNumber);
      } else {
        console.log(`[Firestore] Excluded asker's own FCM token (Roll: ${excludeRollNumber})`);
      }
    }
  });

  console.log(`[Firestore] Found ${tokens.length} target student token(s). Roll Numbers:`, rollNumbers);
  return { tokens, rollNumbers };
}

/**
 * Saves an answer to the responses sub-collection of a question.
 */
async function saveAnswer(payload) {
  await checkInit();
  const { questionId, solverRollNumber, solverName, correctedCode, explanation } = payload;
  console.log(`[Firestore] Saving response answer for Question ID: ${questionId}...`);

  const responseData = {
    authorType: 'student',
    authorId: solverRollNumber,
    authorName: solverName || `Roll ${solverRollNumber}`,
    correctedCode: correctedCode || '',
    explanation: explanation || '',
    timestamp: new Date()
  };

  const docRef = await db.collection('questions')
    .doc(questionId)
    .collection('responses')
    .add(responseData);

  console.log(`[Firestore] Response successfully saved with Document ID: ${docRef.id}`);

  // Increment repliesCount on parent question using a transaction
  try {
    const questionRef = db.collection('questions').doc(questionId);
    await db.runTransaction(async (transaction) => {
      const qDoc = await transaction.get(questionRef);
      if (qDoc.exists) {
        const currentReplies = Number(qDoc.data().repliesCount || 0);
        transaction.update(questionRef, { repliesCount: currentReplies + 1 });
        console.log(`[Firestore] Incremented repliesCount for parent question ${questionId} to ${currentReplies + 1}`);
      } else {
        console.warn(`[Firestore] Parent question ${questionId} not found during transaction.`);
      }
    });
  } catch (txError) {
    console.error(`[Firestore] Failed to increment repliesCount for question ${questionId}:`, txError);
  }

  return { id: docRef.id, ...responseData };
}

/**
 * Retrieves the owner/asker information for a question.
 */
async function getQuestionOwner(questionId) {
  await checkInit();
  console.log(`[Firestore] Retrieving details for parent Question ID: ${questionId}`);
  
  const doc = await db.collection('questions').doc(questionId).get();
  if (!doc.exists) {
    console.warn(`[Firestore] Question document ${questionId} not found.`);
    return null;
  }

  const data = doc.data();
  return {
    classCode: data.classCode,
    rollNumber: data.rollNumber,
    questionTitle: data.questionTitle || 'Untitled',
    questionDescription: data.questionDescription || '',
    studentCode: data.studentCode || ''
  };
}

/**
 * Retrieves a single student's FCM token.
 */
async function getTokenForStudent(classCode, rollNumber) {
  await checkInit();
  const docId = `${classCode}_${rollNumber}`;
  console.log(`[Firestore] Retrieving FCM registration token for Doc ID: ${docId}`);
  console.log(`[Firestore] Express token lookup. Doc ID: ${docId}`);

  const doc = await db.collection('studentFcmTokens').doc(docId).get();
  if (!doc.exists) {
    console.warn(`[Firestore] No token registration found for student: ${docId}`);
    return null;
  }

  return doc.data().fcmToken || null;
}

/**
 * Removes an invalid FCM token from Firestore.
 */
async function removeFcmToken(token) {
  await checkInit();
  console.log('[Firestore] Deleting invalid/expired FCM token from registrations...');
  
  const snapshot = await db.collection('studentFcmTokens')
    .where('fcmToken', '==', token)
    .get();

  const batch = db.batch();
  snapshot.forEach(doc => {
    console.log(`[Firestore] Queueing deletion of token document: ${doc.id}`);
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log('[Firestore] Invalid tokens successfully cleaned up.');
}

/**
 * Saves or updates a student's FCM token in Firestore.
 */
async function saveFcmToken(payload) {
  await checkInit();
  const { classCode, rollNumber, studentName, fcmToken } = payload;
  const docId = `${classCode}_${rollNumber}`;
  console.log(`[Firestore] Saving FCM registration token for student Roll: ${rollNumber} in Class: ${classCode}`);
  
  const docRef = db.collection('studentFcmTokens').doc(docId);
  await docRef.set({
    classCode,
    rollNumber,
    studentName: studentName || '',
    fcmToken,
    timestamp: new Date(),
    updatedTime: new Date()
  }, { merge: true });
  
  console.log(`[Firestore] FCM token successfully saved under Doc ID: ${docId}`);
  console.log(`[Firestore] Firestore document created. Doc ID: ${docId}`);
  return docId;
}

module.exports = {
  saveQuestion,
  getFcmTokensForClass,
  saveAnswer,
  getQuestionOwner,
  getTokenForStudent,
  removeFcmToken,
  saveFcmToken
};

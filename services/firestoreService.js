const { db, isInitialized } = require('../config/firebaseAdmin');

// In-memory cache for FCM tokens grouped by classCode
// Structure: { [classCode]: { [rollNumber]: fcmToken } }
const tokenCache = {};

async function checkInit() {
  if (!isInitialized()) {
    throw new Error('Firebase Admin SDK is not initialized. Check your credentials file.');
  }
}

/**
 * Initializes the in-memory token cache by reading all registrations from Firestore once.
 */
async function initializeTokenCache() {
  await checkInit();
  console.log('[Cache] Initializing FCM token cache from Firestore...');
  try {
    const snapshot = await db.collection('studentFcmTokens').get();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.classCode && data.rollNumber && data.fcmToken) {
        const classCode = String(data.classCode).trim();
        const rollNumber = String(data.rollNumber).trim();
        if (!tokenCache[classCode]) {
          tokenCache[classCode] = {};
        }
        tokenCache[classCode][rollNumber] = data.fcmToken;
      }
    });
    console.log('[Cache] FCM token cache initialized. Classes cached:', Object.keys(tokenCache).length);
  } catch (err) {
    console.error('[Cache Error] Failed to initialize FCM token cache:', err);
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
 * Retrieves all FCM tokens for a class from the memory cache, excluding a specific roll number.
 */
async function getFcmTokensForClass(classCode, excludeRollNumber) {
  console.log(`[Cache] Fetching student FCM tokens from memory cache for Class Code: ${classCode}`);
  const cleanClass = String(classCode).trim();
  const cleanExclude = String(excludeRollNumber || '').trim();

  const classGroup = tokenCache[cleanClass] || {};
  const tokens = [];
  const rollNumbers = [];

  for (const [roll, token] of Object.entries(classGroup)) {
    if (roll !== cleanExclude) {
      tokens.push(token);
      rollNumbers.push(roll);
    } else {
      console.log(`[Cache] Excluded asker's own FCM token (Roll: ${excludeRollNumber})`);
    }
  }

  console.log(`[Cache] Found ${tokens.length} target student token(s) from memory. Roll Numbers:`, rollNumbers);
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
 * Retrieves a single student's FCM token from the memory cache.
 */
async function getTokenForStudent(classCode, rollNumber) {
  console.log(`[Cache] Retrieving FCM token from memory for Class: ${classCode}, Roll: ${rollNumber}`);
  const cleanClass = String(classCode).trim();
  const cleanRoll = String(rollNumber).trim();
  return tokenCache[cleanClass]?.[cleanRoll] || null;
}

/**
 * Removes an invalid FCM token from Firestore and memory cache.
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

  // Update memory cache
  const cleanToken = String(token).trim();
  for (const classCode of Object.keys(tokenCache)) {
    const classGroup = tokenCache[classCode];
    for (const rollNumber of Object.keys(classGroup)) {
      if (classGroup[rollNumber] === cleanToken) {
        console.log(`[Cache] Removing deleted token from memory for Class: ${classCode}, Roll: ${rollNumber}`);
        delete classGroup[rollNumber];
      }
    }
    if (Object.keys(classGroup).length === 0) {
      delete tokenCache[classCode];
    }
  }
}

/**
 * Saves or updates a student's FCM token in Firestore and updates the memory cache.
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

  // Update memory cache
  const cleanClass = String(classCode).trim();
  const cleanRoll = String(rollNumber).trim();
  if (!tokenCache[cleanClass]) {
    tokenCache[cleanClass] = {};
  }
  tokenCache[cleanClass][cleanRoll] = String(fcmToken).trim();

  return docId;
}

module.exports = {
  saveQuestion,
  getFcmTokensForClass,
  saveAnswer,
  getQuestionOwner,
  getTokenForStudent,
  removeFcmToken,
  saveFcmToken,
  initializeTokenCache
};

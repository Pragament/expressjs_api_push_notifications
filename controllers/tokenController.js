const { saveFcmToken, getTokenForStudent } = require('../services/firestoreService');

exports.checkToken = async (req, res, next) => {
  console.log('[Controller] Incoming GET request to /api/tokens/check. Query:', req.query);
  const { classCode, rollNumber, fcmToken } = req.query;

  if (!classCode || !rollNumber) {
    console.warn('[Controller] Validation failed: missing classCode or rollNumber for check');
    return res.status(400).json({
      success: false,
      message: 'Validation failed: classCode and rollNumber are required.'
    });
  }

  try {
    const existingToken = await getTokenForStudent(String(classCode).trim(), String(rollNumber).trim());
    if (!existingToken) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: 'No registration document found.'
      });
    }

    const matches = (fcmToken && String(existingToken).trim() === String(fcmToken).trim());
    return res.status(200).json({
      success: true,
      exists: true,
      matches,
      token: existingToken,
      message: matches ? 'Registration matches.' : 'Registration exists but token differs.'
    });
  } catch (error) {
    console.error('[Controller] Error checking token:', error);
    next(error);
  }
};

exports.registerToken = async (req, res, next) => {
  console.log('[Controller] Incoming POST request to /api/tokens. Body:', req.body);
  const { classCode, rollNumber, studentName, fcmToken } = req.body;

  if (!classCode || !rollNumber || !fcmToken) {
    console.warn('[Controller] Validation failed: missing classCode, rollNumber, or fcmToken');
    return res.status(400).json({
      success: false,
      message: 'Validation failed: classCode, rollNumber, and fcmToken are required.'
    });
  }

  try {
    console.log('[Controller] Registering student token...');
    const docId = await saveFcmToken({
      classCode: String(classCode).trim(),
      rollNumber: String(rollNumber).trim(),
      studentName: studentName ? String(studentName).trim() : '',
      fcmToken: String(fcmToken).trim()
    });

    return res.status(201).json({
      success: true,
      docId,
      message: 'FCM token registered successfully.'
    });
  } catch (error) {
    console.error('[Controller] Error registering token:', error);
    next(error);
  }
};

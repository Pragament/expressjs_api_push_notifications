const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const projectId = process.env.FIREBASE_PROJECT_ID || 'eschool-dev-4c6b4';

// Resolve service account credential path relative to backend root directory
let credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'config/serviceAccountKey.json';
if (!path.isAbsolute(credentialPath)) {
  credentialPath = path.resolve(__dirname, '..', credentialPath);
}

let initialized = false;

try {
  if (fs.existsSync(credentialPath)) {
    console.log(`[Firebase Admin] Loading credentials from: ${credentialPath}`);
    const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId
    });
    initialized = true;
    console.log('[Firebase Admin] Firebase Admin SDK successfully initialized using Service Account certificate.');
  } else {
    console.warn(`[Firebase Admin] Warning: Credentials file not found at: ${credentialPath}`);
    // Attempt standard Application Default Credentials (e.g. deployed environments)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('[Firebase Admin] Attempting initialization with Application Default Credentials (ADC)...');
      admin.initializeApp({
        projectId: projectId
      });
      initialized = true;
      console.log('[Firebase Admin] Firebase Admin SDK initialized using ADC.');
    } else {
      console.error('[Firebase Admin] Error: No credentials found! Database and messaging actions will be unavailable.');
      console.error('[Firebase Admin] Action Required: Place your Firebase service account key JSON file at: config/serviceAccountKey.json');
    }
  }
} catch (error) {
  console.error('[Firebase Admin] Critical error during SDK initialization:', error);
}

const db = initialized ? admin.firestore() : null;
const messaging = initialized ? admin.messaging() : null;

module.exports = {
  admin,
  db,
  messaging,
  isInitialized: () => initialized
};

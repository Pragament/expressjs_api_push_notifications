# Pragament Notification Express API Server

This is the Express.js backend API for the Pragament Chrome Extension. It replaces the old Firebase Cloud Functions, serving as the central coordinator for Firestore data persistence and Firebase Cloud Messaging (FCM) push notifications.

---

## 🛠 Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **SDK**: Firebase Admin SDK
- **Environment**: dotenv, cors, nodemon (for development)

---

## 📦 Installation

1. Navigate to the backend directory:
   ```bash
   cd express_js
   ```
2. Install npm packages:
   ```bash
   npm install
   ```

---

## 🔑 Firebase Service Account Setup

To authorize the server to speak to Firestore and send push notifications via FCM, you must supply a Service Account key:

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project **`eschool-dev-4c6b4`** (or relevant project).
3. Click the Gear Icon ⚙ next to Project Overview, and choose **Project Settings**.
4. Go to the **Service Accounts** tab.
5. Click **Generate New Private Key**, then click **Generate Key** to download the JSON credentials file.
6. Rename the downloaded file to **`serviceAccountKey.json`**.
7. Place the file inside the backend config directory:
   ```
   express_js/config/serviceAccountKey.json
   ```

*(Note: `.gitignore` has been pre-configured to ensure this key is never committed to Git).*

---

## ⚙ Environment Variables

Configure settings by editing the `.env` file in the project root:
- `PORT`: HTTP port the server listens on (defaults to `3000`).
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to your service account key file (defaults to `config/serviceAccountKey.json`).
- `FIREBASE_PROJECT_ID`: Your Firebase Project ID (defaults to `eschool-dev-4c6b4`).

---

## 🚀 Running Locally

- **Development Mode** (with hot-reload via nodemon):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

---

## 🧪 Testing with the Chrome Extension

1. Ensure the Express server is running locally at `http://localhost:3000`.
2. The extension is pre-configured to point its `BACKEND_BASE` variable to `http://localhost:3000` in `config.js`.
3. Open `chrome://extensions` in Google Chrome and click **Reload** under the **Lab Policy Whitelist** extension.
4. Test the workflows:
   - **Ask Class**: Submit a question from a W3Schools editor page. The extension makes a POST request to `http://localhost:3000/api/questions`, saving the question and triggering multicast FCM notifications to classmates.
   - **Submit Answer**: Solve a question from the Student Dashboard. The dashboard makes a POST request to `http://localhost:3000/api/answers`, saving the answer response and triggering an FCM notification to the original asker.

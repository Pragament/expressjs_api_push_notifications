require('dotenv').config();
const express = require('express');
const cors = require('cors');
const questionsRouter = require('./routes/questions');
const answersRouter = require('./routes/answers');
const tokensRouter = require('./routes/tokens');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS to allow requests from the Chrome Extension context
app.use(cors());

// Configure JSON body parser middleware
app.use(express.json());

// Request logger middleware for tracing extension API calls
app.use((req, res, next) => {
  console.log(`[HTTP Request] ${req.method} ${req.originalUrl} - IP: ${req.ip} - Time: ${new Date().toISOString()}`);
  next();
});

// Basic Health Check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Pragament Push Notification Express Server.',
    status: 'online',
    timestamp: new Date()
  });
});

// Map API endpoints
app.use('/api/questions', questionsRouter);
app.use('/api/answers', answersRouter);
app.use('/api/tokens', tokensRouter);

// Global Error Handler Middleware
app.use(errorHandler);

// Launch HTTP listener
app.listen(PORT, () => {
  console.log('============================================================');
  console.log(`[Server] Pragament Notification Server running on port ${PORT}`);
  console.log(`[Server] Local Endpoint: http://localhost:${PORT}`);
  console.log(`[Server] Environment Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log('============================================================');
});

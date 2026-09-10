const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  console.warn('⚠ MONGODB_URI not set — running without database. Configure the environment to enable persistence.');
}

/* Module-level connect promise so concurrent cold-start requests
   (e.g. serverless) share a single in-flight connection. */
let connectPromise = null;

mongoose.connection.on('connected', () => {
  console.log('✓ MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('✗ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

async function connectDB(options = {}) {
  if (!process.env.MONGODB_URI) return false;
  if (mongoose.connection.readyState === 1) return true;

  /* Already connecting — wait for the in-flight attempt instead of racing. */
  if (mongoose.connection.readyState === 2) {
    if (!connectPromise) return false;
    try {
      return await connectPromise;
    } catch (_) {
      return false;
    }
  }

  const opts = {
    serverSelectionTimeoutMS: 8000,
    autoIndex: true,
    maxPoolSize: 10,
    socketTimeoutMS: 30000,
    ...options
  };

  connectPromise = mongoose
    .connect(process.env.MONGODB_URI, opts)
    .then(() => {
      connectPromise = null;
      return true;
    })
    .catch((err) => {
      connectPromise = null;
      console.error('✗ Failed to connect to MongoDB:', err.message);
      return false;
    });

  return connectPromise;
}

async function disconnectDB() {
  connectPromise = null;
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB, isConnected: () => mongoose.connection.readyState === 1 };
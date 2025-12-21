/**
 * Global test setup - runs once before all tests
 */

module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/real-estate-test';

  console.log('\n🧪 Starting test suite...');
};

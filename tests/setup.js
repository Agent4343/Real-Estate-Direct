/**
 * Test setup - runs before each test file
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock console.log for cleaner test output (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn()
// };

// Global test utilities
global.testUtils = {
  generateToken: (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  },

  createMockUser: () => ({
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!'
  }),

  createMockProperty: () => ({
    propertyType: 'house',
    address: {
      street: '123 Test Street',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 1A1'
    },
    price: {
      listPrice: 500000
    },
    details: {
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1500,
      yearBuilt: 2000,
      lotSize: 5000
    },
    description: 'A beautiful test property'
  })
};

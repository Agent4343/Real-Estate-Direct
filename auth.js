const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const User = require('./models/user.model');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const emailService = require('./services/email.service');
const authMiddleware = require('./auth.middleware');

// Strict rate limiting for login attempts (prevents brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins
});

// Rate limiting for registration (prevents mass account creation)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: { error: 'Too many accounts created. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for password reset (prevents abuse)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset attempts per hour
  message: { error: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Password complexity regex - requires:
// - At least 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one number
// - At least one special character
const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Validation middleware for registration
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&]/).withMessage('Password must contain at least one special character (@$!%*?&)')
];

// Validation middleware for login
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Register
router.post('/register', registerLimiter, registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already registered.' });
    }

    // Password will be hashed by the pre-save hook in user.model.js
    const user = new User({ name, email, password });
    await user.save();

    res.status(201).json({ id: user._id, name: user.name, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Login
router.post('/login', loginLimiter, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
      expiresIn: '1h',
    });

    res.json({ message: 'Login successful', token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Forgot Password - Request reset link
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save token to user
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await emailService.sendPasswordReset(user.email, {
      name: user.name,
      resetUrl: `${appUrl}/reset-password?token=${resetToken}`,
      expiresInHours: 1
    });

    res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Helper function to validate password complexity
function validatePasswordComplexity(password) {
  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter');
  if (!/\d/.test(password)) errors.push('one number');
  if (!/[@$!%*?&]/.test(password)) errors.push('one special character (@$!%*?&)');
  return errors;
}

// Reset Password - Set new password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    const passwordErrors = validatePasswordComplexity(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `Password must contain: ${passwordErrors.join(', ')}`
      });
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Change Password - For logged in users
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const passwordErrors = validatePasswordComplexity(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        error: `New password must contain: ${passwordErrors.join(', ')}`
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;

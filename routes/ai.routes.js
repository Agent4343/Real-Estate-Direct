const express = require('express');
const router = express.Router();
const authMiddleware = require('../auth.middleware');
const User = require('../models/user.model');

const AI_MONTHLY_LIMIT = 5; // Free tier limit

// Helper function to check and reset monthly usage
async function checkAndResetUsage(user) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Reset usage if new month
  if (user.aiToolsUsage.lastResetMonth !== currentMonth ||
      user.aiToolsUsage.lastResetYear !== currentYear) {
    user.aiToolsUsage.count = 0;
    user.aiToolsUsage.lastResetMonth = currentMonth;
    user.aiToolsUsage.lastResetYear = currentYear;
    await user.save();
  }

  return user;
}

// Get AI usage status
router.get('/usage', authMiddleware, async (req, res) => {
  try {
    let user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check and reset if new month
    user = await checkAndResetUsage(user);

    // Check if premium and still valid
    const isPremiumActive = user.isPremium &&
      (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

    res.json({
      count: user.aiToolsUsage.count || 0,
      limit: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT,
      isPremium: isPremiumActive,
      canUse: isPremiumActive || (user.aiToolsUsage.count || 0) < AI_MONTHLY_LIMIT
    });
  } catch (err) {
    console.error('Error getting AI usage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Increment AI usage (called before each AI search)
router.post('/use', authMiddleware, async (req, res) => {
  try {
    let user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check and reset if new month
    user = await checkAndResetUsage(user);

    // Check if premium and still valid
    const isPremiumActive = user.isPremium &&
      (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

    // Check if user can use AI tools
    if (!isPremiumActive && (user.aiToolsUsage.count || 0) >= AI_MONTHLY_LIMIT) {
      return res.status(403).json({
        error: 'Monthly AI usage limit reached',
        count: user.aiToolsUsage.count,
        limit: AI_MONTHLY_LIMIT,
        canUse: false
      });
    }

    // Increment usage (even for premium to track)
    user.aiToolsUsage.count = (user.aiToolsUsage.count || 0) + 1;
    await user.save();

    res.json({
      success: true,
      count: user.aiToolsUsage.count,
      limit: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT,
      remaining: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT - user.aiToolsUsage.count,
      canUse: isPremiumActive || user.aiToolsUsage.count < AI_MONTHLY_LIMIT
    });
  } catch (err) {
    console.error('Error incrementing AI usage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user can use AI tools (without incrementing)
router.get('/can-use', authMiddleware, async (req, res) => {
  try {
    let user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check and reset if new month
    user = await checkAndResetUsage(user);

    // Check if premium and still valid
    const isPremiumActive = user.isPremium &&
      (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

    const canUse = isPremiumActive || (user.aiToolsUsage.count || 0) < AI_MONTHLY_LIMIT;

    res.json({
      canUse,
      count: user.aiToolsUsage.count || 0,
      limit: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT,
      remaining: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT - (user.aiToolsUsage.count || 0),
      isPremium: isPremiumActive
    });
  } catch (err) {
    console.error('Error checking AI usage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

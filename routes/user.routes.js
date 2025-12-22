const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const authMiddleware = require('../auth.middleware');

// Get user preferences (checklist progress and favorites)
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('checklistProgress favoriteProperties');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Convert Map to plain object for JSON response
    const checklistProgress = user.checklistProgress ? Object.fromEntries(user.checklistProgress) : {};

    res.json({
      checklistProgress,
      favoriteProperties: user.favoriteProperties || []
    });
  } catch (err) {
    console.error('Error fetching preferences:', err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update checklist progress
router.put('/checklist', authMiddleware, async (req, res) => {
  try {
    const { checklistProgress } = req.body;

    if (!checklistProgress || typeof checklistProgress !== 'object') {
      return res.status(400).json({ error: 'Invalid checklist progress data' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the checklist progress map
    user.checklistProgress = new Map(Object.entries(checklistProgress));
    await user.save();

    res.json({
      message: 'Checklist progress saved',
      checklistProgress: Object.fromEntries(user.checklistProgress)
    });
  } catch (err) {
    console.error('Error saving checklist:', err);
    res.status(500).json({ error: 'Failed to save checklist progress' });
  }
});

// Update single checklist item
router.patch('/checklist/:itemId', authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { completed } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.checklistProgress) {
      user.checklistProgress = new Map();
    }

    if (completed) {
      user.checklistProgress.set(itemId, true);
    } else {
      user.checklistProgress.delete(itemId);
    }

    await user.save();

    res.json({
      message: 'Checklist item updated',
      itemId,
      completed
    });
  } catch (err) {
    console.error('Error updating checklist item:', err);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// Reset checklist (buyer or seller)
router.delete('/checklist/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params; // 'buyer' or 'seller'

    if (!['buyer', 'seller'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "buyer" or "seller"' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.checklistProgress) {
      // Remove all items that start with the type prefix
      const prefix = `${type}-`;
      for (const key of user.checklistProgress.keys()) {
        if (key.startsWith(prefix)) {
          user.checklistProgress.delete(key);
        }
      }
      await user.save();
    }

    res.json({ message: `${type} checklist reset` });
  } catch (err) {
    console.error('Error resetting checklist:', err);
    res.status(500).json({ error: 'Failed to reset checklist' });
  }
});

// Add favorite property
router.post('/favorites', authMiddleware, async (req, res) => {
  try {
    const { propertyId, address, askingPrice, bedrooms, bathrooms, squareFeet, propertyType, image } = req.body;

    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already favorited
    const existingFavorite = user.favoriteProperties.find(
      f => f.propertyId && f.propertyId.toString() === propertyId
    );

    if (existingFavorite) {
      return res.status(400).json({ error: 'Property already saved' });
    }

    user.favoriteProperties.push({
      propertyId,
      address,
      askingPrice,
      bedrooms,
      bathrooms,
      squareFeet,
      propertyType,
      image,
      savedAt: new Date()
    });

    await user.save();

    res.status(201).json({
      message: 'Property saved to favorites',
      favorite: user.favoriteProperties[user.favoriteProperties.length - 1]
    });
  } catch (err) {
    console.error('Error adding favorite:', err);
    res.status(500).json({ error: 'Failed to save property' });
  }
});

// Remove favorite property
router.delete('/favorites/:propertyId', authMiddleware, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const initialLength = user.favoriteProperties.length;
    user.favoriteProperties = user.favoriteProperties.filter(
      f => !f.propertyId || f.propertyId.toString() !== propertyId
    );

    if (user.favoriteProperties.length === initialLength) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await user.save();

    res.json({ message: 'Property removed from favorites' });
  } catch (err) {
    console.error('Error removing favorite:', err);
    res.status(500).json({ error: 'Failed to remove property' });
  }
});

// Get all favorites
router.get('/favorites', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('favoriteProperties');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.favoriteProperties || []);
  } catch (err) {
    console.error('Error fetching favorites:', err);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

module.exports = router;

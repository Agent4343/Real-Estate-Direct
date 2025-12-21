const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const auth = require('../auth.middleware');
const { uploadPropertyImages, handleUploadError } = require('../middleware/upload');
const Property = require('../models/property.model');

// Upload images for a property
router.post('/property/:propertyId', auth, uploadPropertyImages.array('images', 20), handleUploadError, async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      // Clean up uploaded files if property not found
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check ownership
    if (property.owner.toString() !== req.user.id) {
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create image records
    const newImages = req.files.map((file, index) => ({
      url: `/uploads/properties/${file.filename}`,
      caption: req.body.captions ? req.body.captions[index] : '',
      isPrimary: property.photos.length === 0 && index === 0,
      order: property.photos.length + index
    }));

    // Add to property
    property.photos.push(...newImages);
    await property.save();

    res.status(201).json({
      message: `${newImages.length} image(s) uploaded successfully`,
      images: newImages
    });
  } catch (err) {
    // Clean up on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Set primary image for a property
router.put('/property/:propertyId/primary/:imageIndex', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const imageIndex = parseInt(req.params.imageIndex);
    if (imageIndex < 0 || imageIndex >= property.photos.length) {
      return res.status(400).json({ error: 'Invalid image index' });
    }

    // Update primary flags
    property.photos.forEach((photo, idx) => {
      photo.isPrimary = idx === imageIndex;
    });

    await property.save();

    res.json({ message: 'Primary image updated', photos: property.photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update image caption
router.put('/property/:propertyId/caption/:imageIndex', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const imageIndex = parseInt(req.params.imageIndex);
    if (imageIndex < 0 || imageIndex >= property.photos.length) {
      return res.status(400).json({ error: 'Invalid image index' });
    }

    property.photos[imageIndex].caption = req.body.caption || '';
    await property.save();

    res.json({ message: 'Caption updated', photo: property.photos[imageIndex] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reorder images
router.put('/property/:propertyId/reorder', auth, async (req, res) => {
  try {
    const { order } = req.body; // Array of image indices in new order

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (order.length !== property.photos.length) {
      return res.status(400).json({ error: 'Order array must match number of photos' });
    }

    // Reorder photos
    const reorderedPhotos = order.map((oldIndex, newIndex) => {
      const photo = property.photos[oldIndex];
      photo.order = newIndex;
      return photo;
    });

    property.photos = reorderedPhotos;
    await property.save();

    res.json({ message: 'Images reordered', photos: property.photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an image
router.delete('/property/:propertyId/:imageIndex', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const imageIndex = parseInt(req.params.imageIndex);
    if (imageIndex < 0 || imageIndex >= property.photos.length) {
      return res.status(400).json({ error: 'Invalid image index' });
    }

    const photo = property.photos[imageIndex];

    // Delete file from filesystem
    const filePath = path.join(__dirname, '..', photo.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from array
    property.photos.splice(imageIndex, 1);

    // Update order for remaining photos
    property.photos.forEach((p, idx) => {
      p.order = idx;
    });

    // If deleted photo was primary, make first photo primary
    if (photo.isPrimary && property.photos.length > 0) {
      property.photos[0].isPrimary = true;
    }

    await property.save();

    res.json({ message: 'Image deleted', photos: property.photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

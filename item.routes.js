const express = require('express');
const router = express.Router();
const { Item, itemValidationSchema } = require('./item.model');
const mongoose = require('mongoose');

// Middleware to validate ObjectId
function validateObjectId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).send('Invalid ID format');
  }
  next();
}

// Get all items
router.get('/', async (req, res) => {
  try {
    const items = await Item.find();
    res.send(items);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

// Get item by id
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).send('Item not found');
    }
    res.send(item);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

// Create a new item
router.post('/', async (req, res) => {
  try {
    const { error } = itemValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    const item = new Item(req.body);
    await item.save();
    res.status(201).send(item);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

// Update an item
router.put('/:id', validateObjectId, async (req, res) => {
  try {
    const { error } = itemValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) {
      return res.status(404).send('Item not found');
    }
    res.send(item);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

// Delete an item
router.delete('/:id', validateObjectId, async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).send('Item not found');
    }
    res.send(item);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;


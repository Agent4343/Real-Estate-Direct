const mongoose = require('mongoose');
const Joi = require('joi');

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  images: { type: [String], required: true },
  available: { type: Boolean, required: true },
});

const Item = mongoose.model('Item', itemSchema);

const itemValidationSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().required(),
  images: Joi.array().items(Joi.string()).required(),
  available: Joi.boolean().required(),
});

module.exports = { Item, itemValidationSchema };


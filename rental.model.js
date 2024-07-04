const mongoose = require('mongoose');
const joi = require('joi');

const rentalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  startDate: Date,
  endDate: Date,
  totalPrice: Number
});

const Rental = mongoose.model('Rental', rentalSchema);

const rentalValidationSchema = joi.object().keys({
  userId: joi.string().required(),
  itemId: joi.string().required(),
  startDate: joi.date().required(),
  endDate: joi.date().required(),
  totalPrice: joi.number().required()
});

module.exports = { Rental, rentalValidationSchema };

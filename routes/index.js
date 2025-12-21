const authRoutes = require('../auth');
const propertyRoutes = require('./property.routes');
const listingRoutes = require('./listing.routes');
const offerRoutes = require('./offer.routes');
const transactionRoutes = require('./transaction.routes');
const documentRoutes = require('./document.routes');
const itemRoutes = require('../item.routes');
const rentalRoutes = require('../rental.routes');

module.exports = {
  authRoutes,
  propertyRoutes,
  listingRoutes,
  offerRoutes,
  transactionRoutes,
  documentRoutes,
  itemRoutes,
  rentalRoutes
};

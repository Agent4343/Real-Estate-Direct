const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const itemRoutes = require('./item.routes');

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/items', itemRoutes);

// Database connection
mongoose.connect(process.env.DB_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true })
 .then(() => console.log('Connected to database'))
 .catch((err) => console.log('Database connection error:', err));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
 console.log(`Server is running on port ${PORT}`);
});

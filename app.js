const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const winston = require('winston');
const expressWinston = require('express-winston');
require('dotenv').config();

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    // useNewUrlParser and useUnifiedTopology are not needed for Mongoose 6 and later
}).then(() => {
    console.log('MongoDB connected');
}).catch(err => {
    console.error('Failed to connect to MongoDB', err);
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Logging
app.use(expressWinston.logger({
    transports: [
        new winston.transports.File({
            filename: 'combined.log'
        })
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
    )
}));

// Routes
app.use('/auth', require('./auth'));
app.use('/items', require('./item.routes'));

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

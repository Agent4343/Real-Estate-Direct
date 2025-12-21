# Real Estate Direct

A rental property management REST API built with Node.js, Express, and MongoDB.

## Features

- User authentication (register/login) with JWT tokens
- Property/item management (CRUD operations)
- Rental booking system
- Input validation
- Rate limiting
- Security headers (Helmet)

## Prerequisites

- Node.js 18+
- MongoDB

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template and configure:
   ```bash
   cp .env.example .env
   ```
4. Update `.env` with your settings (especially `SECRET_KEY` with a strong random string)

## Running the Application

```bash
# Development
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3001` (or the port specified in `.env`).

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and receive JWT token

### Items
- `GET /items` - Get all items
- `GET /items/:id` - Get single item
- `POST /items` - Create new item
- `PUT /items/:id` - Update item
- `DELETE /items/:id` - Delete item

### Rentals (requires authentication)
- `GET /rentals` - Get user's rentals
- `GET /rentals/:id` - Get single rental
- `POST /rentals` - Create new rental
- `DELETE /rentals/:id` - Cancel rental

### Health
- `GET /health` - Health check endpoint

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| MONGO_URI | MongoDB connection string | mongodb://localhost:27017/rental-app |
| SECRET_KEY | JWT signing secret | (required) |
| PORT | Server port | 3001 |
| NODE_ENV | Environment | development |

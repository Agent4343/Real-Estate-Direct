# Real Estate Direct

A comprehensive Canadian real estate buying/selling platform API built with Node.js, Express, and MongoDB.

## Features

- **User Authentication** - Register, login with JWT tokens
- **Property Management** - Full CRUD for property listings
- **Offer System** - Submit offers, counter-offers, accept/reject workflow
- **Transaction Management** - Step-by-step transaction workflow tracking
- **Condition Tracking** - Financing, inspection, and other conditions
- **Document Generation** - Province-specific legal forms
- **Land Transfer Tax Calculator** - Accurate calculations for all provinces
- **Province Compliance** - Forms and requirements for all Canadian provinces

## Supported Provinces

| Province | Land Transfer Tax | Forms Provider |
|----------|------------------|----------------|
| Ontario | Yes (+ Toronto municipal) | OREA |
| British Columbia | Property Transfer Tax | BCREA |
| Alberta | Registration fees only | AREA |
| Quebec | Welcome Tax | OACIQ |
| Manitoba | Yes | MREA |
| Saskatchewan | No | SREC |
| Nova Scotia | Deed Transfer Tax | NSAR |
| New Brunswick | Yes | NBREA |
| Prince Edward Island | Yes | PEIREA |
| Newfoundland & Labrador | Registration fees | NLARE |
| Territories | Varies | Standard |

## Prerequisites

- Node.js 18+
- MongoDB 6+

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Real-Estate-Direct
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Start the server:
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login and get token |

### Properties
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties` | Search properties |
| GET | `/api/properties/:id` | Get property details |
| POST | `/api/properties` | Create property (auth) |
| PUT | `/api/properties/:id` | Update property (owner) |
| DELETE | `/api/properties/:id` | Delete property (owner) |

### Listings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/listings` | Get active listings |
| POST | `/api/listings` | Activate listing (auth) |
| PATCH | `/api/listings/:id/status` | Update status (owner) |

### Offers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offers/my-offers` | Buyer's offers |
| GET | `/api/offers/received` | Seller's received offers |
| POST | `/api/offers` | Submit offer |
| POST | `/api/offers/:id/accept` | Accept offer (seller) |
| POST | `/api/offers/:id/reject` | Reject offer (seller) |
| POST | `/api/offers/:id/counter` | Counter offer (seller) |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions/my-transactions` | User's transactions |
| GET | `/api/transactions/:id` | Transaction details |
| PUT | `/api/transactions/:id/step` | Advance workflow |
| PUT | `/api/transactions/:id/conditions/:id` | Update condition |
| GET | `/api/transactions/:id/closing-costs` | Calculate costs |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents/forms/:province` | Available forms |
| POST | `/api/documents/generate` | Generate document |
| POST | `/api/documents/:id/sign` | Sign document |

### Utilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/provinces` | List all provinces |
| GET | `/api/calculate-tax` | Land transfer tax |
| GET | `/health` | Health check |

## Transaction Workflow

### Seller Flow
1. **List Property** - Create property and activate listing
2. **Receive Offers** - View and respond to offers
3. **Accept Offer** - Accept best offer, transaction created
4. **Track Conditions** - Monitor buyer's conditions
5. **Engage Lawyer** - Add lawyer information
6. **Close Transaction** - Complete sale

### Buyer Flow
1. **Search Properties** - Browse active listings
2. **Submit Offer** - Make offer with conditions
3. **Negotiate** - Counter-offers back and forth
4. **Fulfill Conditions** - Financing, inspection, etc.
5. **Engage Lawyer** - Add lawyer information
6. **Close Transaction** - Take possession

## Land Transfer Tax Examples

```bash
# Ontario (Toronto) - $800,000 property, first-time buyer
GET /api/calculate-tax?province=ON&price=800000&isFirstTimeBuyer=true&isToronto=true

# Response:
{
  "province": "ON",
  "purchasePrice": 800000,
  "provincial": 12475,
  "municipal": 12475,
  "rebate": 8475,
  "total": 16475
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | localhost |
| `SECRET_KEY` | JWT signing secret | (required) |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |

## Project Structure

```
Real-Estate-Direct/
├── app.js                 # Express application
├── auth.js                # Authentication routes
├── auth.middleware.js     # JWT middleware
├── config/
│   └── provinces.js       # Province config & tax calc
├── models/
│   ├── user.model.js
│   ├── property.model.js
│   ├── listing.model.js
│   ├── offer.model.js
│   ├── transaction.model.js
│   ├── condition.model.js
│   └── document.model.js
├── routes/
│   ├── property.routes.js
│   ├── listing.routes.js
│   ├── offer.routes.js
│   ├── transaction.routes.js
│   └── document.routes.js
├── package.json
└── README.md
```

## Legal Disclaimer

This platform provides tools for real estate transactions but does not constitute legal advice. Users should:
- Consult with licensed real estate lawyers/notaries
- Verify forms comply with current provincial requirements
- Use licensed real estate agents where required by law

## License

ISC

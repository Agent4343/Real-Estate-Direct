# Real Estate Direct - Canadian Real Estate Platform Implementation Plan

## Executive Summary

Transform the existing rental app into a comprehensive real estate buying/selling platform that guides users through the complete transaction process while ensuring compliance with provincial regulations across Canada.

---

## Part 1: Provincial Regulatory Research Summary

### Overview of Canadian Real Estate Regulations

Each Canadian province has its own:
- Regulatory body overseeing real estate transactions
- Required forms and documents
- Land transfer/deed transfer taxes
- Closing requirements (lawyers vs notaries)

### Province-by-Province Requirements

#### 1. Ontario
- **Regulatory Body**: Real Estate Council of Ontario (RECO), governed by TRESA 2020
- **Forms Provider**: Ontario Real Estate Association (OREA)
- **Key Forms**:
  - Form 100: Agreement of Purchase and Sale (Residential)
  - Form 101: Agreement of Purchase and Sale (Condo Resale)
  - Form 120: Amendment to Agreement
  - Form 220: Seller Property Information Statement (SPIS) - voluntary
  - Form 300: Buyer Representation Agreement
  - Form 400: Listing Agreement
  - Form 408: Acknowledgement of Conditions
  - Form 500: Commercial Agreement of Purchase and Sale
- **Closing Professional**: Real Estate Lawyer required
- **Taxes**: Land Transfer Tax (provincial + municipal in Toronto)
- **Special Notes**: Planning Act compliance required; TRESA Phase 2 in effect Dec 2023

#### 2. British Columbia
- **Regulatory Body**: BC Financial Services Authority (BCFSA)
- **Forms Provider**: BC Real Estate Association (BCREA)
- **Key Forms**:
  - Contract of Purchase and Sale (Form 578) - updated Nov 2024
  - Property Disclosure Statement (PDS)
  - Property No-Disclosure Statement (PNDS)
  - PDS - Strata Title Properties
  - Transparency Declaration
  - Transparency Report (if required)
- **Closing Professional**: Lawyer or Notary Public
- **Taxes**: Property Transfer Tax (PTT)
- **Special Notes**: Electronic filing via LTSA required since Dec 2020; GST handling updated Nov 2024

#### 3. Alberta
- **Regulatory Body**: Real Estate Council of Alberta (RECA)
- **Forms Provider**: Alberta Real Estate Association (AREA)
- **Key Forms**:
  - Residential Purchase Contract
  - Country Residential Purchase Contract
  - Residential Resale Condominium Purchase Contract
  - Commercial Purchase Contract
  - Property Disclosure Statement (voluntary but recommended)
- **Closing Professional**: Real Estate Lawyer
- **Taxes**: Land Transfer is administrative fee only (no provincial tax)
- **Special Notes**: Real Property Report (RPR) required; AREA forms restricted to REALTORS®

#### 4. Quebec
- **Regulatory Body**: OACIQ (Organisme d'autoréglementation du courtage immobilier du Québec)
- **Forms Provider**: OACIQ (mandatory forms)
- **Key Forms**:
  - Promise to Purchase (Promesse d'achat) - residential
  - Preliminary Contract (for new construction)
  - Amendments form
  - Brokerage Contract
  - Counter-proposal form
- **Closing Professional**: Notary REQUIRED (not lawyer)
- **Taxes**: Land Transfer Tax (Welcome Tax/Taxe de bienvenue)
- **Special Notes**: ~50 mandatory forms; Civil Code of Quebec governs; double representation prohibited since June 2022

#### 5. Manitoba
- **Regulatory Body**: Manitoba Securities Commission (Real Estate Division)
- **Forms Provider**: Manitoba Real Estate Association (MREA)
- **Key Forms**:
  - Form 1: Residential Offer to Purchase
  - Condominium Offer to Purchase
  - Assumption of Mortgage form
  - Standard Schedule for extra terms
- **Closing Professional**: Real Estate Lawyer
- **Taxes**: Land Transfer Tax
- **Special Notes**: 50+ forms available; forms reviewed under Real Estate Services Act

#### 6. Saskatchewan
- **Regulatory Body**: Saskatchewan Real Estate Commission (SREC)
- **Forms Provider**: Saskatchewan REALTORS® Association
- **Key Forms**:
  - Residential Purchase Contract
  - Property Condition Disclosure Statement
- **Closing Professional**: Real Estate Lawyer
- **Taxes**: No Land Transfer Tax (one of few provinces)
- **Special Notes**: Requires specific provincial research for complete form list

#### 7. Nova Scotia
- **Regulatory Body**: Nova Scotia Real Estate Commission (NSREC)
- **Forms Provider**: Nova Scotia Association of REALTORS® (NSAR)
- **Key Forms**:
  - Form 400: Agreement of Purchase and Sale (existing homes)
  - Form 408: Buyer Waiver of Conditions
  - Property Condition Disclosure Statement
- **Closing Professional**: Real Estate Lawyer
- **Taxes**: Deed Transfer Tax (varies by municipality)
- **Special Notes**: Electronic land registration system; non-member forms available

#### 8. New Brunswick
- **Regulatory Body**: New Brunswick Real Estate Association
- **Key Forms**:
  - Agreement of Purchase and Sale
  - Property Condition Disclosure
- **Closing Professional**: Real Estate Lawyer
- **Taxes**: Land Transfer Tax
- **Special Notes**: Requires specific provincial research

#### 9. Prince Edward Island
- **Regulatory Body**: PEI Real Estate Association
- **Key Forms**:
  - Agreement of Purchase and Sale
  - Property Disclosure Statement
- **Closing Professional**: Real Estate Lawyer
- **Taxes**: Real Property Transfer Tax
- **Special Notes**: Requires specific provincial research

#### 10. Newfoundland and Labrador
- **Regulatory Body**: Newfoundland and Labrador Association of REALTORS®
- **Key Forms**:
  - Purchase and Sale Agreement
  - Disclosure forms
- **Closing Professional**: Real Estate Lawyer
- **Taxes**: Registration fees (no Land Transfer Tax)
- **Special Notes**: Requires specific provincial research

#### 11. Territories (Yukon, NWT, Nunavut)
- Limited formal real estate infrastructure
- Generally follow federal guidelines
- Lawyer recommended for all transactions
- Requires specific research for each territory

---

## Part 2: Step-by-Step Transaction Workflow

### SELLER WORKFLOW

```
STEP 1: LISTING PREPARATION
├── Create account / Login
├── Select province
├── Property details input
│   ├── Address & legal description
│   ├── Property type (residential/condo/commercial)
│   ├── Square footage, bedrooms, bathrooms
│   ├── Year built
│   └── Features & amenities
├── Upload photos & virtual tour
├── Property Disclosure Statement (province-specific)
└── Set asking price

STEP 2: LISTING AGREEMENT
├── Generate Listing Agreement (province-specific form)
├── Set listing terms
│   ├── Listing period
│   ├── Commission structure (if agent)
│   └── Marketing permissions
├── E-signature collection
└── Listing goes live

STEP 3: RECEIVE OFFERS
├── View incoming offers
├── Each offer displays:
│   ├── Offer price
│   ├── Deposit amount
│   ├── Conditions (financing, inspection, etc.)
│   ├── Proposed closing date
│   └── Inclusions/exclusions
├── Accept / Reject / Counter-offer
└── Generate Counter-proposal form if needed

STEP 4: ACCEPTED OFFER
├── Agreement of Purchase and Sale executed
├── Buyer deposit held in trust
├── Track condition deadlines
│   ├── Financing condition
│   ├── Inspection condition
│   ├── Status certificate (condo)
│   └── Other conditions
└── Receive condition waiver notices

STEP 5: PRE-CLOSING
├── Provide access for inspections/appraisals
├── Order/provide surveys or RPR (Alberta)
├── Coordinate with lawyer/notary
├── Review Statement of Adjustments
├── Prepare for possession date
│   ├── Utility transfers
│   ├── Insurance cancellation
│   └── Moving arrangements
└── Sign closing documents

STEP 6: CLOSING
├── Lawyer/Notary handles:
│   ├── Title transfer
│   ├── Mortgage discharge
│   └── Fund disbursement
├── Keys handover
├── Transaction complete
└── Archive documents
```

### BUYER WORKFLOW

```
STEP 1: ACCOUNT SETUP
├── Create account / Login
├── Select province
├── Buyer profile
│   ├── First-time buyer status
│   ├── Pre-approval status
│   └── Search criteria
└── Sign Buyer Representation Agreement (optional)

STEP 2: PROPERTY SEARCH
├── Browse listings
├── Save favorites
├── Request showings
├── View property details
│   ├── Photos & virtual tours
│   ├── Property disclosure statements
│   ├── Price history
│   └── Comparable sales
└── Download property documents

STEP 3: MAKE OFFER
├── Generate Agreement of Purchase and Sale
│   └── Province-specific form auto-selected
├── Input offer details:
│   ├── Offer price
│   ├── Deposit amount
│   ├── Conditions
│   │   ├── Financing (standard)
│   │   ├── Home inspection
│   │   ├── Sale of buyer's property
│   │   ├── Status certificate review (condo)
│   │   └── Custom conditions
│   ├── Closing date
│   ├── Inclusions (appliances, fixtures)
│   └── Exclusions
├── Irrevocability period
├── E-signature
└── Submit offer to seller

STEP 4: NEGOTIATION
├── Receive seller response
│   ├── Accepted → proceed to Step 5
│   ├── Rejected → make new offer or move on
│   └── Counter-offer → review and respond
├── Sign-back process
└── Final agreement reached

STEP 5: CONDITIONAL PERIOD
├── Deposit submitted (held in trust)
├── Complete conditions:
│   ├── FINANCING
│   │   ├── Mortgage application
│   │   ├── Appraisal
│   │   └── Approval confirmation
│   ├── HOME INSPECTION
│   │   ├── Schedule inspector
│   │   ├── Review report
│   │   └── Negotiate repairs or credits
│   ├── STATUS CERTIFICATE (Condo)
│   │   ├── Request from condo corp
│   │   ├── Lawyer review
│   │   └── Reserve fund, rules, fees
│   └── OTHER CONDITIONS
├── Waive or fulfill each condition
├── Submit Condition Waiver form (province-specific)
└── Agreement becomes firm

STEP 6: PRE-CLOSING
├── Retain real estate lawyer (or notary in Quebec)
├── Lawyer conducts:
│   ├── Title search
│   ├── Check for liens/encumbrances
│   ├── Review survey/RPR
│   └── Prepare closing documents
├── Arrange title insurance (optional but recommended)
├── Finalize mortgage
├── Review Statement of Adjustments
├── Calculate closing costs:
│   ├── Land Transfer Tax
│   ├── Legal fees
│   ├── Title insurance
│   ├── Home insurance
│   ├── Property tax adjustment
│   └── Utility adjustments
├── Final walkthrough
└── Sign closing documents

STEP 7: CLOSING DAY
├── Transfer funds to lawyer
├── Lawyer registers deed/transfer
├── Title transfers to buyer
├── Receive keys
├── Transaction complete
└── Welcome to your new home!
```

---

## Part 3: Required Forms by Province (Implementation)

### Core Form Templates Needed

| Form Category | ON | BC | AB | QC | MB | SK | NS | NB | PE | NL |
|---------------|----|----|----|----|----|----|----|----|----|----|
| Agreement of Purchase & Sale | ✓ | ✓ | ✓ | ✓* | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Listing Agreement | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Buyer Representation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Property Disclosure | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Condition Waiver | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Amendment | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Counter-Proposal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Quebec uses "Promise to Purchase" instead of Agreement of Purchase and Sale

### Additional Province-Specific Forms

**Ontario:**
- OREA Form 100, 101, 120, 220, 300, 400, 408, 500

**British Columbia:**
- Property Transfer Tax Return
- Transparency Declaration
- Form D & E (if required)

**Alberta:**
- Real Property Report acknowledgment
- Condominium Document Request

**Quebec:**
- Preliminary Contract (new construction)
- Notary instruction form

---

## Part 4: Technical Implementation Plan

### Database Schema

```
USERS
├── id (UUID)
├── email
├── password (hashed)
├── name
├── phone
├── province
├── userType (buyer/seller/both)
├── createdAt
└── updatedAt

PROPERTIES
├── id (UUID)
├── sellerId (FK → Users)
├── province
├── address
├── legalDescription
├── propertyType (residential/condo/commercial/land)
├── bedrooms
├── bathrooms
├── squareFeet
├── yearBuilt
├── askingPrice
├── status (draft/active/pending/sold/withdrawn)
├── photos[]
├── features[]
├── createdAt
└── updatedAt

LISTINGS
├── id (UUID)
├── propertyId (FK → Properties)
├── listingAgreementId (FK → Documents)
├── startDate
├── endDate
├── status (active/expired/sold)
└── createdAt

OFFERS
├── id (UUID)
├── propertyId (FK → Properties)
├── buyerId (FK → Users)
├── offerPrice
├── depositAmount
├── closingDate
├── irrevocableDate
├── conditions[]
├── inclusions[]
├── exclusions[]
├── status (pending/accepted/rejected/countered/expired)
├── parentOfferId (FK → Offers, for counter-offers)
├── createdAt
└── updatedAt

TRANSACTIONS
├── id (UUID)
├── propertyId (FK → Properties)
├── buyerId (FK → Users)
├── sellerId (FK → Users)
├── acceptedOfferId (FK → Offers)
├── purchasePrice
├── depositAmount
├── closingDate
├── status (conditional/firm/closing/completed/cancelled)
├── currentStep
├── createdAt
└── updatedAt

CONDITIONS
├── id (UUID)
├── transactionId (FK → Transactions)
├── conditionType (financing/inspection/status_cert/sale_of_property/other)
├── description
├── deadlineDate
├── status (pending/fulfilled/waived/failed)
├── waiverDocumentId (FK → Documents)
└── createdAt

DOCUMENTS
├── id (UUID)
├── transactionId (FK → Transactions)
├── documentType (see list below)
├── province
├── formNumber
├── status (draft/pending_signature/signed/archived)
├── filePath
├── signedAt
├── signatures[]
├── createdAt
└── updatedAt

DOCUMENT_TYPES:
- listing_agreement
- buyer_representation
- agreement_purchase_sale
- property_disclosure
- condition_waiver
- amendment
- counter_proposal
- closing_statement
```

### New API Endpoints

```
AUTH
POST   /auth/register
POST   /auth/login
POST   /auth/forgot-password
POST   /auth/reset-password

USERS
GET    /users/me
PUT    /users/me
GET    /users/:id/transactions

PROPERTIES
GET    /properties                    # Search/list properties
GET    /properties/:id
POST   /properties                    # Create listing
PUT    /properties/:id
DELETE /properties/:id
POST   /properties/:id/photos         # Upload photos

LISTINGS
POST   /listings                      # Activate listing
PUT    /listings/:id
GET    /listings/my-listings

OFFERS
POST   /properties/:id/offers         # Submit offer
GET    /offers/:id
PUT    /offers/:id                    # Accept/reject/counter
GET    /offers/my-offers              # Buyer's offers
GET    /properties/:id/offers         # Seller views offers

TRANSACTIONS
GET    /transactions/:id
PUT    /transactions/:id/step         # Advance workflow step
GET    /transactions/my-transactions

CONDITIONS
GET    /transactions/:id/conditions
PUT    /conditions/:id                # Update condition status
POST   /conditions/:id/waive          # Waive condition

DOCUMENTS
GET    /transactions/:id/documents
POST   /transactions/:id/documents    # Generate document
GET    /documents/:id
POST   /documents/:id/sign            # E-signature
GET    /documents/:id/download

FORMS (Province-specific templates)
GET    /forms/:province               # List available forms
GET    /forms/:province/:formType     # Get form template
POST   /forms/generate                # Generate filled form
```

### New Files to Create

```
/models
├── property.model.js
├── listing.model.js
├── offer.model.js
├── transaction.model.js
├── condition.model.js
├── document.model.js
└── index.js

/routes
├── property.routes.js
├── listing.routes.js
├── offer.routes.js
├── transaction.routes.js
├── condition.routes.js
├── document.routes.js
└── form.routes.js

/controllers
├── property.controller.js
├── listing.controller.js
├── offer.controller.js
├── transaction.controller.js
├── condition.controller.js
├── document.controller.js
└── form.controller.js

/services
├── workflow.service.js          # Transaction state machine
├── document.service.js          # Form generation
├── signature.service.js         # E-signature handling
├── notification.service.js      # Email/SMS notifications
├── tax-calculator.service.js    # Land transfer tax calc
└── validation.service.js        # Province-specific validation

/forms
├── /templates
│   ├── /ontario
│   │   ├── agreement-purchase-sale.js
│   │   ├── listing-agreement.js
│   │   ├── buyer-representation.js
│   │   ├── property-disclosure.js
│   │   ├── condition-waiver.js
│   │   ├── amendment.js
│   │   └── counter-proposal.js
│   ├── /british-columbia
│   │   └── ... (same structure)
│   ├── /alberta
│   │   └── ...
│   ├── /quebec
│   │   └── ...
│   └── /... (other provinces)
└── form-generator.js

/middleware
├── auth.middleware.js (existing)
├── province.middleware.js        # Validate province selection
└── transaction-access.middleware.js

/utils
├── land-transfer-tax.js          # Provincial tax calculations
├── date-helpers.js
└── pdf-generator.js
```

### Implementation Phases

#### Phase 1: Core Foundation (Week 1-2)
- [ ] Property model and CRUD routes
- [ ] Listing model and routes
- [ ] Property search and filtering
- [ ] Photo upload handling
- [ ] Basic frontend structure

#### Phase 2: Offer System (Week 3-4)
- [ ] Offer model and routes
- [ ] Counter-offer flow
- [ ] Offer status management
- [ ] Notification system (email)

#### Phase 3: Transaction Workflow (Week 5-6)
- [ ] Transaction model and routes
- [ ] Condition tracking
- [ ] Workflow state machine
- [ ] Deadline notifications

#### Phase 4: Document Generation (Week 7-8)
- [ ] Form templates (Ontario first)
- [ ] PDF generation
- [ ] E-signature integration
- [ ] Document storage

#### Phase 5: Provincial Expansion (Week 9-10)
- [ ] BC form templates
- [ ] Alberta form templates
- [ ] Quebec form templates (Promise to Purchase)
- [ ] Remaining provinces

#### Phase 6: Financial Calculations (Week 11)
- [ ] Land transfer tax calculators (all provinces)
- [ ] Closing cost estimator
- [ ] Statement of adjustments generator

#### Phase 7: Polish & Testing (Week 12)
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation

---

## Part 5: Legal Disclaimers (Required)

The platform must include clear disclaimers:

1. **Not Legal Advice**: This platform provides tools and forms for convenience. It does not constitute legal advice. Users should consult with licensed real estate lawyers/notaries.

2. **Form Accuracy**: While forms are based on provincial standards, users should verify current requirements with their provincial real estate regulatory body.

3. **Agent Involvement**: Certain forms may require use by licensed real estate agents only. The platform will indicate when professional involvement is recommended.

4. **Provincial Compliance**: Users are responsible for ensuring transactions comply with all applicable provincial laws and regulations.

---

## Summary: Key Forms to Implement First (MVP)

Priority forms for initial launch (Ontario focus, then expand):

1. **Agreement of Purchase and Sale** (Form 100 equivalent)
2. **Property Disclosure Statement**
3. **Listing Agreement**
4. **Condition Waiver**
5. **Amendment to Agreement**
6. **Counter-Proposal**

These 6 forms cover the essential transaction flow and can be adapted per province.

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Create database models
4. Build out API routes
5. Implement form generation system

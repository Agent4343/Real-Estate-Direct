/**
 * Canadian Province Configuration
 * Contains regulatory information, tax calculations, and form requirements
 */

const provinces = {
  ON: {
    name: 'Ontario',
    code: 'ON',
    regulatoryBody: 'Real Estate Council of Ontario (RECO)',
    formsProvider: 'Ontario Real Estate Association (OREA)',
    closingProfessional: 'lawyer',

    // Land Transfer Tax Calculation
    landTransferTax: {
      calculate: (purchasePrice, isFirstTimeBuyer = false, isToronto = false) => {
        let provincialTax = 0;
        let municipalTax = 0;

        // Provincial Land Transfer Tax (Ontario)
        // Up to $55,000: 0.5%
        // $55,000 to $250,000: 1.0%
        // $250,000 to $400,000: 1.5%
        // $400,000 to $2,000,000: 2.0%
        // Over $2,000,000: 2.5%

        if (purchasePrice <= 55000) {
          provincialTax = purchasePrice * 0.005;
        } else if (purchasePrice <= 250000) {
          provincialTax = 275 + (purchasePrice - 55000) * 0.01;
        } else if (purchasePrice <= 400000) {
          provincialTax = 2225 + (purchasePrice - 250000) * 0.015;
        } else if (purchasePrice <= 2000000) {
          provincialTax = 4475 + (purchasePrice - 400000) * 0.02;
        } else {
          provincialTax = 36475 + (purchasePrice - 2000000) * 0.025;
        }

        // Toronto Municipal Land Transfer Tax (same rates as provincial)
        if (isToronto) {
          if (purchasePrice <= 55000) {
            municipalTax = purchasePrice * 0.005;
          } else if (purchasePrice <= 250000) {
            municipalTax = 275 + (purchasePrice - 55000) * 0.01;
          } else if (purchasePrice <= 400000) {
            municipalTax = 2225 + (purchasePrice - 250000) * 0.015;
          } else if (purchasePrice <= 2000000) {
            municipalTax = 4475 + (purchasePrice - 400000) * 0.02;
          } else {
            municipalTax = 36475 + (purchasePrice - 2000000) * 0.025;
          }
        }

        // First-time buyer rebate (up to $4,000 provincial, $4,475 Toronto)
        let rebate = 0;
        if (isFirstTimeBuyer) {
          rebate = Math.min(provincialTax, 4000);
          if (isToronto) {
            rebate += Math.min(municipalTax, 4475);
          }
        }

        return {
          provincial: Math.round(provincialTax * 100) / 100,
          municipal: Math.round(municipalTax * 100) / 100,
          rebate: Math.round(rebate * 100) / 100,
          total: Math.round((provincialTax + municipalTax - rebate) * 100) / 100
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'listing_agreement',
      'property_disclosure',
      'buyer_representation',
      'condition_waiver',
      'amendment'
    ]
  },

  BC: {
    name: 'British Columbia',
    code: 'BC',
    regulatoryBody: 'BC Financial Services Authority (BCFSA)',
    formsProvider: 'BC Real Estate Association (BCREA)',
    closingProfessional: 'lawyer_or_notary',

    landTransferTax: {
      calculate: (purchasePrice, isFirstTimeBuyer = false, isNewlyBuilt = false) => {
        let tax = 0;

        // BC Property Transfer Tax
        // First $200,000: 1%
        // $200,000 to $2,000,000: 2%
        // Over $2,000,000: 3%
        // Over $3,000,000 (residential): additional 2%

        if (purchasePrice <= 200000) {
          tax = purchasePrice * 0.01;
        } else if (purchasePrice <= 2000000) {
          tax = 2000 + (purchasePrice - 200000) * 0.02;
        } else if (purchasePrice <= 3000000) {
          tax = 38000 + (purchasePrice - 2000000) * 0.03;
        } else {
          tax = 68000 + (purchasePrice - 3000000) * 0.05; // 3% + 2% additional
        }

        // First-time buyer exemption (up to $500,000 fully exempt, partial to $525,000)
        let rebate = 0;
        if (isFirstTimeBuyer && purchasePrice <= 500000) {
          rebate = tax;
        } else if (isFirstTimeBuyer && purchasePrice <= 525000) {
          rebate = tax * ((525000 - purchasePrice) / 25000);
        }

        // Newly built home exemption (up to $750,000 fully exempt, partial to $800,000)
        if (isNewlyBuilt && purchasePrice <= 750000) {
          rebate = tax;
        } else if (isNewlyBuilt && purchasePrice <= 800000) {
          rebate = tax * ((800000 - purchasePrice) / 50000);
        }

        return {
          provincial: Math.round(tax * 100) / 100,
          municipal: 0,
          rebate: Math.round(rebate * 100) / 100,
          total: Math.round((tax - rebate) * 100) / 100
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'property_disclosure',
      'condition_waiver'
    ]
  },

  AB: {
    name: 'Alberta',
    code: 'AB',
    regulatoryBody: 'Real Estate Council of Alberta (RECA)',
    formsProvider: 'Alberta Real Estate Association (AREA)',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice) => {
        // Alberta has no land transfer tax, only registration fees
        const registrationFee = purchasePrice <= 0 ? 0 :
          Math.max(50, Math.ceil(purchasePrice / 5000) + 50);

        return {
          provincial: 0,
          municipal: 0,
          registrationFee: registrationFee,
          rebate: 0,
          total: registrationFee
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'property_disclosure',
      'real_property_report'
    ]
  },

  QC: {
    name: 'Quebec',
    code: 'QC',
    regulatoryBody: 'OACIQ',
    formsProvider: 'OACIQ',
    closingProfessional: 'notary', // Required - not optional

    landTransferTax: {
      calculate: (purchasePrice, municipality = 'default') => {
        // Quebec Welcome Tax (Taxe de bienvenue)
        // Standard rates (Montreal may differ)
        // Up to $55,200: 0.5%
        // $55,200 to $276,200: 1.0%
        // $276,200 to $500,000: 1.5%
        // Over $500,000: 2.0% (Montreal: 2.5% over $1M, 3% over $2M)

        let tax = 0;

        if (purchasePrice <= 55200) {
          tax = purchasePrice * 0.005;
        } else if (purchasePrice <= 276200) {
          tax = 276 + (purchasePrice - 55200) * 0.01;
        } else if (purchasePrice <= 500000) {
          tax = 2486 + (purchasePrice - 276200) * 0.015;
        } else {
          tax = 5843 + (purchasePrice - 500000) * 0.02;
        }

        return {
          provincial: 0,
          municipal: Math.round(tax * 100) / 100, // Welcome tax is municipal
          rebate: 0,
          total: Math.round(tax * 100) / 100
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale', // Promise to Purchase
      'listing_agreement',       // Brokerage Contract
      'property_disclosure'
    ],

    specialNotes: [
      'Notary required for all real estate transactions',
      'Double representation prohibited since June 2022',
      'Promise to Purchase used instead of Agreement of Purchase and Sale'
    ]
  },

  MB: {
    name: 'Manitoba',
    code: 'MB',
    regulatoryBody: 'Manitoba Securities Commission',
    formsProvider: 'Manitoba Real Estate Association (MREA)',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice, isFirstTimeBuyer = false) => {
        // Manitoba Land Transfer Tax
        // Up to $30,000: 0%
        // $30,000 to $90,000: 0.5%
        // $90,000 to $150,000: 1.0%
        // $150,000 to $200,000: 1.5%
        // Over $200,000: 2.0%

        let tax = 0;

        if (purchasePrice <= 30000) {
          tax = 0;
        } else if (purchasePrice <= 90000) {
          tax = (purchasePrice - 30000) * 0.005;
        } else if (purchasePrice <= 150000) {
          tax = 300 + (purchasePrice - 90000) * 0.01;
        } else if (purchasePrice <= 200000) {
          tax = 900 + (purchasePrice - 150000) * 0.015;
        } else {
          tax = 1650 + (purchasePrice - 200000) * 0.02;
        }

        return {
          provincial: Math.round(tax * 100) / 100,
          municipal: 0,
          rebate: 0,
          total: Math.round(tax * 100) / 100
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'property_disclosure'
    ]
  },

  SK: {
    name: 'Saskatchewan',
    code: 'SK',
    regulatoryBody: 'Saskatchewan Real Estate Commission (SREC)',
    formsProvider: 'Saskatchewan REALTORS Association',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice) => {
        // Saskatchewan has NO land transfer tax - only registration fees
        return {
          provincial: 0,
          municipal: 0,
          rebate: 0,
          total: 0,
          note: 'Saskatchewan does not charge land transfer tax'
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'property_disclosure'
    ]
  },

  NS: {
    name: 'Nova Scotia',
    code: 'NS',
    regulatoryBody: 'Nova Scotia Real Estate Commission (NSREC)',
    formsProvider: 'Nova Scotia Association of REALTORS (NSAR)',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice, municipality = 'halifax') => {
        // Nova Scotia Deed Transfer Tax varies by municipality
        // Halifax: 1.5%
        // Most others: 1.0% to 1.5%
        const rates = {
          halifax: 0.015,
          default: 0.015
        };

        const rate = rates[municipality.toLowerCase()] || rates.default;
        const tax = purchasePrice * rate;

        return {
          provincial: 0,
          municipal: Math.round(tax * 100) / 100,
          rebate: 0,
          total: Math.round(tax * 100) / 100
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'property_disclosure',
      'condition_waiver'
    ]
  },

  NB: {
    name: 'New Brunswick',
    code: 'NB',
    regulatoryBody: 'New Brunswick Real Estate Association',
    formsProvider: 'New Brunswick Real Estate Association',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice) => {
        // New Brunswick Land Transfer Tax: 1%
        const tax = purchasePrice * 0.01;

        return {
          provincial: Math.round(tax * 100) / 100,
          municipal: 0,
          rebate: 0,
          total: Math.round(tax * 100) / 100
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'property_disclosure'
    ]
  },

  PE: {
    name: 'Prince Edward Island',
    code: 'PE',
    regulatoryBody: 'PEI Real Estate Association',
    formsProvider: 'PEI Real Estate Association',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice) => {
        // PEI Real Property Transfer Tax: 1%
        const tax = purchasePrice * 0.01;

        return {
          provincial: Math.round(tax * 100) / 100,
          municipal: 0,
          rebate: 0,
          total: Math.round(tax * 100) / 100
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'property_disclosure'
    ]
  },

  NL: {
    name: 'Newfoundland and Labrador',
    code: 'NL',
    regulatoryBody: 'Newfoundland and Labrador Association of REALTORS',
    formsProvider: 'Newfoundland and Labrador Association of REALTORS',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice) => {
        // Newfoundland has registration fees, not land transfer tax
        // Registration fee is typically $100-200 plus per-page fees
        const registrationFee = 150; // Approximate

        return {
          provincial: 0,
          municipal: 0,
          registrationFee: registrationFee,
          rebate: 0,
          total: registrationFee,
          note: 'Registration fees only, no land transfer tax'
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale',
      'property_disclosure'
    ]
  },

  YT: {
    name: 'Yukon',
    code: 'YT',
    regulatoryBody: 'Yukon Real Estate Association',
    formsProvider: 'Yukon Real Estate Association',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice) => {
        // Yukon has no land transfer tax
        return {
          provincial: 0,
          municipal: 0,
          rebate: 0,
          total: 0
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale'
    ]
  },

  NT: {
    name: 'Northwest Territories',
    code: 'NT',
    regulatoryBody: 'NWT Association of REALTORS',
    formsProvider: 'NWT Association of REALTORS',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice) => {
        // NWT has no land transfer tax
        return {
          provincial: 0,
          municipal: 0,
          rebate: 0,
          total: 0
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale'
    ]
  },

  NU: {
    name: 'Nunavut',
    code: 'NU',
    regulatoryBody: 'N/A',
    formsProvider: 'Standard forms',
    closingProfessional: 'lawyer',

    landTransferTax: {
      calculate: (purchasePrice) => {
        // Nunavut has no land transfer tax
        return {
          provincial: 0,
          municipal: 0,
          rebate: 0,
          total: 0
        };
      }
    },

    requiredForms: [
      'agreement_purchase_sale'
    ]
  }
};

/**
 * Get province configuration by code
 */
function getProvince(code) {
  return provinces[code.toUpperCase()] || null;
}

/**
 * Calculate land transfer tax for any province
 */
function calculateLandTransferTax(provinceCode, purchasePrice, options = {}) {
  const province = getProvince(provinceCode);
  if (!province) {
    throw new Error(`Unknown province code: ${provinceCode}`);
  }

  return province.landTransferTax.calculate(purchasePrice, ...Object.values(options));
}

/**
 * Get closing cost estimate
 */
function estimateClosingCosts(provinceCode, purchasePrice, options = {}) {
  const landTransferTax = calculateLandTransferTax(provinceCode, purchasePrice, options);

  // Standard estimates
  const legalFees = 1500; // Average
  const titleInsurance = 300;
  const homeInspection = 500;
  const appraisal = 400;
  const movingCosts = 1000;

  return {
    landTransferTax: landTransferTax.total,
    legalFees,
    titleInsurance,
    homeInspection,
    appraisal,
    movingCosts,
    total: landTransferTax.total + legalFees + titleInsurance + homeInspection + appraisal + movingCosts
  };
}

/**
 * Get all province codes
 */
function getAllProvinceCodes() {
  return Object.keys(provinces);
}

/**
 * Get all provinces as array
 */
function getAllProvinces() {
  return Object.values(provinces).map(p => ({
    code: p.code,
    name: p.name,
    closingProfessional: p.closingProfessional
  }));
}

module.exports = {
  provinces,
  getProvince,
  calculateLandTransferTax,
  estimateClosingCosts,
  getAllProvinceCodes,
  getAllProvinces
};

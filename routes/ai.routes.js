const express = require('express');
const router = express.Router();
const authMiddleware = require('../auth.middleware');
const User = require('../models/user.model');
const Property = require('../models/property.model');

const AI_MONTHLY_LIMIT = 5; // Free tier limit

// OpenAI integration (optional - works without it too)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (e) {
    console.log('OpenAI not available - AI features will use templates');
  }
}

// Helper function to check and reset monthly usage
async function checkAndResetUsage(user) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (!user.aiToolsUsage) {
    user.aiToolsUsage = { count: 0, lastResetMonth: currentMonth, lastResetYear: currentYear };
  }

  // Reset usage if new month
  if (user.aiToolsUsage.lastResetMonth !== currentMonth ||
      user.aiToolsUsage.lastResetYear !== currentYear) {
    user.aiToolsUsage.count = 0;
    user.aiToolsUsage.lastResetMonth = currentMonth;
    user.aiToolsUsage.lastResetYear = currentYear;
    await user.save();
  }

  return user;
}

// Check usage and increment
async function useAICredit(userId) {
  let user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  user = await checkAndResetUsage(user);

  const isPremiumActive = user.isPremium &&
    (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

  if (!isPremiumActive && (user.aiToolsUsage.count || 0) >= AI_MONTHLY_LIMIT) {
    throw new Error('Monthly AI usage limit reached. Upgrade to Premium for unlimited access.');
  }

  user.aiToolsUsage.count = (user.aiToolsUsage.count || 0) + 1;
  await user.save();

  return user;
}

// Get AI usage status
router.get('/usage', authMiddleware, async (req, res) => {
  try {
    let user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check and reset if new month
    user = await checkAndResetUsage(user);

    // Check if premium and still valid
    const isPremiumActive = user.isPremium &&
      (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

    res.json({
      count: user.aiToolsUsage.count || 0,
      limit: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT,
      isPremium: isPremiumActive,
      canUse: isPremiumActive || (user.aiToolsUsage.count || 0) < AI_MONTHLY_LIMIT
    });
  } catch (err) {
    console.error('Error getting AI usage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Increment AI usage (called before each AI search)
router.post('/use', authMiddleware, async (req, res) => {
  try {
    let user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check and reset if new month
    user = await checkAndResetUsage(user);

    // Check if premium and still valid
    const isPremiumActive = user.isPremium &&
      (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

    // Check if user can use AI tools
    if (!isPremiumActive && (user.aiToolsUsage.count || 0) >= AI_MONTHLY_LIMIT) {
      return res.status(403).json({
        error: 'Monthly AI usage limit reached',
        count: user.aiToolsUsage.count,
        limit: AI_MONTHLY_LIMIT,
        canUse: false
      });
    }

    // Increment usage (even for premium to track)
    user.aiToolsUsage.count = (user.aiToolsUsage.count || 0) + 1;
    await user.save();

    res.json({
      success: true,
      count: user.aiToolsUsage.count,
      limit: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT,
      remaining: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT - user.aiToolsUsage.count,
      canUse: isPremiumActive || user.aiToolsUsage.count < AI_MONTHLY_LIMIT
    });
  } catch (err) {
    console.error('Error incrementing AI usage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user can use AI tools (without incrementing)
router.get('/can-use', authMiddleware, async (req, res) => {
  try {
    let user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check and reset if new month
    user = await checkAndResetUsage(user);

    // Check if premium and still valid
    const isPremiumActive = user.isPremium &&
      (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());

    const canUse = isPremiumActive || (user.aiToolsUsage.count || 0) < AI_MONTHLY_LIMIT;

    res.json({
      canUse,
      count: user.aiToolsUsage.count || 0,
      limit: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT,
      remaining: isPremiumActive ? 'unlimited' : AI_MONTHLY_LIMIT - (user.aiToolsUsage.count || 0),
      isPremium: isPremiumActive
    });
  } catch (err) {
    console.error('Error checking AI usage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// AI Property Description Generator
// ==========================================
router.post('/generate-description', authMiddleware, async (req, res) => {
  try {
    await useAICredit(req.user.userId);

    const { propertyType, bedrooms, bathrooms, squareFeet, features, city, highlights } = req.body;

    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'You are a professional real estate copywriter. Write compelling, accurate property descriptions that highlight key features. Keep it between 150-250 words.'
        }, {
          role: 'user',
          content: `Write a property description for:
Type: ${propertyType}
Location: ${city}
Bedrooms: ${bedrooms}, Bathrooms: ${bathrooms}
Square Feet: ${squareFeet}
Features: ${features ? features.join(', ') : 'Not specified'}
Highlights: ${highlights || 'Not specified'}`
        }],
        max_tokens: 400
      });

      return res.json({
        description: completion.choices[0].message.content,
        source: 'ai'
      });
    }

    // Fallback template-based description
    const featureList = features && features.length > 0 ? features.slice(0, 5).join(', ') : 'modern finishes';
    const description = `Welcome to this beautiful ${propertyType} located in the heart of ${city}. This stunning ${bedrooms}-bedroom, ${bathrooms}-bathroom home offers ${squareFeet ? squareFeet.toLocaleString() + ' square feet of' : 'spacious'} living space perfect for families and professionals alike.

Key features include ${featureList}. ${highlights ? highlights : 'The home has been well-maintained and is move-in ready.'}

Don't miss this exceptional opportunity to own a piece of ${city} real estate. Schedule your private showing today!`;

    res.json({ description, source: 'template' });
  } catch (err) {
    console.error('Error generating description:', err);
    res.status(err.message.includes('limit') ? 403 : 500).json({ error: err.message });
  }
});

// ==========================================
// AI Listing Title Generator
// ==========================================
router.post('/generate-title', authMiddleware, async (req, res) => {
  try {
    await useAICredit(req.user.userId);

    const { propertyType, bedrooms, bathrooms, city, features, price } = req.body;

    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'Generate 3 catchy, professional real estate listing titles. Each should be under 80 characters. Return as JSON array of strings.'
        }, {
          role: 'user',
          content: `Property: ${bedrooms}BR ${bathrooms}BA ${propertyType} in ${city}. Price: $${price ? price.toLocaleString() : 'Contact for price'}. Features: ${features ? features.slice(0, 3).join(', ') : 'Well maintained'}`
        }],
        max_tokens: 200
      });

      try {
        const titles = JSON.parse(completion.choices[0].message.content);
        return res.json({ titles, source: 'ai' });
      } catch {
        return res.json({ titles: [completion.choices[0].message.content], source: 'ai' });
      }
    }

    // Fallback templates
    const titles = [
      `Stunning ${bedrooms}BR ${propertyType} in ${city} - Must See!`,
      `Beautiful ${bedrooms} Bedroom Home in Prime ${city} Location`,
      `Move-In Ready ${propertyType} with ${bathrooms} Baths in ${city}`
    ];

    res.json({ titles, source: 'template' });
  } catch (err) {
    console.error('Error generating title:', err);
    res.status(err.message.includes('limit') ? 403 : 500).json({ error: err.message });
  }
});

// ==========================================
// AI Price Suggestion
// ==========================================
router.post('/suggest-price', authMiddleware, async (req, res) => {
  try {
    await useAICredit(req.user.userId);

    const { propertyType, bedrooms, bathrooms, squareFeet, city, province, yearBuilt, features } = req.body;

    // Get comparable properties from database
    const comparables = await Property.find({
      'address.city': new RegExp(city, 'i'),
      propertyType: propertyType,
      bedrooms: { $gte: bedrooms - 1, $lte: bedrooms + 1 },
      status: { $in: ['sold', 'active'] }
    })
    .select('askingPrice squareFeet bedrooms bathrooms')
    .limit(10);

    let suggestedPrice = 0;
    let priceRange = { low: 0, high: 0 };
    let methodology = '';

    if (comparables.length >= 3) {
      const prices = comparables.map(p => p.askingPrice).sort((a, b) => a - b);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      // Adjust for square footage
      const avgSqft = comparables.reduce((a, p) => a + (p.squareFeet || 0), 0) / comparables.length;
      const sqftMultiplier = squareFeet && avgSqft ? squareFeet / avgSqft : 1;

      suggestedPrice = Math.round(avgPrice * sqftMultiplier);
      priceRange = {
        low: Math.round(prices[0] * 0.95),
        high: Math.round(prices[prices.length - 1] * 1.05)
      };
      methodology = `Based on ${comparables.length} comparable properties in ${city}`;
    } else {
      // Provincial averages (rough estimates)
      const provincialAverages = {
        'ON': 850000, 'BC': 950000, 'AB': 450000, 'QC': 500000,
        'MB': 350000, 'SK': 320000, 'NS': 400000, 'NB': 300000,
        'PE': 350000, 'NL': 280000
      };

      const basePrice = provincialAverages[province] || 500000;
      const bedroomMultiplier = 1 + (bedrooms - 3) * 0.1;
      const sqftMultiplier = squareFeet ? squareFeet / 1500 : 1;

      suggestedPrice = Math.round(basePrice * bedroomMultiplier * sqftMultiplier);
      priceRange = {
        low: Math.round(suggestedPrice * 0.9),
        high: Math.round(suggestedPrice * 1.1)
      };
      methodology = 'Based on provincial averages (limited comparable data)';
    }

    res.json({
      suggestedPrice,
      priceRange,
      comparablesCount: comparables.length,
      methodology,
      disclaimer: 'This is an AI-generated estimate. Consult a professional appraiser for accurate valuation.'
    });
  } catch (err) {
    console.error('Error suggesting price:', err);
    res.status(err.message.includes('limit') ? 403 : 500).json({ error: err.message });
  }
});

// ==========================================
// AI Mortgage Rate Finder
// ==========================================
router.post('/find-mortgage-rates', authMiddleware, async (req, res) => {
  try {
    await useAICredit(req.user.userId);

    const { purchasePrice, downPayment, amortization, province } = req.body;

    const principal = purchasePrice - downPayment;
    const downPaymentPercent = (downPayment / purchasePrice) * 100;

    // Simulated rates (in production, integrate with rate API)
    const baseRate = 4.5; // Current average
    const rateAdjustment = downPaymentPercent >= 20 ? -0.15 : 0.1;

    const rates = [
      {
        lender: 'Major Bank A',
        type: 'Fixed',
        term: '5 years',
        rate: (baseRate + rateAdjustment).toFixed(2),
        monthlyPayment: calculateMonthlyPayment(principal, baseRate + rateAdjustment, amortization)
      },
      {
        lender: 'Major Bank B',
        type: 'Fixed',
        term: '5 years',
        rate: (baseRate + rateAdjustment + 0.1).toFixed(2),
        monthlyPayment: calculateMonthlyPayment(principal, baseRate + rateAdjustment + 0.1, amortization)
      },
      {
        lender: 'Credit Union',
        type: 'Fixed',
        term: '5 years',
        rate: (baseRate + rateAdjustment - 0.2).toFixed(2),
        monthlyPayment: calculateMonthlyPayment(principal, baseRate + rateAdjustment - 0.2, amortization)
      },
      {
        lender: 'Online Lender',
        type: 'Variable',
        term: '5 years',
        rate: (baseRate + rateAdjustment - 0.5).toFixed(2),
        monthlyPayment: calculateMonthlyPayment(principal, baseRate + rateAdjustment - 0.5, amortization)
      }
    ];

    // Check if CMHC insurance required
    const cmhcRequired = downPaymentPercent < 20;
    let cmhcPremium = 0;
    if (cmhcRequired) {
      const cmhcRates = { 5: 4.0, 10: 3.1, 15: 2.8 };
      const tier = downPaymentPercent < 10 ? 5 : downPaymentPercent < 15 ? 10 : 15;
      cmhcPremium = Math.round(principal * (cmhcRates[tier] / 100));
    }

    res.json({
      rates: rates.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate)),
      loanDetails: {
        purchasePrice,
        downPayment,
        downPaymentPercent: downPaymentPercent.toFixed(1),
        principal,
        amortization
      },
      cmhc: {
        required: cmhcRequired,
        premium: cmhcPremium,
        note: cmhcRequired ? 'CMHC insurance required for down payments under 20%' : null
      },
      disclaimer: 'Rates are estimates and may vary. Contact lenders directly for current rates.'
    });
  } catch (err) {
    console.error('Error finding rates:', err);
    res.status(err.message.includes('limit') ? 403 : 500).json({ error: err.message });
  }
});

function calculateMonthlyPayment(principal, annualRate, amortizationYears) {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = amortizationYears * 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  return Math.round(payment);
}

// ==========================================
// AI Offer Response Helper
// ==========================================
router.post('/draft-response', authMiddleware, async (req, res) => {
  try {
    await useAICredit(req.user.userId);

    const { responseType, offerPrice, askingPrice, buyerName, conditions, customMessage } = req.body;

    if (openai) {
      const prompts = {
        accept: `Write a professional, warm acceptance letter for a real estate offer. Buyer: ${buyerName}. Include next steps.`,
        reject: `Write a polite, professional rejection letter for a real estate offer at $${offerPrice?.toLocaleString()} (asking was $${askingPrice?.toLocaleString()}). Be encouraging about future opportunities.`,
        counter: `Write a professional counter-offer letter. Original offer: $${offerPrice?.toLocaleString()}, Asking: $${askingPrice?.toLocaleString()}. Suggest meeting in the middle and express enthusiasm about working together.`
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'You are a professional real estate consultant. Write clear, professional, and friendly responses.'
        }, {
          role: 'user',
          content: prompts[responseType] || prompts.counter
        }],
        max_tokens: 300
      });

      return res.json({ response: completion.choices[0].message.content, source: 'ai' });
    }

    // Template responses
    const templates = {
      accept: `Dear ${buyerName || 'Buyer'},

Thank you for your offer on our property. We are pleased to accept your offer of $${offerPrice?.toLocaleString()}.

We look forward to working with you through the closing process. Please have your lawyer contact us to arrange the next steps.

Best regards`,
      reject: `Dear ${buyerName || 'Buyer'},

Thank you for your interest in our property and for submitting your offer of $${offerPrice?.toLocaleString()}.

After careful consideration, we have decided not to accept your offer at this time. We wish you the best in your home search.

Best regards`,
      counter: `Dear ${buyerName || 'Buyer'},

Thank you for your offer of $${offerPrice?.toLocaleString()} on our property.

While we appreciate your interest, we would like to counter at $${Math.round((offerPrice + askingPrice) / 2)?.toLocaleString()}, which we believe reflects the true value of this property.

We are motivated to work with you and hope we can reach an agreement.

Best regards`
    };

    res.json({ response: templates[responseType] || templates.counter, source: 'template' });
  } catch (err) {
    console.error('Error drafting response:', err);
    res.status(err.message.includes('limit') ? 403 : 500).json({ error: err.message });
  }
});

// ==========================================
// AI Neighbourhood Insights
// ==========================================
router.post('/neighbourhood-insights', authMiddleware, async (req, res) => {
  try {
    await useAICredit(req.user.userId);

    const { city, province, postalCode } = req.body;

    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'You are a Canadian real estate expert. Provide helpful neighbourhood insights including: walkability, transit, schools, amenities, and general vibe. Be balanced and factual.'
        }, {
          role: 'user',
          content: `Provide neighbourhood insights for ${city}, ${province}${postalCode ? ` (postal code: ${postalCode})` : ''}. Include information about schools, transit, amenities, and lifestyle.`
        }],
        max_tokens: 400
      });

      return res.json({ insights: completion.choices[0].message.content, source: 'ai' });
    }

    // Generic insights based on city size/province
    const majorCities = ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg'];
    const isMajorCity = majorCities.some(c => city.toLowerCase().includes(c.toLowerCase()));

    const insights = isMajorCity
      ? `${city} is a vibrant urban center with excellent amenities, diverse dining options, and good public transit. The area offers a mix of residential neighbourhoods, each with its own character. Schools range from public to private options, and healthcare facilities are readily accessible. The city has a strong job market and active cultural scene.`
      : `${city} offers a more relaxed pace of life with a strong sense of community. Residents enjoy local amenities, parks, and recreational facilities. Schools serve the local community well, and neighbors tend to know each other. The area may require a vehicle for some errands but offers a quieter lifestyle compared to major urban centers.`;

    res.json({ insights, source: 'template' });
  } catch (err) {
    console.error('Error getting insights:', err);
    res.status(err.message.includes('limit') ? 403 : 500).json({ error: err.message });
  }
});

module.exports = router;

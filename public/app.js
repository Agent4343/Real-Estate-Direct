// API Configuration
var API_BASE = '/api';
var authToken = localStorage.getItem('authToken');
var currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
} catch(e) {
  currentUser = null;
}

// Image upload state
var selectedImages = [];
var MAX_IMAGES = 20;
var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// User preferences (loaded from API when logged in)
var favorites = [];
var checklistProgress = {};

// Test if JavaScript is working - this runs immediately
console.log('JavaScript loaded successfully');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM ready, initializing app...');

  try {
    loadProvinces();
    updateAuthUI();
    searchProperties();
    initImageUpload();

    // Load user preferences from API if logged in
    if (authToken) {
      loadUserPreferences();
    }

    initChecklists();

    // Add touch support for iOS
    addTouchSupport();

    console.log('App initialized successfully');
  } catch (error) {
    console.error('App initialization error:', error);
  }
});

// Add touch event support for iOS Safari
function addTouchSupport() {
  // Make all clickable elements respond to touch on iOS
  var clickables = document.querySelectorAll('a, button, .btn, [onclick]');
  clickables.forEach(function(el) {
    el.style.cursor = 'pointer';
    // Add touch feedback
    el.addEventListener('touchstart', function() {}, {passive: true});
  });
}

// ==========================================
// User Preferences API
// ==========================================

async function loadUserPreferences() {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_BASE}/user/preferences`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      checklistProgress = data.checklistProgress || {};
      favorites = (data.favoriteProperties || []).map(f => ({
        id: f.propertyId,
        address: f.address,
        askingPrice: f.askingPrice,
        bedrooms: f.bedrooms,
        bathrooms: f.bathrooms,
        squareFeet: f.squareFeet,
        propertyType: f.propertyType,
        image: f.image,
        savedAt: f.savedAt
      }));
    }
  } catch (error) {
    console.error('Failed to load user preferences:', error);
  }
}

// ==========================================
// Favorites / Saved Properties
// ==========================================

function toggleFavorite(propertyId, event) {
  event.stopPropagation(); // Prevent triggering property view

  if (!authToken) {
    showToast('Please login to save properties', 'warning');
    showModal('loginModal');
    return;
  }

  const index = favorites.findIndex(f => f.id === propertyId);

  if (index > -1) {
    // Remove from favorites
    removeFavoriteFromAPI(propertyId);
  } else {
    // Add to favorites
    addToFavorites(propertyId);
  }
}

async function addToFavorites(propertyId) {
  try {
    const response = await fetch(`${API_BASE}/properties/${propertyId}`);
    const property = await response.json();

    const favoriteData = {
      propertyId: propertyId,
      address: property.address,
      askingPrice: property.askingPrice,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      squareFeet: property.squareFeet,
      propertyType: property.propertyType,
      image: property.images && property.images.length > 0 ? property.images[0].url : null
    };

    // Save to API
    const saveResponse = await fetch(`${API_BASE}/user/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(favoriteData)
    });

    if (saveResponse.ok) {
      favorites.push({
        id: propertyId,
        ...favoriteData,
        savedAt: new Date().toISOString()
      });
      updateFavoriteButtons();
      showToast('Property saved to favorites!', 'success');
    } else {
      const error = await saveResponse.json();
      showToast(error.error || 'Failed to save property', 'error');
    }
  } catch (error) {
    showToast('Failed to save property', 'error');
  }
}

async function removeFavoriteFromAPI(propertyId) {
  try {
    const response = await fetch(`${API_BASE}/user/favorites/${propertyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      favorites = favorites.filter(f => f.id !== propertyId);
      updateFavoriteButtons();
      loadSavedProperties();
      showToast('Removed from saved properties', 'info');
    }
  } catch (error) {
    showToast('Failed to remove property', 'error');
  }
}

function isFavorite(propertyId) {
  return favorites.some(f => f.id === propertyId);
}

function updateFavoriteButtons() {
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    const propertyId = btn.dataset.propertyId;
    if (isFavorite(propertyId)) {
      btn.classList.add('favorited');
      btn.innerHTML = '❤️';
      btn.title = 'Remove from saved';
    } else {
      btn.classList.remove('favorited');
      btn.innerHTML = '🤍';
      btn.title = 'Save property';
    }
  });
}

function removeFavorite(propertyId) {
  if (authToken) {
    removeFavoriteFromAPI(propertyId);
  }
}

function loadSavedProperties() {
  const list = document.getElementById('savedPropertiesList');
  if (!list) return;

  if (favorites.length > 0) {
    list.innerHTML = favorites.map(p => `
      <div class="saved-property-card">
        <div class="saved-property-image">
          ${p.image
            ? `<img src="${sanitizeUrl(p.image)}" alt="${escapeHtml(p.address?.street)}">`
            : '<div class="property-image-placeholder">🏠</div>'
          }
        </div>
        <div class="saved-property-info">
          <div class="saved-property-price">${formatCurrency(p.askingPrice)}</div>
          <div class="saved-property-address">${escapeHtml(p.address?.street || '')}, ${escapeHtml(p.address?.city || '')}</div>
          <div class="saved-property-details">
            <span>${escapeHtml(p.bedrooms || 0)} beds</span>
            <span>${escapeHtml(p.bathrooms || 0)} baths</span>
            <span>${escapeHtml(p.squareFeet || 'N/A')} sqft</span>
          </div>
          <div class="saved-property-meta">
            <span class="property-type-badge">${escapeHtml(p.propertyType || 'Property')}</span>
            <span class="saved-date">Saved ${escapeHtml(formatSavedDate(p.savedAt))}</span>
          </div>
        </div>
        <div class="saved-property-actions">
          <button class="btn btn-primary btn-sm" onclick="viewProperty('${escapeHtml(p.id)}')">View</button>
          <button class="btn btn-outline btn-sm" onclick="removeFavorite('${escapeHtml(p.id)}')">Remove</button>
        </div>
      </div>
    `).join('');
  } else {
    list.innerHTML = `
      <div class="empty-saved-state">
        <div class="empty-icon">🤍</div>
        <h3>No Saved Properties</h3>
        <p>Click the heart icon on any property to save it for later.</p>
        <button onclick="showSection('search')" class="btn btn-primary">Browse Properties</button>
      </div>
    `;
  }
}

function formatSavedDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function updateSavedCount() {
  const countEl = document.getElementById('savedCount');
  if (countEl) {
    countEl.textContent = favorites.length > 0 ? `(${favorites.length})` : '';
  }
}

// ==========================================
// Interactive Checklists
// ==========================================

// Buyer checklist items
const buyerChecklistItems = {
  preApproval: [
    { id: 'buyer-1-1', text: 'Check your credit score', tip: 'Aim for 680+ for best rates' },
    { id: 'buyer-1-2', text: 'Gather income documentation (T4s, pay stubs, NOA)', tip: 'Last 2 years' },
    { id: 'buyer-1-3', text: 'Get employment verification letter', tip: 'Include salary and tenure' },
    { id: 'buyer-1-4', text: 'Calculate how much you can afford', tip: 'Max 32% of income on housing' },
    { id: 'buyer-1-5', text: 'Save for down payment', tip: 'Min 5% for homes under $500K' },
    { id: 'buyer-1-6', text: 'Get pre-approved by a lender', tip: 'Valid for 90-120 days' }
  ],
  searching: [
    { id: 'buyer-2-1', text: 'Define your must-haves vs nice-to-haves', tip: 'Be realistic' },
    { id: 'buyer-2-2', text: 'Research neighbourhoods', tip: 'Visit at different times of day' },
    { id: 'buyer-2-3', text: 'Set up property alerts', tip: 'Be first to know about new listings' },
    { id: 'buyer-2-4', text: 'View properties in person', tip: 'Take photos and notes' },
    { id: 'buyer-2-5', text: 'Compare properties objectively', tip: 'Use a scoring system' },
    { id: 'buyer-2-6', text: 'Research comparable sales (comps)', tip: 'Know the market value' }
  ],
  offer: [
    { id: 'buyer-3-1', text: 'Determine your offer price strategy', tip: 'Based on comps and market' },
    { id: 'buyer-3-2', text: 'Decide on deposit amount', tip: 'Usually 3-5% of price' },
    { id: 'buyer-3-3', text: 'Choose your conditions (financing, inspection)', tip: 'Protect yourself' },
    { id: 'buyer-3-4', text: 'Set closing date', tip: '30-90 days is typical' },
    { id: 'buyer-3-5', text: 'Submit formal offer through platform', tip: 'All legal forms included' },
    { id: 'buyer-3-6', text: 'Negotiate if counter-offer received', tip: 'Stay within budget' },
    { id: 'buyer-3-7', text: 'Sign accepted offer', tip: 'Now legally binding' }
  ],
  conditions: [
    { id: 'buyer-4-1', text: 'Submit mortgage application to lender', tip: 'Do immediately' },
    { id: 'buyer-4-2', text: 'Book home inspection', tip: 'Use certified inspector' },
    { id: 'buyer-4-3', text: 'Attend home inspection', tip: 'Ask questions' },
    { id: 'buyer-4-4', text: 'Review inspection report', tip: 'Note major issues' },
    { id: 'buyer-4-5', text: 'Negotiate repairs if needed', tip: 'Or price reduction' },
    { id: 'buyer-4-6', text: 'Hire a real estate lawyer', tip: 'Essential for closing' },
    { id: 'buyer-4-7', text: 'Have lawyer review all documents', tip: 'Before waiving' },
    { id: 'buyer-4-8', text: 'Receive mortgage approval', tip: 'Get it in writing' },
    { id: 'buyer-4-9', text: 'Arrange home insurance', tip: 'Required by lender' },
    { id: 'buyer-4-10', text: 'Sign waiver of conditions', tip: 'Before deadline!' }
  ],
  closing: [
    { id: 'buyer-5-1', text: 'Sign mortgage documents', tip: 'Review all terms' },
    { id: 'buyer-5-2', text: 'Transfer down payment to lawyer', tip: 'Wire or bank draft' },
    { id: 'buyer-5-3', text: 'Transfer closing costs to lawyer', tip: 'Include all fees' },
    { id: 'buyer-5-4', text: 'Do final walkthrough of property', tip: 'Day before closing' },
    { id: 'buyer-5-5', text: 'Set up utilities in your name', tip: 'Hydro, gas, water, internet' },
    { id: 'buyer-5-6', text: 'Arrange movers', tip: 'Book early for month-end' },
    { id: 'buyer-5-7', text: 'Get certified cheque for any balance', tip: 'If needed' },
    { id: 'buyer-5-8', text: 'Receive keys from lawyer', tip: 'Usually after 5pm on closing day' },
    { id: 'buyer-5-9', text: 'Change locks on new home', tip: 'For security' },
    { id: 'buyer-5-10', text: 'Update your address everywhere', tip: 'CRA, bank, license, etc.' }
  ]
};

// Seller checklist items
const sellerChecklistItems = {
  preparation: [
    { id: 'seller-1-1', text: 'Research current market conditions', tip: 'Know if buyer or seller market' },
    { id: 'seller-1-2', text: 'Get a pre-listing home inspection', tip: 'Optional but recommended' },
    { id: 'seller-1-3', text: 'Make necessary repairs', tip: 'Focus on high-impact fixes' },
    { id: 'seller-1-4', text: 'Declutter and depersonalize', tip: 'Buyers need to envision themselves' },
    { id: 'seller-1-5', text: 'Deep clean entire home', tip: 'Consider professional cleaning' },
    { id: 'seller-1-6', text: 'Stage key rooms', tip: 'Living room, kitchen, master bedroom' },
    { id: 'seller-1-7', text: 'Boost curb appeal', tip: 'First impressions matter' },
    { id: 'seller-1-8', text: 'Gather all documents (title, surveys, etc.)', tip: 'Be prepared' }
  ],
  pricing: [
    { id: 'seller-2-1', text: 'Research comparable sales in area', tip: 'Last 3-6 months' },
    { id: 'seller-2-2', text: 'Consider getting an appraisal', tip: 'Professional valuation' },
    { id: 'seller-2-3', text: 'Factor in unique features', tip: 'Upgrades, location, lot size' },
    { id: 'seller-2-4', text: 'Decide on pricing strategy', tip: 'Market price, under, or over' },
    { id: 'seller-2-5', text: 'Set your bottom line price', tip: 'Lowest you will accept' },
    { id: 'seller-2-6', text: 'Calculate your net proceeds', tip: 'After all costs' }
  ],
  listing: [
    { id: 'seller-3-1', text: 'Take professional quality photos', tip: 'Natural light, wide angles' },
    { id: 'seller-3-2', text: 'Write compelling property description', tip: 'Highlight best features' },
    { id: 'seller-3-3', text: 'Complete property details form', tip: 'Be accurate and thorough' },
    { id: 'seller-3-4', text: 'Disclose known defects', tip: 'Legally required' },
    { id: 'seller-3-5', text: 'Create listing on Real Estate Direct', tip: 'All provinces supported' },
    { id: 'seller-3-6', text: 'Share listing on social media', tip: 'Increase exposure' },
    { id: 'seller-3-7', text: 'Prepare for showings', tip: 'Keep home show-ready' }
  ],
  offers: [
    { id: 'seller-4-1', text: 'Review all offers carefully', tip: 'Price isn\'t everything' },
    { id: 'seller-4-2', text: 'Check buyer\'s financing status', tip: 'Pre-approved is better' },
    { id: 'seller-4-3', text: 'Evaluate conditions and timeline', tip: 'Fewer conditions = less risk' },
    { id: 'seller-4-4', text: 'Consider deposit amount', tip: 'Higher = more committed buyer' },
    { id: 'seller-4-5', text: 'Counter-offer if needed', tip: 'Negotiate strategically' },
    { id: 'seller-4-6', text: 'Accept the best offer', tip: 'Sign all documents' },
    { id: 'seller-4-7', text: 'Hire a real estate lawyer', tip: 'To handle closing' }
  ],
  closing: [
    { id: 'seller-5-1', text: 'Cooperate with buyer\'s inspection', tip: 'Be available' },
    { id: 'seller-5-2', text: 'Negotiate any inspection issues', tip: 'Be reasonable' },
    { id: 'seller-5-3', text: 'Provide documents to lawyer', tip: 'Title, surveys, etc.' },
    { id: 'seller-5-4', text: 'Sign transfer documents', tip: 'At lawyer\'s office' },
    { id: 'seller-5-5', text: 'Cancel home insurance (after closing)', tip: 'Get prorated refund' },
    { id: 'seller-5-6', text: 'Cancel/transfer utilities', tip: 'For closing date' },
    { id: 'seller-5-7', text: 'Complete final cleaning', tip: 'Leave it broom-clean' },
    { id: 'seller-5-8', text: 'Remove all belongings', tip: 'Unless included in sale' },
    { id: 'seller-5-9', text: 'Leave all keys, remotes, manuals', tip: 'On kitchen counter' },
    { id: 'seller-5-10', text: 'Receive proceeds from lawyer', tip: 'After closing completes' }
  ]
};

// checklistProgress is loaded from API in loadUserPreferences()

function initChecklists() {
  renderBuyerChecklist();
  renderSellerChecklist();
  updateAllProgress();
}

function renderBuyerChecklist() {
  const container = document.getElementById('buyerChecklist');
  if (!container) return;

  const sections = [
    { key: 'preApproval', title: 'Step 1: Get Pre-Approved', icon: '💰' },
    { key: 'searching', title: 'Step 2: Search & Find', icon: '🔍' },
    { key: 'offer', title: 'Step 3: Make an Offer', icon: '📝' },
    { key: 'conditions', title: 'Step 4: Conditions Period', icon: '✅' },
    { key: 'closing', title: 'Step 5: Close the Deal', icon: '🔑' }
  ];

  container.innerHTML = sections.map(section => {
    const items = buyerChecklistItems[section.key];
    const completed = items.filter(item => checklistProgress[item.id]).length;
    const percentage = Math.round((completed / items.length) * 100);

    return `
      <div class="checklist-section" data-section="buyer-${section.key}">
        <div class="checklist-section-header" onclick="toggleChecklistSection('buyer-${section.key}')">
          <div class="section-title">
            <span class="section-icon">${section.icon}</span>
            <h4>${section.title}</h4>
          </div>
          <div class="section-progress">
            <span class="progress-text">${completed}/${items.length}</span>
            <div class="progress-bar-mini">
              <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <span class="expand-icon">▼</span>
          </div>
        </div>
        <div class="checklist-section-content">
          ${items.map(item => `
            <label class="checklist-item-interactive ${checklistProgress[item.id] ? 'completed' : ''}">
              <input type="checkbox" ${checklistProgress[item.id] ? 'checked' : ''}
                     onchange="toggleChecklistItem('${item.id}', this.checked)">
              <span class="checkmark"></span>
              <span class="item-text">${item.text}</span>
              <span class="item-tip">${item.tip}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderSellerChecklist() {
  const container = document.getElementById('sellerChecklist');
  if (!container) return;

  const sections = [
    { key: 'preparation', title: 'Step 1: Prepare Your Home', icon: '🏠' },
    { key: 'pricing', title: 'Step 2: Price It Right', icon: '💵' },
    { key: 'listing', title: 'Step 3: Create Your Listing', icon: '📸' },
    { key: 'offers', title: 'Step 4: Review Offers', icon: '📋' },
    { key: 'closing', title: 'Step 5: Close the Sale', icon: '🎉' }
  ];

  container.innerHTML = sections.map(section => {
    const items = sellerChecklistItems[section.key];
    const completed = items.filter(item => checklistProgress[item.id]).length;
    const percentage = Math.round((completed / items.length) * 100);

    return `
      <div class="checklist-section" data-section="seller-${section.key}">
        <div class="checklist-section-header" onclick="toggleChecklistSection('seller-${section.key}')">
          <div class="section-title">
            <span class="section-icon">${section.icon}</span>
            <h4>${section.title}</h4>
          </div>
          <div class="section-progress">
            <span class="progress-text">${completed}/${items.length}</span>
            <div class="progress-bar-mini">
              <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <span class="expand-icon">▼</span>
          </div>
        </div>
        <div class="checklist-section-content">
          ${items.map(item => `
            <label class="checklist-item-interactive ${checklistProgress[item.id] ? 'completed' : ''}">
              <input type="checkbox" ${checklistProgress[item.id] ? 'checked' : ''}
                     onchange="toggleChecklistItem('${item.id}', this.checked)">
              <span class="checkmark"></span>
              <span class="item-text">${item.text}</span>
              <span class="item-tip">${item.tip}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function toggleChecklistSection(sectionKey) {
  const section = document.querySelector(`[data-section="${sectionKey}"]`);
  if (section) {
    section.classList.toggle('expanded');
  }
}

async function toggleChecklistItem(itemId, checked) {
  if (!authToken) {
    showToast('Please login to track your progress', 'warning');
    showModal('loginModal');
    // Revert the checkbox
    const checkbox = document.querySelector(`input[onchange*="${itemId}"]`);
    if (checkbox) checkbox.checked = !checked;
    return;
  }

  // Optimistically update UI
  if (checked) {
    checklistProgress[itemId] = true;
  } else {
    delete checklistProgress[itemId];
  }

  // Update the item's visual state
  const checkbox = document.querySelector(`input[onchange*="${itemId}"]`);
  if (checkbox) {
    const label = checkbox.closest('.checklist-item-interactive');
    if (label) {
      label.classList.toggle('completed', checked);
    }
  }

  updateAllProgress();

  // Save to API
  try {
    const response = await fetch(`${API_BASE}/user/checklist/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ completed: checked })
    });

    if (response.ok && checked) {
      showToast('Task completed!', 'success');
    }
  } catch (error) {
    console.error('Failed to save checklist item:', error);
    // Revert on error
    if (checked) {
      delete checklistProgress[itemId];
    } else {
      checklistProgress[itemId] = true;
    }
    updateAllProgress();
  }
}

function updateAllProgress() {
  updateBuyerProgress();
  updateSellerProgress();
}

function updateBuyerProgress() {
  const allItems = Object.values(buyerChecklistItems).flat();
  const completed = allItems.filter(item => checklistProgress[item.id]).length;
  const percentage = Math.round((completed / allItems.length) * 100);

  const progressEl = document.getElementById('buyerOverallProgress');
  if (progressEl) {
    progressEl.innerHTML = `
      <div class="overall-progress-bar">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
      <span class="overall-progress-text">${completed} of ${allItems.length} tasks complete (${percentage}%)</span>
    `;
  }

  // Re-render to update section progress bars
  renderBuyerChecklist();
}

function updateSellerProgress() {
  const allItems = Object.values(sellerChecklistItems).flat();
  const completed = allItems.filter(item => checklistProgress[item.id]).length;
  const percentage = Math.round((completed / allItems.length) * 100);

  const progressEl = document.getElementById('sellerOverallProgress');
  if (progressEl) {
    progressEl.innerHTML = `
      <div class="overall-progress-bar">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
      <span class="overall-progress-text">${completed} of ${allItems.length} tasks complete (${percentage}%)</span>
    `;
  }

  // Re-render to update section progress bars
  renderSellerChecklist();
}

async function resetBuyerChecklist() {
  if (!authToken) {
    showToast('Please login to reset your checklist', 'warning');
    return;
  }

  if (confirm('Are you sure you want to reset your buyer checklist progress? This cannot be undone.')) {
    try {
      const response = await fetch(`${API_BASE}/user/checklist/buyer`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        Object.values(buyerChecklistItems).flat().forEach(item => {
          delete checklistProgress[item.id];
        });
        renderBuyerChecklist();
        updateBuyerProgress();
        showToast('Buyer checklist reset', 'info');
      }
    } catch (error) {
      showToast('Failed to reset checklist', 'error');
    }
  }
}

async function resetSellerChecklist() {
  if (!authToken) {
    showToast('Please login to reset your checklist', 'warning');
    return;
  }

  if (confirm('Are you sure you want to reset your seller checklist progress? This cannot be undone.')) {
    try {
      const response = await fetch(`${API_BASE}/user/checklist/seller`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        Object.values(sellerChecklistItems).flat().forEach(item => {
          delete checklistProgress[item.id];
        });
        renderSellerChecklist();
        updateSellerProgress();
        showToast('Seller checklist reset', 'info');
      }
    } catch (error) {
      showToast('Failed to reset checklist', 'error');
    }
  }
}

// ==========================================
// Toast Notifications
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  // Validate type to prevent class injection
  const validTypes = ['success', 'error', 'info', 'warning'];
  const safeType = validTypes.includes(type) ? type : 'info';
  toast.className = `toast toast-${safeType}`;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[safeType]}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================
// Image Upload Handling
// ==========================================

function initImageUpload() {
  const uploadArea = document.getElementById('imageUploadArea');
  if (!uploadArea) return;

  // Drag and drop handlers
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addImages(files);
  });
}

function handleImagePreview(event) {
  const files = Array.from(event.target.files);
  addImages(files);
  event.target.value = ''; // Reset input so same file can be selected again
}

function addImages(files) {
  const validFiles = files.filter(file => {
    if (!file.type.startsWith('image/')) {
      showToast(`${file.name} is not an image file`, 'error');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(`${file.name} exceeds 10MB limit`, 'error');
      return false;
    }
    return true;
  });

  if (selectedImages.length + validFiles.length > MAX_IMAGES) {
    showToast(`Maximum ${MAX_IMAGES} images allowed`, 'warning');
    validFiles.splice(MAX_IMAGES - selectedImages.length);
  }

  validFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedImages.push({
        file: file,
        preview: e.target.result,
        id: Date.now() + Math.random()
      });
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });

  if (validFiles.length > 0) {
    showToast(`${validFiles.length} image(s) added`, 'success');
  }
}

function renderImagePreviews() {
  const grid = document.getElementById('imagePreviewGrid');
  if (!grid) return;

  grid.innerHTML = selectedImages.map((img, index) => `
    <div class="image-preview-item" data-id="${img.id}">
      <img src="${img.preview}" alt="Preview ${index + 1}">
      <button type="button" class="remove-image-btn" onclick="removeImage(${img.id})">×</button>
      ${index === 0 ? '<span class="main-image-badge">Main</span>' : ''}
    </div>
  `).join('');

  // Update upload area text
  const uploadArea = document.getElementById('imageUploadArea');
  if (uploadArea) {
    const placeholder = uploadArea.querySelector('.upload-placeholder p');
    if (placeholder) {
      placeholder.textContent = selectedImages.length > 0
        ? `${selectedImages.length}/${MAX_IMAGES} photos selected - Click to add more`
        : 'Click to upload photos';
    }
  }
}

function removeImage(imageId) {
  selectedImages = selectedImages.filter(img => img.id !== imageId);
  renderImagePreviews();
  showToast('Image removed', 'info');
}

function clearAllImages() {
  selectedImages = [];
  renderImagePreviews();
}

// ==========================================
// Navigation
// ==========================================

function showSection(sectionId) {
  try {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    var section = document.getElementById(sectionId);
    if (section) {
      section.classList.add('active');
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Handle section-specific loading
    if (sectionId === 'dashboard' && authToken) {
      loadDashboard();
    }
    if (sectionId === 'professionals') {
      initProfessionalsPage();
    }
    if (sectionId === 'showings' && authToken) {
      initShowingsPage();
    }

    // Call the section change callback if defined (in app-features.js)
    if (typeof onSectionChange === 'function') {
      onSectionChange(sectionId);
    }
  } catch (error) {
    console.error('showSection error:', error);
  }
}

function showTab(tabId, event) {
  try {
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });

    if (event && event.target) {
      event.target.classList.add('active');
    }
    var tab = document.getElementById(tabId);
    if (tab) {
      tab.classList.add('active');
    }
  } catch (error) {
    console.error('showTab error:', error);
  }
}

// ==========================================
// Modals
// ==========================================

function showModal(modalId) {
  try {
    var modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  } catch (error) {
    console.error('showModal error:', error);
  }
}

function closeModal(modalId) {
  try {
    var modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  } catch (error) {
    console.error('closeModal error:', error);
  }
}

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

// ==========================================
// Authentication
// ==========================================

async function login(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      authToken = data.token;
      localStorage.setItem('authToken', authToken);

      // Decode token to get user info (simple decode)
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      currentUser = { id: payload.userId, email };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      // Load user preferences (checklist progress and favorites)
      await loadUserPreferences();
      initChecklists();
      searchProperties(); // Refresh to show favorite buttons correctly

      updateAuthUI();
      closeModal('loginModal');
      showSection('dashboard');
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
}

async function register(event) {
  event.preventDefault();

  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (response.ok) {
      alert('Registration successful! Please login.');
      closeModal('registerModal');
      showModal('loginModal');
    } else {
      alert(data.error || data.errors?.[0]?.msg || 'Registration failed');
    }
  } catch (error) {
    alert('Registration failed: ' + error.message);
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');

  // Clear user preferences
  favorites = [];
  checklistProgress = {};
  initChecklists();
  searchProperties(); // Refresh property cards

  updateAuthUI();
  showSection('home');
}

function updateAuthUI() {
  var authButtons = document.getElementById('authButtons');
  var userInfo = document.getElementById('userInfo');
  var dashboardLink = document.getElementById('dashboardLink');
  var showingsLink = document.getElementById('showingsLink');
  var sellFormContainer = document.getElementById('sellFormContainer');
  var sellForm = document.getElementById('sellForm');

  // Login-gated elements
  var checklistLoginPrompt = document.getElementById('checklistLoginPrompt');
  var checklistContent = document.getElementById('checklistContent');
  var sellerChecklistLoginPrompt = document.getElementById('sellerChecklistLoginPrompt');
  var sellerChecklistContent = document.getElementById('sellerChecklistContent');
  var sellLoginPrompt = document.getElementById('sellLoginPrompt');
  var sellWizard = document.getElementById('sellWizard');

  if (authToken && currentUser) {
    // User is logged in
    if (authButtons) authButtons.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    var userName = document.getElementById('userName');
    if (userName) userName.textContent = currentUser.name || currentUser.email;
    if (dashboardLink) dashboardLink.style.display = 'block';
    if (showingsLink) showingsLink.style.display = 'block';

    // Show gated content
    if (checklistLoginPrompt) checklistLoginPrompt.style.display = 'none';
    if (checklistContent) checklistContent.style.display = 'block';
    if (sellerChecklistLoginPrompt) sellerChecklistLoginPrompt.style.display = 'none';
    if (sellerChecklistContent) sellerChecklistContent.style.display = 'block';
    if (sellLoginPrompt) sellLoginPrompt.style.display = 'none';
    if (sellWizard) sellWizard.style.display = 'block';

    // Legacy sell form handling
    if (sellFormContainer) sellFormContainer.style.display = 'none';
    if (sellForm) sellForm.style.display = 'none';
  } else {
    // User is not logged in
    if (authButtons) authButtons.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
    if (dashboardLink) dashboardLink.style.display = 'none';
    if (showingsLink) showingsLink.style.display = 'none';

    // Hide gated content, show login prompts
    if (checklistLoginPrompt) checklistLoginPrompt.style.display = 'block';
    if (checklistContent) checklistContent.style.display = 'none';
    if (sellerChecklistLoginPrompt) sellerChecklistLoginPrompt.style.display = 'block';
    if (sellerChecklistContent) sellerChecklistContent.style.display = 'none';
    if (sellLoginPrompt) sellLoginPrompt.style.display = 'block';
    if (sellWizard) sellWizard.style.display = 'none';

    // Legacy sell form handling
    if (sellFormContainer) sellFormContainer.style.display = 'block';
    if (sellForm) sellForm.style.display = 'none';
  }
}

// ==========================================
// Provinces
// ==========================================

async function loadProvinces() {
  try {
    const response = await fetch(`${API_BASE}/provinces`);
    const provinces = await response.json();

    // Populate province dropdowns
    const dropdowns = ['searchProvince', 'calcProvince', 'propertyProvince'];
    dropdowns.forEach(id => {
      const select = document.getElementById(id);
      if (select) {
        provinces.forEach(p => {
          const option = document.createElement('option');
          option.value = p.code;
          option.textContent = p.name;
          select.appendChild(option);
        });
      }
    });

    // Populate province grid
    const grid = document.getElementById('provinceGrid');
    if (grid) {
      grid.innerHTML = provinces.map(p =>
        `<span class="province-tag">${p.name}</span>`
      ).join('');
    }
  } catch (error) {
    console.error('Failed to load provinces:', error);
  }
}

// Province-specific disclosures for listing workflow
function updateProvinceDisclosures() {
  const province = document.getElementById('propertyProvince')?.value;
  const disclosuresDiv = document.getElementById('provinceDisclosures');
  const disclosureText = document.getElementById('provinceDisclosureText');

  if (!disclosuresDiv || !disclosureText) return;

  const disclosures = {
    'ON': 'Ontario requires mandatory property disclosure statements (SPIS recommended but not required). Title insurance is standard. Land Transfer Tax applies at closing.',
    'BC': 'British Columbia has a Property Transfer Tax and Foreign Buyer Tax in certain areas. Property Disclosure Statement is recommended. Strata properties require Form B Information Certificate.',
    'AB': 'Alberta has no land transfer tax. Real Property Report (RPR) is typically required. Property Condition Disclosure Statement is recommended.',
    'QC': 'Quebec uses the Civil Code rather than common law. Notaries handle closings instead of lawyers. French language requirements may apply for documents.',
    'MB': 'Manitoba has Land Transfer Tax. Property disclosure is recommended. Title insurance is available but not mandatory.',
    'SK': 'Saskatchewan has no land transfer tax on residential property. Property Condition Disclosure Statement is commonly used.',
    'NS': 'Nova Scotia has Deed Transfer Tax. Property Disclosure Statement is recommended. Title insurance is available.',
    'NB': 'New Brunswick has Land Transfer Tax. Property Condition Disclosure is recommended.',
    'PE': 'Prince Edward Island has Real Property Transfer Tax. Non-residents require Cabinet approval for land purchases over 5 acres or 165 feet of shore frontage.',
    'NL': 'Newfoundland and Labrador has Registration of Deeds Tax. Property Condition Disclosure is recommended.',
    'NT': 'Northwest Territories has no land transfer tax. Remote areas may have unique documentation requirements.',
    'YT': 'Yukon has no land transfer tax. Property transactions follow similar processes to other territories.',
    'NU': 'Nunavut has unique land ownership systems including Inuit Owned Lands. Consult local authorities for specific requirements.'
  };

  if (province && disclosures[province]) {
    disclosureText.textContent = disclosures[province];
    disclosuresDiv.style.display = 'block';
  } else {
    disclosuresDiv.style.display = 'none';
  }
}

// ==========================================
// Properties
// ==========================================

async function searchProperties() {
  const province = document.getElementById('searchProvince')?.value || '';
  const city = document.getElementById('searchCity')?.value || '';
  const propertyType = document.getElementById('searchType')?.value || '';
  const minPrice = document.getElementById('minPrice')?.value || '';
  const maxPrice = document.getElementById('maxPrice')?.value || '';

  const params = new URLSearchParams();
  if (province) params.append('province', province);
  if (city) params.append('city', city);
  if (propertyType) params.append('propertyType', propertyType);
  if (minPrice) params.append('minPrice', minPrice);
  if (maxPrice) params.append('maxPrice', maxPrice);

  try {
    const response = await fetch(`${API_BASE}/properties?${params}`);
    const data = await response.json();

    const grid = document.getElementById('propertyGrid');

    if (data.properties && data.properties.length > 0) {
      grid.innerHTML = data.properties.map(p => {
        const safeId = escapeHtml(p._id);
        const mainImage = p.images && p.images.length > 0
          ? `<img src="${sanitizeUrl(p.images[0].url)}" alt="${escapeHtml(p.address?.street)}" style="width:100%;height:100%;object-fit:cover;">`
          : '<div class="property-image-placeholder">🏠</div>';

        const isFav = isFavorite(p._id);

        return `
          <div class="property-card" onclick="viewProperty('${safeId}')">
            <div class="property-image">
              ${mainImage}
              <button class="favorite-btn ${isFav ? 'favorited' : ''}"
                      data-property-id="${safeId}"
                      onclick="toggleFavorite('${safeId}', event)"
                      title="${isFav ? 'Remove from saved' : 'Save property'}">
                ${isFav ? '❤️' : '🤍'}
              </button>
            </div>
            ${p.images && p.images.length > 1 ? `<span class="image-count">📷 ${escapeHtml(p.images.length)}</span>` : ''}
            <div class="property-info">
              <div class="property-price">${formatCurrency(p.askingPrice)}</div>
              <div class="property-address">${escapeHtml(p.address?.street || '')}, ${escapeHtml(p.address?.city || '')}</div>
              <div class="property-details">
                <span>${escapeHtml(p.bedrooms || 0)} beds</span>
                <span>${escapeHtml(p.bathrooms || 0)} baths</span>
                <span>${escapeHtml(p.squareFeet || 'N/A')} sqft</span>
              </div>
              <div class="property-type-badge">${escapeHtml(p.propertyType || 'Property')}</div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Show demo listings with CTA when no real listings found
      grid.innerHTML = `
        <div class="no-listings-banner" style="grid-column: 1/-1; text-align: center; padding: 2rem; background: #fef3c7; border-radius: 12px; margin-bottom: 2rem;">
          <h3 style="margin: 0 0 0.5rem 0; color: #92400e;">No Active Listings Yet</h3>
          <p style="margin: 0 0 1rem 0; color: #78350f;">Be the first to list in this area! It only takes 2 minutes.</p>
          <button onclick="showSection('sell')" class="btn btn-primary">Post Your Listing</button>
        </div>
        <div style="grid-column: 1/-1; margin-bottom: 1rem;">
          <p style="color: #6b7280; font-size: 0.875rem; text-align: center;">Sample listings to show how properties appear:</p>
        </div>
        ${getDemoListings()}
      `;
    }
  } catch (error) {
    document.getElementById('propertyGrid').innerHTML =
      '<p class="error">Failed to load properties. Please try again.</p>';
  }
}

// Demo listings to show when no real listings exist
function getDemoListings() {
  const demoProperties = [
    {
      id: 'demo-1',
      price: 549000,
      street: '123 Maple Street',
      city: 'Toronto',
      province: 'ON',
      beds: 3,
      baths: 2,
      sqft: 1850,
      type: 'Detached'
    },
    {
      id: 'demo-2',
      price: 425000,
      street: '456 Oak Avenue',
      city: 'Ottawa',
      province: 'ON',
      beds: 2,
      baths: 1,
      sqft: 1200,
      type: 'Condo'
    },
    {
      id: 'demo-3',
      price: 799000,
      street: '789 Pine Crescent',
      city: 'Vancouver',
      province: 'BC',
      beds: 4,
      baths: 3,
      sqft: 2400,
      type: 'Townhouse'
    },
    {
      id: 'demo-4',
      price: 375000,
      street: '321 Cedar Lane',
      city: 'Calgary',
      province: 'AB',
      beds: 3,
      baths: 2,
      sqft: 1650,
      type: 'Semi-Detached'
    }
  ];

  return demoProperties.map(p => `
    <div class="property-card demo-listing" style="opacity: 0.7; position: relative;">
      <div class="demo-badge" style="position: absolute; top: 10px; left: 10px; background: #6366f1; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; z-index: 1;">Sample</div>
      <div class="property-image">
        <div class="property-image-placeholder">🏠</div>
      </div>
      <div class="property-info">
        <div class="property-price">${formatCurrency(p.price)}</div>
        <div class="property-address">${escapeHtml(p.street)}, ${escapeHtml(p.city)}</div>
        <div class="property-details">
          <span>${p.beds} beds</span>
          <span>${p.baths} baths</span>
          <span>${p.sqft.toLocaleString()} sqft</span>
        </div>
        <div class="property-type-badge">${escapeHtml(p.type)}</div>
      </div>
    </div>
  `).join('');
}

async function viewProperty(propertyId) {
  try {
    const response = await fetch(`${API_BASE}/properties/${propertyId}`);
    const property = await response.json();

    // Sanitize property data
    const safeId = escapeHtml(property._id);
    const safeStatus = escapeHtml(property.status);

    // Build image gallery HTML
    let galleryHtml = '';
    if (property.images && property.images.length > 0) {
      galleryHtml = `
        <div class="property-gallery">
          <div class="gallery-main">
            <img id="galleryMainImage" src="${sanitizeUrl(property.images[0].url)}" alt="${escapeHtml(property.address?.street)}">
            <div class="gallery-nav">
              <button class="gallery-nav-btn" onclick="prevGalleryImage()">‹</button>
              <span class="gallery-counter"><span id="galleryIndex">1</span> / ${escapeHtml(property.images.length)}</span>
              <button class="gallery-nav-btn" onclick="nextGalleryImage()">›</button>
            </div>
          </div>
          ${property.images.length > 1 ? `
            <div class="gallery-thumbnails">
              ${property.images.map((img, i) => `
                <img src="${sanitizeUrl(img.url)}" alt="Photo ${i + 1}"
                     class="gallery-thumb ${i === 0 ? 'active' : ''}"
                     onclick="selectGalleryImage(${i})"
                     data-index="${i}">
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
      // Store images for gallery navigation
      window.currentGalleryImages = property.images;
      window.currentGalleryIndex = 0;
    } else {
      galleryHtml = '<div class="property-image-placeholder" style="height:300px;font-size:5rem;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:12px;">🏠</div>';
    }

    const detail = document.getElementById('propertyDetail');
    detail.innerHTML = `
      ${galleryHtml}

      <div class="property-detail-header">
        <h2 class="property-detail-price">${formatCurrency(property.askingPrice)}</h2>
        <span class="property-status-badge status-${safeStatus}">${safeStatus}</span>
      </div>

      <p class="property-detail-address">
        <strong>${escapeHtml(property.address?.street)}${property.address?.unit ? ', Unit ' + escapeHtml(property.address.unit) : ''}</strong>
      </p>
      <p class="property-detail-location">${escapeHtml(property.address?.city)}, ${escapeHtml(property.address?.province)} ${escapeHtml(property.address?.postalCode)}</p>

      <div class="property-stats">
        <div class="stat-item">
          <span class="stat-value">${escapeHtml(property.bedrooms || 0)}</span>
          <span class="stat-label">Bedrooms</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${escapeHtml(property.bathrooms || 0)}</span>
          <span class="stat-label">Bathrooms</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${escapeHtml(property.squareFeet?.toLocaleString() || 'N/A')}</span>
          <span class="stat-label">Sq Ft</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${escapeHtml(property.yearBuilt || 'N/A')}</span>
          <span class="stat-label">Year Built</span>
        </div>
      </div>

      <div class="property-description">
        <h3>Description</h3>
        <p>${escapeHtml(property.description || 'No description provided.')}</p>
      </div>

      <div class="property-features">
        <h3>Property Details</h3>
        <div class="features-grid">
          <div class="feature-item"><span class="feature-label">Type:</span> ${escapeHtml(property.propertyType || 'N/A')}</div>
          <div class="feature-item"><span class="feature-label">Lot Size:</span> ${escapeHtml(property.lotSize || 'N/A')} ${escapeHtml(property.lotSizeUnit || 'sqft')}</div>
          <div class="feature-item"><span class="feature-label">Parking:</span> ${escapeHtml(property.parkingSpaces || 0)} spaces</div>
          <div class="feature-item"><span class="feature-label">Heating:</span> ${escapeHtml(property.heatingType || 'N/A')}</div>
          <div class="feature-item"><span class="feature-label">Cooling:</span> ${escapeHtml(property.coolingType || 'N/A')}</div>
        </div>
      </div>

      ${property.features && property.features.length > 0 ? `
        <div class="property-amenities">
          <h3>Features & Amenities</h3>
          <div class="amenities-list">
            ${property.features.map(f => `<span class="amenity-tag">✓ ${escapeHtml(f)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${authToken && property.status === 'active' ? `
        <button onclick="prepareOffer('${safeId}')" class="btn btn-primary btn-lg" style="margin-top:1.5rem;width:100%;">
          Make an Offer
        </button>
      ` : authToken ? '' : '<p style="margin-top:1rem;text-align:center;"><a href="#" onclick="showModal(\'loginModal\')">Login</a> to make an offer</p>'}
    `;

    showModal('propertyModal');
  } catch (error) {
    showToast('Failed to load property details', 'error');
  }
}

// Gallery navigation functions
function selectGalleryImage(index) {
  if (!window.currentGalleryImages) return;

  window.currentGalleryIndex = index;
  const mainImg = document.getElementById('galleryMainImage');
  const indexSpan = document.getElementById('galleryIndex');

  if (mainImg) {
    mainImg.src = window.currentGalleryImages[index].url;
  }
  if (indexSpan) {
    indexSpan.textContent = index + 1;
  }

  // Update thumbnail active state
  document.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === index);
  });
}

function nextGalleryImage() {
  if (!window.currentGalleryImages) return;
  const nextIndex = (window.currentGalleryIndex + 1) % window.currentGalleryImages.length;
  selectGalleryImage(nextIndex);
}

function prevGalleryImage() {
  if (!window.currentGalleryImages) return;
  const prevIndex = window.currentGalleryIndex === 0
    ? window.currentGalleryImages.length - 1
    : window.currentGalleryIndex - 1;
  selectGalleryImage(prevIndex);
}

async function createProperty(event) {
  event.preventDefault();

  if (!authToken) {
    showModal('loginModal');
    return;
  }

  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating Listing...';

  // Gather property features
  const features = [];
  document.querySelectorAll('input[name="features"]:checked').forEach(cb => {
    features.push(cb.value);
  });

  const property = {
    province: document.getElementById('propertyProvince').value,
    address: {
      street: document.getElementById('propertyStreet').value,
      unit: document.getElementById('propertyUnit').value,
      city: document.getElementById('propertyCity').value,
      province: document.getElementById('propertyProvince').value,
      postalCode: document.getElementById('propertyPostal').value
    },
    legalDescription: document.getElementById('propertyLegal').value,
    propertyType: document.getElementById('propertyType').value,
    askingPrice: parseInt(document.getElementById('propertyPrice').value),
    bedrooms: parseInt(document.getElementById('propertyBeds').value) || 0,
    bathrooms: parseFloat(document.getElementById('propertyBaths').value) || 0,
    squareFeet: parseInt(document.getElementById('propertySqft').value) || 0,
    yearBuilt: parseInt(document.getElementById('propertyYear')?.value) || null,
    lotSize: parseFloat(document.getElementById('propertyLotSize')?.value) || null,
    parkingSpaces: parseInt(document.getElementById('propertyParking')?.value) || 0,
    description: document.getElementById('propertyDescription').value,
    features: features
  };

  try {
    // First, create the property
    const response = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(property)
    });

    const data = await response.json();

    if (response.ok) {
      const propertyId = data.property._id || data._id;

      // If there are images, upload them
      if (selectedImages.length > 0) {
        showToast('Uploading images...', 'info');
        await uploadPropertyImages(propertyId);
      }

      showToast('Property created successfully!', 'success');

      // Clear the form and images
      event.target.reset();
      clearAllImages();

      // Navigate to dashboard
      setTimeout(() => {
        showSection('dashboard');
        loadDashboard();
      }, 1000);
    } else {
      showToast(data.error || 'Failed to create property', 'error');
    }
  } catch (error) {
    showToast('Failed to create property: ' + error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function uploadPropertyImages(propertyId) {
  const formData = new FormData();

  selectedImages.forEach((img, index) => {
    formData.append('images', img.file);
  });

  try {
    const response = await fetch(`${API_BASE}/images/property/${propertyId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      showToast(`${selectedImages.length} image(s) uploaded successfully!`, 'success');
      return data;
    } else {
      showToast('Some images failed to upload', 'warning');
      return null;
    }
  } catch (error) {
    showToast('Image upload failed: ' + error.message, 'error');
    return null;
  }
}

// ==========================================
// Offers
// ==========================================

async function prepareOffer(propertyId) {
  closeModal('propertyModal');

  // Get listing for this property
  try {
    const response = await fetch(`${API_BASE}/listings`);
    const data = await response.json();
    const listing = data.listings?.find(l => l.property?._id === propertyId);

    if (listing) {
      document.getElementById('offerListingId').value = listing._id;
      document.getElementById('offerPrice').value = listing.property?.askingPrice || '';
      document.getElementById('offerDeposit').value = Math.round((listing.property?.askingPrice || 0) * 0.05);

      // Set default dates
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      document.getElementById('offerIrrevocable').value = tomorrow.toISOString().slice(0, 16);

      const closing = new Date();
      closing.setDate(closing.getDate() + 60);
      document.getElementById('offerClosingDate').value = closing.toISOString().slice(0, 10);

      showModal('offerModal');
    } else {
      alert('Listing not found');
    }
  } catch (error) {
    alert('Failed to prepare offer: ' + error.message);
  }
}

async function submitOffer(event) {
  event.preventDefault();

  const conditions = [];
  document.querySelectorAll('input[name="conditions"]:checked').forEach(cb => {
    const deadlines = { financing: 5, inspection: 7, lawyer_review: 3 };
    conditions.push({
      type: cb.value,
      deadlineDays: deadlines[cb.value] || 5
    });
  });

  const depositDue = new Date();
  depositDue.setDate(depositDue.getDate() + 3);

  const offer = {
    listingId: document.getElementById('offerListingId').value,
    offerPrice: parseInt(document.getElementById('offerPrice').value),
    depositAmount: parseInt(document.getElementById('offerDeposit').value),
    depositDueDate: depositDue.toISOString(),
    closingDate: document.getElementById('offerClosingDate').value,
    irrevocableDate: document.getElementById('offerIrrevocable').value,
    conditions
  };

  try {
    const response = await fetch(`${API_BASE}/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(offer)
    });

    const data = await response.json();

    if (response.ok) {
      alert('Offer submitted successfully!');
      closeModal('offerModal');
      showSection('dashboard');
      loadDashboard();
    } else {
      alert(data.error || 'Failed to submit offer');
    }
  } catch (error) {
    alert('Failed to submit offer: ' + error.message);
  }
}

// ==========================================
// Tax Calculator
// ==========================================

function updateCalcOptions() {
  const province = document.getElementById('calcProvince').value;
  document.getElementById('torontoOption').style.display = province === 'ON' ? 'block' : 'none';
}

async function calculateTax() {
  const province = document.getElementById('calcProvince').value;
  const price = document.getElementById('calcPrice').value;
  const isFirstTimeBuyer = document.getElementById('calcFirstTime').checked;
  const isToronto = document.getElementById('calcToronto')?.checked || false;

  if (!province || !price) {
    alert('Please select a province and enter a price');
    return;
  }

  try {
    const params = new URLSearchParams({
      province,
      price,
      isFirstTimeBuyer,
      isToronto
    });

    const response = await fetch(`${API_BASE}/calculate-tax?${params}`);
    const data = await response.json();

    const results = document.getElementById('calcResults');
    results.innerHTML = `
      <h3>Tax Breakdown</h3>
      <div class="calc-item">
        <span>Purchase Price:</span>
        <span>${formatCurrency(data.purchasePrice)}</span>
      </div>
      ${data.provincial ? `
        <div class="calc-item">
          <span>Provincial Tax:</span>
          <span>${formatCurrency(data.provincial)}</span>
        </div>
      ` : ''}
      ${data.municipal ? `
        <div class="calc-item">
          <span>Municipal Tax:</span>
          <span>${formatCurrency(data.municipal)}</span>
        </div>
      ` : ''}
      ${data.registrationFee ? `
        <div class="calc-item">
          <span>Registration Fee:</span>
          <span>${formatCurrency(data.registrationFee)}</span>
        </div>
      ` : ''}
      ${data.rebate ? `
        <div class="calc-item" style="color:#10b981;">
          <span>First-Time Buyer Rebate:</span>
          <span>-${formatCurrency(data.rebate)}</span>
        </div>
      ` : ''}
      <div class="calc-item calc-total">
        <span>Total Tax/Fees:</span>
        <span>${formatCurrency(data.total)}</span>
      </div>
      ${data.note ? `<p style="margin-top:1rem;color:#666;font-size:0.875rem;">${escapeHtml(data.note)}</p>` : ''}
    `;
  } catch (error) {
    alert('Calculation failed: ' + error.message);
  }
}

// ==========================================
// Calculator Tabs
// ==========================================

function showCalcTab(tabName, event) {
  // Hide all tab contents
  document.querySelectorAll('.calc-tab-content').forEach(function(content) {
    content.style.display = 'none';
    content.classList.remove('active');
  });

  // Deactivate all tab buttons
  document.querySelectorAll('.calc-tab-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });

  // Show selected tab
  var tabContent = document.getElementById(tabName + 'Calc');
  if (tabContent) {
    tabContent.style.display = 'block';
    tabContent.classList.add('active');
  }

  // Activate clicked button
  if (event && event.target) {
    event.target.classList.add('active');
  }

  // Run calculator for the selected tab
  if (tabName === 'mortgage') {
    calculateMortgage();
  } else if (tabName === 'affordability') {
    calculateAffordability();
  }
}

// ==========================================
// Mortgage Calculator
// ==========================================

function calculateMortgage() {
  var homePrice = parseFloat(document.getElementById('mortgagePrice')?.value) || 0;
  var downPayment = parseFloat(document.getElementById('mortgageDown')?.value) || 0;
  var interestRate = parseFloat(document.getElementById('mortgageRate')?.value) || 5;
  var amortization = parseInt(document.getElementById('mortgageAmortization')?.value) || 25;
  var frequency = document.getElementById('mortgageFrequency')?.value || 'monthly';

  // Calculate mortgage amount
  var mortgageAmount = homePrice - downPayment;
  if (mortgageAmount < 0) mortgageAmount = 0;

  // Update down payment percentage hint
  var downPaymentPercent = homePrice > 0 ? ((downPayment / homePrice) * 100).toFixed(1) : 0;
  var percentHint = document.getElementById('downPaymentPercent');
  if (percentHint) {
    percentHint.textContent = downPaymentPercent + '% of purchase price';
  }

  // Calculate CMHC insurance if down payment < 20%
  var cmhcPremium = 0;
  var cmhcWarning = document.getElementById('cmhcWarning');
  if (downPaymentPercent < 20 && homePrice > 0) {
    // CMHC premium rates based on loan-to-value ratio
    var ltv = (mortgageAmount / homePrice) * 100;
    var premiumRate = 0;
    if (ltv <= 65) premiumRate = 0.006;
    else if (ltv <= 75) premiumRate = 0.017;
    else if (ltv <= 80) premiumRate = 0.024;
    else if (ltv <= 85) premiumRate = 0.028;
    else if (ltv <= 90) premiumRate = 0.031;
    else if (ltv <= 95) premiumRate = 0.04;

    cmhcPremium = mortgageAmount * premiumRate;
    mortgageAmount += cmhcPremium; // CMHC premium is added to mortgage

    if (cmhcWarning) {
      cmhcWarning.style.display = 'block';
      document.getElementById('cmhcPremium').textContent = formatCurrency(cmhcPremium);
    }
  } else {
    if (cmhcWarning) cmhcWarning.style.display = 'none';
  }

  // Calculate monthly payment using mortgage formula
  var monthlyRate = interestRate / 100 / 12;
  var numPayments = amortization * 12;
  var monthlyPayment = 0;

  if (monthlyRate > 0 && mortgageAmount > 0) {
    monthlyPayment = mortgageAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  }

  // Adjust for payment frequency
  var paymentAmount = monthlyPayment;
  var paymentsPerYear = 12;
  if (frequency === 'biweekly') {
    paymentAmount = monthlyPayment / 2;
    paymentsPerYear = 26;
  } else if (frequency === 'weekly') {
    paymentAmount = monthlyPayment / 4;
    paymentsPerYear = 52;
  }

  // Calculate total interest
  var totalPayments = monthlyPayment * numPayments;
  var totalInterest = totalPayments - mortgageAmount;
  var totalCost = homePrice + totalInterest;

  // Update display
  document.getElementById('mortgageAmount').textContent = formatCurrency(mortgageAmount);
  document.getElementById('mortgagePayment').textContent = formatCurrency(paymentAmount) +
    (frequency === 'monthly' ? '/mo' : frequency === 'biweekly' ? '/bi-wk' : '/wk');
  document.getElementById('totalInterest').textContent = formatCurrency(totalInterest);
  document.getElementById('totalCost').textContent = formatCurrency(totalCost);
}

// ==========================================
// Affordability Calculator
// ==========================================

function calculateAffordability() {
  var annualIncome = parseFloat(document.getElementById('annualIncome')?.value) || 0;
  var monthlyDebt = parseFloat(document.getElementById('monthlyDebt')?.value) || 0;
  var availableDown = parseFloat(document.getElementById('availableDown')?.value) || 0;
  var interestRate = parseFloat(document.getElementById('affordRate')?.value) || 5;
  var propTaxRate = parseFloat(document.getElementById('propTaxRate')?.value) || 1;

  var monthlyIncome = annualIncome / 12;

  // GDS ratio (Gross Debt Service) - max 32% for housing costs
  // Housing costs = mortgage + property tax + heating (estimate $150/mo)
  var maxGDS = monthlyIncome * 0.32;

  // TDS ratio (Total Debt Service) - max 40% for all debt
  var maxTDS = monthlyIncome * 0.40;
  var availableForHousing = maxTDS - monthlyDebt;

  // Use the lower of GDS and TDS-adjusted amounts
  var maxMonthlyPayment = Math.min(maxGDS, availableForHousing);

  // Subtract estimated property tax and heating from available payment
  // We'll iterate to find the max home price
  var heatingEstimate = 150; // Monthly heating cost estimate
  var maxHomePrice = 0;

  // Iterative calculation to find max home price
  for (var price = 100000; price <= 3000000; price += 10000) {
    var monthlyPropTax = (price * propTaxRate / 100) / 12;
    var availableForMortgage = maxMonthlyPayment - monthlyPropTax - heatingEstimate;

    if (availableForMortgage <= 0) continue;

    // Calculate max mortgage that would result in this payment
    var monthlyRate = interestRate / 100 / 12;
    var numPayments = 25 * 12; // 25 year amortization

    var maxMortgage = availableForMortgage *
      (Math.pow(1 + monthlyRate, numPayments) - 1) /
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments));

    var requiredDown = price - maxMortgage;

    // Check if we have enough down payment
    if (requiredDown <= availableDown) {
      maxHomePrice = price;
    } else {
      break; // We've exceeded what we can afford
    }
  }

  // Update display
  document.getElementById('maxHomePrice').textContent = formatCurrency(maxHomePrice);
  document.getElementById('maxMonthlyGDS').textContent = formatCurrency(maxGDS);
  document.getElementById('maxMonthlyTDS').textContent = formatCurrency(availableForHousing);
  document.getElementById('maxMortgage').textContent = formatCurrency(maxHomePrice - availableDown);
}

// ==========================================
// Dashboard
// ==========================================

async function loadDashboard() {
  // Load saved properties (works without auth)
  loadSavedProperties();
  updateSavedCount();

  if (!authToken) return;

  // Load properties
  try {
    const response = await fetch(`${API_BASE}/properties/my-properties`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const properties = await response.json();

    const list = document.getElementById('propertiesList');
    if (properties.length > 0) {
      list.innerHTML = properties.map(p => {
        const safeId = escapeHtml(p._id);
        const safeStatus = escapeHtml(p.status);
        return `
          <div class="dashboard-item property-item">
            <div class="property-item-info">
              <strong>${escapeHtml(p.address?.street)}, ${escapeHtml(p.address?.city)}</strong>
              <br><small>${formatCurrency(p.askingPrice)} - ${escapeHtml(p.propertyType)}</small>
            </div>
            <div class="property-item-actions">
              <span class="status-badge status-${safeStatus}">${safeStatus}</span>
              ${p.status === 'draft' ? `<button class="btn btn-sm btn-primary" onclick="activateListing('${safeId}')">Activate</button>` : ''}
              <button class="btn btn-sm btn-outline" onclick="editProperty('${safeId}')" title="Edit">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="confirmDeleteProperty('${safeId}')" title="Delete">Delete</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      list.innerHTML = '<p>No properties yet. <a href="#" onclick="showSection(\'sell\')">List one now!</a></p>';
    }
  } catch (error) {
    console.error('Failed to load properties:', error);
  }

  // Load offers
  try {
    const response = await fetch(`${API_BASE}/offers/my-offers`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const offers = await response.json();

    const list = document.getElementById('offersList');
    if (offers.length > 0) {
      list.innerHTML = offers.map(o => {
        const safeStatus = escapeHtml(o.status);
        return `
          <div class="dashboard-item">
            <div>
              <strong>${escapeHtml(o.property?.address?.street || 'Property')}</strong>
              <br><small>Offer: ${formatCurrency(o.offerPrice)}</small>
            </div>
            <span class="status-badge status-${safeStatus}">${safeStatus}</span>
          </div>
        `;
      }).join('');
    } else {
      list.innerHTML = '<p>No offers yet. <a href="#" onclick="showSection(\'search\')">Find properties!</a></p>';
    }
  } catch (error) {
    console.error('Failed to load offers:', error);
  }

  // Load transactions
  try {
    const response = await fetch(`${API_BASE}/transactions/my-transactions`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const transactions = await response.json();

    const list = document.getElementById('transactionsList');
    if (transactions.length > 0) {
      list.innerHTML = transactions.map(t => {
        const safeStatus = escapeHtml(t.status);
        return `
          <div class="dashboard-item">
            <div>
              <strong>${escapeHtml(t.property?.address?.street || 'Transaction')}</strong>
              <br><small>${formatCurrency(t.purchasePrice)} - Closing: ${formatDate(t.closingDate)}</small>
            </div>
            <span class="status-badge status-${safeStatus}">${safeStatus}</span>
          </div>
        `;
      }).join('');
    } else {
      list.innerHTML = '<p>No transactions yet.</p>';
    }
  } catch (error) {
    console.error('Failed to load transactions:', error);
  }
}

async function activateListing(propertyId) {
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3); // 3 month listing

  try {
    const response = await fetch(`${API_BASE}/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        propertyId,
        endDate: endDate.toISOString()
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert('Listing activated!');
      loadDashboard();
    } else {
      alert(data.error || 'Failed to activate listing');
    }
  } catch (error) {
    alert('Failed to activate listing: ' + error.message);
  }
}

// ==========================================
// Edit Property Functions
// ==========================================

async function editProperty(propertyId) {
  try {
    // Fetch the property data
    const response = await fetch(`${API_BASE}/properties/${propertyId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load property');
    }

    const property = await response.json();

    // Populate the edit form
    document.getElementById('editPropertyId').value = property._id;
    document.getElementById('editStreet').value = property.address?.street || '';
    document.getElementById('editUnit').value = property.address?.unit || '';
    document.getElementById('editCity').value = property.address?.city || '';
    document.getElementById('editProvince').value = property.address?.province || property.province || '';
    document.getElementById('editPostalCode').value = property.address?.postalCode || '';
    document.getElementById('editAskingPrice').value = property.askingPrice || '';
    document.getElementById('editPropertyType').value = property.propertyType || '';
    document.getElementById('editBedrooms').value = property.bedrooms || '';
    document.getElementById('editBathrooms').value = property.bathrooms || '';
    document.getElementById('editSquareFeet').value = property.squareFeet || '';
    document.getElementById('editYearBuilt').value = property.yearBuilt || '';
    document.getElementById('editDescription').value = property.description || '';
    document.getElementById('editLegalDescription').value = property.legalDescription || '';
    document.getElementById('editStatus').value = property.status || 'draft';
    document.getElementById('editParkingSpaces').value = property.parkingSpaces || '';

    // Show the modal
    showModal('editPropertyModal');
  } catch (error) {
    showToast('Failed to load property: ' + error.message, 'error');
  }
}

async function savePropertyEdit(event) {
  event.preventDefault();

  const propertyId = document.getElementById('editPropertyId').value;

  const propertyData = {
    address: {
      street: document.getElementById('editStreet').value,
      unit: document.getElementById('editUnit').value,
      city: document.getElementById('editCity').value,
      province: document.getElementById('editProvince').value,
      postalCode: document.getElementById('editPostalCode').value
    },
    province: document.getElementById('editProvince').value,
    askingPrice: parseFloat(document.getElementById('editAskingPrice').value),
    propertyType: document.getElementById('editPropertyType').value,
    bedrooms: parseInt(document.getElementById('editBedrooms').value) || 0,
    bathrooms: parseFloat(document.getElementById('editBathrooms').value) || 0,
    squareFeet: parseFloat(document.getElementById('editSquareFeet').value) || 0,
    yearBuilt: parseInt(document.getElementById('editYearBuilt').value) || null,
    description: document.getElementById('editDescription').value,
    legalDescription: document.getElementById('editLegalDescription').value,
    status: document.getElementById('editStatus').value,
    parkingSpaces: parseInt(document.getElementById('editParkingSpaces').value) || 0
  };

  try {
    const response = await fetch(`${API_BASE}/properties/${propertyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(propertyData)
    });

    const data = await response.json();

    if (response.ok) {
      closeModal('editPropertyModal');
      showToast('Property updated successfully!', 'success');
      loadDashboard(); // Refresh the property list
    } else {
      showToast(data.error || 'Failed to update property', 'error');
    }
  } catch (error) {
    showToast('Failed to update property: ' + error.message, 'error');
  }
}

// ==========================================
// Delete Property Functions
// ==========================================

async function confirmDeleteProperty(propertyId) {
  try {
    // Fetch the property to show its address in the confirmation
    const response = await fetch(`${API_BASE}/properties/${propertyId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const property = await response.json();
      const address = property.address
        ? `${property.address.street}, ${property.address.city}`
        : 'This property';
      document.getElementById('deletePropertyAddress').textContent = address;
    }

    document.getElementById('deletePropertyId').value = propertyId;
    showModal('deletePropertyModal');
  } catch (error) {
    // Still show the modal even if we can't fetch the address
    document.getElementById('deletePropertyAddress').textContent = 'This property';
    document.getElementById('deletePropertyId').value = propertyId;
    showModal('deletePropertyModal');
  }
}

async function deleteProperty() {
  const propertyId = document.getElementById('deletePropertyId').value;

  if (!propertyId) {
    showToast('No property selected', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/properties/${propertyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      closeModal('deletePropertyModal');
      showToast('Property deleted successfully', 'success');
      loadDashboard(); // Refresh the property list
    } else {
      showToast(data.error || 'Failed to delete property', 'error');
    }
  } catch (error) {
    showToast('Failed to delete property: ' + error.message, 'error');
  }
}

// ==========================================
// FAQ Page Functions
// ==========================================

function showFaqCategory(category) {
  // Hide all categories
  const categories = document.querySelectorAll('.faq-category');
  categories.forEach(cat => cat.classList.remove('active'));
  
  // Show selected category
  const selectedCategory = document.getElementById(`faq-${category}`);
  if (selectedCategory) {
    selectedCategory.classList.add('active');
  }
  
  // Update tab buttons
  const tabs = document.querySelectorAll('.faq-tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
}

function toggleFaq(element) {
  const faqItem = element.closest('.faq-item');
  
  // Close other open FAQs in the same category
  const category = faqItem.closest('.faq-category');
  if (category) {
    const openItems = category.querySelectorAll('.faq-item.open');
    openItems.forEach(item => {
      if (item !== faqItem) {
        item.classList.remove('open');
      }
    });
  }
  
  // Toggle current item
  faqItem.classList.toggle('open');
}

// ==========================================
// Professional Directory Functions
// ==========================================

var proSearchTimeout = null;
var currentProPage = 1;

function debounceProSearch() {
  if (proSearchTimeout) clearTimeout(proSearchTimeout);
  proSearchTimeout = setTimeout(searchProfessionals, 300);
}

async function searchProfessionals(page) {
  page = page || 1;
  currentProPage = page;

  var category = document.getElementById('proCategory') ? document.getElementById('proCategory').value : '';
  var province = document.getElementById('proProvince') ? document.getElementById('proProvince').value : '';
  var city = document.getElementById('proCity') ? document.getElementById('proCity').value : '';
  var minRating = document.getElementById('proRating') ? document.getElementById('proRating').value : '';

  var params = new URLSearchParams();
  if (category) params.append('category', category);
  if (province) params.append('province', province);
  if (city) params.append('city', city);
  if (minRating) params.append('minRating', minRating);
  params.append('page', page);
  params.append('limit', 12);

  var grid = document.getElementById('proGrid');
  if (!grid) return;
  grid.innerHTML = '<p class="loading">Searching...</p>';

  try {
    var response = await fetch(API_BASE + '/professionals/search?' + params);
    var data = await response.json();

    var countEl = document.getElementById('proResultCount');
    if (countEl) {
      countEl.textContent = (data.pagination && data.pagination.total ? data.pagination.total : 0) + ' professionals found';
    }

    if (data.professionals && data.professionals.length > 0) {
      grid.innerHTML = data.professionals.map(function(pro) { return renderProCard(pro); }).join('');
      renderProPagination(data.pagination);
    } else {
      grid.innerHTML = '<p class="empty-state">No professionals found. Try adjusting your filters.</p>';
      var pagEl = document.getElementById('proPagination');
      if (pagEl) pagEl.innerHTML = '';
    }
  } catch (error) {
    console.error('Error searching professionals:', error);
    grid.innerHTML = '<p class="error">Failed to load professionals. Please try again.</p>';
  }
}

function renderProCard(pro) {
  var avg = pro.rating && pro.rating.average ? pro.rating.average : 0;
  var count = pro.rating && pro.rating.count ? pro.rating.count : 0;
  var fullStars = Math.floor(avg);
  var stars = '';
  for (var i = 0; i < fullStars; i++) stars += '★';
  for (var i = fullStars; i < 5; i++) stars += '☆';

  var categoryNames = {
    'lawyer': 'Real Estate Lawyer',
    'notary': 'Notary',
    'inspector': 'Home Inspector',
    'appraiser': 'Property Appraiser',
    'mortgage_broker': 'Mortgage Broker',
    'photographer': 'Photographer',
    'stager': 'Home Stager',
    'mover': 'Moving Company',
    'cleaner': 'Cleaning Service',
    'contractor': 'General Contractor',
    'surveyor': 'Land Surveyor',
    'insurance': 'Insurance Agent'
  };

  var city = pro.location && pro.location.city ? pro.location.city : '';
  var prov = pro.location && pro.location.province ? pro.location.province : '';

  return '<div class="pro-card" onclick="viewProfessional(\'' + escapeHtml(pro._id) + '\')">' +
    '<div class="pro-card-header">' +
      '<div class="pro-logo">' +
        (pro.logo ? '<img src="' + sanitizeUrl(pro.logo) + '" alt="' + escapeHtml(pro.name) + '">' : '🏢') +
      '</div>' +
      '<div class="pro-info">' +
        '<div class="pro-name">' + escapeHtml(pro.name) + '</div>' +
        '<div class="pro-category">' + escapeHtml(categoryNames[pro.category] || pro.category) + '</div>' +
        '<div class="pro-badges">' +
          (pro.verified ? '<span class="pro-badge verified">✓ Verified</span>' : '') +
          (pro.isPartner ? '<span class="pro-badge partner">Partner</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="pro-card-body">' +
      '<div class="pro-rating">' +
        '<span class="pro-stars">' + stars + '</span>' +
        '<span class="pro-rating-text">' + avg.toFixed(1) + ' (' + count + ' reviews)</span>' +
      '</div>' +
      '<div class="pro-location">📍 ' + escapeHtml(city) + ', ' + escapeHtml(prov) + '</div>' +
      (pro.referralDiscount ? '<div class="pro-discount">🎁 ' + escapeHtml(pro.referralDiscount) + '</div>' : '') +
    '</div>' +
  '</div>';
}

function renderProPagination(pagination) {
  var pagEl = document.getElementById('proPagination');
  if (!pagEl) return;

  if (!pagination || pagination.pages <= 1) {
    pagEl.innerHTML = '';
    return;
  }

  var html = '';
  html += '<button onclick="searchProfessionals(' + (pagination.page - 1) + ')" ' + (pagination.page <= 1 ? 'disabled' : '') + '>« Prev</button>';

  for (var i = 1; i <= pagination.pages; i++) {
    if (i === 1 || i === pagination.pages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
      html += '<button onclick="searchProfessionals(' + i + ')" class="' + (i === pagination.page ? 'active' : '') + '">' + i + '</button>';
    } else if (i === pagination.page - 3 || i === pagination.page + 3) {
      html += '<button disabled>...</button>';
    }
  }

  html += '<button onclick="searchProfessionals(' + (pagination.page + 1) + ')" ' + (pagination.page >= pagination.pages ? 'disabled' : '') + '>Next »</button>';

  pagEl.innerHTML = html;
}

async function loadFeaturedProfessionals() {
  try {
    var response = await fetch(API_BASE + '/professionals/featured?limit=6');
    var professionals = await response.json();

    var grid = document.getElementById('proFeaturedGrid');
    var featured = document.getElementById('proFeatured');
    if (professionals && professionals.length > 0) {
      grid.innerHTML = professionals.map(function(pro) { return renderProCard(pro); }).join('');
    } else if (featured) {
      featured.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading featured professionals:', error);
    var featured = document.getElementById('proFeatured');
    if (featured) featured.style.display = 'none';
  }
}

async function viewProfessional(proId) {
  try {
    var response = await fetch(API_BASE + '/professionals/' + proId);
    var pro = await response.json();

    var categoryNames = {
      'lawyer': 'Real Estate Lawyer',
      'notary': 'Notary',
      'inspector': 'Home Inspector',
      'appraiser': 'Property Appraiser',
      'mortgage_broker': 'Mortgage Broker',
      'photographer': 'Photographer',
      'stager': 'Home Stager',
      'mover': 'Moving Company',
      'cleaner': 'Cleaning Service',
      'contractor': 'General Contractor',
      'surveyor': 'Land Surveyor',
      'insurance': 'Insurance Agent'
    };

    var avg = pro.rating && pro.rating.average ? pro.rating.average : 0;
    var count = pro.rating && pro.rating.count ? pro.rating.count : 0;
    var fullStars = Math.floor(avg);
    var stars = '';
    for (var i = 0; i < fullStars; i++) stars += '★';
    for (var i = fullStars; i < 5; i++) stars += '☆';

    var city = pro.location && pro.location.city ? pro.location.city : '';
    var prov = pro.location && pro.location.province ? pro.location.province : '';
    var phone = pro.contact && pro.contact.phone ? pro.contact.phone : '';
    var email = pro.contact && pro.contact.email ? pro.contact.email : '';
    var website = pro.contact && pro.contact.website ? pro.contact.website : '';

    var content = document.getElementById('proDetailContent');
    var html = '<div class="pro-detail-header">' +
      '<div class="pro-detail-logo">' +
        (pro.logo ? '<img src="' + sanitizeUrl(pro.logo) + '" alt="' + escapeHtml(pro.name) + '" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);">' : '🏢') +
      '</div>' +
      '<div class="pro-detail-info">' +
        '<h2>' + escapeHtml(pro.name) + '</h2>' +
        (pro.companyName ? '<p style="color:var(--gray-600);">' + escapeHtml(pro.companyName) + '</p>' : '') +
        '<div class="pro-detail-meta">' +
          '<span>' + escapeHtml(categoryNames[pro.category] || pro.category) + '</span>' +
          '<span>📍 ' + escapeHtml(city) + ', ' + escapeHtml(prov) + '</span>' +
          '<span class="pro-stars">' + stars + ' (' + count + ' reviews)</span>' +
        '</div>' +
        '<div class="pro-badges">' +
          (pro.verified ? '<span class="pro-badge verified">✓ Verified</span>' : '') +
          (pro.isPartner ? '<span class="pro-badge partner">Platform Partner</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>';

    if (pro.description) {
      html += '<div class="pro-detail-section"><h3>About</h3><p>' + escapeHtml(pro.description) + '</p></div>';
    }

    if (pro.referralDiscount) {
      html += '<div class="pro-discount" style="margin-bottom:1.5rem;">🎁 Special Offer: ' + escapeHtml(pro.referralDiscount) + '</div>';
    }

    html += '<div class="pro-detail-section"><h3>Contact</h3><div class="pro-contact-grid">';
    if (phone) {
      html += '<div class="pro-contact-item" onclick="trackProContact(\'' + pro._id + '\')">' +
        '<span class="pro-contact-icon">📞</span>' +
        '<div><div class="pro-contact-label">Phone</div><div class="pro-contact-value"><a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + '</a></div></div>' +
      '</div>';
    }
    if (email) {
      html += '<div class="pro-contact-item" onclick="trackProContact(\'' + pro._id + '\')">' +
        '<span class="pro-contact-icon">✉️</span>' +
        '<div><div class="pro-contact-label">Email</div><div class="pro-contact-value"><a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></div></div>' +
      '</div>';
    }
    if (website) {
      html += '<div class="pro-contact-item" onclick="trackProContact(\'' + pro._id + '\')">' +
        '<span class="pro-contact-icon">🌐</span>' +
        '<div><div class="pro-contact-label">Website</div><div class="pro-contact-value"><a href="' + sanitizeUrl(website) + '" target="_blank">Visit Website</a></div></div>' +
      '</div>';
    }
    html += '</div></div>';

    content.innerHTML = html;
    showModal('proDetailModal');
  } catch (error) {
    showToast('Failed to load professional details', 'error');
  }
}

async function trackProContact(proId) {
  try {
    await fetch(API_BASE + '/professionals/' + proId + '/contact-click', { method: 'POST' });
  } catch (e) {
    // Silently fail
  }
}

async function submitProfessionalSuggestion(event) {
  event.preventDefault();

  if (!authToken) {
    showToast('Please login to suggest a professional', 'error');
    showModal('loginModal');
    return;
  }

  var data = {
    name: document.getElementById('suggestName').value,
    companyName: document.getElementById('suggestCompany').value,
    category: document.getElementById('suggestCategory').value,
    location: {
      city: document.getElementById('suggestCity').value,
      province: document.getElementById('suggestProvince').value
    },
    contact: {
      phone: document.getElementById('suggestPhone').value,
      email: document.getElementById('suggestEmail').value,
      website: document.getElementById('suggestWebsite').value
    },
    description: document.getElementById('suggestReason').value
  };

  try {
    var response = await fetch(API_BASE + '/professionals/suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify(data)
    });

    var result = await response.json();

    if (response.ok) {
      closeModal('suggestProModal');
      showToast('Thank you! Your suggestion has been submitted for review.', 'success');
      event.target.reset();
    } else {
      showToast(result.error || 'Failed to submit suggestion', 'error');
    }
  } catch (error) {
    showToast('Failed to submit suggestion: ' + error.message, 'error');
  }
}

// ==========================================
// Showings Functions
// ==========================================

function showShowingsTab(tab) {
  document.querySelectorAll('.showings-tabs .tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
  event.target.classList.add('active');

  if (tab === 'requests') {
    document.getElementById('showingRequestsTab').style.display = 'block';
    document.getElementById('scheduledShowingsTab').style.display = 'none';
    loadShowingRequests();
  } else {
    document.getElementById('showingRequestsTab').style.display = 'none';
    document.getElementById('scheduledShowingsTab').style.display = 'block';
    loadMyShowings();
  }
}

async function loadShowingRequests() {
  if (!authToken) return;

  var list = document.getElementById('showingRequestsList');
  if (!list) return;
  list.innerHTML = '<p class="loading">Loading...</p>';

  try {
    var response = await fetch(API_BASE + '/showings/my-properties', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    var showings = await response.json();

    if (showings && showings.length > 0) {
      list.innerHTML = showings.map(function(s) { return renderShowingCard(s, 'seller'); }).join('');
    } else {
      list.innerHTML = '<p class="empty-state">No showing requests yet.</p>';
    }
  } catch (error) {
    list.innerHTML = '<p class="error">Failed to load showing requests.</p>';
  }
}

async function loadMyShowings() {
  if (!authToken) return;

  var list = document.getElementById('scheduledShowingsList');
  if (!list) return;
  list.innerHTML = '<p class="loading">Loading...</p>';

  try {
    var response = await fetch(API_BASE + '/showings/my-requests', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    var showings = await response.json();

    if (showings && showings.length > 0) {
      list.innerHTML = showings.map(function(s) { return renderShowingCard(s, 'buyer'); }).join('');
    } else {
      list.innerHTML = '<p class="empty-state">You have not requested any showings yet. <a href="javascript:void(0)" onclick="showSection(\'search\')">Browse properties</a> to schedule viewings.</p>';
    }
  } catch (error) {
    list.innerHTML = '<p class="error">Failed to load your showings.</p>';
  }
}

function renderShowingCard(showing, role) {
  var dateObj = new Date(showing.requestedDate);
  var date = dateObj.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

  var address = showing.property && showing.property.address
    ? showing.property.address.street + ', ' + showing.property.address.city
    : 'Property';

  var timeStart = showing.timeSlot && showing.timeSlot.start ? showing.timeSlot.start : '';
  var timeEnd = showing.timeSlot && showing.timeSlot.end ? showing.timeSlot.end : '';
  var buyerName = showing.buyer && showing.buyer.name ? showing.buyer.name : '';

  var actions = '';
  if (role === 'seller' && showing.status === 'pending') {
    actions = '<button class="btn btn-sm btn-primary" onclick="openRespondModal(\'' + showing._id + '\', \'' + escapeHtml(address) + '\', \'' + date + '\', \'' + timeStart + '\')">Respond</button>';
  } else if (role === 'buyer' && (showing.status === 'pending' || showing.status === 'approved')) {
    actions = '<button class="btn btn-sm btn-outline" onclick="cancelShowing(\'' + showing._id + '\')">Cancel</button>';
  }

  return '<div class="showing-card">' +
    '<div class="showing-info">' +
      '<h4>' + escapeHtml(address) + '</h4>' +
      '<div class="showing-meta">' +
        '<span>📅 ' + date + '</span>' +
        '<span>🕐 ' + timeStart + ' - ' + timeEnd + '</span>' +
        (role === 'seller' && buyerName ? '<span>👤 ' + escapeHtml(buyerName) + '</span>' : '') +
      '</div>' +
      (showing.buyerMessage ? '<p style="margin-top:0.5rem;color:var(--gray-600);font-size:0.875rem;">"' + escapeHtml(showing.buyerMessage) + '"</p>' : '') +
    '</div>' +
    '<div class="showing-actions">' +
      '<span class="showing-status ' + showing.status + '">' + showing.status + '</span>' +
      actions +
    '</div>' +
  '</div>';
}

function openScheduleShowing(propertyId, address) {
  if (!authToken) {
    showToast('Please login to schedule a showing', 'info');
    showModal('loginModal');
    return;
  }

  document.getElementById('showingPropertyId').value = propertyId;
  document.getElementById('showingPropertyAddress').textContent = address;
  document.getElementById('showingTimeSlots').innerHTML = '<p class="hint">Select a date to see available times</p>';
  document.getElementById('showingTimeStart').value = '';
  document.getElementById('showingTimeEnd').value = '';

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('showingDate').min = tomorrow.toISOString().split('T')[0];
  document.getElementById('showingDate').value = '';

  showModal('scheduleShowingModal');
}

async function loadAvailableSlots() {
  var propertyId = document.getElementById('showingPropertyId').value;
  var date = document.getElementById('showingDate').value;

  if (!propertyId || !date) return;

  var slotsContainer = document.getElementById('showingTimeSlots');
  slotsContainer.innerHTML = '<p class="loading">Loading available times...</p>';

  try {
    var response = await fetch(API_BASE + '/showings/available-slots/' + propertyId + '/' + date);
    var data = await response.json();

    if (data.availableSlots && data.availableSlots.length > 0) {
      slotsContainer.innerHTML = data.availableSlots.map(function(slot) {
        return '<div class="time-slot" onclick="selectTimeSlot(this, \'' + slot.start + '\', \'' + slot.end + '\')">' + slot.start + '</div>';
      }).join('');
    } else {
      slotsContainer.innerHTML = '<p class="hint">No available times for this date. Please select another date.</p>';
    }
  } catch (error) {
    slotsContainer.innerHTML = '<p class="error">Failed to load available times.</p>';
  }
}

function selectTimeSlot(element, start, end) {
  document.querySelectorAll('.time-slot').forEach(function(s) { s.classList.remove('selected'); });
  element.classList.add('selected');
  document.getElementById('showingTimeStart').value = start;
  document.getElementById('showingTimeEnd').value = end;
}

async function submitShowingRequest(event) {
  event.preventDefault();

  var propertyId = document.getElementById('showingPropertyId').value;
  var date = document.getElementById('showingDate').value;
  var start = document.getElementById('showingTimeStart').value;
  var end = document.getElementById('showingTimeEnd').value;
  var phone = document.getElementById('showingPhone').value;
  var message = document.getElementById('showingMessage').value;

  if (!start || !end) {
    showToast('Please select a time slot', 'error');
    return;
  }

  try {
    var response = await fetch(API_BASE + '/showings/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({
        propertyId: propertyId,
        requestedDate: date,
        timeSlot: { start: start, end: end },
        buyerPhone: phone,
        buyerMessage: message
      })
    });

    var data = await response.json();

    if (response.ok) {
      closeModal('scheduleShowingModal');
      showToast('Showing request submitted! The seller will respond soon.', 'success');
    } else {
      showToast(data.error || 'Failed to submit request', 'error');
    }
  } catch (error) {
    showToast('Failed to submit request: ' + error.message, 'error');
  }
}

function openRespondModal(showingId, address, date, time) {
  document.getElementById('respondShowingId').value = showingId;
  document.getElementById('showingDetails').innerHTML = '<p><strong>Property:</strong> ' + escapeHtml(address) + '</p><p><strong>Requested:</strong> ' + date + ' at ' + time + '</p>';
  showModal('respondShowingModal');
}

async function approveShowing() {
  var showingId = document.getElementById('respondShowingId').value;
  var message = document.getElementById('showingResponseMessage').value;

  try {
    var response = await fetch(API_BASE + '/showings/' + showingId + '/approve', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({ message: message })
    });

    if (response.ok) {
      closeModal('respondShowingModal');
      showToast('Showing approved! The buyer has been notified.', 'success');
      loadShowingRequests();
    } else {
      var data = await response.json();
      showToast(data.error || 'Failed to approve showing', 'error');
    }
  } catch (error) {
    showToast('Failed to approve showing: ' + error.message, 'error');
  }
}

async function rejectShowing() {
  var showingId = document.getElementById('respondShowingId').value;
  var message = document.getElementById('showingResponseMessage').value;

  try {
    var response = await fetch(API_BASE + '/showings/' + showingId + '/reject', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({ message: message })
    });

    if (response.ok) {
      closeModal('respondShowingModal');
      showToast('Showing declined.', 'info');
      loadShowingRequests();
    } else {
      var data = await response.json();
      showToast(data.error || 'Failed to decline showing', 'error');
    }
  } catch (error) {
    showToast('Failed to decline showing: ' + error.message, 'error');
  }
}

async function cancelShowing(showingId) {
  if (!confirm('Are you sure you want to cancel this showing?')) return;

  try {
    var response = await fetch(API_BASE + '/showings/' + showingId + '/cancel', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({ reason: 'Cancelled by user' })
    });

    if (response.ok) {
      showToast('Showing cancelled.', 'info');
      loadMyShowings();
    } else {
      var data = await response.json();
      showToast(data.error || 'Failed to cancel showing', 'error');
    }
  } catch (error) {
    showToast('Failed to cancel showing: ' + error.message, 'error');
  }
}

function initProfessionalsPage() {
  loadFeaturedProfessionals();
  searchProfessionals();
}

function initShowingsPage() {
  loadShowingRequests();
}

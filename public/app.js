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
            ? `<img src="${p.image}" alt="${p.address?.street}">`
            : '<div class="property-image-placeholder">🏠</div>'
          }
        </div>
        <div class="saved-property-info">
          <div class="saved-property-price">$${p.askingPrice?.toLocaleString() || 'N/A'}</div>
          <div class="saved-property-address">${p.address?.street || ''}, ${p.address?.city || ''}</div>
          <div class="saved-property-details">
            <span>${p.bedrooms || 0} beds</span>
            <span>${p.bathrooms || 0} baths</span>
            <span>${p.squareFeet || 'N/A'} sqft</span>
          </div>
          <div class="saved-property-meta">
            <span class="property-type-badge">${p.propertyType || 'Property'}</span>
            <span class="saved-date">Saved ${formatSavedDate(p.savedAt)}</span>
          </div>
        </div>
        <div class="saved-property-actions">
          <button class="btn btn-primary btn-sm" onclick="viewProperty('${p.id}')">View</button>
          <button class="btn btn-outline btn-sm" onclick="removeFavorite('${p.id}')">Remove</button>
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
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
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

    if (sectionId === 'dashboard' && authToken) {
      loadDashboard();
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
  alert('showModal called: ' + modalId);
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
  const authButtons = document.getElementById('authButtons');
  const userInfo = document.getElementById('userInfo');
  const dashboardLink = document.getElementById('dashboardLink');
  const sellFormContainer = document.getElementById('sellFormContainer');
  const sellForm = document.getElementById('sellForm');

  if (authToken && currentUser) {
    authButtons.style.display = 'none';
    userInfo.style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.email;
    dashboardLink.style.display = 'block';
    sellFormContainer.style.display = 'none';
    sellForm.style.display = 'block';
  } else {
    authButtons.style.display = 'flex';
    userInfo.style.display = 'none';
    dashboardLink.style.display = 'none';
    sellFormContainer.style.display = 'block';
    sellForm.style.display = 'none';
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
        const mainImage = p.images && p.images.length > 0
          ? `<img src="${p.images[0].url}" alt="${p.address?.street}" style="width:100%;height:100%;object-fit:cover;">`
          : '<div class="property-image-placeholder">🏠</div>';

        const isFav = isFavorite(p._id);

        return `
          <div class="property-card" onclick="viewProperty('${p._id}')">
            <div class="property-image">
              ${mainImage}
              <button class="favorite-btn ${isFav ? 'favorited' : ''}"
                      data-property-id="${p._id}"
                      onclick="toggleFavorite('${p._id}', event)"
                      title="${isFav ? 'Remove from saved' : 'Save property'}">
                ${isFav ? '❤️' : '🤍'}
              </button>
            </div>
            ${p.images && p.images.length > 1 ? `<span class="image-count">📷 ${p.images.length}</span>` : ''}
            <div class="property-info">
              <div class="property-price">$${p.askingPrice?.toLocaleString() || 'N/A'}</div>
              <div class="property-address">${p.address?.street || ''}, ${p.address?.city || ''}</div>
              <div class="property-details">
                <span>${p.bedrooms || 0} beds</span>
                <span>${p.bathrooms || 0} baths</span>
                <span>${p.squareFeet || 'N/A'} sqft</span>
              </div>
              <div class="property-type-badge">${p.propertyType || 'Property'}</div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      grid.innerHTML = '<p class="loading">No properties found. Try adjusting your search.</p>';
    }
  } catch (error) {
    document.getElementById('propertyGrid').innerHTML =
      '<p class="error">Failed to load properties</p>';
  }
}

async function viewProperty(propertyId) {
  try {
    const response = await fetch(`${API_BASE}/properties/${propertyId}`);
    const property = await response.json();

    // Build image gallery HTML
    let galleryHtml = '';
    if (property.images && property.images.length > 0) {
      galleryHtml = `
        <div class="property-gallery">
          <div class="gallery-main">
            <img id="galleryMainImage" src="${property.images[0].url}" alt="${property.address?.street}">
            <div class="gallery-nav">
              <button class="gallery-nav-btn" onclick="prevGalleryImage()">‹</button>
              <span class="gallery-counter"><span id="galleryIndex">1</span> / ${property.images.length}</span>
              <button class="gallery-nav-btn" onclick="nextGalleryImage()">›</button>
            </div>
          </div>
          ${property.images.length > 1 ? `
            <div class="gallery-thumbnails">
              ${property.images.map((img, i) => `
                <img src="${img.url}" alt="Photo ${i + 1}"
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
        <h2 class="property-detail-price">$${property.askingPrice?.toLocaleString()}</h2>
        <span class="property-status-badge status-${property.status}">${property.status}</span>
      </div>

      <p class="property-detail-address">
        <strong>${property.address?.street}${property.address?.unit ? ', Unit ' + property.address.unit : ''}</strong>
      </p>
      <p class="property-detail-location">${property.address?.city}, ${property.address?.province} ${property.address?.postalCode}</p>

      <div class="property-stats">
        <div class="stat-item">
          <span class="stat-value">${property.bedrooms || 0}</span>
          <span class="stat-label">Bedrooms</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${property.bathrooms || 0}</span>
          <span class="stat-label">Bathrooms</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${property.squareFeet?.toLocaleString() || 'N/A'}</span>
          <span class="stat-label">Sq Ft</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${property.yearBuilt || 'N/A'}</span>
          <span class="stat-label">Year Built</span>
        </div>
      </div>

      <div class="property-description">
        <h3>Description</h3>
        <p>${property.description || 'No description provided.'}</p>
      </div>

      <div class="property-features">
        <h3>Property Details</h3>
        <div class="features-grid">
          <div class="feature-item"><span class="feature-label">Type:</span> ${property.propertyType || 'N/A'}</div>
          <div class="feature-item"><span class="feature-label">Lot Size:</span> ${property.lotSize || 'N/A'} ${property.lotSizeUnit || 'sqft'}</div>
          <div class="feature-item"><span class="feature-label">Parking:</span> ${property.parkingSpaces || 0} spaces</div>
          <div class="feature-item"><span class="feature-label">Heating:</span> ${property.heatingType || 'N/A'}</div>
          <div class="feature-item"><span class="feature-label">Cooling:</span> ${property.coolingType || 'N/A'}</div>
        </div>
      </div>

      ${property.features && property.features.length > 0 ? `
        <div class="property-amenities">
          <h3>Features & Amenities</h3>
          <div class="amenities-list">
            ${property.features.map(f => `<span class="amenity-tag">✓ ${f}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${authToken && property.status === 'active' ? `
        <button onclick="prepareOffer('${property._id}')" class="btn btn-primary btn-lg" style="margin-top:1.5rem;width:100%;">
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
        <span>$${data.purchasePrice?.toLocaleString()}</span>
      </div>
      ${data.provincial ? `
        <div class="calc-item">
          <span>Provincial Tax:</span>
          <span>$${data.provincial?.toLocaleString()}</span>
        </div>
      ` : ''}
      ${data.municipal ? `
        <div class="calc-item">
          <span>Municipal Tax:</span>
          <span>$${data.municipal?.toLocaleString()}</span>
        </div>
      ` : ''}
      ${data.registrationFee ? `
        <div class="calc-item">
          <span>Registration Fee:</span>
          <span>$${data.registrationFee?.toLocaleString()}</span>
        </div>
      ` : ''}
      ${data.rebate ? `
        <div class="calc-item" style="color:#10b981;">
          <span>First-Time Buyer Rebate:</span>
          <span>-$${data.rebate?.toLocaleString()}</span>
        </div>
      ` : ''}
      <div class="calc-item calc-total">
        <span>Total Tax/Fees:</span>
        <span>$${data.total?.toLocaleString()}</span>
      </div>
      ${data.note ? `<p style="margin-top:1rem;color:#666;font-size:0.875rem;">${data.note}</p>` : ''}
    `;
  } catch (error) {
    alert('Calculation failed: ' + error.message);
  }
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
      list.innerHTML = properties.map(p => `
        <div class="dashboard-item">
          <div>
            <strong>${p.address?.street}, ${p.address?.city}</strong>
            <br><small>$${p.askingPrice?.toLocaleString()} - ${p.propertyType}</small>
          </div>
          <div>
            <span class="status-badge status-${p.status}">${p.status}</span>
            ${p.status === 'draft' ? `<button class="btn btn-sm btn-primary" onclick="activateListing('${p._id}')">Activate</button>` : ''}
          </div>
        </div>
      `).join('');
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
      list.innerHTML = offers.map(o => `
        <div class="dashboard-item">
          <div>
            <strong>${o.property?.address?.street || 'Property'}</strong>
            <br><small>Offer: $${o.offerPrice?.toLocaleString()}</small>
          </div>
          <span class="status-badge status-${o.status}">${o.status}</span>
        </div>
      `).join('');
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
      list.innerHTML = transactions.map(t => `
        <div class="dashboard-item">
          <div>
            <strong>${t.property?.address?.street || 'Transaction'}</strong>
            <br><small>$${t.purchasePrice?.toLocaleString()} - Closing: ${new Date(t.closingDate).toLocaleDateString()}</small>
          </div>
          <span class="status-badge status-${t.status}">${t.status}</span>
        </div>
      `).join('');
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

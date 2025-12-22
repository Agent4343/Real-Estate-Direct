// API Configuration
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// Image upload state
let selectedImages = [];
const MAX_IMAGES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadProvinces();
  updateAuthUI();
  searchProperties();
  initImageUpload();
});

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
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');

  if (sectionId === 'dashboard' && authToken) {
    loadDashboard();
  }
}

function showTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// ==========================================
// Modals
// ==========================================

function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
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

        return `
          <div class="property-card" onclick="viewProperty('${p._id}')">
            <div class="property-image">${mainImage}</div>
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

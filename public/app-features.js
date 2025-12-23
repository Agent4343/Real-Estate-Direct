// ==========================================
// Section Change Callback - handles all section-specific loading
// This is called by showSection() in app.js
// ==========================================

function onSectionChange(sectionId) {
  switch(sectionId) {
    case 'admin':
      loadAdminDashboard();
      break;
    case 'messages':
      if (typeof loadConversations === 'function') loadConversations();
      break;
    case 'profile':
      if (typeof loadProfile === 'function') loadProfile();
      break;
    case 'transactions':
      if (typeof loadTransactions === 'function') loadTransactions();
      break;
    case 'notifications':
      if (typeof loadNotifications === 'function') loadNotifications();
      break;
    case 'documents':
      if (typeof loadDocuments === 'function') loadDocuments();
      if (typeof loadUserTransactionsForDocuments === 'function') loadUserTransactionsForDocuments();
      break;
    case 'analytics':
      if (typeof loadAnalytics === 'function') loadAnalytics();
      break;
    case 'ai-tools':
      if (typeof loadAIToolsUsage === 'function') loadAIToolsUsage();
      break;
    case 'referrals':
      if (typeof updateReferralUI === 'function') updateReferralUI();
      break;
    case 'savings-calculator':
      if (typeof calculateSavings === 'function') calculateSavings();
      break;
    case 'offer-comparison':
      if (typeof loadOfferComparison === 'function') loadOfferComparison();
      break;
  }
}

// ==========================================
// Admin Dashboard Functions
// ==========================================

var isAdmin = false;

async function checkAdminStatus() {
  if (!authToken) return;
  try {
    const response = await fetch(`${API_BASE}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    isAdmin = response.ok;
    updateNavForAdmin();
  } catch (err) {
    isAdmin = false;
  }
}

function updateNavForAdmin() {
  const adminLink = document.getElementById('adminLink');
  if (adminLink) {
    adminLink.style.display = isAdmin ? 'inline' : 'none';
  }
}

async function loadAdminDashboard() {
  if (!isAdmin) return;

  try {
    const [statsRes, earningsRes] = await Promise.all([
      fetch(`${API_BASE}/admin/stats`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/admin/earnings`, { headers: { 'Authorization': `Bearer ${authToken}` } })
    ]);

    if (statsRes.ok) {
      const stats = await statsRes.json();
      document.getElementById('adminTotalEarnings').textContent = '$' + (stats.totalEarnings || 0).toLocaleString();
      document.getElementById('adminPendingCommissions').textContent = '$' + (stats.pendingCommissions || 0).toLocaleString();
      document.getElementById('adminTotalTransactions').textContent = stats.totalTransactions || 0;
      document.getElementById('adminTotalUsers').textContent = stats.totalUsers || 0;
    }

    if (earningsRes.ok) {
      const earnings = await earningsRes.json();
      renderAdminTables(earnings);
    }
  } catch (err) {
    console.error('Failed to load admin dashboard:', err);
  }
}

function renderAdminTables(earnings) {
  const pending = earnings.filter(function(e) { return e.platformFee && e.platformFee.status !== 'paid'; });
  const paid = earnings.filter(function(e) { return e.platformFee && e.platformFee.status === 'paid'; });

  const pendingTable = document.getElementById('pendingCommissionsTable');
  const paidTable = document.getElementById('paidCommissionsTable');

  if (pending.length === 0) {
    pendingTable.innerHTML = '<tr><td colspan="6" class="empty-state">No pending commissions</td></tr>';
  } else {
    pendingTable.innerHTML = pending.map(function(t) {
      const address = t.property && t.property.address ? t.property.address.street : 'N/A';
      const seller = t.seller ? t.seller.name : 'N/A';
      const price = t.purchasePrice || 0;
      const commission = t.platformFee ? t.platformFee.amount : 0;
      const status = t.platformFee ? t.platformFee.status : 'pending';
      return '<tr>' +
        '<td>' + address + '</td>' +
        '<td>' + seller + '</td>' +
        '<td>$' + price.toLocaleString() + '</td>' +
        '<td>$' + commission.toLocaleString() + '</td>' +
        '<td><span class="status-badge ' + status + '">' + status + '</span></td>' +
        '<td><button class="btn btn-sm btn-primary" onclick="sendInvoice(\'' + t._id + '\')">Send Invoice</button></td>' +
        '</tr>';
    }).join('');
  }

  if (paid.length === 0) {
    paidTable.innerHTML = '<tr><td colspan="5" class="empty-state">No paid commissions yet</td></tr>';
  } else {
    paidTable.innerHTML = paid.map(function(t) {
      const address = t.property && t.property.address ? t.property.address.street : 'N/A';
      const seller = t.seller ? t.seller.name : 'N/A';
      const price = t.purchasePrice || 0;
      const commission = t.platformFee ? t.platformFee.amount : 0;
      const paidDate = t.platformFee && t.platformFee.paidAt ? new Date(t.platformFee.paidAt).toLocaleDateString() : 'N/A';
      return '<tr>' +
        '<td>' + address + '</td>' +
        '<td>' + seller + '</td>' +
        '<td>$' + price.toLocaleString() + '</td>' +
        '<td>$' + commission.toLocaleString() + '</td>' +
        '<td>' + paidDate + '</td>' +
        '</tr>';
    }).join('');
  }
}

function showAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
  event.target.classList.add('active');
  document.getElementById('admin-' + tabName).classList.add('active');
}

async function sendInvoice(transactionId) {
  try {
    const response = await fetch(API_BASE + '/notifications/commission-invoice/' + transactionId, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    if (response.ok) {
      showToast('Invoice sent successfully', 'success');
      loadAdminDashboard();
    } else {
      showToast('Failed to send invoice', 'error');
    }
  } catch (err) {
    showToast('Failed to send invoice', 'error');
  }
}

// ==========================================
// Messages Functions
// ==========================================

let currentConversationId = null;

async function loadConversations() {
  if (!authToken) return;

  try {
    const response = await fetch(API_BASE + '/messages/conversations', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      const conversations = await response.json();
      renderConversations(conversations);
    }
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

function renderConversations(conversations) {
  const container = document.getElementById('conversationsList');

  if (!conversations || conversations.length === 0) {
    container.innerHTML = '<div class="empty-state">No conversations yet</div>';
    return;
  }

  container.innerHTML = conversations.map(function(conv) {
    const participantName = conv.participants && conv.participants[0] ? conv.participants[0].name : 'Unknown';
    const preview = conv.property ? conv.property.address : (conv.lastMessage ? conv.lastMessage.content : 'No messages');
    const unreadClass = conv.unreadCount > 0 ? 'unread' : '';
    const activeClass = conv.id === currentConversationId ? 'active' : '';
    return '<div class="conversation-item ' + unreadClass + ' ' + activeClass + '" onclick="openConversation(\'' + conv.id + '\')">' +
      '<h4>' + participantName + '</h4>' +
      '<p>' + preview + '</p>' +
      '</div>';
  }).join('');

  const totalUnread = conversations.reduce(function(sum, c) { return sum + (c.unreadCount || 0); }, 0);
  const badge = document.getElementById('totalUnreadBadge');
  if (totalUnread > 0) {
    badge.textContent = totalUnread;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

async function openConversation(conversationId) {
  currentConversationId = conversationId;

  document.getElementById('noConversationSelected').style.display = 'none';
  document.getElementById('conversationView').style.display = 'flex';

  try {
    const response = await fetch(API_BASE + '/messages/conversations/' + conversationId + '/messages', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      const messages = await response.json();
      renderMessages(messages);
      loadConversations();
    }
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

function renderMessages(messages) {
  const container = document.getElementById('messagesList');

  container.innerHTML = messages.map(function(msg) {
    const bubbleClass = msg.isOwn ? 'sent' : 'received';
    const time = new Date(msg.createdAt).toLocaleTimeString();
    return '<div class="message-bubble ' + bubbleClass + '">' +
      '<p>' + msg.content + '</p>' +
      '<div class="message-time">' + time + '</div>' +
      '</div>';
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function handleMessageKeypress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content || !currentConversationId) return;

  try {
    const response = await fetch(API_BASE + '/messages/conversations/' + currentConversationId + '/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({ content: content })
    });

    if (response.ok) {
      input.value = '';
      openConversation(currentConversationId);
    }
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

// ==========================================
// Profile Functions
// ==========================================

async function loadProfile() {
  if (!authToken) return;

  try {
    const response = await fetch(API_BASE + '/user/preferences', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      const data = await response.json();
      document.getElementById('profileName').value = data.name || '';
      document.getElementById('profileEmail').value = data.email || '';
      document.getElementById('profilePhone').value = data.phone || '';

      if (data.notificationSettings) {
        document.getElementById('notifyOffers').checked = data.notificationSettings.emailOffers !== false;
        document.getElementById('notifyMessages').checked = data.notificationSettings.emailMessages !== false;
        document.getElementById('notifyTransactions').checked = data.notificationSettings.emailTransactions !== false;
      }
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

async function updateProfile(event) {
  event.preventDefault();

  const name = document.getElementById('profileName').value;
  const phone = document.getElementById('profilePhone').value;

  try {
    const response = await fetch(API_BASE + '/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({ name: name, phone: phone })
    });

    if (response.ok) {
      showToast('Profile updated successfully', 'success');
    } else {
      showToast('Failed to update profile', 'error');
    }
  } catch (err) {
    showToast('Failed to update profile', 'error');
  }
}

async function changePassword(event) {
  event.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  try {
    const response = await fetch(API_BASE + '/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword })
    });

    if (response.ok) {
      showToast('Password updated successfully', 'success');
      document.getElementById('passwordForm').reset();
    } else {
      const data = await response.json();
      showToast(data.error || 'Failed to update password', 'error');
    }
  } catch (err) {
    showToast('Failed to update password', 'error');
  }
}

async function updateNotifications(event) {
  event.preventDefault();

  const settings = {
    emailOffers: document.getElementById('notifyOffers').checked,
    emailMessages: document.getElementById('notifyMessages').checked,
    emailTransactions: document.getElementById('notifyTransactions').checked
  };

  try {
    const response = await fetch(API_BASE + '/notifications/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify(settings)
    });

    if (response.ok) {
      showToast('Notification preferences saved', 'success');
    } else {
      showToast('Failed to save preferences', 'error');
    }
  } catch (err) {
    showToast('Failed to save preferences', 'error');
  }
}

// ==========================================
// Transactions Functions
// ==========================================

async function loadTransactions() {
  if (!authToken) return;

  try {
    const response = await fetch(API_BASE + '/transactions/my', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      const transactions = await response.json();
      renderTransactionsUI(transactions);
    }
  } catch (err) {
    console.error('Failed to load transactions:', err);
  }
}

function renderTransactionsUI(transactions) {
  const container = document.getElementById('transactionsList');

  if (!transactions || transactions.length === 0) {
    container.innerHTML = '<div class="empty-state">No transactions yet</div>';
    return;
  }

  container.innerHTML = transactions.map(function(t) {
    const address = t.property && t.property.address ? t.property.address.street : 'Property';
    const price = t.purchasePrice || 0;
    const role = t.role === 'buyer' ? 'Buying' : 'Selling';
    const statusClass = t.status === 'completed' ? 'completed' : 'active';
    return '<div class="transaction-card">' +
      '<div class="transaction-info">' +
      '<h3>' + address + '</h3>' +
      '<p>$' + price.toLocaleString() + ' - ' + role + '</p>' +
      '</div>' +
      '<span class="transaction-status ' + statusClass + '">' + t.status + '</span>' +
      '</div>';
  }).join('');
}

function filterTransactions(filter) {
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  event.target.classList.add('active');
}

// ==========================================
// Property Comparison Functions
// ==========================================

var compareProperties = [null, null, null];

function openPropertySelector(slot) {
  showToast('Property selector - select from your saved properties', 'info');
}

// ==========================================
// Saved Searches Functions
// ==========================================

async function createSavedSearch(event) {
  event.preventDefault();

  var searchData = {
    name: document.getElementById('searchName').value,
    criteria: {
      province: document.getElementById('searchProvince').value,
      minPrice: document.getElementById('searchMinPrice').value,
      maxPrice: document.getElementById('searchMaxPrice').value,
      propertyType: document.getElementById('searchPropertyType').value,
      minBedrooms: document.getElementById('searchMinBeds').value
    }
  };

  try {
    var response = await fetch(API_BASE + '/user/saved-searches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify(searchData)
    });

    if (response.ok) {
      showToast('Search saved successfully', 'success');
      document.getElementById('savedSearchForm').reset();
      loadSavedSearches();
    } else {
      showToast('Failed to save search', 'error');
    }
  } catch (err) {
    showToast('Failed to save search', 'error');
  }
}

async function loadSavedSearches() {
  if (!authToken) return;

  try {
    var response = await fetch(API_BASE + '/user/saved-searches', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      var searches = await response.json();
      renderSavedSearches(searches);
    }
  } catch (err) {
    console.error('Failed to load saved searches:', err);
  }
}

function renderSavedSearches(searches) {
  var container = document.getElementById('savedSearchesList');

  if (!searches || searches.length === 0) {
    container.innerHTML = '<div class="empty-state">No saved searches yet</div>';
    return;
  }

  container.innerHTML = searches.map(function(s) {
    var province = s.criteria && s.criteria.province ? s.criteria.province : 'Any province';
    var propType = s.criteria && s.criteria.propertyType ? s.criteria.propertyType : 'Any type';
    return '<div class="saved-search-item">' +
      '<div>' +
      '<strong>' + s.name + '</strong>' +
      '<p>' + province + ' - ' + propType + '</p>' +
      '</div>' +
      '<button class="btn btn-outline btn-sm" onclick="deleteSavedSearch(\'' + s._id + '\')">Delete</button>' +
      '</div>';
  }).join('');
}

// ==========================================
// Password Reset Functions
// ==========================================

async function requestPasswordReset(event) {
  event.preventDefault();

  var email = document.getElementById('resetEmail').value;

  try {
    var response = await fetch(API_BASE + '/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });

    if (response.ok) {
      showToast('Password reset email sent', 'success');
      closeModal('forgotPasswordModal');
    } else {
      showToast('Failed to send reset email', 'error');
    }
  } catch (err) {
    showToast('Failed to send reset email', 'error');
  }
}

// Section loading is now handled by onSectionChange() at the top of this file

// Check admin status on login
var originalLogin = window.login;
if (originalLogin) {
  window.login = async function(event) {
    await originalLogin(event);
    checkAdminStatus();
  };
}

// ==========================================
// Document Management Functions
// ==========================================

var currentDocumentId = null;
var signaturePadCanvas = null;
var signaturePadCtx = null;
var isDrawing = false;

async function loadDocuments() {
  if (!authToken) return;

  try {
    var response = await fetch(API_BASE + '/documents/my-documents', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      var documents = await response.json();
      renderDocuments(documents);
    }
  } catch (err) {
    console.error('Failed to load documents:', err);
  }
}

function renderDocuments(documents) {
  var allContainer = document.getElementById('allDocumentsList');
  var pendingContainer = document.getElementById('pendingDocumentsList');
  var signedContainer = document.getElementById('signedDocumentsList');

  if (!documents || documents.length === 0) {
    allContainer.innerHTML = '<div class="empty-state">No documents yet. Generate a new document to get started.</div>';
    pendingContainer.innerHTML = '<div class="empty-state">No documents pending signature</div>';
    signedContainer.innerHTML = '<div class="empty-state">No completed documents</div>';
    return;
  }

  var allDocs = documents;
  var pendingDocs = documents.filter(function(d) {
    return d.status === 'pending_signatures' || d.status === 'partially_signed' || d.status === 'draft';
  });
  var signedDocs = documents.filter(function(d) { return d.status === 'signed'; });

  allContainer.innerHTML = allDocs.length > 0 ? renderDocumentList(allDocs) : '<div class="empty-state">No documents yet</div>';
  pendingContainer.innerHTML = pendingDocs.length > 0 ? renderDocumentList(pendingDocs) : '<div class="empty-state">No documents pending signature</div>';
  signedContainer.innerHTML = signedDocs.length > 0 ? renderDocumentList(signedDocs) : '<div class="empty-state">No completed documents</div>';
}

function renderDocumentList(docs) {
  return docs.map(function(doc) {
    var statusClass = getDocStatusClass(doc.status);
    var docType = formatDocType(doc.documentType);
    var date = new Date(doc.createdAt).toLocaleDateString();
    return '<div class="document-card" onclick="viewDocument(\'' + doc._id + '\')">' +
      '<div class="doc-icon">📄</div>' +
      '<div class="doc-info">' +
      '<h4>' + (doc.title || docType) + '</h4>' +
      '<p>' + doc.province + ' - ' + docType + '</p>' +
      '<span class="doc-date">' + date + '</span>' +
      '</div>' +
      '<span class="doc-status ' + statusClass + '">' + formatStatus(doc.status) + '</span>' +
      '</div>';
  }).join('');
}

function getDocStatusClass(status) {
  switch(status) {
    case 'signed': return 'completed';
    case 'draft': return 'draft';
    case 'pending_signatures': return 'pending';
    case 'partially_signed': return 'pending';
    default: return '';
  }
}

function formatDocType(type) {
  if (!type) return 'Document';
  return type.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
}

function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
}

function showDocTab(tabName) {
  document.querySelectorAll('.doc-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.doc-tab-content').forEach(function(c) { c.classList.remove('active'); });
  event.target.classList.add('active');
  document.getElementById('doc-' + tabName).classList.add('active');
}

async function viewDocument(docId) {
  currentDocumentId = docId;

  try {
    var response = await fetch(API_BASE + '/documents/' + docId, {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      var doc = await response.json();
      displayDocument(doc);
      showModal('documentViewerModal');
    } else {
      showToast('Failed to load document', 'error');
    }
  } catch (err) {
    showToast('Failed to load document', 'error');
  }
}

function displayDocument(doc) {
  document.getElementById('docViewerTitle').textContent = doc.title || formatDocType(doc.documentType);
  document.getElementById('docViewerType').textContent = formatDocType(doc.documentType);
  document.getElementById('docViewerStatus').textContent = formatStatus(doc.status);
  document.getElementById('docViewerStatus').className = 'doc-status-badge ' + getDocStatusClass(doc.status);
  document.getElementById('docViewerProvince').textContent = doc.province;
  document.getElementById('docViewerFormNumber').textContent = doc.formNumber || '-';
  document.getElementById('docViewerCreated').textContent = new Date(doc.createdAt).toLocaleDateString();

  // Render signatures
  var sigContainer = document.getElementById('signaturesContainer');
  if (doc.requiredSignatures && doc.requiredSignatures.length > 0) {
    sigContainer.innerHTML = doc.requiredSignatures.map(function(req) {
      var signed = doc.signatures && doc.signatures.find(function(s) { return s.role === req.role; });
      if (signed) {
        return '<div class="signature-item signed">' +
          '<span class="sig-role">' + req.role + '</span>' +
          '<span class="sig-status">Signed by ' + signed.name + ' on ' + new Date(signed.signedAt).toLocaleDateString() + '</span>' +
          '</div>';
      } else {
        return '<div class="signature-item pending">' +
          '<span class="sig-role">' + req.role + '</span>' +
          '<span class="sig-status">Pending</span>' +
          '</div>';
      }
    }).join('');
  } else {
    sigContainer.innerHTML = '<p>No signatures required</p>';
  }

  // Show/hide action buttons
  var canSign = doc.status !== 'signed' && doc.requiredSignatures && doc.requiredSignatures.length > 0;
  var canSend = doc.status === 'draft' && doc.createdBy && doc.createdBy._id === currentUserId;
  document.getElementById('signDocBtn').style.display = canSign ? 'inline-block' : 'none';
  document.getElementById('sendForSigBtn').style.display = canSend ? 'inline-block' : 'none';
}

async function generateDocument(event) {
  event.preventDefault();

  var docData = {
    province: document.getElementById('docProvince').value,
    documentType: document.getElementById('docType').value,
    transactionId: document.getElementById('docTransaction').value || undefined,
    data: {
      title: document.getElementById('docTitle').value
    }
  };

  try {
    var response = await fetch(API_BASE + '/documents/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify(docData)
    });

    if (response.ok) {
      showToast('Document generated successfully', 'success');
      document.getElementById('generateDocForm').reset();
      loadDocuments();
      showDocTab('all');
      document.querySelector('.doc-tab').click();
    } else {
      var data = await response.json();
      showToast(data.error || 'Failed to generate document', 'error');
    }
  } catch (err) {
    showToast('Failed to generate document', 'error');
  }
}

function openSignatureModal() {
  showModal('signatureModal');
  initSignaturePad();
}

function initSignaturePad() {
  signaturePadCanvas = document.getElementById('signaturePad');
  signaturePadCtx = signaturePadCanvas.getContext('2d');

  signaturePadCtx.fillStyle = 'white';
  signaturePadCtx.fillRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
  signaturePadCtx.strokeStyle = '#000';
  signaturePadCtx.lineWidth = 2;
  signaturePadCtx.lineCap = 'round';

  signaturePadCanvas.onmousedown = startDrawing;
  signaturePadCanvas.onmousemove = draw;
  signaturePadCanvas.onmouseup = stopDrawing;
  signaturePadCanvas.onmouseout = stopDrawing;

  signaturePadCanvas.ontouchstart = function(e) {
    e.preventDefault();
    startDrawing(e.touches[0]);
  };
  signaturePadCanvas.ontouchmove = function(e) {
    e.preventDefault();
    draw(e.touches[0]);
  };
  signaturePadCanvas.ontouchend = stopDrawing;
}

function startDrawing(e) {
  isDrawing = true;
  var rect = signaturePadCanvas.getBoundingClientRect();
  signaturePadCtx.beginPath();
  signaturePadCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
  if (!isDrawing) return;
  var rect = signaturePadCanvas.getBoundingClientRect();
  signaturePadCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  signaturePadCtx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function clearSignaturePad() {
  if (signaturePadCtx) {
    signaturePadCtx.fillStyle = 'white';
    signaturePadCtx.fillRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
  }
}

async function submitSignature(event) {
  event.preventDefault();

  if (!currentDocumentId) return;

  var signatureData = signaturePadCanvas.toDataURL('image/png');

  var sigData = {
    role: document.getElementById('signatureRole').value,
    name: document.getElementById('signatureName').value,
    signatureData: signatureData
  };

  try {
    var response = await fetch(API_BASE + '/documents/' + currentDocumentId + '/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify(sigData)
    });

    if (response.ok) {
      showToast('Document signed successfully', 'success');
      closeModal('signatureModal');
      closeModal('documentViewerModal');
      loadDocuments();
    } else {
      var data = await response.json();
      showToast(data.error || 'Failed to sign document', 'error');
    }
  } catch (err) {
    showToast('Failed to sign document', 'error');
  }
}

async function sendForSignature() {
  showToast('Send for signature feature - Enter recipient email addresses', 'info');
}

function downloadDocument() {
  if (!currentDocumentId) return;
  window.open(API_BASE + '/documents/' + currentDocumentId + '/pdf', '_blank');
}

function loadProvinceForms() {
  var province = document.getElementById('docProvince').value;
  if (!province) return;
  // Form types are already in the select, province-specific info loaded on demand
}

// Documents section loading is handled by onSectionChange()

async function loadUserTransactionsForDocuments() {
  if (!authToken) return;

  try {
    var response = await fetch(API_BASE + '/transactions/my', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      var transactions = await response.json();
      var select = document.getElementById('docTransaction');
      if (select && transactions.length > 0) {
        select.innerHTML = '<option value="">None - Standalone Document</option>' +
          transactions.map(function(t) {
            var addr = t.property && t.property.address ? t.property.address.street : 'Transaction';
            return '<option value="' + t._id + '">' + addr + '</option>';
          }).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load transactions for documents:', err);
  }
}

// Show documents link when logged in
var prevOnLogin = window.onLoginSuccess;
window.onLoginSuccess = function() {
  if (prevOnLogin) prevOnLogin();
  var docsLink = document.getElementById('documentsLink');
  if (docsLink) docsLink.style.display = 'inline';
  var notifsLink = document.getElementById('notificationsLink');
  if (notifsLink) notifsLink.style.display = 'inline';
  loadNotifications();
};

// ==========================================
// Notification Center Functions
// ==========================================

var notificationsData = [];
var notificationPanelOpen = false;

function toggleNotifications() {
  var panel = document.getElementById('notificationPanel');
  notificationPanelOpen = !notificationPanelOpen;
  panel.style.display = notificationPanelOpen ? 'block' : 'none';

  if (notificationPanelOpen) {
    loadNotifications();
  }
}

function closeNotificationPanel() {
  var panel = document.getElementById('notificationPanel');
  panel.style.display = 'none';
  notificationPanelOpen = false;
}

async function loadNotifications() {
  if (!authToken) return;

  try {
    var response = await fetch(API_BASE + '/notifications', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      notificationsData = await response.json();
      renderNotifications();
      updateNotificationCount();
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
    // Use mock data for demo
    notificationsData = getMockNotifications();
    renderNotifications();
    updateNotificationCount();
  }
}

function getMockNotifications() {
  return [
    { _id: '1', type: 'offer', title: 'New Offer Received', message: 'You received an offer of $550,000 on 123 Main St', createdAt: new Date(), read: false },
    { _id: '2', type: 'message', title: 'New Message', message: 'John Smith sent you a message', createdAt: new Date(Date.now() - 3600000), read: false },
    { _id: '3', type: 'transaction', title: 'Transaction Update', message: 'Financing condition has been fulfilled', createdAt: new Date(Date.now() - 86400000), read: true },
    { _id: '4', type: 'document', title: 'Document Signed', message: 'Agreement of Purchase and Sale has been signed', createdAt: new Date(Date.now() - 172800000), read: true }
  ];
}

function renderNotifications() {
  var panelList = document.getElementById('notificationList');
  var fullList = document.getElementById('notificationsFullList');

  if (!notificationsData || notificationsData.length === 0) {
    var emptyHtml = '<div class="empty-state">No notifications</div>';
    if (panelList) panelList.innerHTML = emptyHtml;
    if (fullList) fullList.innerHTML = emptyHtml;
    return;
  }

  var recentNotifs = notificationsData.slice(0, 5);

  if (panelList) {
    panelList.innerHTML = recentNotifs.map(function(n) {
      return renderNotificationItem(n, true);
    }).join('');
  }

  if (fullList) {
    fullList.innerHTML = notificationsData.map(function(n) {
      return renderNotificationItem(n, false);
    }).join('');
  }
}

function renderNotificationItem(n, isCompact) {
  var icon = getNotificationIcon(n.type);
  var timeAgo = getTimeAgo(new Date(n.createdAt));
  var readClass = n.read ? 'read' : 'unread';

  if (isCompact) {
    return '<div class="notification-item ' + readClass + '" onclick="handleNotificationClick(\'' + n._id + '\', \'' + n.type + '\')">' +
      '<span class="notif-icon">' + icon + '</span>' +
      '<div class="notif-content">' +
      '<p class="notif-title">' + n.title + '</p>' +
      '<span class="notif-time">' + timeAgo + '</span>' +
      '</div>' +
      '</div>';
  } else {
    return '<div class="notification-item-full ' + readClass + '" onclick="handleNotificationClick(\'' + n._id + '\', \'' + n.type + '\')">' +
      '<span class="notif-icon">' + icon + '</span>' +
      '<div class="notif-content">' +
      '<p class="notif-title">' + n.title + '</p>' +
      '<p class="notif-message">' + n.message + '</p>' +
      '<span class="notif-time">' + timeAgo + '</span>' +
      '</div>' +
      '<button class="notif-dismiss" onclick="dismissNotification(event, \'' + n._id + '\')">×</button>' +
      '</div>';
  }
}

function getNotificationIcon(type) {
  switch(type) {
    case 'offer': return '📝';
    case 'message': return '💬';
    case 'transaction': return '🏠';
    case 'document': return '📄';
    case 'payment': return '💰';
    default: return '🔔';
  }
}

function getTimeAgo(date) {
  var seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
  return date.toLocaleDateString();
}

function updateNotificationCount() {
  var countEl = document.getElementById('notificationCount');
  var unreadCount = notificationsData.filter(function(n) { return !n.read; }).length;

  if (unreadCount > 0) {
    countEl.textContent = unreadCount > 9 ? '9+' : unreadCount;
    countEl.style.display = 'inline-block';
  } else {
    countEl.style.display = 'none';
  }
}

function handleNotificationClick(notifId, type) {
  markNotificationRead(notifId);
  closeNotificationPanel();

  switch(type) {
    case 'offer':
      showSection('dashboard');
      break;
    case 'message':
      showSection('messages');
      break;
    case 'transaction':
      showSection('transactions');
      break;
    case 'document':
      showSection('documents');
      break;
    default:
      break;
  }
}

async function markNotificationRead(notifId) {
  var notif = notificationsData.find(function(n) { return n._id === notifId; });
  if (notif) notif.read = true;
  updateNotificationCount();
  renderNotifications();

  try {
    await fetch(API_BASE + '/notifications/' + notifId + '/read', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
  }
}

async function markAllNotificationsRead() {
  notificationsData.forEach(function(n) { n.read = true; });
  updateNotificationCount();
  renderNotifications();

  try {
    await fetch(API_BASE + '/notifications/read-all', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    showToast('All notifications marked as read', 'success');
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err);
  }
}

async function dismissNotification(event, notifId) {
  event.stopPropagation();

  notificationsData = notificationsData.filter(function(n) { return n._id !== notifId; });
  updateNotificationCount();
  renderNotifications();

  try {
    await fetch(API_BASE + '/notifications/' + notifId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
  } catch (err) {
    console.error('Failed to dismiss notification:', err);
  }
}

async function clearAllNotifications() {
  notificationsData = [];
  updateNotificationCount();
  renderNotifications();

  try {
    await fetch(API_BASE + '/notifications/clear', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    showToast('All notifications cleared', 'success');
  } catch (err) {
    console.error('Failed to clear notifications:', err);
  }
}

function filterNotifications(filter) {
  document.querySelectorAll('.notif-filter').forEach(function(b) { b.classList.remove('active'); });
  event.target.classList.add('active');

  var filteredData = filter === 'all' ? notificationsData :
    notificationsData.filter(function(n) { return n.type === filter.slice(0, -1); });

  var fullList = document.getElementById('notificationsFullList');
  if (filteredData.length === 0) {
    fullList.innerHTML = '<div class="empty-state">No ' + filter + ' notifications</div>';
  } else {
    fullList.innerHTML = filteredData.map(function(n) {
      return renderNotificationItem(n, false);
    }).join('');
  }
}

// Close notification panel when clicking outside
document.addEventListener('click', function(event) {
  var panel = document.getElementById('notificationPanel');
  var bell = document.getElementById('notificationBell');

  if (notificationPanelOpen && panel && bell &&
      !panel.contains(event.target) && !bell.contains(event.target)) {
    closeNotificationPanel();
  }
});

// Poll for new notifications every 30 seconds
setInterval(function() {
  if (authToken) {
    loadNotifications();
  }
}, 30000);

// ==========================================
// Map Integration Functions
// ==========================================

var propertyMap = null;
var mapMarkers = [];
var currentSearchView = 'grid';

// Canadian city coordinates for demo/fallback
var canadianCities = {
  'Toronto': [43.6532, -79.3832],
  'Vancouver': [49.2827, -123.1207],
  'Montreal': [45.5017, -73.5673],
  'Calgary': [51.0447, -114.0719],
  'Edmonton': [53.5461, -113.4938],
  'Ottawa': [45.4215, -75.6972],
  'Winnipeg': [49.8951, -97.1384],
  'Quebec City': [46.8139, -71.2080],
  'Hamilton': [43.2557, -79.8711],
  'Victoria': [48.4284, -123.3656],
  'Halifax': [44.6488, -63.5752],
  'Regina': [50.4452, -104.6189],
  'Saskatoon': [52.1332, -106.6700],
  'St. John\'s': [47.5615, -52.7126],
  'Mississauga': [43.5890, -79.6441],
  'Brampton': [43.7315, -79.7624],
  'Markham': [43.8561, -79.3370],
  'Surrey': [49.1913, -122.8490],
  'Burnaby': [49.2488, -122.9805],
  'Richmond': [49.1666, -123.1336]
};

function setSearchView(view) {
  currentSearchView = view;

  var gridBtn = document.getElementById('gridViewBtn');
  var mapBtn = document.getElementById('mapViewBtn');
  var gridView = document.getElementById('searchGridView');
  var mapView = document.getElementById('searchMapView');

  if (view === 'grid') {
    gridBtn.classList.add('active');
    mapBtn.classList.remove('active');
    gridView.style.display = 'block';
    mapView.style.display = 'none';
  } else {
    gridBtn.classList.remove('active');
    mapBtn.classList.add('active');
    gridView.style.display = 'none';
    mapView.style.display = 'block';
    initializeMap();
  }
}

function initializeMap() {
  if (propertyMap) {
    propertyMap.invalidateSize();
    return;
  }

  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.warn('Leaflet not loaded yet');
    setTimeout(initializeMap, 500);
    return;
  }

  // Initialize map centered on Canada
  propertyMap = L.map('propertyMap').setView([56.1304, -106.3468], 4);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(propertyMap);

  // Load properties on map
  loadPropertiesOnMap();
}

async function loadPropertiesOnMap() {
  if (!propertyMap) return;

  // Clear existing markers
  mapMarkers.forEach(function(marker) {
    propertyMap.removeLayer(marker);
  });
  mapMarkers = [];

  try {
    var response = await fetch(API_BASE + '/properties');
    var properties = [];

    if (response.ok) {
      properties = await response.json();
    } else {
      // Use demo properties
      properties = getDemoMapProperties();
    }

    addPropertiesToMap(properties);
  } catch (err) {
    console.error('Failed to load properties for map:', err);
    addPropertiesToMap(getDemoMapProperties());
  }
}

function getDemoMapProperties() {
  var cities = Object.keys(canadianCities);
  return cities.slice(0, 10).map(function(city, index) {
    var coords = canadianCities[city];
    return {
      _id: 'demo-' + index,
      address: {
        street: (100 + index * 10) + ' ' + city + ' Street',
        city: city,
        province: getProvinceForCity(city)
      },
      askingPrice: 400000 + (index * 50000),
      bedrooms: 2 + (index % 3),
      bathrooms: 1 + (index % 2),
      squareFeet: 1000 + (index * 200),
      propertyType: ['detached', 'condo', 'townhouse'][index % 3],
      coordinates: { lat: coords[0], lng: coords[1] }
    };
  });
}

function getProvinceForCity(city) {
  var provinceMap = {
    'Toronto': 'ON', 'Mississauga': 'ON', 'Brampton': 'ON', 'Markham': 'ON', 'Hamilton': 'ON', 'Ottawa': 'ON',
    'Vancouver': 'BC', 'Victoria': 'BC', 'Surrey': 'BC', 'Burnaby': 'BC', 'Richmond': 'BC',
    'Montreal': 'QC', 'Quebec City': 'QC',
    'Calgary': 'AB', 'Edmonton': 'AB',
    'Winnipeg': 'MB',
    'Regina': 'SK', 'Saskatoon': 'SK',
    'Halifax': 'NS',
    'St. John\'s': 'NL'
  };
  return provinceMap[city] || 'ON';
}

function addPropertiesToMap(properties) {
  if (!propertyMap || !properties) return;

  var bounds = [];

  properties.forEach(function(property) {
    var coords = getPropertyCoordinates(property);
    if (!coords) return;

    var marker = L.marker([coords.lat, coords.lng]);

    var popupContent = createMapPopup(property);
    marker.bindPopup(popupContent, { maxWidth: 300 });

    marker.addTo(propertyMap);
    mapMarkers.push(marker);
    bounds.push([coords.lat, coords.lng]);
  });

  // Fit map to show all markers
  if (bounds.length > 0) {
    propertyMap.fitBounds(bounds, { padding: [50, 50] });
  }
}

function getPropertyCoordinates(property) {
  // If property has coordinates, use them
  if (property.coordinates && property.coordinates.lat && property.coordinates.lng) {
    return property.coordinates;
  }

  // Otherwise try to get from city name
  var city = property.address && property.address.city;
  if (city && canadianCities[city]) {
    var coords = canadianCities[city];
    // Add some randomness so properties in same city don't overlap
    return {
      lat: coords[0] + (Math.random() - 0.5) * 0.05,
      lng: coords[1] + (Math.random() - 0.5) * 0.05
    };
  }

  return null;
}

function createMapPopup(property) {
  var address = property.address ?
    property.address.street + ', ' + property.address.city :
    'Property';
  var price = property.askingPrice ?
    '$' + property.askingPrice.toLocaleString() :
    'Price TBD';
  var beds = property.bedrooms || '-';
  var baths = property.bathrooms || '-';
  var sqft = property.squareFeet ?
    property.squareFeet.toLocaleString() + ' sqft' :
    '-';

  return '<div class="map-popup">' +
    '<h4>' + address + '</h4>' +
    '<p class="popup-price">' + price + '</p>' +
    '<p class="popup-details">' + beds + ' bed | ' + baths + ' bath | ' + sqft + '</p>' +
    '<button class="btn btn-primary btn-sm" onclick="viewPropertyFromMap(\'' + property._id + '\')">View Details</button>' +
    '</div>';
}

function viewPropertyFromMap(propertyId) {
  if (typeof viewProperty === 'function') {
    viewProperty(propertyId);
  } else {
    showToast('Property details not available', 'info');
  }
}

// Update map when search is performed
var originalSearchProperties = window.searchProperties;
if (originalSearchProperties) {
  window.searchProperties = async function() {
    await originalSearchProperties();
    if (currentSearchView === 'map') {
      loadPropertiesOnMap();
    }
  };
}

// ==========================================
// Analytics Dashboard Functions
// ==========================================

var analyticsData = null;

async function loadAnalytics() {
  if (!authToken) return;

  try {
    var days = document.getElementById('analyticsDateRange').value || 30;
    var response = await fetch(API_BASE + '/analytics?days=' + days, {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      analyticsData = await response.json();
      renderAnalytics();
    } else {
      // Use demo data
      analyticsData = getDemoAnalytics();
      renderAnalytics();
    }
  } catch (err) {
    console.error('Failed to load analytics:', err);
    analyticsData = getDemoAnalytics();
    renderAnalytics();
  }
}

function getDemoAnalytics() {
  return {
    summary: {
      totalViews: 1247,
      viewsChange: 12,
      totalInquiries: 23,
      inquiriesChange: 8,
      totalOffers: 5,
      offersChange: 25,
      totalFavorites: 89,
      favoritesChange: 15
    },
    topProperties: [
      { id: 1, address: '123 Toronto St, Toronto', views: 342, inquiries: 8 },
      { id: 2, address: '456 Vancouver Ave, Vancouver', views: 278, inquiries: 5 },
      { id: 3, address: '789 Calgary Blvd, Calgary', views: 201, inquiries: 4 }
    ],
    recentActivity: [
      { type: 'view', message: 'Someone viewed 123 Toronto St', time: '2 hours ago' },
      { type: 'inquiry', message: 'New inquiry on 456 Vancouver Ave', time: '5 hours ago' },
      { type: 'offer', message: 'Offer received for 789 Calgary Blvd', time: '1 day ago' },
      { type: 'favorite', message: '123 Toronto St was saved', time: '2 days ago' }
    ]
  };
}

function renderAnalytics() {
  if (!analyticsData) return;

  var summary = analyticsData.summary;

  // Update summary stats
  document.getElementById('totalViews').textContent = summary.totalViews.toLocaleString();
  document.getElementById('totalInquiries').textContent = summary.totalInquiries.toLocaleString();
  document.getElementById('totalOffers').textContent = summary.totalOffers.toLocaleString();
  document.getElementById('totalFavorites').textContent = summary.totalFavorites.toLocaleString();

  // Update change percentages
  updateChangeIndicator('viewsChange', summary.viewsChange);
  updateChangeIndicator('inquiriesChange', summary.inquiriesChange);
  updateChangeIndicator('offersChange', summary.offersChange);
  updateChangeIndicator('favoritesChange', summary.favoritesChange);

  // Render top properties
  renderTopProperties(analyticsData.topProperties);

  // Render activity timeline
  renderActivityTimeline(analyticsData.recentActivity);
}

function updateChangeIndicator(elementId, change) {
  var element = document.getElementById(elementId);
  if (!element) return;

  var isPositive = change >= 0;
  element.textContent = (isPositive ? '+' : '') + change + '%';
  element.className = 'stat-change ' + (isPositive ? 'positive' : 'negative');
}

function renderTopProperties(properties) {
  var container = document.getElementById('topPropertiesList');
  if (!container) return;

  if (!properties || properties.length === 0) {
    container.innerHTML = '<div class="empty-state">No property data available</div>';
    return;
  }

  container.innerHTML = properties.map(function(prop, index) {
    return '<div class="top-property-item">' +
      '<span class="property-rank">#' + (index + 1) + '</span>' +
      '<div class="property-info">' +
      '<p class="property-address">' + prop.address + '</p>' +
      '<span class="property-stats">' + prop.views + ' views, ' + prop.inquiries + ' inquiries</span>' +
      '</div>' +
      '</div>';
  }).join('');
}

function renderActivityTimeline(activities) {
  var container = document.getElementById('activityTimeline');
  if (!container) return;

  if (!activities || activities.length === 0) {
    container.innerHTML = '<div class="empty-state">No recent activity</div>';
    return;
  }

  container.innerHTML = activities.map(function(activity) {
    var icon = getActivityIcon(activity.type);
    return '<div class="activity-item">' +
      '<span class="activity-icon">' + icon + '</span>' +
      '<div class="activity-content">' +
      '<p>' + activity.message + '</p>' +
      '<span class="activity-time">' + activity.time + '</span>' +
      '</div>' +
      '</div>';
  }).join('');
}

function getActivityIcon(type) {
  switch(type) {
    case 'view': return '👁️';
    case 'inquiry': return '📧';
    case 'offer': return '💰';
    case 'favorite': return '❤️';
    default: return '📌';
  }
}

function updateAnalytics() {
  loadAnalytics();
}

// Add analytics link on login
var prevOnLogin2 = window.onLoginSuccess;
window.onLoginSuccess = function() {
  if (prevOnLogin2) prevOnLogin2();
  var analyticsLink = document.getElementById('analyticsLink');
  if (analyticsLink) analyticsLink.style.display = 'inline';
};

// Analytics and AI-tools section loading is handled by onSectionChange()

// ==========================================
// AI Tools - Mortgage & Lawyer Finder
// ==========================================

var AI_MONTHLY_LIMIT = 5; // Free tier limit (synced with server)
var aiUsageCache = { count: 0, limit: AI_MONTHLY_LIMIT, canUse: true, isPremium: false };

// Check if user is logged in for AI tools
function isLoggedInForAI() {
  return !!authToken;
}

// Fetch AI usage from server
async function fetchAIUsage() {
  if (!isLoggedInForAI()) {
    return { count: 0, limit: AI_MONTHLY_LIMIT, canUse: false, isPremium: false };
  }

  try {
    var response = await fetch(API_BASE + '/ai/usage', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });

    if (response.ok) {
      var data = await response.json();
      aiUsageCache = data;
      return data;
    }
  } catch (err) {
    console.error('Failed to fetch AI usage:', err);
  }

  return aiUsageCache;
}

// Increment AI usage on server
async function incrementAIUsageOnServer() {
  if (!isLoggedInForAI()) {
    return { success: false, error: 'Not logged in' };
  }

  try {
    var response = await fetch(API_BASE + '/ai/use', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + authToken,
        'Content-Type': 'application/json'
      }
    });

    var data = await response.json();

    if (response.ok) {
      aiUsageCache = data;
      updateAIUsageDisplay(data);
      return { success: true, data: data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (err) {
    console.error('Failed to increment AI usage:', err);
    return { success: false, error: 'Network error' };
  }
}

// Check if user can use AI tools (server check)
async function canUseAITools() {
  if (!isLoggedInForAI()) {
    showToast('Please log in to use AI tools', 'error');
    return false;
  }

  var usage = await fetchAIUsage();
  return usage.canUse;
}

// Load AI tools usage from server
async function loadAIToolsUsage() {
  if (!isLoggedInForAI()) {
    // Show login required message
    var container = document.querySelector('.ai-tools-container');
    if (container) {
      var loginBanner = document.createElement('div');
      loginBanner.className = 'ai-login-required';
      loginBanner.innerHTML = '<h3>Account Required</h3><p>Please <a href="#" onclick="showModal(\'loginModal\'); return false;">log in</a> or <a href="#" onclick="showModal(\'registerModal\'); return false;">create an account</a> to use AI-powered tools.</p>';
      container.insertBefore(loginBanner, container.firstChild);
    }
    return;
  }

  var usage = await fetchAIUsage();
  updateAIUsageDisplay(usage);
}

function updateAIUsageDisplay(usage) {
  if (!usage) usage = aiUsageCache;

  var countEl = document.getElementById('aiUsageCount');
  var limitEl = document.getElementById('aiUsageLimit');
  var fillEl = document.getElementById('aiUsageFill');
  var upgradeBanner = document.getElementById('aiUpgradeBanner');

  var limit = usage.isPremium ? 'Unlimited' : (usage.limit || AI_MONTHLY_LIMIT);
  var count = usage.count || 0;

  if (countEl) countEl.textContent = count;
  if (limitEl) limitEl.textContent = limit;

  if (fillEl) {
    if (usage.isPremium) {
      fillEl.style.width = '100%';
      fillEl.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
    } else {
      fillEl.style.width = Math.min((count / limit) * 100, 100) + '%';
    }
  }

  if (upgradeBanner) {
    upgradeBanner.style.display = (!usage.isPremium && !usage.canUse) ? 'block' : 'none';
  }

  // Disable buttons if limit reached (and not premium)
  var mortgageBtn = document.getElementById('mortgageSearchBtn');
  var lawyerBtn = document.getElementById('lawyerSearchBtn');

  if (!usage.canUse) {
    if (mortgageBtn) mortgageBtn.disabled = true;
    if (lawyerBtn) lawyerBtn.disabled = true;
  } else {
    if (mortgageBtn) mortgageBtn.disabled = false;
    if (lawyerBtn) lawyerBtn.disabled = false;
  }
}

async function findMortgageRates(event) {
  event.preventDefault();

  // Check login first
  if (!isLoggedInForAI()) {
    showToast('Please log in to use AI tools', 'error');
    showModal('loginModal');
    return;
  }

  // Check usage limit with server
  var canUse = await canUseAITools();
  if (!canUse) {
    showToast('You have reached your monthly AI search limit. Please upgrade for more searches.', 'error');
    return;
  }

  var province = document.getElementById('mortgageProvince').value;
  var city = document.getElementById('mortgageCity').value;
  var propertyValue = parseFloat(document.getElementById('mortgagePropertyValue').value);
  var downPayment = parseFloat(document.getElementById('mortgageDownPayment').value);
  var mortgageType = document.getElementById('mortgageType').value;
  var term = document.getElementById('mortgageTerm').value;
  var firstTimeBuyer = document.querySelector('input[name="firstTimeBuyer"]:checked').value === 'yes';

  var btn = document.getElementById('mortgageSearchBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Searching...';

  // Simulate AI processing delay
  await new Promise(function(resolve) { setTimeout(resolve, 2000); });

  // Increment usage on server
  var usageResult = await incrementAIUsageOnServer();
  if (!usageResult.success) {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔍</span> Find Best Rates';
    showToast(usageResult.error || 'Failed to process request', 'error');
    return;
  }

  // Generate mock results based on inputs
  var mortgageAmount = propertyValue - downPayment;
  var ltv = (mortgageAmount / propertyValue) * 100;
  var needsCMHC = downPayment < (propertyValue * 0.2);

  var results = generateMortgageResults(province, city, mortgageAmount, mortgageType, term, firstTimeBuyer, needsCMHC);

  displayMortgageResults(results, mortgageAmount, needsCMHC);

  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">🔍</span> Find Best Rates';
}

function generateMortgageResults(province, city, amount, type, term, firstTime, needsCMHC) {
  var baseRate = 4.5; // Base rate
  var results = [];

  // Major banks
  var banks = [
    { name: 'TD Canada Trust', type: 'Bank', logo: '🏦' },
    { name: 'RBC Royal Bank', type: 'Bank', logo: '🏦' },
    { name: 'BMO Bank of Montreal', type: 'Bank', logo: '🏦' },
    { name: 'Scotiabank', type: 'Bank', logo: '🏦' },
    { name: 'CIBC', type: 'Bank', logo: '🏦' },
    { name: 'National Bank', type: 'Bank', logo: '🏦' },
    { name: 'Meridian Credit Union', type: 'Credit Union', logo: '🏛️' },
    { name: 'MCAP', type: 'Mortgage Company', logo: '📋' },
    { name: 'First National', type: 'Mortgage Company', logo: '📋' },
    { name: 'Butler Mortgage', type: 'Broker', logo: '👤' }
  ];

  banks.forEach(function(bank, index) {
    var rateVariation = (Math.random() * 0.8 - 0.4).toFixed(2);
    var fixedRate = (baseRate + parseFloat(rateVariation)).toFixed(2);
    var variableRate = (baseRate - 0.5 + parseFloat(rateVariation)).toFixed(2);

    // Credit unions and brokers often have better rates
    if (bank.type === 'Credit Union' || bank.type === 'Broker') {
      fixedRate = (parseFloat(fixedRate) - 0.15).toFixed(2);
      variableRate = (parseFloat(variableRate) - 0.15).toFixed(2);
    }

    // First time buyer discount
    if (firstTime && index < 5) {
      fixedRate = (parseFloat(fixedRate) - 0.1).toFixed(2);
    }

    var monthlyPayment = calculateMonthlyPayment(amount, parseFloat(fixedRate), parseInt(term) * 12);

    if (type === 'fixed' || type === 'both') {
      results.push({
        lender: bank.name,
        type: bank.type,
        logo: bank.logo,
        rateType: 'Fixed',
        rate: fixedRate,
        term: term + ' Year',
        monthlyPayment: monthlyPayment,
        features: getRandomFeatures()
      });
    }

    if (type === 'variable' || type === 'both') {
      results.push({
        lender: bank.name,
        type: bank.type,
        logo: bank.logo,
        rateType: 'Variable',
        rate: variableRate,
        term: term + ' Year',
        monthlyPayment: calculateMonthlyPayment(amount, parseFloat(variableRate), parseInt(term) * 12),
        features: getRandomFeatures()
      });
    }
  });

  // Sort by rate
  results.sort(function(a, b) { return parseFloat(a.rate) - parseFloat(b.rate); });

  return results.slice(0, 8); // Return top 8
}

function calculateMonthlyPayment(principal, annualRate, months) {
  var monthlyRate = annualRate / 100 / 12;
  var payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(payment);
}

function getRandomFeatures() {
  var allFeatures = [
    'Pre-approval available',
    'No prepayment penalty',
    '20% annual prepayment',
    'Portable mortgage',
    'Rate hold 120 days',
    'Online application',
    'Cash back option',
    'Skip-a-payment option'
  ];

  var count = Math.floor(Math.random() * 2) + 2;
  var features = [];

  for (var i = 0; i < count; i++) {
    var idx = Math.floor(Math.random() * allFeatures.length);
    if (features.indexOf(allFeatures[idx]) === -1) {
      features.push(allFeatures[idx]);
    }
  }

  return features;
}

function displayMortgageResults(results, amount, needsCMHC) {
  var container = document.getElementById('mortgageResultsList');
  var resultsDiv = document.getElementById('mortgageResults');

  var cmhcNotice = '';
  if (needsCMHC) {
    cmhcNotice = '<div class="cmhc-notice">⚠️ With less than 20% down payment, CMHC insurance will be required (adds 2.8-4% to mortgage amount)</div>';
  }

  var html = cmhcNotice + results.map(function(r, idx) {
    return '<div class="result-card ' + (idx === 0 ? 'best-rate' : '') + '">' +
      (idx === 0 ? '<span class="best-badge">Best Rate</span>' : '') +
      '<div class="result-header">' +
        '<span class="result-logo">' + r.logo + '</span>' +
        '<div class="result-lender">' +
          '<strong>' + r.lender + '</strong>' +
          '<span class="lender-type">' + r.type + '</span>' +
        '</div>' +
        '<div class="result-rate">' +
          '<span class="rate-value">' + r.rate + '%</span>' +
          '<span class="rate-type">' + r.rateType + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="result-details">' +
        '<div class="detail-item"><span>Term:</span> ' + r.term + '</div>' +
        '<div class="detail-item"><span>Monthly:</span> $' + r.monthlyPayment.toLocaleString() + '</div>' +
      '</div>' +
      '<div class="result-features">' +
        r.features.map(function(f) { return '<span class="feature-tag">' + f + '</span>'; }).join('') +
      '</div>' +
      '<button class="btn btn-outline btn-sm" onclick="contactLender(\'' + r.lender + '\')">Contact Lender</button>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
  resultsDiv.style.display = 'block';
}

async function findLawyers(event) {
  event.preventDefault();

  // Check login first
  if (!isLoggedInForAI()) {
    showToast('Please log in to use AI tools', 'error');
    showModal('loginModal');
    return;
  }

  // Check usage limit with server
  var canUse = await canUseAITools();
  if (!canUse) {
    showToast('You have reached your monthly AI search limit. Please upgrade for more searches.', 'error');
    return;
  }

  var province = document.getElementById('lawyerProvince').value;
  var city = document.getElementById('lawyerCity').value;
  var transactionType = document.getElementById('transactionType').value;
  var propertyType = document.getElementById('lawyerPropertyType').value;
  var language = document.getElementById('lawyerLanguage').value;

  var btn = document.getElementById('lawyerSearchBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Searching...';

  // Simulate AI processing delay
  await new Promise(function(resolve) { setTimeout(resolve, 2000); });

  // Increment usage on server
  var usageResult = await incrementAIUsageOnServer();
  if (!usageResult.success) {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔍</span> Find Lawyers';
    showToast(usageResult.error || 'Failed to process request', 'error');
    return;
  }

  // Generate mock results
  var results = generateLawyerResults(province, city, transactionType, propertyType, language);

  displayLawyerResults(results);

  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">🔍</span> Find Lawyers';
}

function generateLawyerResults(province, city, transactionType, propertyType, language) {
  var provinceNames = {
    'ON': 'Ontario', 'BC': 'British Columbia', 'AB': 'Alberta', 'QC': 'Quebec',
    'MB': 'Manitoba', 'SK': 'Saskatchewan', 'NS': 'Nova Scotia', 'NB': 'New Brunswick',
    'PE': 'Prince Edward Island', 'NL': 'Newfoundland and Labrador'
  };

  var firstNames = ['Sarah', 'Michael', 'Jennifer', 'David', 'Lisa', 'Robert', 'Amanda', 'James', 'Michelle', 'Christopher'];
  var lastNames = ['Chen', 'Smith', 'Patel', 'Williams', 'Brown', 'Singh', 'Martin', 'Thompson', 'Anderson', 'Lee'];

  var firms = [
    ' Law Professional Corporation',
    ' & Associates',
    ' Legal Services',
    ' Law Office',
    ' Real Estate Law'
  ];

  var results = [];

  for (var i = 0; i < 6; i++) {
    var firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    var lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    var firm = lastName + firms[Math.floor(Math.random() * firms.length)];

    var baseFee = propertyType === 'commercial' ? 2500 : propertyType === 'land' ? 1200 : 1500;
    var feeVariation = Math.floor(Math.random() * 800) - 400;
    var fee = baseFee + feeVariation;

    var rating = (4 + Math.random()).toFixed(1);
    var reviews = Math.floor(Math.random() * 150) + 10;
    var yearsExp = Math.floor(Math.random() * 25) + 3;

    var languages = ['English'];
    if (province === 'QC' || language === 'french' || language === 'both') {
      languages.push('French');
    }
    if (Math.random() > 0.7) {
      var otherLangs = ['Mandarin', 'Cantonese', 'Punjabi', 'Hindi', 'Spanish', 'Arabic'];
      languages.push(otherLangs[Math.floor(Math.random() * otherLangs.length)]);
    }

    var specialties = ['Residential Real Estate'];
    if (propertyType === 'commercial') specialties.push('Commercial Transactions');
    if (Math.random() > 0.5) specialties.push('Mortgage Refinancing');
    if (Math.random() > 0.7) specialties.push('Title Insurance');

    results.push({
      name: firstName + ' ' + lastName,
      firm: firm,
      city: city,
      province: provinceNames[province] || province,
      fee: fee,
      rating: rating,
      reviews: reviews,
      yearsExperience: yearsExp,
      languages: languages,
      specialties: specialties,
      phone: '(416) ' + Math.floor(Math.random() * 900 + 100) + '-' + Math.floor(Math.random() * 9000 + 1000),
      email: firstName.toLowerCase() + '@' + lastName.toLowerCase() + 'law.ca'
    });
  }

  // Sort by rating
  results.sort(function(a, b) { return parseFloat(b.rating) - parseFloat(a.rating); });

  return results;
}

function displayLawyerResults(results) {
  var container = document.getElementById('lawyerResultsList');
  var resultsDiv = document.getElementById('lawyerResults');

  var html = results.map(function(r, idx) {
    return '<div class="result-card lawyer-card ' + (idx === 0 ? 'top-rated' : '') + '">' +
      (idx === 0 ? '<span class="top-badge">Top Rated</span>' : '') +
      '<div class="lawyer-header">' +
        '<div class="lawyer-avatar">⚖️</div>' +
        '<div class="lawyer-info">' +
          '<strong>' + r.name + '</strong>' +
          '<span class="firm-name">' + r.firm + '</span>' +
          '<span class="location">' + r.city + ', ' + r.province + '</span>' +
        '</div>' +
        '<div class="lawyer-rating">' +
          '<span class="rating-stars">★ ' + r.rating + '</span>' +
          '<span class="review-count">(' + r.reviews + ' reviews)</span>' +
        '</div>' +
      '</div>' +
      '<div class="lawyer-details">' +
        '<div class="detail-row">' +
          '<span class="detail-label">Experience:</span>' +
          '<span class="detail-value">' + r.yearsExperience + ' years</span>' +
        '</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">Est. Fee:</span>' +
          '<span class="detail-value fee-value">$' + r.fee.toLocaleString() + ' - $' + (r.fee + 500).toLocaleString() + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
          '<span class="detail-label">Languages:</span>' +
          '<span class="detail-value">' + r.languages.join(', ') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="lawyer-specialties">' +
        r.specialties.map(function(s) { return '<span class="specialty-tag">' + s + '</span>'; }).join('') +
      '</div>' +
      '<div class="lawyer-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="copyToClipboard(\'' + r.phone + '\')">📞 ' + r.phone + '</button>' +
        '<button class="btn btn-primary btn-sm" onclick="emailLawyer(\'' + r.email + '\')">✉️ Contact</button>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
  resultsDiv.style.display = 'block';
}

function contactLender(lenderName) {
  showToast('Opening contact form for ' + lenderName + '...', 'info');
  // In production, this would open a contact modal or redirect to lender site
}

function emailLawyer(email) {
  window.location.href = 'mailto:' + email + '?subject=Real%20Estate%20Legal%20Services%20Inquiry';
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() {
    showToast('Phone number copied to clipboard!', 'success');
  }).catch(function() {
    showToast('Phone: ' + text, 'info');
  });
}

// ==========================================
// AI Property Description Generator
// ==========================================

async function generateDescription(event) {
  event.preventDefault();

  if (!isLoggedInForAI()) {
    showToast('Please log in to use AI tools', 'error');
    showModal('loginModal');
    return;
  }

  var canUse = await canUseAITools();
  if (!canUse) {
    showToast('You have reached your monthly AI limit. Please upgrade for more uses.', 'error');
    return;
  }

  var propertyType = document.getElementById('descPropertyType').value;
  var bedrooms = document.getElementById('descBedrooms').value;
  var bathrooms = document.getElementById('descBathrooms').value;
  var sqft = document.getElementById('descSqft').value;
  var features = document.getElementById('descFeatures').value;
  var location = document.getElementById('descLocation').value;
  var style = document.getElementById('descStyle').value;

  var btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';

  try {
    var response = await fetch(API_BASE + '/ai/generate-description', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        propertyType: propertyType,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        squareFeet: sqft,
        features: features,
        location: location,
        style: style
      })
    });

    var data = await response.json();

    if (response.ok) {
      document.getElementById('generatedDescription').textContent = data.description;
      document.getElementById('descriptionResult').style.display = 'block';
      updateAIUsageDisplay(data.usage);
      showToast('Description generated successfully!', 'success');
    } else {
      showToast(data.error || 'Failed to generate description', 'error');
    }
  } catch (err) {
    console.error('Description generation error:', err);
    showToast('Network error. Please try again.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">✨</span> Generate Description';
}

function copyDescription() {
  var text = document.getElementById('generatedDescription').textContent;
  navigator.clipboard.writeText(text).then(function() {
    showToast('Description copied to clipboard!', 'success');
  }).catch(function() {
    showToast('Failed to copy. Please select and copy manually.', 'error');
  });
}

async function regenerateDescription() {
  var form = document.getElementById('descriptionForm');
  if (form) {
    var event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
  }
}

// ==========================================
// AI Price Suggestion Tool
// ==========================================

async function suggestPrice(event) {
  event.preventDefault();

  if (!isLoggedInForAI()) {
    showToast('Please log in to use AI tools', 'error');
    showModal('loginModal');
    return;
  }

  var canUse = await canUseAITools();
  if (!canUse) {
    showToast('You have reached your monthly AI limit. Please upgrade for more uses.', 'error');
    return;
  }

  var propertyType = document.getElementById('pricePropertyType').value;
  var bedrooms = document.getElementById('priceBedrooms').value;
  var bathrooms = document.getElementById('priceBathrooms').value;
  var sqft = document.getElementById('priceSqft').value;
  var province = document.getElementById('priceProvince').value;
  var city = document.getElementById('priceCity').value;
  var condition = document.getElementById('priceCondition').value;
  var yearBuilt = document.getElementById('priceYearBuilt').value;

  var btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzing...';

  try {
    var response = await fetch(API_BASE + '/ai/suggest-price', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        propertyType: propertyType,
        bedrooms: parseInt(bedrooms),
        bathrooms: parseFloat(bathrooms),
        squareFeet: parseInt(sqft),
        province: province,
        city: city,
        condition: condition,
        yearBuilt: parseInt(yearBuilt)
      })
    });

    var data = await response.json();

    if (response.ok) {
      document.getElementById('suggestedPrice').textContent = '$' + data.suggestedPrice.toLocaleString();
      document.getElementById('priceRangeLow').textContent = '$' + data.priceRange.low.toLocaleString();
      document.getElementById('priceRangeHigh').textContent = '$' + data.priceRange.high.toLocaleString();
      document.getElementById('pricePerSqftResult').textContent = '$' + data.pricePerSqft.toLocaleString();
      document.getElementById('marketTrendResult').textContent = data.marketTrend;
      document.getElementById('confidenceLevel').textContent = data.confidence;

      // Display comparables
      var compHtml = data.comparables.map(function(c) {
        return '<div class="comparable-item">' +
          '<div class="comp-address">' + c.address + '</div>' +
          '<div class="comp-details">' + c.bedrooms + ' bed, ' + c.bathrooms + ' bath, ' + c.squareFeet.toLocaleString() + ' sqft</div>' +
          '<div class="comp-price">Sold: $' + c.soldPrice.toLocaleString() + ' (' + c.daysAgo + ' days ago)</div>' +
        '</div>';
      }).join('');
      document.getElementById('priceComparables').innerHTML = compHtml;

      document.getElementById('priceResult').style.display = 'block';
      updateAIUsageDisplay(data.usage);
      showToast('Price analysis complete!', 'success');
    } else {
      showToast(data.error || 'Failed to analyze price', 'error');
    }
  } catch (err) {
    console.error('Price suggestion error:', err);
    showToast('Network error. Please try again.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">💰</span> Get Price Suggestion';
}

// ==========================================
// AI Listing Title Generator
// ==========================================

async function generateTitles(event) {
  event.preventDefault();

  if (!isLoggedInForAI()) {
    showToast('Please log in to use AI tools', 'error');
    showModal('loginModal');
    return;
  }

  var canUse = await canUseAITools();
  if (!canUse) {
    showToast('You have reached your monthly AI limit. Please upgrade for more uses.', 'error');
    return;
  }

  var propertyType = document.getElementById('titlePropertyType').value;
  var keyFeatures = document.getElementById('titleKeyFeatures').value;
  var location = document.getElementById('titleLocation').value;
  var targetBuyer = document.getElementById('titleTargetBuyer').value;

  var btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';

  try {
    var response = await fetch(API_BASE + '/ai/generate-title', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        propertyType: propertyType,
        keyFeatures: keyFeatures,
        location: location,
        targetBuyer: targetBuyer
      })
    });

    var data = await response.json();

    if (response.ok) {
      var titlesHtml = data.titles.map(function(title, idx) {
        return '<div class="title-option">' +
          '<span class="title-number">' + (idx + 1) + '</span>' +
          '<span class="title-text">' + title + '</span>' +
          '<button class="btn btn-sm btn-outline" onclick="copyTitleText(\'' + title.replace(/'/g, "\\'") + '\')">Copy</button>' +
        '</div>';
      }).join('');

      document.getElementById('generatedTitles').innerHTML = titlesHtml;
      document.getElementById('titlesResult').style.display = 'block';
      updateAIUsageDisplay(data.usage);
      showToast('Titles generated successfully!', 'success');
    } else {
      showToast(data.error || 'Failed to generate titles', 'error');
    }
  } catch (err) {
    console.error('Title generation error:', err);
    showToast('Network error. Please try again.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">📝</span> Generate Titles';
}

function copyTitleText(title) {
  navigator.clipboard.writeText(title).then(function() {
    showToast('Title copied to clipboard!', 'success');
  }).catch(function() {
    showToast('Failed to copy. Please select and copy manually.', 'error');
  });
}

// ==========================================
// AI Neighbourhood Insights
// ==========================================

async function getNeighbourhoodInsights(event) {
  event.preventDefault();

  if (!isLoggedInForAI()) {
    showToast('Please log in to use AI tools', 'error');
    showModal('loginModal');
    return;
  }

  var canUse = await canUseAITools();
  if (!canUse) {
    showToast('You have reached your monthly AI limit. Please upgrade for more uses.', 'error');
    return;
  }

  var province = document.getElementById('insightsProvince').value;
  var city = document.getElementById('insightsCity').value;
  var neighbourhood = document.getElementById('insightsNeighbourhood').value;

  var btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzing...';

  try {
    var response = await fetch(API_BASE + '/ai/neighbourhood-insights', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        province: province,
        city: city,
        neighbourhood: neighbourhood
      })
    });

    var data = await response.json();

    if (response.ok) {
      var insights = data.insights;

      // Update the insights display
      document.getElementById('insightsOverview').textContent = insights.overview;
      document.getElementById('insightsAvgPrice').textContent = '$' + insights.demographics.averageHomePrice.toLocaleString();
      document.getElementById('insightsPopulation').textContent = insights.demographics.population.toLocaleString();
      document.getElementById('insightsMedianIncome').textContent = '$' + insights.demographics.medianIncome.toLocaleString();

      // Amenities
      var amenitiesHtml = insights.amenities.map(function(a) {
        return '<span class="amenity-tag">' + a + '</span>';
      }).join('');
      document.getElementById('insightsAmenities').innerHTML = amenitiesHtml;

      // Schools
      var schoolsHtml = insights.schools.map(function(s) {
        return '<div class="school-item">' +
          '<span class="school-name">' + s.name + '</span>' +
          '<span class="school-rating">Rating: ' + s.rating + '/10</span>' +
        '</div>';
      }).join('');
      document.getElementById('insightsSchools').innerHTML = schoolsHtml;

      // Transportation
      var transitHtml = insights.transportation.map(function(t) {
        return '<span class="transit-tag">' + t + '</span>';
      }).join('');
      document.getElementById('insightsTransit').innerHTML = transitHtml;

      // Scores
      document.getElementById('walkScore').textContent = insights.scores.walkScore;
      document.getElementById('transitScore').textContent = insights.scores.transitScore;
      document.getElementById('bikeScore').textContent = insights.scores.bikeScore;

      document.getElementById('insightsResult').style.display = 'block';
      updateAIUsageDisplay(data.usage);
      showToast('Neighbourhood analysis complete!', 'success');
    } else {
      showToast(data.error || 'Failed to get insights', 'error');
    }
  } catch (err) {
    console.error('Neighbourhood insights error:', err);
    showToast('Network error. Please try again.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">🏘️</span> Get Insights';
}

function showUpgradeModal() {
  showToast('Premium upgrade coming soon! Contact support for early access.', 'info');
}

// Add AI Tools link on login
var prevOnLogin3 = window.onLoginSuccess;
window.onLoginSuccess = function() {
  if (prevOnLogin3) prevOnLogin3();
  var aiToolsLink = document.getElementById('aiToolsLink');
  if (aiToolsLink) aiToolsLink.style.display = 'inline';
};

// ==========================================
// Savings Calculator Functions
// ==========================================

function updateSavingsValue(value) {
  document.getElementById('savingsPropertyValue').value = value;
  calculateSavings();
}

function calculateSavings() {
  var propertyValue = parseFloat(document.getElementById('savingsPropertyValue').value) || 500000;
  var transactionType = document.querySelector('input[name="transactionType"]:checked');
  var type = transactionType ? transactionType.value : 'selling';

  // Update slider
  var slider = document.getElementById('savingsPropertySlider');
  if (slider) slider.value = propertyValue;

  var traditionalRate = 0.05; // 5% traditional
  var ourRate = 0.02; // 2% (1% buyer + 1% seller)

  var multiplier = 1;
  if (type === 'both') {
    multiplier = 2;
  }

  var traditionalCost = propertyValue * traditionalRate * multiplier;
  var ourCost = propertyValue * ourRate * multiplier;
  var savings = traditionalCost - ourCost;

  document.getElementById('traditionalCost').textContent = '$' + traditionalCost.toLocaleString();
  document.getElementById('ourCost').textContent = '$' + ourCost.toLocaleString();
  document.getElementById('totalSavings').textContent = '$' + savings.toLocaleString();
}

// Initialize savings calculator on page load
document.addEventListener('DOMContentLoaded', function() {
  calculateSavings();
});

// ==========================================
// Home Valuation Functions
// ==========================================

// Sample market data by province/city (in production, this would come from an API)
var marketData = {
  'ON': {
    'Toronto': { avgPrice: 1050000, pricePerSqft: 750, trend: 2.5, daysOnMarket: 15 },
    'Ottawa': { avgPrice: 650000, pricePerSqft: 450, trend: 3.2, daysOnMarket: 22 },
    'default': { avgPrice: 550000, pricePerSqft: 350, trend: 2.8, daysOnMarket: 25 }
  },
  'BC': {
    'Vancouver': { avgPrice: 1250000, pricePerSqft: 900, trend: 1.8, daysOnMarket: 18 },
    'Victoria': { avgPrice: 850000, pricePerSqft: 600, trend: 2.2, daysOnMarket: 21 },
    'default': { avgPrice: 650000, pricePerSqft: 450, trend: 2.5, daysOnMarket: 24 }
  },
  'AB': {
    'Calgary': { avgPrice: 550000, pricePerSqft: 350, trend: 4.5, daysOnMarket: 28 },
    'Edmonton': { avgPrice: 420000, pricePerSqft: 280, trend: 3.8, daysOnMarket: 32 },
    'default': { avgPrice: 380000, pricePerSqft: 250, trend: 4.0, daysOnMarket: 35 }
  },
  'QC': {
    'Montreal': { avgPrice: 550000, pricePerSqft: 400, trend: 3.5, daysOnMarket: 25 },
    'Quebec City': { avgPrice: 350000, pricePerSqft: 280, trend: 4.2, daysOnMarket: 30 },
    'default': { avgPrice: 320000, pricePerSqft: 240, trend: 3.8, daysOnMarket: 32 }
  },
  'default': { avgPrice: 400000, pricePerSqft: 300, trend: 3.0, daysOnMarket: 28 }
};

var propertyTypeMultipliers = {
  'detached': 1.0,
  'semi-detached': 0.85,
  'townhouse': 0.75,
  'condo': 0.7
};

var conditionMultipliers = {
  'excellent': 1.1,
  'good': 1.0,
  'fair': 0.9,
  'needs-work': 0.75
};

function getHomeValuation(event) {
  event.preventDefault();

  var province = document.getElementById('valuationProvince').value;
  var city = document.getElementById('valuationCity').value.trim();
  var postalCode = document.getElementById('valuationPostal').value.trim();
  var propertyType = document.getElementById('valuationType').value;
  var beds = parseInt(document.getElementById('valuationBeds').value);
  var baths = parseInt(document.getElementById('valuationBaths').value);
  var sqft = parseInt(document.getElementById('valuationSqft').value) || 1500;
  var yearBuilt = parseInt(document.getElementById('valuationYear').value) || 2000;
  var condition = document.getElementById('valuationCondition').value;

  // Get market data
  var provinceData = marketData[province] || marketData['default'];
  var cityData = provinceData[city] || provinceData['default'] || provinceData;

  // Base calculation
  var basePrice = cityData.avgPrice || 400000;
  var pricePerSqft = cityData.pricePerSqft || 300;

  // Adjust for sqft
  var sqftValue = sqft * pricePerSqft;

  // Adjust for property type
  var typeMultiplier = propertyTypeMultipliers[propertyType] || 1.0;

  // Adjust for condition
  var condMultiplier = conditionMultipliers[condition] || 1.0;

  // Adjust for bedrooms (more beds = higher value)
  var bedMultiplier = 1 + ((beds - 3) * 0.05);

  // Adjust for year built
  var currentYear = new Date().getFullYear();
  var age = currentYear - yearBuilt;
  var ageMultiplier = age < 5 ? 1.1 : (age > 50 ? 0.85 : 1 - (age * 0.002));

  // Calculate estimated value
  var estimatedValue = sqftValue * typeMultiplier * condMultiplier * bedMultiplier * ageMultiplier;

  // Round to nearest 5000
  estimatedValue = Math.round(estimatedValue / 5000) * 5000;

  // Calculate range (±4%)
  var lowEstimate = Math.round(estimatedValue * 0.96 / 1000) * 1000;
  var highEstimate = Math.round(estimatedValue * 1.04 / 1000) * 1000;

  // Update results
  document.getElementById('valuationPrimary').textContent = '$' + estimatedValue.toLocaleString();
  document.getElementById('valuationRange').textContent = '$' + lowEstimate.toLocaleString() + ' - $' + highEstimate.toLocaleString();
  document.getElementById('valuationPricePerSqft').textContent = '$' + Math.round(estimatedValue / sqft).toLocaleString();
  document.getElementById('valuationTrend').textContent = '+' + (cityData.trend || 3.0).toFixed(1) + '% (6 months)';
  document.getElementById('valuationDays').textContent = (cityData.daysOnMarket || 25) + ' days';

  // Generate comparable sales
  var comparables = generateComparables(estimatedValue, city, province);
  renderComparables(comparables);

  // Show results
  document.getElementById('valuationResults').style.display = 'block';

  // Smooth scroll to results
  document.getElementById('valuationResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function generateComparables(baseValue, city, province) {
  var comparables = [];
  var variance = 0.08; // 8% variance

  for (var i = 0; i < 3; i++) {
    var priceVariance = 1 + ((Math.random() - 0.5) * variance * 2);
    var price = Math.round(baseValue * priceVariance / 1000) * 1000;
    var daysAgo = Math.floor(Math.random() * 45) + 5;

    comparables.push({
      address: generateFakeAddress(city),
      price: price,
      soldDate: daysAgo + ' days ago'
    });
  }

  return comparables;
}

function generateFakeAddress(city) {
  var streetNumbers = ['123', '456', '789', '321', '654', '987', '234', '567', '890'];
  var streetNames = ['Maple', 'Oak', 'Pine', 'Cedar', 'Elm', 'Birch', 'Willow', 'Spruce', 'Cherry'];
  var streetTypes = ['St', 'Ave', 'Dr', 'Blvd', 'Crescent', 'Way', 'Lane'];

  var num = streetNumbers[Math.floor(Math.random() * streetNumbers.length)];
  var name = streetNames[Math.floor(Math.random() * streetNames.length)];
  var type = streetTypes[Math.floor(Math.random() * streetTypes.length)];

  return num + ' ' + name + ' ' + type + ', ' + city;
}

function renderComparables(comparables) {
  var container = document.getElementById('comparableList');

  container.innerHTML = comparables.map(function(comp) {
    return '<div class="comparable-item">' +
      '<span>' + comp.address + '</span>' +
      '<span><strong>$' + comp.price.toLocaleString() + '</strong> (' + comp.soldDate + ')</span>' +
    '</div>';
  }).join('');
}

// ==========================================
// Referral Program Functions
// ==========================================

function generateReferralCode() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var code = '';
  for (var i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function updateReferralUI() {
  var loggedOutDiv = document.getElementById('loggedOutReferral');
  var loggedInDiv = document.getElementById('loggedInReferral');

  if (authToken && currentUser) {
    loggedOutDiv.style.display = 'none';
    loggedInDiv.style.display = 'block';

    // Generate or get referral code
    var referralCode = localStorage.getItem('referralCode');
    if (!referralCode) {
      referralCode = generateReferralCode();
      localStorage.setItem('referralCode', referralCode);
    }

    var referralLink = window.location.origin + '/ref/' + referralCode;
    document.getElementById('referralLink').value = referralLink;

    // Load referral stats (in production from API)
    var stats = JSON.parse(localStorage.getItem('referralStats') || '{"sent":0,"signedUp":0,"earned":0}');
    document.getElementById('referralsSent').textContent = stats.sent;
    document.getElementById('referralsSignedUp').textContent = stats.signedUp;
    document.getElementById('referralsEarned').textContent = '$' + stats.earned;
  } else {
    loggedOutDiv.style.display = 'block';
    loggedInDiv.style.display = 'none';
  }
}

function copyReferralLink() {
  var linkInput = document.getElementById('referralLink');
  linkInput.select();
  navigator.clipboard.writeText(linkInput.value).then(function() {
    showToast('Referral link copied to clipboard!', 'success');

    // Increment sent count
    var stats = JSON.parse(localStorage.getItem('referralStats') || '{"sent":0,"signedUp":0,"earned":0}');
    stats.sent++;
    localStorage.setItem('referralStats', JSON.stringify(stats));
    document.getElementById('referralsSent').textContent = stats.sent;
  }).catch(function() {
    showToast('Failed to copy. Please copy manually.', 'error');
  });
}

function shareViaEmail() {
  var referralLink = document.getElementById('referralLink').value;
  var subject = encodeURIComponent('Save thousands on your next home purchase - Real Estate Direct');
  var body = encodeURIComponent('Hey!\n\nI found this great platform for buying/selling real estate in Canada. They only charge 2% instead of the usual 5-6% commission. I saved thousands!\n\nCheck it out: ' + referralLink + '\n\nWe both get $500 off our platform fee when you complete a transaction.');
  window.location.href = 'mailto:?subject=' + subject + '&body=' + body;

  var stats = JSON.parse(localStorage.getItem('referralStats') || '{"sent":0,"signedUp":0,"earned":0}');
  stats.sent++;
  localStorage.setItem('referralStats', JSON.stringify(stats));
  document.getElementById('referralsSent').textContent = stats.sent;
}

function shareViaFacebook() {
  var referralLink = document.getElementById('referralLink').value;
  window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(referralLink), '_blank', 'width=600,height=400');
}

function shareViaTwitter() {
  var referralLink = document.getElementById('referralLink').value;
  var text = encodeURIComponent('I just discovered @RealEstateDirect - they only charge 2% vs 5-6% traditional commission! Check it out:');
  window.open('https://twitter.com/intent/tweet?text=' + text + '&url=' + encodeURIComponent(referralLink), '_blank', 'width=600,height=400');
}

function shareViaWhatsApp() {
  var referralLink = document.getElementById('referralLink').value;
  var text = encodeURIComponent('Hey! Check out Real Estate Direct - save thousands on buying/selling your home: ' + referralLink);
  window.open('https://wa.me/?text=' + text, '_blank');
}

// ==========================================
// Offer Comparison Functions
// ==========================================

function loadOfferComparison(propertyId) {
  // In production, this would fetch offers from API
  // For now, show the no-offers state
  var noOffersState = document.getElementById('noOffersState');
  var offersGrid = document.getElementById('offersComparisonGrid');

  // Simulated check - in production would check actual offers
  var hasOffers = false;

  if (hasOffers) {
    noOffersState.style.display = 'none';
    offersGrid.style.display = 'grid';
    // renderOfferComparison(offers);
  } else {
    noOffersState.style.display = 'block';
    offersGrid.style.display = 'none';
  }
}

function renderOfferComparison(offers) {
  var container = document.getElementById('offersComparisonGrid');

  // Sort offers by price descending
  offers.sort(function(a, b) { return b.price - a.price; });

  container.innerHTML = offers.map(function(offer, index) {
    var isBest = index === 0;
    return '<div class="offer-comparison-card' + (isBest ? ' best-offer' : '') + '">' +
      '<div class="offer-header' + (isBest ? ' best' : '') + '">' +
        '<h3>Offer ' + (index + 1) + (isBest ? ' - Best Offer' : '') + '</h3>' +
      '</div>' +
      '<div class="offer-body">' +
        '<div class="offer-row"><span class="label">Offer Price</span><span class="value">$' + offer.price.toLocaleString() + '</span></div>' +
        '<div class="offer-row"><span class="label">Deposit</span><span class="value">$' + offer.deposit.toLocaleString() + '</span></div>' +
        '<div class="offer-row"><span class="label">Closing Date</span><span class="value">' + offer.closingDate + '</span></div>' +
        '<div class="offer-row"><span class="label">Conditions</span><span class="value">' + offer.conditions + '</span></div>' +
        '<div class="offer-row"><span class="label">Pre-Approved</span><span class="value">' + (offer.preApproved ? 'Yes' : 'No') + '</span></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ==========================================
// Initialize New Features on Page Load
// ==========================================

var prevOnLogin4 = window.onLoginSuccess;
window.onLoginSuccess = function() {
  if (prevOnLogin4) prevOnLogin4();
  updateReferralUI();
};

// Referrals, savings-calculator, and offer-comparison section loading is handled by onSectionChange()

// ==========================================
// Sell Wizard Functions
// ==========================================

var currentWizardStep = 1;
var totalWizardSteps = 8;
var wizardValuation = 0;

function checkVerificationComplete() {
  var verifyId = document.getElementById('verifyId');
  var verifyOwner = document.getElementById('verifyOwner');
  var verifyAccurate = document.getElementById('verifyAccurate');
  var step1Next = document.getElementById('step1Next');

  if (verifyId && verifyOwner && verifyAccurate && step1Next) {
    var allChecked = verifyId.checked && verifyOwner.checked && verifyAccurate.checked;
    step1Next.disabled = !allChecked;
  }
}

function nextWizardStep() {
  if (currentWizardStep < totalWizardSteps) {
    // Validate current step before proceeding
    if (!validateWizardStep(currentWizardStep)) {
      return;
    }

    // Hide current step
    var currentContent = document.getElementById('wizardStep' + currentWizardStep);
    if (currentContent) currentContent.style.display = 'none';

    // Mark current step as completed
    var currentStepEl = document.querySelector('.wizard-step[data-step="' + currentWizardStep + '"]');
    if (currentStepEl) {
      currentStepEl.classList.remove('active');
      currentStepEl.classList.add('completed');
    }

    // Move to next step
    currentWizardStep++;

    // Show next step
    var nextContent = document.getElementById('wizardStep' + currentWizardStep);
    if (nextContent) nextContent.style.display = 'block';

    // Mark next step as active
    var nextStepEl = document.querySelector('.wizard-step[data-step="' + currentWizardStep + '"]');
    if (nextStepEl) {
      nextStepEl.classList.add('active');
    }

    // Handle special step actions
    if (currentWizardStep === 5) {
      runWizardValuation();
    } else if (currentWizardStep === 6) {
      setupPriceStep();
    } else if (currentWizardStep === 8) {
      populateReviewSummary();
    }

    // Scroll to top of wizard
    var wizard = document.getElementById('sellWizard');
    if (wizard) wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function prevWizardStep() {
  if (currentWizardStep > 1) {
    // Hide current step
    var currentContent = document.getElementById('wizardStep' + currentWizardStep);
    if (currentContent) currentContent.style.display = 'none';

    // Remove active from current step
    var currentStepEl = document.querySelector('.wizard-step[data-step="' + currentWizardStep + '"]');
    if (currentStepEl) {
      currentStepEl.classList.remove('active');
    }

    // Move to previous step
    currentWizardStep--;

    // Show previous step
    var prevContent = document.getElementById('wizardStep' + currentWizardStep);
    if (prevContent) prevContent.style.display = 'block';

    // Mark previous step as active (remove completed)
    var prevStepEl = document.querySelector('.wizard-step[data-step="' + currentWizardStep + '"]');
    if (prevStepEl) {
      prevStepEl.classList.remove('completed');
      prevStepEl.classList.add('active');
    }

    // Scroll to top of wizard
    var wizard = document.getElementById('sellWizard');
    if (wizard) wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function validateWizardStep(step) {
  switch(step) {
    case 1:
      var verifyId = document.getElementById('verifyId');
      var verifyOwner = document.getElementById('verifyOwner');
      var verifyAccurate = document.getElementById('verifyAccurate');
      if (!verifyId.checked || !verifyOwner.checked || !verifyAccurate.checked) {
        showToast('Please complete all verification checkboxes', 'error');
        return false;
      }
      return true;

    case 2:
      var province = document.getElementById('propertyProvince').value;
      var street = document.getElementById('propertyStreet').value;
      var city = document.getElementById('propertyCity').value;
      var postal = document.getElementById('propertyPostal').value;
      if (!province || !street || !city || !postal) {
        showToast('Please fill in all required address fields', 'error');
        return false;
      }
      return true;

    case 3:
      var propertyType = document.getElementById('propertyType').value;
      var beds = document.getElementById('propertyBeds').value;
      var baths = document.getElementById('propertyBaths').value;
      var sqft = document.getElementById('propertySqft').value;
      if (!propertyType || !beds || !baths || !sqft) {
        showToast('Please fill in all required property details', 'error');
        return false;
      }
      return true;

    case 6:
      var price = document.getElementById('propertyPrice').value;
      if (!price || parseInt(price) < 1000) {
        showToast('Please enter a valid asking price', 'error');
        return false;
      }
      return true;

    default:
      return true;
  }
}

function runWizardValuation() {
  var loading = document.getElementById('valuationLoading');
  var estimate = document.getElementById('valuationEstimate');

  if (loading) loading.style.display = 'block';
  if (estimate) estimate.style.display = 'none';

  // Get property details for valuation
  var province = document.getElementById('propertyProvince').value;
  var city = document.getElementById('propertyCity').value;
  var propertyType = document.getElementById('propertyType').value;
  var beds = parseInt(document.getElementById('propertyBeds').value) || 3;
  var baths = parseFloat(document.getElementById('propertyBaths').value) || 2;
  var sqft = parseInt(document.getElementById('propertySqft').value) || 1500;
  var condition = document.querySelector('input[name="condition"]:checked');
  var conditionValue = condition ? condition.value : 'good';

  // Simulate valuation (use the marketData from home valuation if available)
  setTimeout(function() {
    var basePrice = calculateBaseValuation(province, city, propertyType, sqft, beds, baths, conditionValue);

    var lowEstimate = Math.round(basePrice * 0.92);
    var midEstimate = Math.round(basePrice);
    var highEstimate = Math.round(basePrice * 1.08);

    wizardValuation = midEstimate;

    document.getElementById('estimateLow').textContent = '$' + lowEstimate.toLocaleString();
    document.getElementById('estimateMid').textContent = '$' + midEstimate.toLocaleString();
    document.getElementById('estimateHigh').textContent = '$' + highEstimate.toLocaleString();
    document.getElementById('compCount').textContent = Math.floor(Math.random() * 15) + 5;

    if (loading) loading.style.display = 'none';
    if (estimate) estimate.style.display = 'block';
  }, 1500);
}

function calculateBaseValuation(province, city, propertyType, sqft, beds, baths, condition) {
  // Base price per sqft by province/city (simplified)
  var pricePerSqft = {
    'ON': { 'Toronto': 900, 'Ottawa': 550, 'default': 450 },
    'BC': { 'Vancouver': 1100, 'Victoria': 700, 'default': 500 },
    'AB': { 'Calgary': 400, 'Edmonton': 350, 'default': 300 },
    'QC': { 'Montreal': 500, 'Quebec City': 350, 'default': 300 },
    'default': { 'default': 350 }
  };

  var provinceData = pricePerSqft[province] || pricePerSqft['default'];
  var basePricePerSqft = provinceData[city] || provinceData['default'];

  // Property type multiplier
  var typeMultiplier = {
    'detached': 1.1,
    'semi-detached': 1.0,
    'townhouse': 0.95,
    'condo': 0.9,
    'land': 0.5,
    'commercial': 1.2
  };

  // Condition multiplier
  var conditionMultiplier = {
    'excellent': 1.1,
    'good': 1.0,
    'fair': 0.9,
    'fixer': 0.75
  };

  var basePrice = sqft * basePricePerSqft;
  basePrice *= (typeMultiplier[propertyType] || 1.0);
  basePrice *= (conditionMultiplier[condition] || 1.0);

  // Add value for bedrooms and bathrooms
  basePrice += (beds - 3) * 25000;
  basePrice += (baths - 2) * 15000;

  return Math.max(basePrice, 100000);
}

function setupPriceStep() {
  var suggestedPrice = document.getElementById('suggestedPrice');
  var priceInput = document.getElementById('propertyPrice');

  if (suggestedPrice) {
    suggestedPrice.textContent = '$' + wizardValuation.toLocaleString();
  }

  if (priceInput && !priceInput.value) {
    priceInput.value = wizardValuation;
  }

  // Add listener for commission calculation
  if (priceInput) {
    priceInput.addEventListener('input', updateCommissionPreview);
    updateCommissionPreview();
  }
}

function updateCommissionPreview() {
  var priceInput = document.getElementById('propertyPrice');
  var price = parseInt(priceInput.value) || 0;

  var sellerComm = Math.round(price * 0.01);
  var buyerComm = Math.round(price * 0.01);
  var netProceeds = price - sellerComm;

  var sellerCommEl = document.getElementById('sellerCommission');
  var buyerCommEl = document.getElementById('buyerCommission');
  var netProceedsEl = document.getElementById('netProceeds');

  if (sellerCommEl) sellerCommEl.textContent = '$' + sellerComm.toLocaleString();
  if (buyerCommEl) buyerCommEl.textContent = '$' + buyerComm.toLocaleString();
  if (netProceedsEl) netProceedsEl.textContent = '$' + netProceeds.toLocaleString();
}

function populateReviewSummary() {
  var street = document.getElementById('propertyStreet').value;
  var city = document.getElementById('propertyCity').value;
  var province = document.getElementById('propertyProvince').value;
  var postal = document.getElementById('propertyPostal').value;
  var propertyType = document.getElementById('propertyType');
  var beds = document.getElementById('propertyBeds').value;
  var baths = document.getElementById('propertyBaths').value;
  var sqft = document.getElementById('propertySqft').value;
  var price = document.getElementById('propertyPrice').value;

  document.getElementById('reviewAddress').textContent = street + ', ' + city + ', ' + province + ' ' + postal;
  document.getElementById('reviewType').textContent = propertyType.options[propertyType.selectedIndex].text;
  document.getElementById('reviewBedBath').textContent = beds + ' bed / ' + baths + ' bath';
  document.getElementById('reviewSqft').textContent = parseInt(sqft).toLocaleString() + ' sq ft';
  document.getElementById('reviewPrice').textContent = '$' + parseInt(price).toLocaleString();
  document.getElementById('reviewPhotos').textContent = selectedImages.length + ' photos';
}

function publishListing() {
  var agreeTerms = document.getElementById('agreeTerms');
  if (!agreeTerms || !agreeTerms.checked) {
    showToast('Please agree to the terms and conditions', 'error');
    return;
  }

  var description = document.getElementById('propertyDescription').value;
  if (!description || description.length < 50) {
    showToast('Please write a description (at least 50 characters)', 'error');
    return;
  }

  // Call the original createProperty function
  var event = { preventDefault: function() {} };
  createPropertyFromWizard();
}

function createPropertyFromWizard() {
  // Gather all data from wizard
  var propertyData = {
    address: {
      street: document.getElementById('propertyStreet').value,
      unit: document.getElementById('propertyUnit').value,
      city: document.getElementById('propertyCity').value,
      province: document.getElementById('propertyProvince').value,
      postalCode: document.getElementById('propertyPostal').value
    },
    propertyType: document.getElementById('propertyType').value,
    bedrooms: parseInt(document.getElementById('propertyBeds').value),
    bathrooms: parseFloat(document.getElementById('propertyBaths').value),
    squareFeet: parseInt(document.getElementById('propertySqft').value),
    yearBuilt: parseInt(document.getElementById('propertyYear').value) || null,
    askingPrice: parseInt(document.getElementById('propertyPrice').value),
    description: document.getElementById('propertyDescription').value,
    features: [],
    condition: 'good'
  };

  // Get features
  var featureCheckboxes = document.querySelectorAll('input[name="features"]:checked');
  featureCheckboxes.forEach(function(cb) {
    propertyData.features.push(cb.value);
  });

  // Get condition
  var conditionRadio = document.querySelector('input[name="condition"]:checked');
  if (conditionRadio) {
    propertyData.condition = conditionRadio.value;
  }

  // Submit to API
  var publishBtn = document.getElementById('publishBtn');
  if (publishBtn) {
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<span class="spinner"></span> Publishing...';
  }

  fetch(API_BASE + '/properties', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + authToken
    },
    body: JSON.stringify(propertyData)
  })
  .then(function(response) {
    if (!response.ok) throw new Error('Failed to create listing');
    return response.json();
  })
  .then(function(property) {
    // Upload images if any
    if (selectedImages.length > 0) {
      return uploadPropertyImages(property._id);
    }
    return property;
  })
  .then(function() {
    showToast('Your listing has been published!', 'success');
    // Reset wizard
    currentWizardStep = 1;
    // Show dashboard
    showSection('dashboard');
    if (typeof loadDashboard === 'function') loadDashboard();
  })
  .catch(function(error) {
    console.error('Error:', error);
    showToast('Failed to publish listing: ' + error.message, 'error');
  })
  .finally(function() {
    if (publishBtn) {
      publishBtn.disabled = false;
      publishBtn.innerHTML = '<span class="btn-icon">🚀</span> Publish Listing';
    }
  });
}

function uploadPropertyImages(propertyId) {
  var formData = new FormData();
  selectedImages.forEach(function(img) {
    formData.append('images', img.file);
  });

  return fetch(API_BASE + '/images/property/' + propertyId, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + authToken
    },
    body: formData
  });
}

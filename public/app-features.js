// ==========================================
// Admin Dashboard Functions
// ==========================================

let isAdmin = false;

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

// ==========================================
// Section Loading
// ==========================================

var originalShowSection = window.showSection;
window.showSection = function(sectionId) {
  originalShowSection(sectionId);

  switch(sectionId) {
    case 'admin':
      loadAdminDashboard();
      break;
    case 'messages':
      loadConversations();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'transactions':
      loadTransactions();
      break;
    case 'saved-searches':
      loadSavedSearches();
      break;
  }
};

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

// Update showSection to include documents
var prevShowSection = window.showSection;
window.showSection = function(sectionId) {
  prevShowSection(sectionId);

  if (sectionId === 'documents') {
    loadDocuments();
    loadUserTransactionsForDocuments();
  }
};

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
};

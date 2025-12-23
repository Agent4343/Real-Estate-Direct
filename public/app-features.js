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

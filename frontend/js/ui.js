/**
 * NexSettle — UI Utilities
 * Toast notifications, modals, loaders, etc.
 */

// ── Toast Notifications ───────────────────────────────────

export function showToast(title, message = '', type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => toast.remove(), duration);
  }

  return toast;
}

// ── Loading Overlay ───────────────────────────────────────

let _loadingOverlay = null;

export function showLoading(message = 'Processing…') {
  if (_loadingOverlay) return;
  _loadingOverlay = document.createElement('div');
  _loadingOverlay.className = 'loading-overlay';
  _loadingOverlay.id = 'global-loading';
  _loadingOverlay.innerHTML = `
    <div class="spinner spinner-lg"></div>
    <div class="loading-text">${message}</div>
  `;
  document.body.appendChild(_loadingOverlay);
}

export function hideLoading() {
  if (_loadingOverlay) {
    _loadingOverlay.remove();
    _loadingOverlay = null;
  }
}

// ── Modal ─────────────────────────────────────────────────

export function createModal({ title, subtitle = '', content, footer = '', size = '' }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <div class="modal-title">${title}</div>
          ${subtitle ? `<div class="modal-subtitle">${subtitle}</div>` : ''}
        </div>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">${content}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeModal = () => backdrop.remove();
  backdrop.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  return { backdrop, closeModal };
}

// ── Confirm Dialog ─────────────────────────────────────────

export function confirmDialog(title, message, confirmText = 'Confirm', type = 'danger') {
  return new Promise((resolve) => {
    const { backdrop, closeModal } = createModal({
      title,
      content: `<p style="color: var(--text-secondary); line-height: 1.7;">${message}</p>`,
      footer: `
        <button class="btn btn-outline" id="confirm-cancel">Cancel</button>
        <button class="btn btn-${type}" id="confirm-ok">${confirmText}</button>
      `,
    });

    backdrop.querySelector('#confirm-cancel').addEventListener('click', () => {
      closeModal(); resolve(false);
    });
    backdrop.querySelector('#confirm-ok').addEventListener('click', () => {
      closeModal(); resolve(true);
    });
  });
}

// ── Format Helpers ────────────────────────────────────────

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatConfidence(score) {
  return (Number(score) * 100).toFixed(1) + '%';
}

// ── Claim Status Badge ────────────────────────────────────

export function claimStatusBadge(status) {
  const map = {
    'verification_pending': ['badge-amber', '⏳ Pending'],
    'under_review':         ['badge-blue',  '🔍 Under Review'],
    'approved':             ['badge-green', '✅ Approved'],
    'rejected':             ['badge-red',   '❌ Rejected'],
    'fraud_detected':       ['badge-red',   '🚨 Fraud'],
    'settled':              ['badge-cyan',  '💰 Settled'],
    'unknown':              ['badge-gray',  '❓ Unknown'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── Doc Type Label ────────────────────────────────────────

export function docTypeIcon(docType) {
  const map = {
    'death_certificate':  '📜',
    'aadhaar':            '🇮🇳',
    'pan':                '💳',
    'bank':               '🏦',
    'policy':             '📋',
    'fir':                '🚔',
    'hospital_record':    '🏥',
    'newspaper_clipping': '📰',
    'unknown':            '📄',
  };
  return map[docType] || '📄';
}

export function docTypeLabel(docType) {
  return (docType || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── File Size Format ──────────────────────────────────────

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Render Extracted Data ─────────────────────────────────

export function renderExtractedData(extractedData) {
  if (!extractedData || Object.keys(extractedData).length === 0) {
    return `<div class="empty-state" style="padding:1rem"><div class="empty-state-icon">📭</div><div class="empty-state-desc">No data extracted</div></div>`;
  }

  return Object.entries(extractedData).map(([key, value]) => {
    const displayVal = value === null || value === undefined
      ? '<span class="field-value null">null</span>'
      : `<span class="field-value">${Array.isArray(value) ? value.join(', ') || '[]' : String(value)}</span>`;
    return `
      <div class="extracted-field">
        <div class="field-key">${key.replace(/_/g, ' ')}</div>
        ${displayVal}
      </div>
    `;
  }).join('');
}

// ── Button Loading State ──────────────────────────────────

export function setButtonLoading(btn, loading, text = '') {
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${text ? text : ''}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._originalText || text;
  }
}

// ── Clipboard ─────────────────────────────────────────────

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied', '', 'success', 1500);
  } catch {
    showToast('Copy failed', '', 'error', 2000);
  }
}

// ── Redirect Guard ────────────────────────────────────────

export function requireAuth(role = null) {
  const token = localStorage.getItem('nexsettle_token');
  const userRole = localStorage.getItem('nexsettle_role');

  if (!token) {
    window.location.href = '/frontend/index.html';
    return false;
  }

  if (role && userRole !== role) {
    // Redirect to proper portal
    if (userRole === 'admin') window.location.href = '/frontend/pages/admin-dashboard.html';
    else if (userRole === 'agent') window.location.href = '/frontend/pages/agent-dashboard.html';
    else window.location.href = '/frontend/pages/dashboard.html';
    return false;
  }

  return true;
}

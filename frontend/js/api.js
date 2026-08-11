/**
 * NexSettle — API Client
 * Central module for all backend API calls.
 */

const API_BASE = 'http://localhost:8000/api';

// ── Token Management ──────────────────────────────────────

export function getToken() {
  return localStorage.getItem('nexsettle_token');
}

export function setToken(token) {
  localStorage.setItem('nexsettle_token', token);
}

export function removeToken() {
  localStorage.removeItem('nexsettle_token');
  localStorage.removeItem('nexsettle_user');
  localStorage.removeItem('nexsettle_role');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('nexsettle_user') || 'null');
  } catch {
    return null;
  }
}

export function setUser(user, role = 'user') {
  localStorage.setItem('nexsettle_user', JSON.stringify(user));
  localStorage.setItem('nexsettle_role', role);
}

export function getRole() {
  return localStorage.getItem('nexsettle_role') || 'user';
}

export function isLoggedIn() {
  return !!getToken();
}

// ── Core Request Helper ───────────────────────────────────

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Try to parse JSON, fallback to text
    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.includes('application/pdf')) {
      data = await response.blob();
      return { ok: response.ok, status: response.status, data, isBlob: true };
    } else {
      data = await response.text();
    }

    return { ok: response.ok, status: response.status, data };
  } catch (networkErr) {
    console.error('Network error:', networkErr);
    return { ok: false, status: 0, data: { error: 'Network error — is the backend running?' } };
  }
}

// ── Auth API ──────────────────────────────────────────────

export const Auth = {
  async register(username, email, password) {
    return request('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  async verifyOTP(userId, otpCode) {
    return request('/auth/verify-otp/', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, otp_code: otpCode }),
    });
  },

  async resendOTP(userId) {
    return request('/auth/resend-otp/', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  async login(email, password) {
    return request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout() {
    await request('/auth/logout/', { method: 'POST' });
    removeToken();
  },

  async getProfile() {
    return request('/auth/profile/');
  },
};

// ── AI Pipeline API ───────────────────────────────────────

export const Pipeline = {
  async processDocuments(files) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return request('/pipeline/process/', {
      method: 'POST',
      body: formData,
    });
  },
};

// ── Claims API ────────────────────────────────────────────

export const Claims = {
  async list() {
    return request('/claims/list/');
  },

  async get(claimId) {
    return request(`/claims/${claimId}/`);
  },

  async updateStatus(claimId, claimStatus) {
    return request(`/claims/${claimId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ claim_status: claimStatus }),
    });
  },

  async all(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/claims/all/${qs ? '?' + qs : ''}`);
  },
};

// ── Reports API ───────────────────────────────────────────

export const Reports = {
  async downloadReport(claimId) {
    return request(`/reports/${claimId}/download/`);
  },
};

// ── Agent API ─────────────────────────────────────────────

export const Agent = {
  async login(email, password) {
    return request('/agent/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getClaims(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/agent/claims/${qs ? '?' + qs : ''}`);
  },

  async reviewClaim(claimId, note, claimStatus) {
    return request(`/agent/claims/${claimId}/review/`, {
      method: 'POST',
      body: JSON.stringify({ note, claim_status: claimStatus }),
    });
  },
};

// ── Admin API ─────────────────────────────────────────────

export const Admin = {
  async login(email, password) {
    return request('/admin-panel/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getDashboard() {
    return request('/admin-panel/dashboard/');
  },

  async getClaims(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin-panel/claims/${qs ? '?' + qs : ''}`);
  },

  async approveClaim(claimId) {
    return request(`/admin-panel/claims/${claimId}/approve/`, { method: 'PATCH' });
  },

  async rejectClaim(claimId, reason) {
    return request(`/admin-panel/claims/${claimId}/reject/`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  async settleClaim(claimId) {
    return request(`/admin-panel/claims/${claimId}/settle/`, { method: 'PATCH' });
  },

  async getAgents() {
    return request('/admin-panel/agents/');
  },

  async createAgent(agentName, agentEmail, agentPassword) {
    return request('/admin-panel/agents/create/', {
      method: 'POST',
      body: JSON.stringify({ agent_name: agentName, agent_email: agentEmail, agent_password: agentPassword }),
    });
  },

  async getPolicyHolders(userId = null) {
    const qs = userId ? `?user_id=${userId}` : '';
    return request(`/admin-panel/policy-holders/${qs}`);
  },

  async addPolicyHolder(data) {
    return request('/admin-panel/policy-holders/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ── Fraud API ─────────────────────────────────────────────

export const Fraud = {
  async getLogs() {
    return request('/fraud/logs/');
  },
};

/**
 * Admin API client for the Sensible Soccer ROM Editor.
 */

const API_BASE = '/api';

// Get stored credentials
function getAuthHeaders() {
  const credentials = localStorage.getItem('adminCredentials');
  if (credentials) {
    return {
      'Authorization': `Basic ${credentials}`,
    };
  }
  return {};
}

/**
 * Get admin statistics
 */
export async function getAdminStats() {
  const response = await fetch(`${API_BASE}/admin/stats`, {
    headers: getAuthHeaders(),
  });
  
  if (response.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  
  return response.json();
}

/**
 * List sessions
 */
export async function listSessions(page = 1, limit = 50) {
  const response = await fetch(
    `${API_BASE}/admin/sessions?page=${page}&limit=${limit}`,
    { headers: getAuthHeaders() }
  );
  
  if (response.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  
  return response.json();
}

/**
 * Get session details
 */
export async function getSession(sessionId) {
  const response = await fetch(
    `${API_BASE}/admin/sessions/${sessionId}`,
    { headers: getAuthHeaders() }
  );
  
  if (response.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch session');
  }
  
  return response.json();
}

/**
 * Get upload details
 */
export async function getUpload(uploadId) {
  const response = await fetch(
    `${API_BASE}/admin/uploads/${uploadId}`,
    { headers: getAuthHeaders() }
  );
  
  if (response.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch upload');
  }
  
  return response.json();
}

/**
 * List requests
 */
export async function listRequests(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set('page', params.page);
  if (params.limit) queryParams.set('limit', params.limit);
  if (params.session_id) queryParams.set('session_id', params.session_id);
  if (params.endpoint) queryParams.set('endpoint', params.endpoint);
  if (params.status) queryParams.set('status', params.status);
  
  const response = await fetch(
    `${API_BASE}/admin/requests?${queryParams.toString()}`,
    { headers: getAuthHeaders() }
  );
  
  if (response.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch requests');
  }
  
  return response.json();
}

/**
 * List ROMs
 */
export async function listRoms(page = 1, limit = 50) {
  const response = await fetch(
    `${API_BASE}/admin/roms?page=${page}&limit=${limit}`,
    { headers: getAuthHeaders() }
  );
  
  if (response.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch ROMs');
  }
  
  return response.json();
}

/**
 * Delete ROM
 */
export async function deleteRom(md5Hash) {
  const response = await fetch(
    `${API_BASE}/admin/roms/${md5Hash}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );
  
  if (response.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error('Failed to delete ROM');
  }
  
  return response.json();
}

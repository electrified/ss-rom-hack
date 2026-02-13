/**
 * API client for the Sensible Soccer ROM Editor backend.
 */

const API_BASE = '/api';

/**
 * Upload a ROM file to the server.
 * @param {File} file - The ROM file to upload
 * @returns {Promise<Object>} - Session data including session_id and teams_json
 */
export async function uploadRom(file) {
  const formData = new FormData();
  formData.append('rom_file', file);

  const response = await fetch(`${API_BASE}/upload-rom`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Failed to upload ROM');
  }

  return response.json();
}

/**
 * Validate teams JSON against the original ROM.
 * @param {string} sessionId - The session ID from upload
 * @param {Object} teamsJson - The teams JSON to validate
 * @returns {Promise<Object>} - Validation results
 */
export async function validateTeams(sessionId, teamsJson) {
  const response = await fetch(`${API_BASE}/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      teams_json: teamsJson,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Validation failed' }));
    throw new Error(error.detail || 'Failed to validate teams');
  }

  return response.json();
}

/**
 * Generate and download a modified ROM.
 * @param {string} sessionId - The session ID from upload
 * @param {Object} teamsJson - The teams JSON to use
 * @param {string} filename - The filename for the download
 * @returns {Promise<void>}
 */
export async function generateRom(sessionId, teamsJson, filename = 'modified_rom.md') {
  const response = await fetch(`${API_BASE}/generate-rom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      teams_json: teamsJson,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Generation failed' }));
    throw new Error(error.detail || 'Failed to generate ROM');
  }

  // Download the file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

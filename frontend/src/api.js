export async function uploadRom(file) {
  const formData = new FormData();
  formData.append('rom_file', file);
  
  const response = await fetch('/api/upload-rom', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload ROM');
  }
  
  return response.json();
}

export async function validateTeams(sessionId, teamsJson) {
  const response = await fetch('/api/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, teams_json: teamsJson }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to validate');
  }
  
  return response.json();
}

export async function generateRom(sessionId, teamsJson) {
  const response = await fetch('/api/generate-rom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, teams_json: teamsJson }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.message || error.detail || 'Failed to generate ROM');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modified_rom.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

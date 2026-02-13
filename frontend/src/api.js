export async function uploadRom(file) {
  const formData = new FormData();
  formData.append('rom_file', file);
  
  const res = await fetch('/api/upload-rom', {
    method: 'POST',
    body: formData,
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to upload ROM');
  }
  
  return res.json();
}

export async function validateTeams(sessionId, teamsJson) {
  const res = await fetch('/api/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, teams_json: teamsJson }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to validate');
  }
  
  return res.json();
}

export async function generateRom(sessionId, teamsJson) {
  const res = await fetch('/api/generate-rom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, teams_json: teamsJson }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate ROM');
  }
  
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modified.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

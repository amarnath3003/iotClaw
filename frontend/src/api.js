const API_BASE = 'http://localhost:8000'

export async function getState() {
  const res = await fetch(`${API_BASE}/state`)
  return res.json()
}

export async function getWorkflows() {
  const res = await fetch(`${API_BASE}/workflows`)
  return res.json()
}

export async function createWorkflow(payload) {
  const res = await fetch(`${API_BASE}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function runWorkflow(id) {
  const res = await fetch(`${API_BASE}/workflows/${id}/run`, { method: 'POST' })
  return res.json()
}

export async function deleteWorkflow(id) {
  const res = await fetch(`${API_BASE}/workflows/${id}`, { method: 'DELETE' })
  return res.json()
}

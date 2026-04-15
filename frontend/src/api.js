const BASE = 'http://localhost:8000'

function getToken() {
  return localStorage.getItem('openclaw_token')
}

async function req(method, path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    localStorage.removeItem('openclaw_token')
    window.dispatchEvent(new Event('openclaw:logout'))
    throw new Error('Session expired')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `${method} ${path} → ${res.status}`)
  }
  return res.json()
}

async function reqForm(path, formData) {
  const res = await fetch(BASE + path, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `POST ${path} → ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Auth
  register:         (username, email, password) =>
                      req('POST', '/auth/register', { username, email, password }),
  login:            (username, password) => {
                      const fd = new FormData()
                      fd.append('username', username)
                      fd.append('password', password)
                      return reqForm('/auth/login', fd)
                    },
  me:               ()    => req('GET', '/auth/me', null, true),

  // Chat
  chat:             (messages, mode) => req('POST', '/chat', { messages, mode }, true),

  // Workflows
  listWorkflows:    ()           => req('GET',  '/workflows', null, true),
  createWorkflow:   (data)       => req('POST', '/workflows', data, true),
  getWorkflow:      (id)         => req('GET',  `/workflows/${id}`, null, true),
  updateWorkflow:   (id, data)   => req('PUT',  `/workflows/${id}`, data, true),
  deleteWorkflow:   (id)         => req('DELETE',`/workflows/${id}`, null, true),
  toggleWorkflow:   (id)         => req('PATCH', `/workflows/${id}/toggle`, null, true),
  runWorkflow:      (id)         => req('POST', `/workflows/${id}/run`, null, true),

  // Templates
  listTemplates:    (cat)        => req('GET',  `/templates${cat ? `?category=${cat}` : ''}`),
  activateTemplate: (tid)        => req('POST', `/templates/${tid}/activate`, null, true),

  // State
  getState:         ()           => req('GET',  '/state'),
  controlDevice:    (path, val)  => req('POST', `/state/${path}`, { value: val }, true),

  // Logs
  getExecLog:       ()           => req('GET',  '/execlog'),
  getNotifications: ()           => req('GET',  '/notifications'),
  getAudit:         (n=50)       => req('GET',  `/audit?limit=${n}`, null, true),

  // Export / Import
  exportWorkflow:   (id)         => req('GET',  `/workflows/${id}/export`, null, true),
  importWorkflow:   (data)       => req('POST', '/workflows/import', data, true),

  // Settings
  getSettings:      ()           => req('GET',  '/settings', null, true),
  changePassword:   (old_pw, new_pw) =>
                      req('PUT', '/settings/password', { old_password: old_pw, new_password: new_pw }, true),
}

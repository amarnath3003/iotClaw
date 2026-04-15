"""
OpenClaw v5 backend test suite.
Run from the project root: pytest tests/ -v
Requires: pip install pytest httpx
"""

import json
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('GEMINI_API_KEY', 'test-key')
os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-testing-only')

from fastapi.testclient import TestClient

# Patch Gemini client before importing app so it doesn't try to connect
import unittest.mock as mock
with mock.patch('google.genai.Client'):
    from main import app

client = TestClient(app)

# ── Helpers ───────────────────────────────────────────────────────────────────

def register_and_login(username='testuser', email='test@example.com', password='testpass123'):
    client.post('/auth/register', json={'username': username, 'email': email, 'password': password})
    resp = client.post('/auth/login', data={'username': username, 'password': password})
    return resp.json().get('access_token', '')

def auth_headers(token):
    return {'Authorization': f'Bearer {token}'}

# ── Root ──────────────────────────────────────────────────────────────────────

def test_root():
    r = client.get('/')
    assert r.status_code == 200
    assert 'OpenClaw' in r.json()['status']

# ── Auth ──────────────────────────────────────────────────────────────────────

def test_register_success():
    r = client.post('/auth/register', json={
        'username': 'newuser1', 'email': 'new1@test.com', 'password': 'password123'
    })
    assert r.status_code == 200
    data = r.json()
    assert 'access_token' in data
    assert data['user']['username'] == 'newuser1'

def test_register_short_password():
    r = client.post('/auth/register', json={
        'username': 'shortpw', 'email': 'short@test.com', 'password': '123'
    })
    assert r.status_code == 400

def test_register_duplicate():
    client.post('/auth/register', json={
        'username': 'dupuser', 'email': 'dup@test.com', 'password': 'password123'
    })
    r = client.post('/auth/register', json={
        'username': 'dupuser', 'email': 'dup@test.com', 'password': 'password123'
    })
    assert r.status_code == 400

def test_login_success():
    client.post('/auth/register', json={
        'username': 'logintest', 'email': 'login@test.com', 'password': 'mypassword'
    })
    r = client.post('/auth/login', data={'username': 'logintest', 'password': 'mypassword'})
    assert r.status_code == 200
    assert 'access_token' in r.json()

def test_login_wrong_password():
    client.post('/auth/register', json={
        'username': 'wrongpw', 'email': 'wrongpw@test.com', 'password': 'correct'
    })
    r = client.post('/auth/login', data={'username': 'wrongpw', 'password': 'wrong'})
    assert r.status_code == 401

def test_me_authenticated():
    token = register_and_login('meuser', 'me@test.com', 'mepassword')
    r = client.get('/auth/me', headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json()['username'] == 'meuser'

def test_me_unauthenticated():
    r = client.get('/auth/me')
    assert r.status_code == 401

# ── Workflows ─────────────────────────────────────────────────────────────────

SAMPLE_WORKFLOW = {
    'name': 'Test workflow',
    'description': 'Automated test',
    'trigger': {'type': 'manual'},
    'conditions': [],
    'actions': [{'type': 'notify', 'message': 'Hello'}],
    'error_policy': {'retry_count': 1, 'on_failure': 'notify_user'},
}

def test_create_workflow():
    r = client.post('/workflows', json=SAMPLE_WORKFLOW)
    assert r.status_code == 200
    data = r.json()
    assert data['name'] == 'Test workflow'
    assert 'id' in data
    assert data['version'] == 1

def test_list_workflows():
    client.post('/workflows', json=SAMPLE_WORKFLOW)
    r = client.get('/workflows')
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1

def test_get_workflow():
    create = client.post('/workflows', json=SAMPLE_WORKFLOW).json()
    r = client.get(f"/workflows/{create['id']}")
    assert r.status_code == 200
    assert r.json()['id'] == create['id']

def test_get_workflow_not_found():
    r = client.get('/workflows/nonexistent-id')
    assert r.status_code == 404

def test_update_workflow():
    wid  = client.post('/workflows', json=SAMPLE_WORKFLOW).json()['id']
    body = {**SAMPLE_WORKFLOW, 'name': 'Updated name'}
    r    = client.put(f'/workflows/{wid}', json=body)
    assert r.status_code == 200
    assert r.json()['name'] == 'Updated name'
    assert r.json()['version'] == 2

def test_toggle_workflow():
    wid   = client.post('/workflows', json=SAMPLE_WORKFLOW).json()['id']
    r     = client.patch(f'/workflows/{wid}/toggle')
    assert r.status_code == 200
    assert r.json()['enabled'] == False
    r2    = client.patch(f'/workflows/{wid}/toggle')
    assert r2.json()['enabled'] == True

def test_delete_workflow():
    wid = client.post('/workflows', json=SAMPLE_WORKFLOW).json()['id']
    r   = client.delete(f'/workflows/{wid}')
    assert r.status_code == 200
    r2  = client.get(f'/workflows/{wid}')
    assert r2.status_code == 404

def test_export_workflow():
    wid  = client.post('/workflows', json=SAMPLE_WORKFLOW).json()['id']
    r    = client.get(f'/workflows/{wid}/export')
    assert r.status_code == 200
    data = r.json()
    assert 'id' not in data          # runtime fields stripped
    assert data['name'] == 'Test workflow'

def test_import_workflow():
    payload = {**SAMPLE_WORKFLOW, 'name': 'Imported workflow'}
    r = client.post('/workflows/import', json=payload)
    assert r.status_code == 200
    assert r.json()['name'] == 'Imported workflow'

# ── State / devices ───────────────────────────────────────────────────────────

def test_get_state():
    r = client.get('/state')
    assert r.status_code == 200
    data = r.json()
    assert 'sensor/motion' in data
    assert 'device/light' in data

def test_control_device():
    r = client.post('/state/device/light', json={'value': True})
    assert r.status_code == 200
    assert r.json()['ok'] == True
    state = client.get('/state').json()
    assert state['device/light']['value'] == True

def test_control_unknown_device():
    r = client.post('/state/device/teleporter', json={'value': True})
    assert r.status_code == 404

# ── Templates ─────────────────────────────────────────────────────────────────

def test_list_templates():
    r = client.get('/templates')
    assert r.status_code == 200
    assert len(r.json()) == 15

def test_list_templates_by_category():
    r = client.get('/templates?category=Security')
    assert r.status_code == 200
    for t in r.json():
        assert t['category'] == 'Security'

def test_activate_template():
    r = client.post('/templates/t1/activate')
    assert r.status_code == 200
    assert r.json()['name'] == 'Night lighting'

def test_activate_unknown_template():
    r = client.post('/templates/nonexistent/activate')
    assert r.status_code == 404

# ── Logs ──────────────────────────────────────────────────────────────────────

def test_get_execlog():
    r = client.get('/execlog')
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_get_notifications():
    r = client.get('/notifications')
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_get_audit():
    r = client.get('/audit')
    assert r.status_code == 200
    assert isinstance(r.json(), list)

# ── Settings ──────────────────────────────────────────────────────────────────

def test_get_settings_authenticated():
    token = register_and_login('setuser', 'set@test.com', 'setpassword')
    r = client.get('/settings', headers=auth_headers(token))
    assert r.status_code == 200
    assert 'model' in r.json()

def test_get_settings_unauthenticated():
    r = client.get('/settings')
    assert r.status_code == 401

# ── Simulation engine ─────────────────────────────────────────────────────────

def test_simulation_state_has_all_sensors():
    state = client.get('/state').json()
    expected = ['sensor/motion', 'sensor/temperature', 'sensor/moisture',
                'sensor/door', 'sensor/light_level']
    for key in expected:
        assert key in state, f"Missing: {key}"

def test_simulation_state_has_all_devices():
    state = client.get('/state').json()
    expected = ['device/light', 'device/fan', 'device/pump', 'device/camera', 'device/robot']
    for key in expected:
        assert key in state, f"Missing: {key}"

# ── Rate limiting ─────────────────────────────────────────────────────────────

def test_rate_limit_register():
    """After 10 attempts, should get 429."""
    responses = []
    for i in range(12):
        r = client.post('/auth/register', json={
            'username': f'ratelimit_u{i}', 'email': f'rl{i}@test.com', 'password': 'password123'
        })
        responses.append(r.status_code)
    assert 429 in responses, "Rate limit should have fired after 10 attempts"

# ── WebSocket ─────────────────────────────────────────────────────────────────

def test_websocket_connects():
    from starlette.testclient import TestClient as SC
    with SC(app).websocket_connect('/ws') as ws:
        # should connect without error
        pass

# ── Execution engine ──────────────────────────────────────────────────────────

def test_execution_engine_time_trigger():
    """Workflow with time trigger should not crash the engine."""
    r = client.post('/workflows', json={
        'name': 'Time trigger test',
        'trigger': {'type': 'time', 'cron': '0 7 * * *'},
        'conditions': [],
        'actions': [{'type': 'notify', 'message': 'Good morning'}],
        'error_policy': {'retry_count': 1, 'on_failure': 'ignore'},
    })
    assert r.status_code == 200
    assert r.json()['trigger']['type'] == 'time'

def test_run_workflow_immediately():
    wid = client.post('/workflows', json={
        'name': 'Immediate run',
        'trigger': {'type': 'manual'},
        'conditions': [],
        'actions': [{'type': 'notify', 'message': 'Test run'}],
        'error_policy': {'retry_count': 1, 'on_failure': 'ignore'},
    }).json()['id']
    r = client.post(f'/workflows/{wid}/run')
    assert r.status_code == 200
    assert r.json()['status'] == 'triggered'

# ── Import / Export round-trip ────────────────────────────────────────────────

def test_export_import_roundtrip():
    # Create original
    wid = client.post('/workflows', json={
        'name': 'Round-trip test',
        'description': 'Export then import',
        'trigger': {'type': 'manual'},
        'conditions': [],
        'actions': [{'type': 'notify', 'message': 'round trip'}],
        'error_policy': {'retry_count': 2, 'on_failure': 'notify_user'},
    }).json()['id']

    # Export
    exported = client.get(f'/workflows/{wid}/export').json()
    assert 'id' not in exported
    assert exported['name'] == 'Round-trip test'

    # Import back
    imported = client.post('/workflows/import', json=exported).json()
    assert imported['name'] == 'Round-trip test'
    assert imported['id'] != wid   # new ID assigned

# ── Settings ──────────────────────────────────────────────────────────────────

def test_change_password():
    token = register_and_login('pwchange', 'pwchange@test.com', 'oldpassword')
    r = client.put('/settings/password',
        json={'old_password': 'oldpassword', 'new_password': 'newpassword123'},
        headers=auth_headers(token))
    assert r.status_code == 200

def test_change_password_wrong_old():
    token = register_and_login('pwwrong', 'pwwrong@test.com', 'mypassword')
    r = client.put('/settings/password',
        json={'old_password': 'wrongpassword', 'new_password': 'newpass123'},
        headers=auth_headers(token))
    assert r.status_code == 401

import React, { useState, useEffect } from 'react'
import { api } from '../api.js'

const DEVICE_TYPES = [
  { id: 'light',   label: 'Light',   icon: '◎', sensor: false },
  { id: 'switch',  label: 'Switch',  icon: '◈', sensor: false },
  { id: 'fan',     label: 'Fan',     icon: '◷', sensor: false },
  { id: 'pump',    label: 'Pump',    icon: '⬡', sensor: false },
  { id: 'camera',  label: 'Camera',  icon: '◩', sensor: false },
  { id: 'robot',   label: 'Robot',   icon: '⬡', sensor: false },
  { id: 'sensor',  label: 'Sensor',  icon: '◎', sensor: true  },
  { id: 'other',   label: 'Other',   icon: '◈', sensor: false },
]

const ROOM_ICONS = ['◎','◈','◩','⬡','◷','▷']

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-xs font-body text-claw-sub uppercase tracking-widest">{label}</label>
        {hint && <span className="text-xs font-body text-claw-sub/60 normal-case tracking-normal">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, className = '', type = 'text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-claw-bg border border-claw-border rounded-xl px-3 py-2.5
        text-sm font-body text-claw-text placeholder-claw-sub
        focus:outline-none focus:border-claw-muted transition-colors ${className}`} />
  )
}

function DeviceModal({ device, rooms, onSave, onClose }) {
  const isNew = !device?.id
  const [form, setForm] = useState(device || {
    name: '', device_type: 'light', room: '', icon: '◎',
    is_sensor: false, mqtt_topic_get: '', mqtt_topic_set: '', unit: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const typeInfo = DEVICE_TYPES.find(t => t.id === form.device_type)

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (isNew) await api.addDevice(form)
      else       await api.updateDevice(device.id, form)
      onSave()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true); setTestMsg(null)
    try {
      const r = await api.testDevice(device.id, { payload: 'ON' })
      setTestMsg(r.via === 'hardware'
        ? `✓ Sent "ON" to ${r.topic}`
        : `MQTT not connected — command would go to ${r.topic}`)
    } catch (err) { setTestMsg(`Error: ${err.message}`) }
    finally { setTesting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-claw-surface border border-claw-border rounded-2xl w-full max-w-lg
        max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-claw-border">
          <h3 className="font-display text-base text-claw-text">
            {isNew ? 'Add device' : 'Edit device'}
          </h3>
          <button onClick={onClose} className="text-claw-sub hover:text-claw-text text-sm">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={v => set('name', v)} placeholder="Bedroom light" />
          </Field>

          <Field label="Type">
            <div className="grid grid-cols-4 gap-2">
              {DEVICE_TYPES.map(t => (
                <button key={t.id} onClick={() => { set('device_type', t.id); set('is_sensor', t.sensor) }}
                  className={`py-2 rounded-xl border text-xs font-body transition-all flex flex-col items-center gap-1
                    ${form.device_type === t.id
                      ? 'border-claw-amber/40 bg-claw-amber/10 text-claw-amber'
                      : 'border-claw-border text-claw-sub hover:border-claw-muted'}`}>
                  <span className="font-mono">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Room">
              <select value={form.room} onChange={e => set('room', e.target.value)}
                className="w-full bg-claw-bg border border-claw-border rounded-xl px-3 py-2.5
                  text-sm font-body text-claw-text focus:outline-none focus:border-claw-muted">
                <option value="">No room</option>
                {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Icon">
              <div className="flex gap-1.5 flex-wrap">
                {ROOM_ICONS.map(ic => (
                  <button key={ic} onClick={() => set('icon', ic)}
                    className={`w-9 h-9 rounded-xl border font-mono text-base
                      ${form.icon === ic
                        ? 'border-claw-amber/40 bg-claw-amber/10 text-claw-amber'
                        : 'border-claw-border text-claw-sub hover:border-claw-muted'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* MQTT topics */}
          <div className="pt-2 space-y-3 border-t border-claw-border">
            <p className="text-claw-sub text-xs font-body uppercase tracking-widest">MQTT topics</p>
            <Field label="Subscribe topic" hint="— reads sensor values from this topic">
              <Input value={form.mqtt_topic_get} onChange={v => set('mqtt_topic_get', v)}
                placeholder="home/bedroom/temperature" />
            </Field>
            <Field label="Publish topic" hint="— sends commands to this topic">
              <Input value={form.mqtt_topic_set} onChange={v => set('mqtt_topic_set', v)}
                placeholder="home/bedroom/light/set" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit" hint="(optional)">
                <Input value={form.unit} onChange={v => set('unit', v)} placeholder="°C / % / lux" />
              </Field>
              <Field label="Notes">
                <Input value={form.notes} onChange={v => set('notes', v)} placeholder="ESP32 pin 4" />
              </Field>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center gap-3 flex-wrap">
          {!isNew && form.mqtt_topic_set && (
            <button onClick={handleTest} disabled={testing}
              className="px-4 py-2 rounded-xl border border-claw-border text-claw-sub
                text-xs font-body hover:text-claw-text hover:bg-claw-muted/40 transition-all disabled:opacity-50">
              {testing ? 'Testing…' : '▷ Test (send ON)'}
            </button>
          )}
          {testMsg && <span className="text-xs font-body text-claw-sub flex-1">{testMsg}</span>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl border border-claw-border text-claw-sub
                text-sm font-body hover:text-claw-text transition-all">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded-xl bg-claw-accent text-claw-bg text-sm
                font-body font-medium hover:bg-claw-accentdim transition-all disabled:opacity-50">
              {saving ? 'Saving…' : isNew ? 'Add device' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DevicesView() {
  const [devices, setDevices] = useState([])
  const [rooms, setRooms]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)  // null | 'device' | 'room'
  const [editing, setEditing] = useState(null)
  const [newRoom, setNewRoom] = useState('')

  async function refresh() {
    const [d, r] = await Promise.all([api.listDevices(), api.listRooms()])
    setDevices(d); setRooms(r); setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this device?')) return
    await api.deleteDevice(id)
    refresh()
  }

  async function addRoom() {
    if (!newRoom.trim()) return
    await api.addRoom({ name: newRoom, icon: '◎' })
    setNewRoom(''); refresh()
  }

  const byRoom = {}
  devices.forEach(d => {
    const r = d.room || 'Unassigned'
    if (!byRoom[r]) byRoom[r] = []
    byRoom[r].push(d)
  })

  return (
    <div className="flex flex-col h-full overflow-hidden bg-claw-bg">
      <div className="px-6 py-5 border-b border-claw-border bg-claw-surface/50 shrink-0
        flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg text-claw-text">Devices</h2>
          <p className="text-claw-sub text-xs font-body mt-0.5">
            {devices.length} registered · connect real hardware via MQTT
          </p>
        </div>
        <button onClick={() => { setEditing(null); setModal('device') }}
          className="px-4 py-2 rounded-xl bg-claw-accent text-claw-bg text-sm
            font-body font-medium hover:bg-claw-accentdim transition-all">
          + Add device
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-claw-sub animate-pulse_dot"
                  style={{ animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <span className="text-4xl text-claw-border">◈</span>
            <div>
              <p className="text-claw-text text-sm font-body font-medium mb-1">No devices yet</p>
              <p className="text-claw-sub text-xs font-body max-w-xs leading-relaxed">
                Add your real devices with their MQTT topics. OpenClaw will control them
                directly and show real data on the dashboard.
              </p>
            </div>
            <button onClick={() => { setEditing(null); setModal('device') }}
              className="px-5 py-2.5 rounded-xl bg-claw-accent text-claw-bg text-sm
                font-body font-medium hover:bg-claw-accentdim transition-all">
              + Add first device
            </button>
          </div>
        ) : (
          Object.entries(byRoom).map(([room, devs]) => (
            <div key={room}>
              <p className="text-claw-sub text-xs font-body uppercase tracking-widest mb-3">
                {room}
              </p>
              <div className="space-y-2">
                {devs.map(d => (
                  <div key={d.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border
                      border-claw-border bg-claw-surface hover:border-claw-muted transition-all group">
                    <span className="font-mono text-claw-sub w-6 text-center">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-claw-text text-sm font-body font-medium">{d.name}</span>
                        <span className={`text-xs font-body px-1.5 py-0.5 rounded-full
                          ${d.is_sensor
                            ? 'bg-claw-blue/10 text-claw-blue'
                            : 'bg-claw-accent/10 text-claw-accent'}`}>
                          {d.is_sensor ? 'sensor' : d.device_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {d.mqtt_topic_get && (
                          <span className="text-claw-sub text-xs font-mono truncate">
                            ↓ {d.mqtt_topic_get}
                          </span>
                        )}
                        {d.mqtt_topic_set && (
                          <span className="text-claw-sub text-xs font-mono truncate">
                            ↑ {d.mqtt_topic_set}
                          </span>
                        )}
                        {!d.mqtt_topic_get && !d.mqtt_topic_set && (
                          <span className="text-claw-sub/50 text-xs font-body">no MQTT topics set</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(d); setModal('device') }}
                        className="w-7 h-7 rounded-lg text-claw-sub hover:text-claw-text
                          hover:bg-claw-muted text-xs flex items-center justify-center">
                        ✎
                      </button>
                      <button onClick={() => handleDelete(d.id)}
                        className="w-7 h-7 rounded-lg text-claw-sub hover:text-red-400
                          hover:bg-red-500/10 text-xs flex items-center justify-center">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Rooms section */}
        <div>
          <p className="text-claw-sub text-xs font-body uppercase tracking-widest mb-3">Rooms</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {rooms.map(r => (
              <span key={r.id} className="px-3 py-1.5 rounded-full bg-claw-surface border
                border-claw-border text-claw-sub text-xs font-body">
                {r.icon} {r.name}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newRoom} onChange={e => setNewRoom(e.target.value)}
              placeholder="New room name…"
              onKeyDown={e => e.key === 'Enter' && addRoom()}
              className="flex-1 bg-claw-bg border border-claw-border rounded-xl px-3 py-2
                text-sm font-body text-claw-text placeholder-claw-sub
                focus:outline-none focus:border-claw-muted transition-colors" />
            <button onClick={addRoom} disabled={!newRoom.trim()}
              className="px-3 py-2 rounded-xl bg-claw-muted border border-claw-border
                text-claw-sub text-sm hover:text-claw-text transition-all disabled:opacity-40">
              Add
            </button>
          </div>
        </div>
      </div>

      {modal === 'device' && (
        <DeviceModal
          device={editing}
          rooms={rooms}
          onSave={() => { setModal(null); setEditing(null); refresh() }}
          onClose={() => { setModal(null); setEditing(null) }}
        />
      )}
    </div>
  )
}
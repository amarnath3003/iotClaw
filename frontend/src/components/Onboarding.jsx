import React, { useState } from 'react'
import { api } from '../api.js'

const STEPS = [
  { id: 'welcome',  label: 'Welcome'  },
  { id: 'mode',     label: 'Setup'    },
  { id: 'first',    label: 'First step' },
]

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState(null)  // 'simulation' | 'hardware'
  const [done, setDone] = useState(false)

  async function finish() {
    setDone(true)
    try { await api.completeOnboarding() } catch {}
    onComplete()
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-claw-bg flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 rounded-xl bg-claw-accent/20 flex items-center justify-center">
            <span className="text-claw-accent font-mono font-bold text-xl">⌥</span>
          </div>
          <span className="font-display text-2xl text-claw-text">OpenClaw</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className={`flex items-center gap-2 ${i <= step ? 'text-claw-text' : 'text-claw-sub'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-body
                  ${i < step  ? 'bg-claw-accent text-claw-bg' :
                    i === step ? 'border border-claw-accent text-claw-accent' :
                                 'border border-claw-border text-claw-sub'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-xs font-body hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${i < step ? 'bg-claw-accent' : 'bg-claw-border'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-claw-surface border border-claw-border rounded-2xl p-8 space-y-6">

          {step === 0 && (
            <>
              <div className="text-center space-y-3">
                <h2 className="font-display text-2xl text-claw-text">Welcome to OpenClaw</h2>
                <p className="text-claw-sub font-body leading-relaxed">
                  OpenClaw is an AI-powered automation platform for your smart home and IoT devices.
                  You talk to it in plain language — it controls your lights, sensors, robots, and more.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: '◈', title: 'Chat to automate', desc: 'Say "turn on the fan when it gets hot" and it just works' },
                  { icon: '⬡', title: 'Build workflows', desc: 'Visual editor for trigger → condition → action automations' },
                  { icon: '◩', title: 'Real hardware support', desc: 'Connect ESP32, Raspberry Pi, any MQTT device' },
                ].map(f => (
                  <div key={f.icon} className="flex items-start gap-3 px-4 py-3 rounded-xl
                    bg-claw-muted/30 border border-claw-border">
                    <span className="font-mono text-claw-accent mt-0.5">{f.icon}</span>
                    <div>
                      <p className="text-claw-text text-sm font-body font-medium">{f.title}</p>
                      <p className="text-claw-sub text-xs font-body mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl text-claw-text">How do you want to start?</h2>
                <p className="text-claw-sub text-sm font-body">You can change this later in Settings.</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => setMode('simulation')}
                  className={`w-full px-5 py-4 rounded-xl border text-left transition-all
                    ${mode === 'simulation'
                      ? 'border-claw-accent/40 bg-claw-accent/10'
                      : 'border-claw-border hover:border-claw-muted'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`font-mono text-lg mt-0.5 ${mode === 'simulation' ? 'text-claw-accent' : 'text-claw-sub'}`}>◎</span>
                    <div>
                      <p className={`text-sm font-body font-medium ${mode === 'simulation' ? 'text-claw-text' : 'text-claw-sub'}`}>
                        Try with simulation
                      </p>
                      <p className="text-claw-sub text-xs font-body mt-1 leading-relaxed">
                        Virtual sensors and devices. No hardware needed. Perfect for exploring
                        the platform and building automations to deploy later.
                      </p>
                    </div>
                  </div>
                </button>

                <button onClick={() => setMode('hardware')}
                  className={`w-full px-5 py-4 rounded-xl border text-left transition-all
                    ${mode === 'hardware'
                      ? 'border-claw-amber/40 bg-claw-amber/10'
                      : 'border-claw-border hover:border-claw-muted'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`font-mono text-lg mt-0.5 ${mode === 'hardware' ? 'text-claw-amber' : 'text-claw-sub'}`}>⬡</span>
                    <div>
                      <p className={`text-sm font-body font-medium ${mode === 'hardware' ? 'text-claw-text' : 'text-claw-sub'}`}>
                        Connect real devices
                      </p>
                      <p className="text-claw-sub text-xs font-body mt-1 leading-relaxed">
                        I have an ESP32, Raspberry Pi, or other MQTT-capable hardware ready.
                        I'll add my devices with their MQTT topics.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl text-claw-text">
                  {mode === 'hardware' ? "Here's how to connect" : "You're ready to go"}
                </h2>
              </div>

              {mode === 'simulation' ? (
                <div className="space-y-3">
                  <p className="text-claw-sub text-sm font-body leading-relaxed">
                    The dashboard shows live simulated data — temperature, motion, moisture and more.
                    All of it responds to your automations in real time.
                  </p>
                  <div className="space-y-2">
                    {[
                      'Go to Chat and describe what you want to automate',
                      'Try: "Turn on the light when motion is detected at night"',
                      'Save the generated workflow and watch it fire on the Dashboard',
                      'When ready, add real devices in the Devices view',
                    ].map((t, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-claw-accent font-mono text-xs mt-0.5 shrink-0">
                          {i + 1}.
                        </span>
                        <p className="text-claw-sub text-xs font-body leading-relaxed">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="px-4 py-3 rounded-xl bg-claw-muted/30 border border-claw-border">
                    <p className="text-claw-text text-xs font-body font-medium mb-2">Step 1 — Install Mosquitto MQTT broker</p>
                    <code className="text-claw-accent text-xs font-mono block">
                      # Windows: download from mosquitto.org<br/>
                      # Then run: mosquitto -v
                    </code>
                  </div>
                  <div className="px-4 py-3 rounded-xl bg-claw-muted/30 border border-claw-border">
                    <p className="text-claw-text text-xs font-body font-medium mb-2">Step 2 — Set your MQTT host in .env</p>
                    <code className="text-claw-accent text-xs font-mono">MQTT_HOST=localhost</code>
                  </div>
                  <div className="px-4 py-3 rounded-xl bg-claw-muted/30 border border-claw-border">
                    <p className="text-claw-text text-xs font-body font-medium mb-2">Step 3 — Add your devices</p>
                    <p className="text-claw-sub text-xs font-body">
                      Go to Devices → Add device. Enter the MQTT topic your device publishes to
                      and the topic it listens on for commands.
                    </p>
                  </div>
                  <div className="px-4 py-3 rounded-xl bg-claw-muted/30 border border-claw-border">
                    <p className="text-claw-text text-xs font-body font-medium mb-2">Step 4 — Flash your ESP32</p>
                    <p className="text-claw-sub text-xs font-body">
                      See the README for the ESP32 firmware template that connects to Mosquitto
                      and publishes sensor data + accepts device commands.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-4 py-2 rounded-xl border border-claw-border text-claw-sub text-sm
                font-body hover:text-claw-text transition-all disabled:opacity-0">
              ← Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !mode}
                className="px-6 py-2.5 rounded-xl bg-claw-accent text-claw-bg text-sm
                  font-body font-medium hover:bg-claw-accentdim transition-all disabled:opacity-50">
                Continue →
              </button>
            ) : (
              <button onClick={finish} disabled={done}
                className="px-6 py-2.5 rounded-xl bg-claw-accent text-claw-bg text-sm
                  font-body font-medium hover:bg-claw-accentdim transition-all disabled:opacity-50">
                {done ? 'Opening…' : "Let's go →"}
              </button>
            )}
          </div>
        </div>

        <p className="text-claw-sub text-xs font-body text-center mt-4">
          You can revisit this guide anytime in Settings → Getting started
        </p>
      </div>
    </div>
  )
}
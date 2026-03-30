const nav = [
  ['dashboard', 'Dashboard'],
  ['chat', 'Chat'],
  ['workflows', 'Workflows'],
  ['editor', 'Editor'],
  ['templates', 'Templates'],
]

const modes = ['simulation', 'mqtt', 'hybrid']

export default function Sidebar({ activeView, setActiveView, mode, setMode }) {
  return (
    <aside className="bg-claw-900 text-claw-50 p-5">
      <h1 className="font-serif text-2xl mb-6">IoT Claw</h1>
      <nav className="space-y-2 mb-8">
        {nav.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`w-full text-left px-3 py-2 rounded ${activeView === id ? 'bg-claw-600' : 'bg-claw-800'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-wide">Mode</p>
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`w-full text-left px-3 py-2 rounded ${mode === m ? 'bg-claw-500' : 'bg-claw-800'}`}
          >
            {m}
          </button>
        ))}
      </div>
    </aside>
  )
}

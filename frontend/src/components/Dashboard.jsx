import { useEffect, useState } from 'react'
import { getState } from '../api'

export default function Dashboard() {
  const [state, setState] = useState({})

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      const next = await getState()
      if (mounted) setState(next)
    }
    tick()
    const id = setInterval(tick, 1500)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <section>
      <h2 className="font-serif text-3xl mb-4">Live Dashboard</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(state).map(([k, v]) => (
          <article key={k} className="bg-white border border-claw-200 rounded-xl p-4">
            <p className="font-mono text-xs text-claw-700">{k}</p>
            <p className="text-2xl font-semibold">{String(v)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { deleteWorkflow, getWorkflows, runWorkflow } from '../api'

export default function WorkflowList() {
  const [items, setItems] = useState([])

  async function load() {
    setItems(await getWorkflows())
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <section>
      <h2 className="font-serif text-3xl mb-4">Saved Workflows</h2>
      <div className="space-y-3">
        {items.map((wf) => (
          <article key={wf.id} className="bg-white border border-claw-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{wf.name}</h3>
              <p className="text-sm text-claw-700">{wf.enabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => runWorkflow(wf.id)} className="px-3 py-2 rounded bg-claw-600 text-white">Run</button>
              <button onClick={async () => { await deleteWorkflow(wf.id); load() }} className="px-3 py-2 rounded border border-claw-300">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

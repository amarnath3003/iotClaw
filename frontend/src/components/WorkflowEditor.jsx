import { useState } from 'react'
import { createWorkflow } from '../api'

const blank = {
  name: 'New Workflow',
  definition: {
    trigger: { sensor: 'temperature', operator: '>', value: 30 },
    condition: { field: 'humidity', equals: 50 },
    action: { device: 'fan_1', value: 'on' },
  },
  enabled: true,
}

export default function WorkflowEditor() {
  const [workflow, setWorkflow] = useState(blank)

  async function save() {
    await createWorkflow(workflow)
    alert('Workflow saved')
  }

  return (
    <section className="grid md:grid-cols-2 gap-4">
      <div className="bg-white border border-claw-200 rounded-xl p-4">
        <h2 className="font-serif text-3xl mb-4">Workflow Editor</h2>
        <label className="block mb-3">
          <span className="text-sm">Name</span>
          <input
            className="w-full border border-claw-300 rounded px-3 py-2"
            value={workflow.name}
            onChange={(e) => setWorkflow((w) => ({ ...w, name: e.target.value }))}
          />
        </label>
        <button onClick={save} className="bg-claw-600 text-white px-4 py-2 rounded">Save Workflow</button>
      </div>
      <pre className="bg-claw-900 text-claw-50 rounded-xl p-4 overflow-x-auto text-sm">{JSON.stringify(workflow.definition, null, 2)}</pre>
    </section>
  )
}

import { useState } from 'react'
import { rpc } from './api'
import type { Student } from './api'
import { errMsg } from './ui'

// One-time consent before any feedback is recorded or typed. Turning feedback on is the only thing the monthly perk depends on.
export function ConsentSheet({ token, onDone, onCancel }: { token: string | null; onDone: (s: Student) => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const agree = async () => {
    setBusy(true); setErr('')
    try { onDone(await rpc<Student>('set_feedback', { p_token: token, p_on: true })) }
    catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  return (
    <div className="sheet-bg" role="dialog" aria-modal="true" aria-label="Before you share feedback">
      <div className="sheet consent">
        <h2>Before you share feedback</h2>
        <p className="muted">Feedback is optional. Here is exactly what happens to it.</p>
        <ul>
          <li><b>We listen for up to 15 seconds</b> and turn it into text. We do not keep the audio.</li>
          <li><b>A speech service reads the audio once</b> to write the words (Groq). Nothing else is sent.</li>
          <li><b>The store sees your words and the mood</b>, labelled “Student”. Never your name, never your audio.</li>
          <li><b>You can turn it off any time</b> in Rewards. Skipping never costs you anything.</li>
        </ul>
        <div className="banner small">Keep feedback on and order 3 times in a month to earn that month’s perk. Nobody is paid per note.</div>
        {err && <div className="err">{err}</div>}
        <button className="btn dk" disabled={busy} onClick={agree}>{busy ? 'Turning on…' : 'I agree, turn feedback on'}</button>
        <button className="btn ghost" style={{ marginTop: 8 }} disabled={busy} onClick={onCancel}>Not now</button>
      </div>
    </div>
  )
}

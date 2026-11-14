import { createClient } from 'npm:@supabase/supabase-js@2'

// Emails a 6-digit code for email verification or password reset (Brevo transactional email, free tier).
// The code is generated and stored (hashed) by issue_email_code; this function only delivers it.
// It never reveals whether an account exists.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const { email, role, purpose } = await req.json()
    const em = String(email ?? '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(em) || !['student', 'vendor'].includes(role) || !['verify', 'reset'].includes(purpose)) {
      return json({ error: 'Enter a valid email' }, 400)
    }
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: secrets } = await db.from('app_secrets').select('name, value').in('name', ['brevo_api_key', 'mail_sender'])
    const key = secrets?.find(s => s.name === 'brevo_api_key')?.value
    const sender = secrets?.find(s => s.name === 'mail_sender')?.value
    if (!key || !sender) return json({ error: 'Email verification is not set up yet' }, 503)

    const { data: code, error } = await db.rpc('issue_email_code', { p_email: em, p_role: role, p_purpose: purpose })
    if (error) return json({ error: error.message.includes('Too many') ? error.message : 'Could not create a code' }, error.message.includes('Too many') ? 429 : 500)
    if (!code) return json({ ok: true }) // no matching account (or already verified): same answer, so emails can't be probed

    const what = purpose === 'verify' ? 'verify your email' : 'reset your password'
    const html = `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #efe8d6;border-radius:16px">
      <div style="font-size:22px;font-weight:800;color:#231f14">Looply</div>
      <p style="color:#231f14">Use this code to ${what}:</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#ffc72c;color:#231f14;padding:14px;border-radius:12px;text-align:center">${esc(String(code))}</div>
      <p style="color:#8a8372;font-size:13px">It expires in 10 minutes. If you did not ask for this, you can ignore this email.</p></div>`
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: sender, name: 'Looply' },
        to: [{ email: em }],
        subject: `Your Looply code: ${code}`,
        htmlContent: html,
        textContent: `Your Looply code to ${what} is ${code}. It expires in 10 minutes.`,
      }),
    })
    if (!res.ok) {
      console.error('brevo', res.status, await res.text())
      return json({ error: 'Could not send the email. Try again shortly.' }, 502)
    }
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Something went wrong' }, 500)
  }
})

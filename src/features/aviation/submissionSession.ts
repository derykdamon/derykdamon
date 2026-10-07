// Persist only an opaque key, payload fingerprint, and receipt in this tab.
// Contact and travel details are never written to browser storage.
export type SubmissionSession = { key: string; fingerprint: string; reference?: string }
const storageName = 'hrl-aviation-submission-v1'
export function readSubmission(): SubmissionSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageName) ?? 'null')
    return value && /^[0-9a-f-]{36}$/.test(value.key) && /^[0-9a-f]{64}$/.test(value.fingerprint) && (!value.reference || /^HRL-[0-9A-F]{12}$/.test(value.reference)) ? value : null
  } catch { return null }
}
export function saveSubmission(value: SubmissionSession | null) {
  try { if (value) sessionStorage.setItem(storageName, JSON.stringify(value)); else sessionStorage.removeItem(storageName) } catch { /* Private browsing can disable storage; in-memory retries still work. */ }
}
export async function fingerprint(payload: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))), byte => byte.toString(16).padStart(2, '0')).join('')
}

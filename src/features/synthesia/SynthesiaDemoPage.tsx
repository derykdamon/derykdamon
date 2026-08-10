import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Film,
  LoaderCircle,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'

type TemplateVariable = {
  id: string
  type?: string
  value?: string
}

type SynthesiaTemplate = {
  id: string
  title?: string
  description?: string
  variables?: TemplateVariable[]
}

type VideoResult = {
  id?: string
  status?: string
  title?: string
  download?: string
  share?: string
  shareUrl?: string
  error?: string
  [key: string]: unknown
}

function extractTemplates(payload: unknown): SynthesiaTemplate[] {
  if (Array.isArray(payload)) return payload as SynthesiaTemplate[]
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  for (const key of ['templates', 'results', 'data']) {
    if (Array.isArray(record[key])) return record[key] as SynthesiaTemplate[]
  }

  return []
}

function SynthesiaDemoPage() {
  const [templates, setTemplates] = useState<SynthesiaTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({})
  const [title, setTitle] = useState('Synthesia API Demo')
  const [testMode, setTestMode] = useState(true)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [video, setVideo] = useState<VideoResult | null>(null)

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templateId, templates],
  )

  useEffect(() => {
    void (async () => {
      setLoadingTemplates(true)
      setError('')
      try {
        const response = await fetch('/api/synthesia-templates?limit=100')
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error ?? 'Unable to load Synthesia templates.')
        }

        const nextTemplates = extractTemplates(payload)
        setTemplates(nextTemplates)
        if (nextTemplates[0]) setTemplateId(nextTemplates[0].id)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load Synthesia templates.')
      } finally {
        setLoadingTemplates(false)
      }
    })()
  }, [])

  useEffect(() => {
    const defaults: Record<string, string> = {}
    selectedTemplate?.variables?.forEach((variable) => {
      defaults[variable.id] = variable.value ?? ''
    })
    setTemplateValues(defaults)
  }, [selectedTemplate])

  useEffect(() => {
    if (!video?.id) return undefined
    const normalized = String(video.status ?? '').toLowerCase()
    if (['complete', 'completed', 'failed', 'error'].includes(normalized)) return undefined

    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/synthesia-video?id=${encodeURIComponent(video.id ?? '')}`)
          const payload = (await response.json()) as VideoResult
          if (response.ok) setVideo(payload)
        } catch {
          // Keep the current state and try again on the next interval.
        }
      })()
    }, 10000)

    return () => window.clearInterval(timer)
  }, [video?.id, video?.status])

  const createVideo = async (event: FormEvent) => {
    event.preventDefault()
    if (!templateId) return

    setCreating(true)
    setError('')
    setVideo(null)

    try {
      const response = await fetch('/api/synthesia-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          templateData: templateValues,
          title,
          test: testMode,
          visibility: 'private',
        }),
      })
      const payload = (await response.json()) as VideoResult
      if (!response.ok) throw new Error(payload.error ?? 'Synthesia rejected the video request.')
      setVideo(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the video.')
    } finally {
      setCreating(false)
    }
  }

  const status = String(video?.status ?? (video?.id ? 'processing' : '')).toLowerCase()
  const ready = ['complete', 'completed'].includes(status)
  const videoUrl = video?.download || video?.shareUrl || video?.share

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <header className="border-b border-white/10 bg-[#080c18]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-300 to-cyan-300 text-slate-950">
              <Film size={20} />
            </div>
            <div>
              <p className="font-semibold text-white">Synthesia API Lab</p>
              <p className="text-xs text-slate-500">Programmatic video generation · demo0</p>
            </div>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
            <ArrowLeft size={16} />
            Website
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-medium text-violet-200">
              <Sparkles size={14} /> Creator API workspace
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Generate a Synthesia video from a published template.
            </h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-400">
              Choose one of your API-accessible Synthesia templates, populate its variables, submit a test render, and watch the job status from this page.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex gap-3 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">
              <CircleAlert className="mt-0.5 shrink-0" size={18} />
              <div>
                <p className="font-medium">Synthesia connection needs attention</p>
                <p className="mt-1 text-red-100/70">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={createVideo} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Template</label>
              <select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                disabled={loadingTemplates}
                className="w-full rounded-xl border border-white/10 bg-[#0b1120] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
              >
                {loadingTemplates && <option>Loading templates…</option>}
                {!loadingTemplates && templates.length === 0 && <option value="">No templates returned</option>}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title || template.id}
                  </option>
                ))}
              </select>
              {selectedTemplate?.description && (
                <p className="mt-2 text-xs leading-5 text-slate-500">{selectedTemplate.description}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Video title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0b1120] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
              />
            </div>

            {(selectedTemplate?.variables?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Template variables</h2>
                  <p className="mt-1 text-xs text-slate-500">These fields are reported by Synthesia for the selected published template.</p>
                </div>
                {selectedTemplate?.variables?.map((variable) => (
                  <div key={variable.id}>
                    <label className="mb-2 flex items-center justify-between text-sm text-slate-300">
                      <span>{variable.id}</span>
                      <span className="text-xs text-slate-600">{variable.type ?? 'variable'}</span>
                    </label>
                    <textarea
                      rows={variable.type === 'string' ? 4 : 2}
                      value={templateValues[variable.id] ?? ''}
                      onChange={(event) =>
                        setTemplateValues((current) => ({ ...current, [variable.id]: event.target.value }))
                      }
                      className="w-full resize-y rounded-xl border border-white/10 bg-[#0b1120] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
                    />
                  </div>
                ))}
              </div>
            ) : selectedTemplate ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
                This template does not report any API variables. Add script, text, media, or avatar variables in Synthesia and republish the template if you want them editable here.
              </div>
            ) : null}

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(event) => setTestMode(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-white">Test render</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Keep this enabled while developing. Synthesia test videos are watermarked and do not consume normal video quota.</span>
              </span>
            </label>

            <button
              type="submit"
              disabled={!templateId || creating}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? <LoaderCircle size={17} className="animate-spin" /> : <Play size={17} />}
              {creating ? 'Submitting…' : 'Generate video'}
            </button>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-[#080c18] p-6">
            <h2 className="font-semibold text-white">Render status</h2>
            {!video ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">No video has been submitted from this session yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  {ready ? (
                    <CheckCircle2 size={22} className="text-emerald-300" />
                  ) : (
                    <RefreshCw size={22} className="animate-spin text-cyan-300" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{video.status ?? 'Processing'}</p>
                    <p className="mt-0.5 break-all text-xs text-slate-600">{video.id}</p>
                  </div>
                </div>
                {videoUrl && (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
                  >
                    Open completed video
                  </a>
                )}
                <p className="text-xs leading-5 text-slate-500">Status is checked automatically about every 10 seconds while the job is processing.</p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#080c18] p-6">
            <h2 className="font-semibold text-white">Mouth / lip sync</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Synthesia performs avatar lip synchronization as part of rendering. The public Creator API does not document a separate mouth-timing or lip-sync-offset control.
            </p>
            <div className="mt-4 space-y-3 text-xs leading-5 text-slate-500">
              <p>For text-to-speech, improve timing with script pacing, pauses, pronunciation, voice selection, and the avatar/template itself.</p>
              <p>Synthesia supports script tags such as break and pronunciation substitution. Uploaded script audio can also drive an avatar, but Synthesia documents audio upload as an Enterprise feature.</p>
            </div>
          </section>

          <section className="rounded-3xl border border-violet-300/15 bg-violet-300/[0.05] p-6">
            <h2 className="font-semibold text-white">Recommended workflow</h2>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
              <li>1. Design the scene visually in Synthesia.</li>
              <li>2. Add variables to the script, text, media, and/or avatar.</li>
              <li>3. Publish it as a custom template.</li>
              <li>4. Use this page to generate personalized versions programmatically.</li>
            </ol>
          </section>
        </aside>
      </main>
    </div>
  )
}

export default SynthesiaDemoPage

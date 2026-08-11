import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  Eye,
  EyeOff,
  FileText,
  Layers3,
  LoaderCircle,
  MapPin,
  Maximize2,
  Network,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

type LoadState = 'loading' | 'ready' | 'error'

type TokenPayload = {
  accessToken?: string
  mapId?: string
  error?: string
}

type FloorOption = {
  id: string
  name: string
  elevation: number
}

type SpaceOption = {
  id: string
  name: string
  floorName: string
  raw: any
}

type OverlayState = {
  readiness: boolean
  equipment: boolean
  lowVoltage: boolean
  qc: boolean
  documents: boolean
}

const readinessMetrics = [
  { label: 'Equipment', value: 92, icon: Boxes },
  { label: 'Low voltage', value: 78, icon: Network },
  { label: 'QC closeout', value: 86, icon: ShieldCheck },
  { label: 'Documents', value: 71, icon: FileText },
]

const simulatedIssues = [
  'Missing final device label photo',
  'Patch panel verification pending',
  'UPS/PDU runtime confirmation needed',
]

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function getFloorNameForSpace(space: any, fallback: string) {
  return safeName(space?.floor?.name, fallback)
}

async function rebuildLabels(mapView: any, spaces: SpaceOption[]) {
  mapView.Labels.removeAll()

  await Promise.all(
    spaces.slice(0, 450).map((space) =>
      mapView.Labels.add(space.raw, space.name, {
        interactive: true,
        enabled: true,
        rank: 'always-visible',
        appearance: {
          margin: 8,
          maxLines: 2,
          maxWidth: 160,
          textSize: 11,
          textColor: '#111827',
          textOutlineColor: '#ffffff',
          pinColor: '#164e63',
          pinOutlineColor: '#ffffff',
        },
      }),
    ),
  )
}

function MappedinMissionControlDemoPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<any>(null)
  const spacesRef = useRef<SpaceOption[]>([])
  const tourTimerRef = useRef<number | null>(null)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [query, setQuery] = useState('')
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [selectedSpace, setSelectedSpace] = useState<SpaceOption | null>(null)
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [tourRunning, setTourRunning] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Select a space to inspect room-level operational data.')
  const [overlays, setOverlays] = useState<OverlayState>({
    readiness: true,
    equipment: true,
    lowVoltage: true,
    qc: true,
    documents: true,
  })

  const filteredSpaces = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return spaces.slice(0, 60)
    return spaces.filter((space) => space.name.toLowerCase().includes(value)).slice(0, 80)
  }, [query, spaces])

  const focusSpace = useCallback((space: SpaceOption) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(space.raw)
    mapView.Camera.set({ pitch: 55 })
    setSelectedSpace(space)
    setStatusMessage(`${space.name} selected. Operational data below is simulated until linked to the Mappedin space ID.`)
  }, [])

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return

    setLoadState('loading')
    setErrorMessage('')

    const tokenResponse = await fetch('/api/mappedin-token')
    const tokenPayload = (await tokenResponse.json()) as TokenPayload

    if (!tokenResponse.ok || !tokenPayload.accessToken || !tokenPayload.mapId) {
      throw new Error(tokenPayload.error ?? 'Mappedin token configuration could not be loaded.')
    }

    const mapData = await getMapData({ accessToken: tokenPayload.accessToken, mapId: tokenPayload.mapId })
    const mapView = await show3dMap(mapElement, mapData)

    mapViewRef.current = mapView
    mapView.Camera.interactions.set({ pan: true, zoom: true, bearingAndPitch: true })

    const floorOptions: FloorOption[] = mapData
      .getByType('floor')
      .map((floor: any) => ({
        id: String(floor.id),
        name: safeName(floor.name, `Level ${floor.elevation ?? ''}`),
        elevation: Number(floor.elevation ?? 0),
      }))
      .sort((a: FloorOption, b: FloorOption) => b.elevation - a.elevation)

    const currentFloorName = safeName(mapView.currentFloor?.name, 'Current floor')
    const spaceOptions: SpaceOption[] = mapData
      .getByType('space')
      .filter((space: any) => safeName(space.name, '').length > 0)
      .map((space: any) => ({
        id: String(space.id),
        name: safeName(space.name, 'Unnamed mapped space'),
        floorName: getFloorNameForSpace(space, currentFloorName),
        raw: space,
      }))
      .sort((a: SpaceOption, b: SpaceOption) => a.name.localeCompare(b.name))

    setFloors(floorOptions)
    setCurrentFloorId(mapView.currentFloor.id)
    setSpaces(spaceOptions)
    spacesRef.current = spaceOptions

    spaceOptions.forEach((space) => {
      mapView.updateState(space.raw, {
        interactive: true,
        hoverColor: '#38bdf8',
      })
    })

    await rebuildLabels(mapView, spaceOptions)

    mapView.on('floor-change', (event: any) => {
      setCurrentFloorId(event.floor.id)
      mapView.Camera.focusOn(event.floor)
      mapView.Camera.set({ pitch: 55 })
    })

    mapView.on('click', (event: any) => {
      const clickedSpace = event.spaces?.[0]
      const clickedLabel = event.labels?.[0]
      const id = String(clickedSpace?.id ?? '')

      if (clickedSpace && id) {
        const match = spacesRef.current.find((space) => space.id === id)
        if (match) focusSpace(match)
        return
      }

      if (clickedLabel?.text) {
        const match = spacesRef.current.find((space) => space.name === clickedLabel.text)
        if (match) focusSpace(match)
      }
    })

    mapView.Camera.focusOn(mapView.currentFloor)
    mapView.Camera.set({ pitch: 55, bearing: 0 })
    setLoadState('ready')
  }, [focusSpace])

  useEffect(() => {
    let cancelled = false

    void loadMap().catch((error: unknown) => {
      if (cancelled) return
      setErrorMessage(error instanceof Error ? error.message : 'The map failed to load.')
      setLoadState('error')
    })

    return () => {
      cancelled = true
      if (tourTimerRef.current) window.clearInterval(tourTimerRef.current)
      tourTimerRef.current = null
      mapViewRef.current?.destroy()
      mapViewRef.current = null
    }
  }, [loadMap, reloadKey])

  const changeFloor = (floorId: string) => {
    mapViewRef.current?.setFloor(floorId)
  }

  const toggleLabels = async () => {
    const mapView = mapViewRef.current
    if (!mapView) return

    if (labelsVisible) {
      mapView.Labels.removeAll()
      setLabelsVisible(false)
    } else {
      await rebuildLabels(mapView, spacesRef.current)
      setLabelsVisible(true)
    }
  }

  const rotate = (degrees: number) => {
    const mapView = mapViewRef.current
    if (!mapView) return
    mapView.Camera.set({ bearing: degrees, pitch: 55 })
  }

  const reset = () => {
    const mapView = mapViewRef.current
    if (!mapView) return
    mapView.Camera.focusOn(selectedSpace?.raw ?? mapView.currentFloor)
    mapView.Camera.set({ bearing: 0, pitch: 55 })
  }

  const enterFullscreen = async () => {
    if (!rootRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await rootRef.current.requestFullscreen()
  }

  const runTour = () => {
    if (tourTimerRef.current) {
      window.clearInterval(tourTimerRef.current)
      tourTimerRef.current = null
      setTourRunning(false)
      setStatusMessage('Guided tour stopped.')
      return
    }

    const candidates = spacesRef.current.slice(0, 12)
    if (candidates.length === 0) return

    let index = 0
    setTourRunning(true)
    setStatusMessage('Guided tour running through mapped spaces.')
    focusSpace(candidates[index])

    tourTimerRef.current = window.setInterval(() => {
      index = (index + 1) % candidates.length
      focusSpace(candidates[index])
    }, 3500)
  }

  const setOverlay = (key: keyof OverlayState) => {
    setOverlays((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div ref={rootRef} className="relative h-screen overflow-hidden bg-[#020617] text-white">
      <div ref={mapElementRef} className="absolute inset-0" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-8 text-center shadow-2xl">
            <LoaderCircle className="mx-auto animate-spin text-cyan-300" size={34} />
            <p className="mt-5 text-xl font-semibold">Loading ActivationOS Mission Control</p>
            <p className="mt-2 text-sm text-slate-400">Preparing map, labels, floors, and simulated operational overlays.</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617] px-6">
          <div className="max-w-lg rounded-3xl border border-red-300/20 bg-red-400/10 p-8 text-center">
            <AlertTriangle className="mx-auto text-red-300" size={34} />
            <h1 className="mt-4 text-xl font-semibold">Mission Control failed to load</h1>
            <p className="mt-3 text-sm text-slate-300">{errorMessage}</p>
            <button className="mt-6 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-950" type="button" onClick={() => setReloadKey((value) => value + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <header className="absolute inset-x-4 top-4 z-30 flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/80 px-5 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-indigo-400 text-slate-950">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold">ActivationOS Mission Control</p>
                <p className="text-xs text-slate-400">Demo3 · digital twin + simulated operational layer</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              {floors.map((floor) => (
                <button key={floor.id} type="button" onClick={() => changeFloor(floor.id)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${currentFloorId === floor.id ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'}`}>
                  {floor.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSidePanelOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">
                {sidePanelOpen ? 'Hide panel' : 'Show panel'}
              </button>
              <button type="button" onClick={() => void enterFullscreen()} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200" aria-label="Fullscreen">
                <Maximize2 size={17} />
              </button>
              <Link to="/" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">
                <ArrowLeft className="mr-1 inline" size={14} /> Website
              </Link>
            </div>
          </header>

          <div className="absolute bottom-5 left-5 z-30 flex flex-wrap gap-2 rounded-3xl border border-white/10 bg-slate-950/82 p-2 shadow-2xl backdrop-blur-xl">
            <button type="button" onClick={() => rotate(0)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><Compass className="mr-1 inline" size={15} />North</button>
            <button type="button" onClick={() => rotate(90)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">East</button>
            <button type="button" onClick={() => rotate(180)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">South</button>
            <button type="button" onClick={() => rotate(270)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">West</button>
            <button type="button" onClick={() => void toggleLabels()} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">
              {labelsVisible ? <EyeOff className="mr-1 inline" size={15} /> : <Eye className="mr-1 inline" size={15} />} {labelsVisible ? 'Labels off' : 'Labels on'}
            </button>
            <button type="button" onClick={runTour} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${tourRunning ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}>
              <Play className="mr-1 inline" size={15} /> {tourRunning ? 'Stop tour' : 'Guided tour'}
            </button>
            <button type="button" onClick={reset} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><RotateCcw className="mr-1 inline" size={15} />Reset</button>
          </div>

          {sidePanelOpen && (
            <aside className="absolute bottom-5 right-5 top-24 z-30 flex w-[28rem] flex-col rounded-3xl border border-white/10 bg-slate-950/86 shadow-2xl backdrop-blur-xl">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Room intelligence</p>
                    <h2 className="mt-2 text-2xl font-semibold">{selectedSpace?.name ?? 'Select a mapped space'}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{statusMessage}</p>
                  </div>
                  <button type="button" onClick={() => setSidePanelOpen(false)} className="rounded-xl border border-white/10 p-2 text-slate-400 hover:text-white" aria-label="Close panel"><X size={16} /></button>
                </div>
              </div>

              <div className="border-b border-white/10 p-5">
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && filteredSpaces[0]) focusSpace(filteredSpaces[0])
                    }}
                    placeholder="Search room, department, label"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b border-white/10 p-5">
                {readinessMetrics.map((metric) => {
                  const MetricIcon = metric.icon
                  return (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-300"><MetricIcon size={17} className="text-cyan-300" /> {metric.label}</div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400" style={{ width: `${metric.value}%` }} /></div>
                      <p className="mt-2 text-xs text-slate-500">{metric.value}% ready</p>
                    </div>
                  )
                })}
              </div>

              <div className="border-b border-white/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operational overlays</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    ['readiness', 'Readiness', CheckCircle2],
                    ['equipment', 'Equipment', Boxes],
                    ['lowVoltage', 'Low voltage', Network],
                    ['qc', 'QC', ClipboardList],
                    ['documents', 'Documents', FileText],
                  ].map(([key, label, Icon]) => {
                    const OverlayIcon = Icon as typeof CheckCircle2
                    const enabled = overlays[key as keyof OverlayState]
                    return (
                      <button key={key as string} type="button" onClick={() => setOverlay(key as keyof OverlayState)} className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold ${enabled ? 'border-cyan-300/40 bg-cyan-300/12 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-slate-400'}`}>
                        <OverlayIcon className="mr-1 inline" size={14} /> {label as string}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mapped spaces</p>
                <div className="mt-3 space-y-2">
                  {filteredSpaces.map((space) => (
                    <button key={space.id} type="button" onClick={() => focusSpace(space)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${selectedSpace?.id === space.id ? 'border-cyan-300/50 bg-cyan-300/15 text-white' : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.08]'}`}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{space.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{space.floorName}</span>
                      </span>
                      <ChevronRight className="shrink-0 text-slate-600" size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          <div className="absolute left-5 top-24 z-20 rounded-3xl border border-white/10 bg-slate-950/82 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold"><Building2 size={17} className="text-cyan-300" /> Robley Rex VAMC</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><Layers3 className="text-cyan-300" size={16} /><p className="mt-2 text-lg font-semibold">{floors.length}</p><p className="text-slate-500">floors</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><MapPin className="text-cyan-300" size={16} /><p className="mt-2 text-lg font-semibold">{spaces.length}</p><p className="text-slate-500">spaces</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><Activity className="text-emerald-300" size={16} /><p className="mt-2 text-lg font-semibold">84%</p><p className="text-slate-500">sim ready</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><Camera className="text-amber-300" size={16} /><p className="mt-2 text-lg font-semibold">18</p><p className="text-slate-500">photo refs</p></div>
            </div>
          </div>

          {overlays.qc && (
            <div className="absolute left-5 top-[25rem] z-20 w-72 rounded-3xl border border-amber-300/20 bg-slate-950/82 p-4 shadow-2xl backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Simulated open issues</p>
              <div className="mt-3 space-y-2">
                {simulatedIssues.map((issue) => (
                  <div key={issue} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">{issue}</div>
                ))}
              </div>
            </div>
          )}

          <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/82 px-4 py-2 text-xs text-slate-300 shadow-2xl backdrop-blur-xl">
            <Tags className="mr-2 inline text-cyan-300" size={14} />
            Demo3 treats Mappedin as the spatial source and overlays simulated ActivationOS data until real room records are linked.
          </div>
        </>
      )}
    </div>
  )
}

export default MappedinMissionControlDemoPage

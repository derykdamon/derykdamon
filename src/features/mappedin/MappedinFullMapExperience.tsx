import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Compass,
  Eye,
  EyeOff,
  Expand,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Radar,
  RotateCcw,
  RotateCw,
  Search,
  Target,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

type TokenPayload = { accessToken?: string; mapId?: string; error?: string }
type LoadState = 'loading' | 'ready' | 'error'
type FloorOption = { id: string; name: string; elevation: number }
type SpaceOption = { id: string; name: string; floorName: string; raw: any }
type LocationState = { status: 'off' | 'requesting' | 'ready' | 'error'; message: string }
type ExperienceVariant = 'control-tower' | 'mappedin-plus'

type MappedinFullMapExperienceProps = {
  variant: ExperienceVariant
}

const VARIANT_CONFIG = {
  'control-tower': {
    title: 'Mappedin Control Tower',
    route: 'Demo2',
    subtitle: 'full campus context, real floors, labels, search, and camera controls',
    badge: 'Map-first operations console',
    panelTitle: 'Control panel',
  },
  'mappedin-plus': {
    title: 'Mappedin Mission Control',
    route: 'Demo3',
    subtitle: 'native-style Mappedin view with ActivationOS-ready controls',
    badge: 'Mappedin-first experience',
    panelTitle: 'Mappedin features',
  },
} as const

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function floorRank(floor: FloorOption) {
  const name = floor.name.toLowerCase()

  if (name.includes('ground')) return -100
  if (name.includes('first')) return 1
  if (name.includes('second')) return 2
  if (name.includes('third')) return 3
  if (name.includes('fourth')) return 4
  if (name.includes('fifth')) return 5

  return floor.elevation
}

function setCamera(
  mapView: any,
  options: { bearing?: number; pitch?: number; zoom?: number },
) {
  mapView?.Camera?.set(options as any)
}

async function addPersistentLabels(mapView: any, spaces: SpaceOption[]) {
  mapView.Labels.removeAll()

  await Promise.all(
    spaces.slice(0, 650).map((space) =>
      mapView.Labels.add(space.raw, space.name, {
        interactive: true,
        enabled: true,
        rank: 'always-visible',
        appearance: {
          margin: 8,
          maxLines: 2,
          maxWidth: 190,
          textSize: 12,
          textColor: '#0f172a',
          textOutlineColor: '#ffffff',
          pinColor: '#0f172a',
          pinOutlineColor: '#ffffff',
        },
      }),
    ),
  )
}

function getVisibleSpaces(spaces: SpaceOption[], query: string) {
  const value = query.trim().toLowerCase()

  if (!value) return spaces.slice(0, 50)

  return spaces
    .filter((space) =>
      `${space.name} ${space.floorName}`.toLowerCase().includes(value),
    )
    .slice(0, 120)
}

function MappedinFullMapExperience({ variant }: MappedinFullMapExperienceProps) {
  const config = VARIANT_CONFIG[variant]
  const rootRef = useRef<HTMLDivElement>(null)
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<any>(null)
  const spacesRef = useRef<SpaceOption[]>([])
  const orbitTimerRef = useRef<number | null>(null)
  const bearingRef = useRef(0)
  const pitchRef = useRef(48)
  const zoomRef = useRef(14.2)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [selectedSpace, setSelectedSpace] = useState<SpaceOption | null>(null)
  const [query, setQuery] = useState('')
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)
  const [leftPanelOpen, setLeftPanelOpen] = useState(variant === 'control-tower')
  const [rightPanelOpen, setRightPanelOpen] = useState(variant === 'mappedin-plus')
  const [orbiting, setOrbiting] = useState(false)
  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(48)
  const [zoom, setZoom] = useState(14.2)
  const [viewMode, setViewMode] = useState('Campus')
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'off',
    message: 'Browser GPS has not been requested.',
  })

  const visibleSpaces = useMemo(
    () => getVisibleSpaces(spaces, query),
    [query, spaces],
  )

  const applyCamera = useCallback((nextBearing: number, nextPitch: number, nextZoom = zoomRef.current) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    const normalizedBearing = ((nextBearing % 360) + 360) % 360
    const normalizedPitch = Math.max(0, Math.min(75, nextPitch))
    const normalizedZoom = Math.max(12.5, Math.min(19.5, nextZoom))

    bearingRef.current = normalizedBearing
    pitchRef.current = normalizedPitch
    zoomRef.current = normalizedZoom
    setBearing(normalizedBearing)
    setPitch(normalizedPitch)
    setZoom(normalizedZoom)
    setCamera(mapView, {
      bearing: normalizedBearing,
      pitch: normalizedPitch,
      zoom: normalizedZoom,
    })
  }, [])

  const focusCampus = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(mapView.currentFloor)
    applyCamera(bearingRef.current, 48, 14.2)
    setViewMode('Campus')
  }, [applyCamera])

  const focusSite = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(mapView.currentFloor)
    applyCamera(bearingRef.current, 52, 15.3)
    setViewMode('Site')
  }, [applyCamera])

  const focusBuilding = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(selectedSpace?.raw ?? mapView.currentFloor)
    applyCamera(bearingRef.current, 58, 16.6)
    setViewMode('Building')
  }, [applyCamera, selectedSpace])

  const focusSpace = useCallback(
    (space: SpaceOption) => {
      const mapView = mapViewRef.current
      if (!mapView) return

      mapView.Camera.focusOn(space.raw)
      applyCamera(bearingRef.current, Math.max(pitchRef.current, 52), 17.4)
      setSelectedSpace(space)
      setRightPanelOpen(true)
      setViewMode('Room')
    },
    [applyCamera],
  )

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return

    setLoadState('loading')
    setErrorMessage('')
    setSelectedSpace(null)

    const tokenResponse = await fetch('/api/mappedin-token')
    const tokenPayload = (await tokenResponse.json()) as TokenPayload

    if (!tokenResponse.ok || !tokenPayload.accessToken || !tokenPayload.mapId) {
      throw new Error(
        tokenPayload.error ?? 'Mappedin token configuration could not be loaded.',
      )
    }

    const mapData: any = await getMapData({
      accessToken: tokenPayload.accessToken,
      mapId: tokenPayload.mapId,
    })
    const mapView: any = await show3dMap(mapElement, mapData)
    mapViewRef.current = mapView

    mapView.Camera.interactions.set({
      pan: true,
      zoom: true,
      bearingAndPitch: true,
    })

    const floorOptions: FloorOption[] = mapData
      .getByType('floor')
      .map((floor: any) => ({
        id: String(floor.id),
        name: safeName(floor.name, `Level ${floor.elevation ?? ''}`),
        elevation: Number(floor.elevation ?? 0),
      }))
      .sort((a: FloorOption, b: FloorOption) => floorRank(a) - floorRank(b))

    const currentFloorName = safeName(mapView.currentFloor?.name, 'Current floor')
    const spaceOptions: SpaceOption[] = mapData
      .getByType('space')
      .filter((space: any) => safeName(space.name, '').length > 0)
      .map((space: any) => ({
        id: String(space.id),
        name: safeName(space.name, 'Unnamed mapped space'),
        floorName: safeName(space.floor?.name, currentFloorName),
        raw: space,
      }))
      .sort((a: SpaceOption, b: SpaceOption) => a.name.localeCompare(b.name))

    setFloors(floorOptions)
    setSpaces(spaceOptions)
    spacesRef.current = spaceOptions
    setCurrentFloorId(String(mapView.currentFloor.id))

    spaceOptions.forEach((space) => {
      mapView.updateState(space.raw, {
        interactive: true,
        hoverColor: '#06b6d4',
      })
    })

    await addPersistentLabels(mapView, spaceOptions)

    mapView.on('floor-change', (event: any) => {
      setCurrentFloorId(String(event.floor.id))
      mapView.Camera.focusOn(event.floor)
      setCamera(mapView, {
        bearing: bearingRef.current,
        pitch: pitchRef.current,
        zoom: zoomRef.current,
      })
    })

    mapView.on('camera-change', (transform: any) => {
      if (typeof transform.bearing === 'number') {
        const nextBearing = ((transform.bearing % 360) + 360) % 360
        bearingRef.current = nextBearing
        setBearing(nextBearing)
      }

      if (typeof transform.pitch === 'number') {
        const nextPitch = Math.round(transform.pitch)
        pitchRef.current = nextPitch
        setPitch(nextPitch)
      }

      if (typeof transform.zoom === 'number') {
        const nextZoom = Number(transform.zoom.toFixed(1))
        zoomRef.current = nextZoom
        setZoom(nextZoom)
      }
    })

    mapView.on('click', (event: any) => {
      const clickedSpace = event.spaces?.[0]
      const clickedLabel = event.labels?.[0]

      if (clickedSpace?.id) {
        const match = spacesRef.current.find(
          (space) => space.id === String(clickedSpace.id),
        )
        if (match) focusSpace(match)
        return
      }

      if (clickedLabel?.text) {
        const match = spacesRef.current.find(
          (space) => space.name === clickedLabel.text,
        )
        if (match) focusSpace(match)
      }
    })

    setLoadState('ready')
    window.setTimeout(() => focusCampus(), 200)
  }, [focusCampus, focusSpace])

  useEffect(() => {
    let cancelled = false

    void loadMap().catch((error: unknown) => {
      if (cancelled) return
      setErrorMessage(
        error instanceof Error ? error.message : 'The map failed to load.',
      )
      setLoadState('error')
    })

    return () => {
      cancelled = true
      if (orbitTimerRef.current) window.clearInterval(orbitTimerRef.current)
      orbitTimerRef.current = null
      mapViewRef.current?.destroy()
      mapViewRef.current = null
    }
  }, [loadMap, reloadKey])

  const changeFloor = (floorId: string) => mapViewRef.current?.setFloor(floorId)

  const toggleLabels = async () => {
    const mapView = mapViewRef.current
    if (!mapView) return

    if (labelsVisible) {
      mapView.Labels.removeAll()
      setLabelsVisible(false)
    } else {
      await addPersistentLabels(mapView, spacesRef.current)
      setLabelsVisible(true)
    }
  }

  const toggleOrbit = () => {
    if (orbitTimerRef.current) {
      window.clearInterval(orbitTimerRef.current)
      orbitTimerRef.current = null
      setOrbiting(false)
      return
    }

    setOrbiting(true)
    orbitTimerRef.current = window.setInterval(() => {
      applyCamera(bearingRef.current + 2.5, Math.max(pitchRef.current, 45))
    }, 120)
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState({
        status: 'error',
        message: 'This browser does not support geolocation.',
      })
      return
    }

    setLocationState({
      status: 'requesting',
      message: 'Waiting for browser location permission…',
    })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setLocationState({
          status: 'ready',
          message: `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · accuracy ${Math.round(accuracy)} m. Off-site positions are reported but not plotted as an indoor Blue Dot.`,
        })
      },
      () =>
        setLocationState({
          status: 'error',
          message: 'Location could not be retrieved or permission was denied.',
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  }

  const enterFullscreen = async () => {
    if (!rootRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await rootRef.current.requestFullscreen()
  }

  const firstMatch = visibleSpaces[0]

  return (
    <div ref={rootRef} className="relative h-screen overflow-hidden bg-white text-slate-950">
      <div ref={mapElementRef} className="absolute inset-0" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white">
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-2xl">
            <LoaderCircle className="mx-auto animate-spin text-cyan-500" size={34} />
            <p className="mt-5 text-lg font-semibold">Loading {config.title}</p>
            <p className="mt-2 text-sm text-slate-500">Preparing full-campus map, real floors, labels, room search, and camera controls.</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white px-6">
          <div className="max-w-lg rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertTriangle className="mx-auto text-red-500" size={34} />
            <h1 className="mt-4 text-xl font-semibold">Map failed to load</h1>
            <p className="mt-3 text-sm text-slate-600">{errorMessage}</p>
            <button
              className="mt-6 rounded-xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <header className="absolute inset-x-4 top-4 z-30 rounded-3xl border border-slate-200/80 bg-white/88 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLeftPanelOpen((value) => !value)}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm"
                  aria-label="Toggle left panel"
                >
                  {leftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                </button>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white">
                  {variant === 'control-tower' ? <Radar size={21} /> : <Target size={21} />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{config.title}</p>
                  <p className="truncate text-xs text-slate-500">{config.route} · {config.subtitle}</p>
                </div>
              </div>

              <label className="relative hidden min-w-64 flex-1 lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && firstMatch && focusSpace(firstMatch)}
                  placeholder="Search mapped rooms, labels, departments, or spaces"
                  className="w-full rounded-2xl border border-slate-200 bg-white/80 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-400"
                />
              </label>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setUiVisible((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                  {uiVisible ? 'Hide UI' : 'Show UI'}
                </button>
                <button type="button" onClick={() => setRightPanelOpen((value) => !value)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm" aria-label="Toggle right panel">
                  {rightPanelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                </button>
                <button type="button" onClick={() => void enterFullscreen()} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm" aria-label="Fullscreen"><Expand size={17} /></button>
                <Link to="/" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"><ArrowLeft className="mr-1 inline" size={14} /> Website</Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 px-4 py-3">
              <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Ground → higher</span>
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => changeFloor(floor.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    currentFloorId === floor.id
                      ? 'border-cyan-500 bg-cyan-100 text-cyan-900'
                      : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {floor.name}
                </button>
              ))}
            </div>
          </header>

          {uiVisible && leftPanelOpen && (
            <aside className="absolute bottom-5 left-5 top-40 z-20 flex w-[23rem] flex-col rounded-3xl border border-slate-200 bg-white/88 shadow-2xl backdrop-blur-xl">
              <div className="border-b border-slate-200 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-700">{config.badge}</p>
                    <h2 className="mt-1 text-lg font-semibold">{config.panelTitle}</h2>
                  </div>
                  <button type="button" onClick={() => setLeftPanelOpen(false)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-lg font-bold">{floors.length}</p><p className="text-slate-500">Floors</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-lg font-bold">{spaces.length}</p><p className="text-slate-500">Spaces</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3"><p className="text-lg font-bold">{viewMode}</p><p className="text-slate-500">View</p></div>
                </div>
              </div>

              <div className="border-b border-slate-200 p-5 lg:hidden">
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && firstMatch && focusSpace(firstMatch)}
                    placeholder="Search spaces"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-400"
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mapped spaces</p>
                <div className="space-y-2">
                  {visibleSpaces.map((space) => (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => focusSpace(space)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        selectedSpace?.id === space.id
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-950'
                          : 'border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex gap-2">
                        <MapPin className="mt-0.5 shrink-0 text-cyan-600" size={16} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{space.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{space.floorName}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          {uiVisible && rightPanelOpen && (
            <aside className="absolute bottom-5 right-5 top-40 z-20 w-[25rem] rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-700">Selection</p>
                  <h2 className="mt-2 text-xl font-bold">{selectedSpace?.name ?? 'No room selected'}</h2>
                  <p className="mt-2 text-sm text-slate-500">{selectedSpace?.floorName ?? 'Select or search a mapped space.'}</p>
                </div>
                <button type="button" onClick={() => setRightPanelOpen(false)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"><X size={16} /></button>
              </div>

              <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex justify-between gap-4"><span className="text-slate-500">Mappedin ID</span><span className="max-w-44 truncate font-medium">{selectedSpace?.id ?? '—'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Current floor</span><span className="font-medium">{floors.find((floor) => floor.id === currentFloorId)?.name ?? '—'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Labels</span><span className="font-medium">{labelsVisible ? 'Visible' : 'Hidden'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Camera</span><span className="font-medium">{viewMode}</span></div>
              </div>

              <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
                <div className="flex items-center gap-2 font-semibold"><Building2 size={16} /> Next product layer</div>
                <p className="mt-2 leading-6 text-cyan-900/80">
                  This page is intentionally map-first. The next step is linking selected Mappedin space IDs to equipment, low-voltage, QC photos, documents, DITL scenarios, and readiness data.
                </p>
              </div>
            </aside>
          )}

          {uiVisible && (
            <div className="absolute bottom-5 left-1/2 z-30 w-[min(55rem,calc(100%-2rem))] -translate-x-1/2 rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={focusCampus} className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900"><Navigation className="mr-1 inline" size={15} />Campus</button>
                <button type="button" onClick={focusSite} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Target className="mr-1 inline" size={15} />Site</button>
                <button type="button" onClick={focusBuilding} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Building2 className="mr-1 inline" size={15} />Bldg</button>
                <button type="button" onClick={() => applyCamera(bearing, 0, zoom)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Compass className="mr-1 inline" size={15} />Top</button>
                <button type="button" onClick={() => applyCamera(bearing - 25, pitch, zoom)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RotateCcw className="mr-1 inline" size={15} />Left</button>
                <button type="button" onClick={() => applyCamera(bearing + 25, pitch, zoom)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RotateCw className="mr-1 inline" size={15} />Right</button>
                <button type="button" onClick={() => applyCamera(bearing, pitch + 8, zoom)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Plus className="mr-1 inline" size={15} />Pitch</button>
                <button type="button" onClick={() => applyCamera(bearing, pitch - 8, zoom)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Minus className="mr-1 inline" size={15} />Pitch</button>
                <button type="button" onClick={() => applyCamera(bearing, pitch, zoom - 0.8)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Minus className="mr-1 inline" size={15} />Zoom</button>
                <button type="button" onClick={() => applyCamera(bearing, pitch, zoom + 0.8)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Plus className="mr-1 inline" size={15} />Zoom</button>
                <button type="button" onClick={() => void toggleLabels()} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">{labelsVisible ? <EyeOff className="mr-1 inline" size={15} /> : <Eye className="mr-1 inline" size={15} />}{labelsVisible ? 'Labels off' : 'Labels on'}</button>
                <button type="button" onClick={toggleOrbit} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${orbiting ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'}`}><Play className="mr-1 inline" size={15} />Orbit</button>
                <button type="button" onClick={requestLocation} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><LocateFixed className="mr-1 inline" size={15} />GPS</button>
                <button type="button" onClick={focusCampus} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RotateCcw className="mr-1 inline" size={15} />Reset</button>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-slate-500">
                <span>View: {viewMode}</span>
                <span>Bearing: {Math.round(bearing)}°</span>
                <span>Pitch: {Math.round(pitch)}°</span>
                <span>Zoom: {zoom.toFixed(1)}</span>
                <span>{locationState.message}</span>
              </div>
            </div>
          )}

          {!uiVisible && (
            <button type="button" onClick={() => setUiVisible(true)} className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-slate-200 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-800 shadow-2xl backdrop-blur-xl">
              Show Mappedin controls
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default MappedinFullMapExperience

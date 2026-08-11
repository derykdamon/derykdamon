import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import {
  AlertTriangle,
  ArrowLeft,
  Compass,
  Eye,
  EyeOff,
  Expand,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
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
  floorId: string
  floorName: string
  raw: any
}

type LocationState = {
  status: 'off' | 'requesting' | 'ready' | 'error'
  message: string
}

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function floorRank(floor: FloorOption) {
  const name = floor.name.toLowerCase()
  if (name.includes('ground')) return 0
  return Number.isFinite(floor.elevation) ? floor.elevation + 10 : 999
}

async function rebuildLabels(mapView: any, spaces: SpaceOption[]) {
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
          maxWidth: 170,
          textSize: 11.5,
          textColor: '#111827',
          textOutlineColor: '#ffffff',
          pinColor: '#0f172a',
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
  const selectedRef = useRef<SpaceOption | null>(null)
  const orbitTimerRef = useRef<number | null>(null)
  const bearingRef = useRef(0)
  const pitchRef = useRef(50)
  const zoomRef = useRef(15)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [query, setQuery] = useState('')
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [selectedSpace, setSelectedSpace] = useState<SpaceOption | null>(null)
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [cameraMode, setCameraMode] = useState<'campus' | 'top' | 'room'>('campus')
  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(50)
  const [zoom, setZoom] = useState(15)
  const [orbiting, setOrbiting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(
    'Campus context view. Use map controls for guaranteed rotate and pitch if trackpad modifiers do not work.',
  )
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'off',
    message: 'Browser location has not been requested.',
  })

  const filteredSpaces = useMemo(() => {
    const value = query.trim().toLowerCase()
    const source = value
      ? spaces.filter((space) => space.name.toLowerCase().includes(value))
      : spaces
    return source.slice(0, value ? 100 : 40)
  }, [query, spaces])

  const applyCamera = useCallback((nextBearing: number, nextPitch: number, nextZoom = zoomRef.current) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    const normalizedBearing = ((nextBearing % 360) + 360) % 360
    const normalizedPitch = Math.max(0, Math.min(75, nextPitch))
    const normalizedZoom = Math.max(12, Math.min(21, nextZoom))

    bearingRef.current = normalizedBearing
    pitchRef.current = normalizedPitch
    zoomRef.current = normalizedZoom
    setBearing(Math.round(normalizedBearing))
    setPitch(Math.round(normalizedPitch))
    setZoom(Number(normalizedZoom.toFixed(1)))

    try {
      mapView.Camera.set({
        bearing: normalizedBearing,
        pitch: normalizedPitch,
        zoom: normalizedZoom,
        zoomLevel: normalizedZoom,
      })
    } catch {
      mapView.Camera.set({ bearing: normalizedBearing, pitch: normalizedPitch })
    }
  }, [])

  const setCampusView = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(mapView.currentFloor)
    applyCamera(0, 48, 14.2)
    setCameraMode('campus')
    setStatusMessage('Campus context view enabled. Pan or zoom out to see surrounding roads and site context.')
  }, [applyCamera])

  const focusSpace = useCallback(
    (space: SpaceOption) => {
      const mapView = mapViewRef.current
      if (!mapView) return

      if (selectedRef.current) {
        mapView.updateState(selectedRef.current.raw, {
          interactive: true,
          hoverColor: '#38bdf8',
          color: undefined,
        })
      }

      if (space.floorId && space.floorId !== currentFloorId) {
        mapView.setFloor(space.floorId)
      }

      selectedRef.current = space
      mapView.updateState(space.raw, {
        interactive: true,
        color: '#22d3ee',
        hoverColor: '#67e8f9',
      })
      mapView.Camera.focusOn(space.raw)
      applyCamera(bearingRef.current, Math.max(pitchRef.current, 55), Math.max(zoomRef.current, 16.5))
      setSelectedSpace(space)
      setCameraMode('room')
      setStatusMessage(`${space.name} selected. This is the live Mappedin space; the operational records are not linked yet.`)
    },
    [applyCamera, currentFloorId],
  )

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
        floorId: String(space.floor?.id ?? mapView.currentFloor?.id ?? ''),
        floorName: safeName(space.floor?.name, currentFloorName),
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
      setStatusMessage(`${safeName(event.floor.name, 'Floor')} selected. Floors are ordered from Ground upward.`)
    })

    mapView.on('camera-change', (transform: any) => {
      if (typeof transform.bearing === 'number') {
        const nextBearing = ((transform.bearing % 360) + 360) % 360
        bearingRef.current = nextBearing
        setBearing(Math.round(nextBearing))
      }
      if (typeof transform.pitch === 'number') {
        pitchRef.current = transform.pitch
        setPitch(Math.round(transform.pitch))
      }
      if (typeof transform.zoom === 'number') {
        zoomRef.current = transform.zoom
        setZoom(Number(transform.zoom.toFixed(1)))
      }
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

    setLoadState('ready')
    window.setTimeout(() => setCampusView(), 400)
  }, [focusSpace, setCampusView])

  useEffect(() => {
    let cancelled = false

    void loadMap().catch((error: unknown) => {
      if (cancelled) return
      setErrorMessage(error instanceof Error ? error.message : 'The map failed to load.')
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

  const changeFloor = (floorId: string) => {
    const mapView = mapViewRef.current
    if (!mapView) return
    mapView.setFloor(floorId)
    window.setTimeout(() => {
      if (cameraMode === 'campus') setCampusView()
      else applyCamera(bearingRef.current, pitchRef.current, zoomRef.current)
    }, 150)
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

  const toggleTopDown = () => {
    const nextTopDown = cameraMode !== 'top'
    setCameraMode(nextTopDown ? 'top' : 'campus')
    applyCamera(bearingRef.current, nextTopDown ? 0 : 48, nextTopDown ? 15 : 14.2)
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
      applyCamera((bearingRef.current + 2.5) % 360, Math.max(pitchRef.current, 48), zoomRef.current)
    }, 120)
  }

  const resetSelection = () => {
    if (selectedRef.current && mapViewRef.current) {
      mapViewRef.current.updateState(selectedRef.current.raw, {
        interactive: true,
        hoverColor: '#38bdf8',
        color: undefined,
      })
    }
    selectedRef.current = null
    setSelectedSpace(null)
    setCampusView()
  }

  const enterFullscreen = async () => {
    if (!rootRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await rootRef.current.requestFullscreen()
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState({ status: 'error', message: 'This browser does not support geolocation.' })
      return
    }

    setLocationState({ status: 'requesting', message: 'Waiting for browser location permission…' })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setLocationState({
          status: 'ready',
          message: `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · accuracy ${Math.round(accuracy)} m. Off-site coordinates are shown for demo only and are not plotted as an indoor Blue Dot.`,
        })
      },
      () => setLocationState({ status: 'error', message: 'Location could not be retrieved or permission was denied.' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  }

  const activeFloor = floors.find((floor) => floor.id === currentFloorId)

  return (
    <div ref={rootRef} className="relative h-screen overflow-hidden bg-[#020617] text-white">
      <div ref={mapElementRef} className="absolute inset-0" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-8 text-center shadow-2xl">
            <LoaderCircle className="mx-auto animate-spin text-cyan-300" size={34} />
            <p className="mt-5 text-xl font-semibold">Loading Mappedin Mission Control</p>
            <p className="mt-2 text-sm text-slate-400">Preparing campus context, floors, labels, room search, and camera controls.</p>
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
          <header className="absolute inset-x-4 top-4 z-30 flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/78 px-5 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-indigo-400 text-slate-950">
                <Radar size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold">Mappedin Mission Control</p>
                <p className="text-xs text-slate-400">Demo3 · full map, campus context, real floors, real labels</p>
              </div>
            </div>

            <div className="hidden min-w-0 max-w-[50vw] items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-2 lg:flex">
              <span className="whitespace-nowrap px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ground → higher</span>
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => changeFloor(floor.id)}
                  className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold ${currentFloorId === floor.id ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'}`}
                  title={`Elevation ${floor.elevation}`}
                >
                  {floor.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setUiVisible((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">
                {uiVisible ? 'Hide UI' : 'Show UI'}
              </button>
              <button type="button" onClick={() => void enterFullscreen()} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200" aria-label="Fullscreen">
                <Expand size={17} />
              </button>
              <Link to="/" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">
                <ArrowLeft className="mr-1 inline" size={14} /> Website
              </Link>
            </div>
          </header>

          {uiVisible && (
            <>
              <section className="absolute left-5 top-24 z-30 w-[22rem] rounded-3xl border border-white/10 bg-slate-950/78 p-4 shadow-2xl backdrop-blur-xl">
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && filteredSpaces[0] && focusSpace(filteredSpaces[0])}
                    placeholder="Search mapped rooms / spaces"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                  />
                </label>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="font-semibold text-white">{floors.length}</p><p className="mt-1 text-slate-500">Floors</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="font-semibold text-white">{spaces.length}</p><p className="mt-1 text-slate-500">Spaces</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="font-semibold text-white">{activeFloor?.name ?? '—'}</p><p className="mt-1 text-slate-500">Active</p></div>
                </div>

                <div className="mt-4 max-h-[38vh] space-y-2 overflow-y-auto pr-1">
                  {filteredSpaces.map((space) => (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => focusSpace(space)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${selectedSpace?.id === space.id ? 'border-cyan-300/50 bg-cyan-300/12' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'}`}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 text-cyan-300" size={16} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{space.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{space.floorName}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="absolute bottom-5 left-5 z-30 rounded-3xl border border-white/10 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-xl">
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={setCampusView} className="rounded-xl border border-cyan-300/30 bg-cyan-300/12 px-3 py-2 text-xs font-semibold text-cyan-100"><Navigation className="mr-1 inline" size={14} />Campus</button>
                  <button type="button" onClick={toggleTopDown} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><Compass className="mr-1 inline" size={14} />{cameraMode === 'top' ? '3D' : 'Top'}</button>
                  <button type="button" onClick={() => applyCamera(bearing - 25, pitch, zoom)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><RotateCcw className="mr-1 inline" size={14} />Left</button>
                  <button type="button" onClick={() => applyCamera(bearing + 25, pitch, zoom)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><RotateCw className="mr-1 inline" size={14} />Right</button>
                  <button type="button" onClick={() => applyCamera(bearing, pitch + 8, zoom)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><Plus className="mr-1 inline" size={14} />Pitch</button>
                  <button type="button" onClick={() => applyCamera(bearing, pitch - 8, zoom)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><Minus className="mr-1 inline" size={14} />Pitch</button>
                  <button type="button" onClick={() => applyCamera(bearing, pitch, zoom - 0.8)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><Minus className="mr-1 inline" size={14} />Zoom</button>
                  <button type="button" onClick={() => applyCamera(bearing, pitch, zoom + 0.8)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><Plus className="mr-1 inline" size={14} />Zoom</button>
                  <button type="button" onClick={() => void toggleLabels()} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">{labelsVisible ? <EyeOff className="mr-1 inline" size={14} /> : <Eye className="mr-1 inline" size={14} />}{labelsVisible ? 'Labels off' : 'Labels on'}</button>
                  <button type="button" onClick={toggleOrbit} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${orbiting ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Play className="mr-1 inline" size={14} />Orbit</button>
                  <button type="button" onClick={requestLocation} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><LocateFixed className="mr-1 inline" size={14} />GPS</button>
                  <button type="button" onClick={resetSelection} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200"><RotateCcw className="mr-1 inline" size={14} />Reset</button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                  <div>Bearing: <span className="text-white">{bearing}°</span></div>
                  <div>Pitch: <span className="text-white">{pitch}°</span></div>
                  <div>Zoom: <span className="text-white">{zoom}</span></div>
                </div>
              </section>

              <section className="absolute bottom-5 right-5 z-30 max-w-[36rem] rounded-3xl border border-white/10 bg-slate-950/78 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Map instructions</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{statusMessage}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Drag to pan. Scroll or pinch to zoom. Right-click/Control/Command drag may rotate depending on browser and device. The buttons here are the reliable fallback for 360° camera movement.</p>
                    {locationState.status !== 'off' && <p className="mt-2 text-xs leading-5 text-cyan-100">{locationState.message}</p>}
                  </div>
                  <button type="button" onClick={() => setDrawerOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-200" aria-label="Toggle details panel">
                    {drawerOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                  </button>
                </div>
              </section>
            </>
          )}

          {drawerOpen && uiVisible && (
            <aside className="absolute bottom-40 right-5 top-24 z-30 w-[25rem] rounded-3xl border border-white/10 bg-slate-950/82 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected space</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedSpace?.name ?? 'No room selected'}</h2>
                  <p className="mt-2 text-sm text-slate-400">{selectedSpace?.floorName ?? 'Click a room or choose from search.'}</p>
                </div>
                <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-300" aria-label="Close panel"><X size={17} /></button>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  ['Mappedin ID', selectedSpace?.id.slice(0, 18) ?? '—'],
                  ['Floor source', activeFloor?.name ?? '—'],
                  ['Label status', labelsVisible ? 'Visible' : 'Hidden'],
                  ['View mode', cameraMode],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-white/8 pb-3 text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-right text-slate-200">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100"><Target size={16} /> Next product layer</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">This page is intentionally Mappedin-first. The next layer is linking each selected space ID to ActivationOS equipment, low-voltage, documents, QC, and readiness records.</p>
              </div>
            </aside>
          )}

          {!uiVisible && (
            <button type="button" onClick={() => setUiVisible(true)} className="absolute left-5 top-5 z-40 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl">
              Show Mappedin controls
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default MappedinMissionControlDemoPage

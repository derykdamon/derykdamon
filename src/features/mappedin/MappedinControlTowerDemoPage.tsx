import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import {
  AlertTriangle,
  ArrowLeft,
  Compass,
  Eye,
  EyeOff,
  Expand,
  Layers3,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Radar,
  RotateCcw,
  RotateCw,
  Search,
  Tags,
  TimerReset,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

type TokenPayload = { accessToken?: string; mapId?: string; error?: string }
type LoadState = 'loading' | 'ready' | 'error'
type FloorOption = { id: string; name: string; elevation: number }
type SpaceOption = { id: string; name: string; floorName: string; raw: any }
type LocationState = { status: 'off' | 'requesting' | 'ready' | 'error'; message: string }

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

async function addLabels(mapView: any, spaces: SpaceOption[]) {
  mapView.Labels.removeAll()
  await Promise.all(
    spaces.slice(0, 500).map((space) =>
      mapView.Labels.add(space.raw, space.name, {
        interactive: true,
        enabled: true,
        rank: 'always-visible',
        appearance: {
          margin: 8,
          maxLines: 2,
          maxWidth: 180,
          textSize: 12,
          textColor: '#101827',
          textOutlineColor: '#ffffff',
          pinColor: '#0f172a',
          pinOutlineColor: '#ffffff',
        },
      }),
    ),
  )
}

function MappedinControlTowerDemoPage() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<any>(null)
  const spacesRef = useRef<SpaceOption[]>([])
  const orbitTimerRef = useRef<number | null>(null)
  const bearingRef = useRef(0)
  const pitchRef = useRef(58)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [selectedSpaceId, setSelectedSpaceId] = useState('')
  const [selectedName, setSelectedName] = useState('No room selected')
  const [query, setQuery] = useState('')
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)
  const [cameraMode, setCameraMode] = useState<'orbit' | 'top' | 'walkthrough'>('orbit')
  const [bearing, setBearing] = useState(0)
  const [orbiting, setOrbiting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'off',
    message: 'Browser location has not been requested.',
  })

  const visibleSpaces = useMemo(() => {
    const value = query.trim().toLowerCase()
    const source = value
      ? spaces.filter((space) => space.name.toLowerCase().includes(value))
      : spaces
    return source.slice(0, value ? 80 : 32)
  }, [query, spaces])

  const applyCamera = useCallback((nextBearing: number, nextPitch: number) => {
    const mapView = mapViewRef.current
    if (!mapView) return
    const normalizedBearing = ((nextBearing % 360) + 360) % 360
    const normalizedPitch = Math.max(0, Math.min(75, nextPitch))
    bearingRef.current = normalizedBearing
    pitchRef.current = normalizedPitch
    setBearing(normalizedBearing)
    mapView.Camera.set({ bearing: normalizedBearing, pitch: normalizedPitch })
  }, [])

  const focusSpace = useCallback((space: SpaceOption) => {
    const mapView = mapViewRef.current
    if (!mapView) return
    mapView.Camera.focusOn(space.raw)
    mapView.Camera.set({ bearing: bearingRef.current, pitch: Math.max(pitchRef.current, 48) })
    setSelectedSpaceId(space.id)
    setSelectedName(space.name)
    setCameraMode('walkthrough')
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
        floorName: safeName(space.floor?.name, currentFloorName),
        raw: space,
      }))
      .sort((a: SpaceOption, b: SpaceOption) => a.name.localeCompare(b.name))

    setFloors(floorOptions)
    setSpaces(spaceOptions)
    spacesRef.current = spaceOptions
    setCurrentFloorId(mapView.currentFloor.id)

    spaceOptions.forEach((space) => {
      mapView.updateState(space.raw, { interactive: true, hoverColor: '#06b6d4' })
    })

    await addLabels(mapView, spaceOptions)

    mapView.on('floor-change', (event: any) => {
      setCurrentFloorId(event.floor.id)
      mapView.Camera.focusOn(event.floor)
      mapView.Camera.set({ bearing: bearingRef.current, pitch: pitchRef.current })
    })

    mapView.on('camera-change', (transform: any) => {
      if (typeof transform.bearing === 'number') {
        const nextBearing = ((transform.bearing % 360) + 360) % 360
        bearingRef.current = nextBearing
        setBearing(nextBearing)
      }
      if (typeof transform.pitch === 'number') pitchRef.current = Math.round(transform.pitch)
    })

    mapView.on('click', (event: any) => {
      const clickedSpace = event.spaces?.[0]
      const clickedLabel = event.labels?.[0]
      if (clickedSpace?.id) {
        const match = spacesRef.current.find((space) => space.id === String(clickedSpace.id))
        if (match) focusSpace(match)
        return
      }
      if (clickedLabel?.text) setSelectedName(safeName(clickedLabel.text, 'Mapped label'))
    })

    mapView.Camera.focusOn(mapView.currentFloor)
    mapView.Camera.set({ bearing: 0, pitch: 58 })
    bearingRef.current = 0
    pitchRef.current = 58
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
      if (orbitTimerRef.current) window.clearInterval(orbitTimerRef.current)
      orbitTimerRef.current = null
      mapViewRef.current?.destroy()
      mapViewRef.current = null
    }
  }, [loadMap, reloadKey])

  const firstMatch = visibleSpaces[0]
  const changeFloor = (floorId: string) => mapViewRef.current?.setFloor(floorId)

  const toggleLabels = async () => {
    const mapView = mapViewRef.current
    if (!mapView) return
    if (labelsVisible) {
      mapView.Labels.removeAll()
      setLabelsVisible(false)
    } else {
      await addLabels(mapView, spacesRef.current)
      setLabelsVisible(true)
    }
  }

  const resetView = () => {
    const mapView = mapViewRef.current
    if (!mapView) return
    mapView.Camera.focusOn(mapView.currentFloor)
    applyCamera(0, 58)
    setCameraMode('orbit')
  }

  const toggleTopDown = () => {
    const nextMode = cameraMode === 'top' ? 'orbit' : 'top'
    setCameraMode(nextMode)
    applyCamera(bearingRef.current, nextMode === 'top' ? 0 : 58)
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
      const next = (bearingRef.current + 3) % 360
      applyCamera(next, Math.max(pitchRef.current, 48))
    }, 120)
  }

  const enterFullscreen = async () => {
    if (!shellRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await shellRef.current.requestFullscreen()
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
          message: `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · accuracy ${Math.round(accuracy)} m. Off-site positions are reported but not plotted as an indoor Blue Dot.`,
        })
      },
      () => setLocationState({ status: 'error', message: 'Location could not be retrieved or permission was denied.' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  }

  return (
    <div ref={shellRef} className="relative h-screen overflow-hidden bg-slate-950 text-white">
      <div ref={mapElementRef} className="absolute inset-0" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950">
          <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-8 text-center shadow-2xl">
            <LoaderCircle className="mx-auto animate-spin text-cyan-300" size={34} />
            <p className="mt-5 text-lg font-semibold">Loading Mappedin Control Tower</p>
            <p className="mt-2 text-sm text-slate-400">Preparing floors, labels, room search, and camera controls.</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950 px-6">
          <div className="max-w-lg rounded-3xl border border-red-300/20 bg-red-400/10 p-8 text-center">
            <AlertTriangle className="mx-auto text-red-300" size={34} />
            <h1 className="mt-4 text-xl font-semibold">Map failed to load</h1>
            <p className="mt-3 text-sm text-slate-300">{errorMessage}</p>
            <button className="mt-6 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-950" type="button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <div className="pointer-events-none absolute left-6 top-5 z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-slate-950"><Radar size={20} /></div>
            <div><p className="text-sm font-semibold">Mappedin Control Tower</p><p className="text-xs text-slate-400">Demo2 · full-map operations console</p></div>
          </div>

          <div className="absolute right-6 top-5 z-30 flex items-center gap-2">
            <button type="button" onClick={() => setUiVisible((value) => !value)} className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-xl">{uiVisible ? 'Hide UI' : 'Show UI'}</button>
            <button type="button" onClick={() => void enterFullscreen()} className="rounded-xl border border-white/10 bg-slate-950/80 p-2.5 text-slate-200 backdrop-blur-xl" aria-label="Fullscreen"><Expand size={17} /></button>
            <Link to="/" className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-xl"><ArrowLeft className="mr-1 inline" size={14} /> Website</Link>
          </div>

          {uiVisible && (
            <>
              <aside className="absolute bottom-6 left-6 top-24 z-20 flex w-[24rem] flex-col rounded-3xl border border-white/10 bg-slate-950/82 shadow-2xl backdrop-blur-xl">
                <div className="border-b border-white/10 p-5"><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && firstMatch && focusSpace(firstMatch)} placeholder="Search mapped rooms" className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-300/50" /></label></div>
                <div className="border-b border-white/10 p-5">
                  <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Floors</p><span className="text-xs text-slate-500">{floors.length} loaded</span></div>
                  <div className="grid grid-cols-2 gap-2">{floors.map((floor) => <button key={floor.id} type="button" onClick={() => changeFloor(floor.id)} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${currentFloorId === floor.id ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'}`}>{floor.name}</button>)}</div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Spaces</p><span className="text-xs text-slate-500">{spaces.length} named</span></div>
                  <div className="space-y-2">{visibleSpaces.map((space) => <button key={space.id} type="button" onClick={() => focusSpace(space)} className={`w-full rounded-xl border px-3 py-2 text-left transition ${selectedSpaceId === space.id ? 'border-cyan-300/50 bg-cyan-300/15 text-white' : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.08]'}`}><span className="block truncate text-sm font-medium">{space.name}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{space.floorName} · {space.id}</span></button>)}</div>
                </div>
              </aside>

              <section className="absolute bottom-6 right-6 z-20 w-[26rem] rounded-3xl border border-white/10 bg-slate-950/82 p-5 shadow-2xl backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Selected mapped location</p><h2 className="mt-3 text-2xl font-semibold">{selectedName}</h2><p className="mt-2 text-sm leading-6 text-slate-400">Click labels, choose a room, or search by name. This panel is ready for equipment, low-voltage, QC, photo, and document data.</p>
                <div className="mt-5 grid grid-cols-3 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><Layers3 className="text-cyan-300" size={18} /><p className="mt-2 text-lg font-semibold">{floors.length}</p><p className="text-[11px] text-slate-500">floors</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><MapPin className="text-cyan-300" size={18} /><p className="mt-2 text-lg font-semibold">{spaces.length}</p><p className="text-[11px] text-slate-500">spaces</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><Compass className="text-cyan-300" size={18} /><p className="mt-2 text-lg font-semibold">{Math.round(bearing)}°</p><p className="text-[11px] text-slate-500">bearing</p></div></div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3"><button type="button" onClick={requestLocation} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950"><LocateFixed size={15} /> Use my location</button><p className="mt-2 text-xs leading-5 text-slate-400">{locationState.message}</p></div>
              </section>

              <div className="absolute left-1/2 top-5 z-20 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/82 p-2 shadow-2xl backdrop-blur-xl">
                <button type="button" onClick={() => applyCamera(bearingRef.current - 20, Math.max(pitchRef.current, 45))} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 hover:bg-white/10" aria-label="Rotate left"><RotateCcw size={17} /></button>
                <button type="button" onClick={() => applyCamera(bearingRef.current + 20, Math.max(pitchRef.current, 45))} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 hover:bg-white/10" aria-label="Rotate right"><RotateCw size={17} /></button>
                <button type="button" onClick={() => applyCamera(bearingRef.current, pitchRef.current + 8)} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 hover:bg-white/10" aria-label="Increase pitch"><Plus size={17} /></button>
                <button type="button" onClick={() => applyCamera(bearingRef.current, pitchRef.current - 8)} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 hover:bg-white/10" aria-label="Decrease pitch"><Minus size={17} /></button>
                <button type="button" onClick={toggleTopDown} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"><Compass className="mr-1 inline" size={15} /> {cameraMode === 'top' ? '3D View' : 'Top View'}</button>
                <button type="button" onClick={toggleOrbit} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${orbiting ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10'}`}><TimerReset className="mr-1 inline" size={15} /> {orbiting ? 'Stop Orbit' : 'Auto Orbit'}</button>
                <button type="button" onClick={() => void toggleLabels()} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">{labelsVisible ? <EyeOff className="mr-1 inline" size={15} /> : <Eye className="mr-1 inline" size={15} />} {labelsVisible ? 'Hide Labels' : 'Show Labels'}</button>
                <button type="button" onClick={resetView} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"><RotateCcw className="mr-1 inline" size={15} /> Reset</button>
              </div>

              <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-xs text-slate-300 shadow-2xl backdrop-blur-xl"><Tags className="mr-2 inline text-cyan-300" size={14} /> Reliable 360° control is in the camera bar: rotate, pitch, top view, reset, and auto-orbit.</div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default MappedinControlTowerDemoPage

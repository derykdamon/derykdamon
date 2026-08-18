import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Compass,
  Eye,
  EyeOff,
  Expand,
  Flag,
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
  RotateCcw,
  RotateCw,
  Route as RouteIcon,
  Search,
  Target,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { normalizeFloors } from './core/floors'
import { initializeMappedinMap } from './core/mapLifecycle'
import { enableSpaceInteractivity, normalizeSpaces } from './core/spaces'
import type { FloorOption, LoadState, MapData, MapView, SpaceOption } from './types/mappedinTypes'

type LocationState = { status: 'off' | 'requesting' | 'ready' | 'error'; message: string }
type PickMode = 'inspect' | 'origin' | 'destination'
type ExperienceVariant = 'control-tower' | 'mappedin-plus'
type CameraTransform = { bearing?: number; pitch?: number; zoom?: number }
type CameraFocusTarget = Parameters<MapView['Camera']['focusOn']>[0]
type FloorChangeEvent = { floor: CameraFocusTarget & { id: string; name?: string; elevation?: number } }
type CameraChangeEvent = CameraTransform
type MapClickEvent = { spaces?: Array<{ id?: string }>; labels?: Array<{ text?: string }> }

type RouteInstruction = {
  text: string
  distance: number | null
}

type MappedinFullMapExperienceProps = {
  variant: ExperienceVariant
}

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function instructionText(instruction: any, index: number) {
  if (typeof instruction?.instruction === 'string' && instruction.instruction.trim()) {
    return instruction.instruction.trim()
  }

  const actionType = safeName(instruction?.action?.type, '')
  const bearing = safeName(instruction?.action?.bearing, '')
  const cleanAction = actionType
    ? actionType.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : `Step ${index + 1}`

  return [cleanAction, bearing].filter(Boolean).join(' ')
}

function formatDistance(distance: number | null) {
  if (distance === null || Number.isNaN(distance)) return '—'
  if (distance < 1) return '< 1 m'
  return `${Math.round(distance)} m`
}

function setCameraTransform(mapView: MapView, transform: CameraTransform) {
  ;(mapView.Camera.set as (nextTransform: CameraTransform) => void)(transform)
}

async function addLabels(mapView: MapView, spaces: SpaceOption[]) {
  mapView.Labels.removeAll()
  await Promise.all(
    spaces.slice(0, 600).map((space) =>
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

function MappedinFullMapExperience({ variant }: MappedinFullMapExperienceProps) {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<MapView | null>(null)
  const mapDataRef = useRef<MapData | null>(null)
  const spacesRef = useRef<SpaceOption[]>([])
  const orbitTimerRef = useRef<number | null>(null)
  const bearingRef = useRef(0)
  const pitchRef = useRef(48)
  const zoomRef = useRef(14.2)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [selectedSpace, setSelectedSpace] = useState<SpaceOption | null>(null)
  const [query, setQuery] = useState('')
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [pickMode, setPickMode] = useState<PickMode>('inspect')
  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(48)
  const [zoom, setZoom] = useState(14.2)
  const [orbiting, setOrbiting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [origin, setOrigin] = useState<SpaceOption | null>(null)
  const [destination, setDestination] = useState<SpaceOption | null>(null)
  const [accessibleRoute, setAccessibleRoute] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [routeDistance, setRouteDistance] = useState<number | null>(null)
  const [routeInstructions, setRouteInstructions] = useState<RouteInstruction[]>([])
  const [routeActive, setRouteActive] = useState(false)
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'off',
    message: 'Browser location has not been requested.',
  })

  const isMission = variant === 'mappedin-plus'
  const title = isMission ? 'Mappedin Mission Control' : 'Mappedin Control Tower'
  const subtitle = isMission
    ? 'Demo3 · full map, real floors, navigation, labels'
    : 'Demo2 · full-map operations console with route planner'

  const visibleSpaces = useMemo(() => {
    const value = query.trim().toLowerCase()
    const source = value
      ? spaces.filter((space) => space.name.toLowerCase().includes(value))
      : spaces
    return source.slice(0, value ? 120 : 40)
  }, [query, spaces])

  const applyCamera = useCallback((nextBearing: number, nextPitch: number, nextZoom = zoomRef.current) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    const normalizedBearing = ((nextBearing % 360) + 360) % 360
    const normalizedPitch = Math.max(0, Math.min(75, nextPitch))
    const normalizedZoom = Math.max(11.5, Math.min(20, nextZoom))

    bearingRef.current = normalizedBearing
    pitchRef.current = normalizedPitch
    zoomRef.current = normalizedZoom
    setBearing(normalizedBearing)
    setPitch(normalizedPitch)
    setZoom(normalizedZoom)
    setCameraTransform(mapView, { bearing: normalizedBearing, pitch: normalizedPitch, zoom: normalizedZoom })
  }, [])

  const applyCampusCamera = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return
    mapView.Camera.focusOn(mapView.currentFloor)
    applyCamera(0, 48, 14.2)
  }, [applyCamera])

  const applySiteCamera = () => applyCamera(bearingRef.current, 50, 15.6)
  const applyBuildingCamera = () => applyCamera(bearingRef.current, 58, 17)
  const applyTopCamera = () => applyCamera(bearingRef.current, 0, Math.max(zoomRef.current, 15.2))

  const clearRoute = useCallback(() => {
    const mapView = mapViewRef.current
    try {
      mapView?.Navigation?.stopTracking?.()
      mapView?.Navigation?.clear?.()
      ;(mapView?.Navigation as { remove?: () => void } | undefined)?.remove?.()
      mapView?.Paths?.removeAll?.()
    } catch {
      // Mappedin exposes slightly different clear methods across versions.
    }
    setRouteActive(false)
    setRouteDistance(null)
    setRouteInstructions([])
    setRouteError('')
  }, [])

  const focusSpace = useCallback((space: SpaceOption) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(space.raw)
    applyCamera(bearingRef.current, Math.max(pitchRef.current, 48), Math.max(zoomRef.current, 16.2))
    setSelectedSpace(space)

    if (pickMode === 'origin') {
      setOrigin(space)
      setPickMode('inspect')
      setRouteError('Start point selected. Choose a destination and draw the route.')
    } else if (pickMode === 'destination') {
      setDestination(space)
      setPickMode('inspect')
      setRouteError('Destination selected. Draw the route when ready.')
    }
  }, [applyCamera, pickMode])

  const drawRoute = useCallback(async () => {
    const mapData = mapDataRef.current
    const mapView = mapViewRef.current

    if (!mapData || !mapView || !origin || !destination) {
      setRouteError('Select both a start point and a destination.')
      return
    }

    setRouteLoading(true)
    setRouteError('')

    try {
      clearRoute()
      const directions = await mapData.getDirections(origin.raw, destination.raw, {
        accessible: accessibleRoute,
        smoothing: true,
      })

      if (!directions) {
        setRouteError('Mappedin could not calculate a route between those two spaces.')
        return
      }

      await mapView.Navigation.draw(directions, {
        pathOptions: {
          color: '#06b6d4',
          accentColor: '#ffffff',
          displayArrowsOnPath: true,
          animateArrowsOnPath: true,
          width: 1.1,
        },
        markerOptions: {
          departureColor: '#22c55e',
          destinationColor: '#ef4444',
        },
      })

      const legacyDistance = (directions as { totalDistance?: number }).totalDistance
      const distance = Number(directions.distance ?? legacyDistance ?? 0)
      const instructions = Array.isArray(directions.instructions)
        ? directions.instructions.map((instruction: any, index: number) => ({
            text: instructionText(instruction, index),
            distance: typeof instruction.distance === 'number' ? instruction.distance : null,
          }))
        : []

      setRouteDistance(Number.isFinite(distance) ? distance : null)
      setRouteInstructions(instructions)
      setRouteActive(true)
      mapView.Camera.focusOn(destination.raw)
      applyCamera(bearingRef.current, 55, Math.max(zoomRef.current, 16.6))
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Unable to draw navigation route.')
    } finally {
      setRouteLoading(false)
    }
  }, [accessibleRoute, applyCamera, clearRoute, destination, origin])

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return

    setLoadState('loading')
    setErrorMessage('')

    const { mapData, mapView } = await initializeMappedinMap(mapElement, {
      tokenErrorMessage: 'Mappedin token configuration could not be loaded.',
    })
    mapViewRef.current = mapView
    mapDataRef.current = mapData

    const currentFloorName = safeName(mapView.currentFloor?.name, 'Current floor')
    const floorOptions = normalizeFloors(mapData, { sort: 'semantic-asc' })
    const spaceOptions = normalizeSpaces(mapData, currentFloorName)

    setFloors(floorOptions)
    setSpaces(spaceOptions)
    spacesRef.current = spaceOptions
    setCurrentFloorId(String(mapView.currentFloor.id))

    enableSpaceInteractivity(mapView, spaceOptions, '#06b6d4')

    await addLabels(mapView, spaceOptions)

    mapView.on('floor-change', (event: FloorChangeEvent) => {
      setCurrentFloorId(String(event.floor.id))
      if (!routeActive) {
        mapView.Camera.focusOn(event.floor)
        applyCamera(bearingRef.current, pitchRef.current, zoomRef.current)
      }
    })

    mapView.on('camera-change', (transform: CameraChangeEvent) => {
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

    mapView.on('click', (event: MapClickEvent) => {
      const clickedSpace = event.spaces?.[0]
      const clickedLabel = event.labels?.[0]
      if (clickedSpace?.id) {
        const match = spacesRef.current.find((space) => space.id === String(clickedSpace.id))
        if (match) focusSpace(match)
        return
      }
      if (clickedLabel?.text) {
        const match = spacesRef.current.find((space) => space.name === clickedLabel.text)
        if (match) focusSpace(match)
      }
    })

    setLoadState('ready')
    window.setTimeout(() => applyCampusCamera(), 150)
  }, [applyCamera, applyCampusCamera, focusSpace, routeActive])

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
      mapDataRef.current = null
    }
  }, [loadMap, reloadKey])

  useEffect(() => {
    if (origin && destination && routeActive) {
      void drawRoute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessibleRoute])

  const firstMatch = visibleSpaces[0]
  const activeFloor = floors.find((floor) => floor.id === currentFloorId)

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
    clearRoute()
    setOrigin(null)
    setDestination(null)
    setSelectedSpace(null)
    setPickMode('inspect')
    applyCampusCamera()
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
      applyCamera(next, Math.max(pitchRef.current, 48), zoomRef.current)
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
            <p className="mt-5 text-lg font-semibold">Loading {title}</p>
            <p className="mt-2 text-sm text-slate-400">Preparing floors, labels, room search, navigation, and camera controls.</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950 px-6">
          <div className="max-w-lg rounded-3xl border border-red-300/20 bg-red-400/10 p-8 text-center">
            <AlertTriangle className="mx-auto text-red-300" size={34} />
            <h1 className="mt-4 text-xl font-semibold">Map failed to load</h1>
            <p className="mt-3 text-sm text-slate-300">{errorMessage}</p>
            <button className="mt-6 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-950" type="button" onClick={() => setReloadKey((value) => value + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <header className="absolute inset-x-4 top-4 z-30 rounded-3xl border border-white/10 bg-white/88 p-3 text-slate-950 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[20rem] items-center gap-3">
                <Link to="/" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm" aria-label="Return to website">
                  <ArrowLeft size={18} />
                </Link>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-700 text-white">
                  {isMission ? <Navigation size={20} /> : <Building2 size={20} />}
                </div>
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="text-xs text-slate-500">{subtitle}</p>
                </div>
              </div>

              <label className="relative min-w-[18rem] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && firstMatch && focusSpace(firstMatch)}
                  placeholder="Search mapped rooms, labels, departments, or spaces"
                  className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Clear search">
                    <X size={16} />
                  </button>
                )}
              </label>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setLeftPanelOpen((value) => !value)} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Toggle left panel">
                  {leftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                </button>
                <button type="button" onClick={() => setRightPanelOpen((value) => !value)} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Toggle navigation panel">
                  {rightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                </button>
                <button type="button" onClick={() => setUiVisible((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm">
                  {uiVisible ? 'Hide UI' : 'Show UI'}
                </button>
                <button type="button" onClick={() => void enterFullscreen()} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Fullscreen">
                  <Expand size={18} />
                </button>
              </div>
            </div>

            {uiVisible && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                <span className="px-2 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Ground → Higher</span>
                {floors.map((floor) => (
                  <button key={floor.id} type="button" onClick={() => changeFloor(floor.id)} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${currentFloorId === floor.id ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {floor.name}
                  </button>
                ))}
              </div>
            )}
          </header>

          {uiVisible && leftPanelOpen && (
            <aside className="absolute bottom-6 left-5 top-40 z-20 flex w-[25rem] flex-col rounded-3xl border border-white/15 bg-slate-950/80 text-white shadow-2xl backdrop-blur-xl">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Map controls</p>
                    <h2 className="mt-2 text-xl font-bold">Full Mappedin experience</h2>
                  </div>
                  <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-200">Live</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3"><p className="font-bold">{floors.length}</p><p className="text-xs text-slate-400">Floors</p></div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3"><p className="font-bold">{spaces.length}</p><p className="text-xs text-slate-400">Spaces</p></div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3"><p className="font-bold">{activeFloor?.name ?? '—'}</p><p className="text-xs text-slate-400">Active</p></div>
                </div>
              </div>

              <div className="border-b border-white/10 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Camera</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={applyCampusCamera} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100"><Navigation className="mr-1 inline" size={16} />Campus</button>
                  <button type="button" onClick={applySiteCamera} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Target className="mr-1 inline" size={16} />Site</button>
                  <button type="button" onClick={applyBuildingCamera} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Building2 className="mr-1 inline" size={16} />Bldg</button>
                  <button type="button" onClick={applyTopCamera} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Compass className="mr-1 inline" size={16} />Top</button>
                  <button type="button" onClick={() => applyCamera(bearing - 25, pitch, zoom)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><RotateCcw className="mr-1 inline" size={16} />Left</button>
                  <button type="button" onClick={() => applyCamera(bearing + 25, pitch, zoom)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><RotateCw className="mr-1 inline" size={16} />Right</button>
                  <button type="button" onClick={() => applyCamera(bearing, pitch + 8, zoom)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Plus className="mr-1 inline" size={16} />Pitch</button>
                  <button type="button" onClick={() => applyCamera(bearing, pitch - 8, zoom)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Minus className="mr-1 inline" size={16} />Pitch</button>
                  <button type="button" onClick={() => applyCamera(bearing, pitch, zoom + 0.7)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Plus className="mr-1 inline" size={16} />Zoom</button>
                  <button type="button" onClick={() => applyCamera(bearing, pitch, zoom - 0.7)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Minus className="mr-1 inline" size={16} />Zoom</button>
                  <button type="button" onClick={toggleOrbit} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${orbiting ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Play className="mr-1 inline" size={16} />Orbit</button>
                  <button type="button" onClick={resetView} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><RotateCcw className="mr-1 inline" size={16} />Reset</button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-400">Bearing {Math.round(bearing)}° · Pitch {Math.round(pitch)}° · Zoom {zoom.toFixed(1)}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Spaces</p>
                  <span className="text-xs text-slate-500">{visibleSpaces.length} shown</span>
                </div>
                <div className="space-y-2">
                  {visibleSpaces.map((space) => (
                    <button key={space.id} type="button" onClick={() => focusSpace(space)} className={`w-full rounded-xl border p-3 text-left transition ${selectedSpace?.id === space.id ? 'border-cyan-300/50 bg-cyan-300/12' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 shrink-0 text-cyan-300" size={16} />
                        <div className="min-w-0"><p className="truncate text-sm font-semibold">{space.name}</p><p className="mt-1 text-xs text-slate-500">{space.floorName}</p></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          {uiVisible && rightPanelOpen && (
            <aside className="absolute bottom-6 right-5 top-40 z-20 flex w-[27rem] flex-col rounded-3xl border border-white/15 bg-slate-950/82 text-white shadow-2xl backdrop-blur-xl">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Selection</p>
                    <h2 className="mt-2 text-2xl font-bold">{selectedSpace?.name ?? 'No room selected'}</h2>
                    <p className="mt-1 text-sm text-slate-400">{selectedSpace?.floorName ?? 'Click a room or search result.'}</p>
                  </div>
                  <button type="button" onClick={() => setRightPanelOpen(false)} className="rounded-xl border border-white/10 p-2 text-slate-300"><X size={18} /></button>
                </div>
              </div>

              <div className="border-b border-white/10 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Navigation</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => selectedSpace && setOrigin(selectedSpace)} disabled={!selectedSpace} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"><Flag className="mr-1 inline" size={16} />Set start</button>
                  <button type="button" onClick={() => selectedSpace && setDestination(selectedSpace)} disabled={!selectedSpace} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"><Target className="mr-1 inline" size={16} />Set destination</button>
                  <button type="button" onClick={() => setPickMode('origin')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${pickMode === 'origin' ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}>Pick start</button>
                  <button type="button" onClick={() => setPickMode('destination')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${pickMode === 'destination' ? 'border-rose-300/50 bg-rose-300/15 text-rose-100' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}>Pick destination</button>
                </div>

                <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                  <p><span className="text-slate-500">Start:</span> <span className="font-semibold">{origin?.name ?? 'Not selected'}</span></p>
                  <p><span className="text-slate-500">Destination:</span> <span className="font-semibold">{destination?.name ?? 'Not selected'}</span></p>
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={accessibleRoute} onChange={(event) => setAccessibleRoute(event.target.checked)} />
                    Accessible route where available
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void drawRoute()} disabled={routeLoading || !origin || !destination} className="rounded-xl bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                    {routeLoading ? <LoaderCircle className="mr-1 inline animate-spin" size={16} /> : <RouteIcon className="mr-1 inline" size={16} />}
                    Draw route
                  </button>
                  <button type="button" onClick={clearRoute} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200">Clear route</button>
                </div>
                {routeError && <p className="mt-3 text-xs leading-5 text-amber-200">{routeError}</p>}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-slate-500">Distance</p><p className="mt-1 text-xl font-bold">{formatDistance(routeDistance)}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-slate-500">Mode</p><p className="mt-1 text-xl font-bold">{accessibleRoute ? 'Accessible' : 'Shortest'}</p></div>
                </div>

                <div className="mt-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Turn-by-turn</p>
                  {routeInstructions.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">Draw a route to show Mappedin turn-by-turn instructions. Multi-floor routes can include connection tooltips for stairs/elevators when available in the map data.</p>
                  ) : (
                    <ol className="space-y-2">
                      {routeInstructions.map((instruction, index) => (
                        <li key={`${instruction.text}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                          <div className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs font-bold text-slate-950">{index + 1}</span>
                            <div><p className="text-sm font-semibold">{instruction.text}</p><p className="mt-1 text-xs text-slate-500">{formatDistance(instruction.distance)}</p></div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </aside>
          )}

          {uiVisible && (
            <div className="absolute bottom-5 left-1/2 z-30 w-[min(46rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-white/88 p-3 text-center text-sm font-medium text-slate-700 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={() => void toggleLabels()} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  {labelsVisible ? <EyeOff className="mr-1 inline" size={15} /> : <Eye className="mr-1 inline" size={15} />}
                  {labelsVisible ? 'Hide labels' : 'Show labels'}
                </button>
                <button type="button" onClick={requestLocation} disabled={locationState.status === 'requesting'} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
                  <LocateFixed className="mr-1 inline" size={15} /> GPS
                </button>
                <span className="text-xs text-slate-500">{pickMode === 'inspect' ? 'Click spaces to inspect, then set start/destination for navigation.' : `Click a room to set ${pickMode}.`}</span>
              </div>
            </div>
          )}

          {uiVisible && locationState.status !== 'off' && (
            <div className="absolute bottom-24 left-1/2 z-30 w-[min(38rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/82 p-3 text-center text-xs leading-5 text-slate-300 shadow-2xl backdrop-blur-xl">
              {locationState.message}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MappedinFullMapExperience

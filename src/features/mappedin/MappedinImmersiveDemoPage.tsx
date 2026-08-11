import {
  getMapData,
  show3dMap,
  type Space,
} from '@mappedin/mappedin-js'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Expand,
  Layers3,
  LoaderCircle,
  LocateFixed,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  Tags,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

type TokenPayload = {
  accessToken?: string
  mapId?: string
  error?: string
}

type LoadState = 'loading' | 'ready' | 'error'
type MapData = Awaited<ReturnType<typeof getMapData>>
type MapView = Awaited<ReturnType<typeof show3dMap>>

type FloorOption = {
  id: string
  name: string
  elevation: number
}

type SpaceOption = {
  id: string
  name: string
  floorName: string
  space: Space
}

type SelectedLocation = {
  id: string
  name: string
  floorName: string
  latitude?: number
  longitude?: number
}

type LocationState =
  | { status: 'idle'; message: string }
  | { status: 'requesting'; message: string }
  | { status: 'ready'; message: string }
  | { status: 'error'; message: string }

async function addPersistentLabels(mapView: MapView, mapData: MapData) {
  mapView.Labels.removeAll()

  const namedSpaces = mapData
    .getByType('space')
    .filter((space) => Boolean(space.name?.trim()))

  await Promise.all(
    namedSpaces.map((space) =>
      mapView.Labels.add(space, space.name, {
        interactive: true,
        enabled: true,
        rank: 'always-visible',
        appearance: {
          margin: 6,
          maxLines: 2,
          maxWidth: 160,
          textSize: 11.5,
          textColor: '#172033',
          textOutlineColor: '#ffffff',
          pinColor: '#172033',
          pinOutlineColor: '#ffffff',
        },
      }),
    ),
  )
}

function MappedinImmersiveDemoPage() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<MapView | null>(null)
  const mapDataRef = useRef<MapData | null>(null)
  const bearingRef = useRef(0)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null)
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [cameraMode, setCameraMode] = useState<'3d' | 'top'>('3d')
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [simulatedBlueDot, setSimulatedBlueDot] = useState(false)
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'idle',
    message:
      'Location is off. Browser GPS can report your true coordinates, but a reliable indoor blue dot requires on-site indoor positioning.',
  })

  const selectedFloor = useMemo(
    () => floors.find((floor) => floor.id === currentFloorId),
    [currentFloorId, floors],
  )

  const filteredSpaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const visibleSpaces = query
      ? spaces.filter((space) => space.name.toLowerCase().includes(query))
      : spaces

    return visibleSpaces.slice(0, 60)
  }, [searchQuery, spaces])

  const selectSpace = useCallback((spaceOption: SpaceOption) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(spaceOption.space)
    setSelectedLocation({
      id: spaceOption.id,
      name: spaceOption.name,
      floorName: mapView.currentFloor?.name || spaceOption.floorName,
    })
  }, [])

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return undefined

    setLoadState('loading')
    setErrorMessage('')

    const tokenResponse = await fetch('/api/mappedin-token')
    const tokenPayload = (await tokenResponse.json()) as TokenPayload

    if (!tokenResponse.ok || !tokenPayload.accessToken || !tokenPayload.mapId) {
      throw new Error(
        tokenPayload.error ?? 'The Mappedin configuration could not be loaded.',
      )
    }

    const mapData = await getMapData({
      accessToken: tokenPayload.accessToken,
      mapId: tokenPayload.mapId,
    })
    const mapView = await show3dMap(mapElement, mapData)

    mapViewRef.current = mapView
    mapDataRef.current = mapData

    mapView.Camera.interactions.set({
      pan: true,
      zoom: true,
      bearingAndPitch: true,
    })

    const floorOptions = mapData
      .getByType('floor')
      .map((floor) => ({
        id: floor.id,
        name: floor.name || `Level ${floor.elevation}`,
        elevation: floor.elevation,
      }))
      .sort((a, b) => b.elevation - a.elevation)

    const spaceOptions = mapData
      .getByType('space')
      .filter((space) => Boolean(space.name?.trim()))
      .map((space) => ({
        id: space.id,
        name: (space.name ?? '').trim(),
        floorName: mapView.currentFloor?.name || 'Mapped floor',
        space,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    setFloors(floorOptions)
    setSpaces(spaceOptions)
    setCurrentFloorId(mapView.currentFloor.id)

    mapData.getByType('space').forEach((space) => {
      mapView.updateState(space, {
        interactive: true,
        hoverColor: '#22d3ee',
      })
    })

    await addPersistentLabels(mapView, mapData)

    mapView.on('floor-change', (event) => {
      setCurrentFloorId(event.floor.id)
      setSelectedLocation((current) =>
        current
          ? {
              ...current,
              floorName: event.floor.name || `Level ${event.floor.elevation}`,
            }
          : null,
      )
    })

    mapView.on('camera-change', (transform) => {
      bearingRef.current = transform.bearing
    })

    mapView.on('click', (event) => {
      const floor = event.floors?.[0] ?? mapView.currentFloor
      const space = event.spaces?.[0]
      const label = event.labels?.[0]
      const coordinate = event.coordinate as
        | { latitude?: number; longitude?: number }
        | undefined

      if (space) {
        const name = space.name?.trim() || 'Unnamed mapped location'
        mapView.Camera.focusOn(space)
        setSelectedLocation({
          id: space.id,
          name,
          floorName: floor.name || `Level ${floor.elevation}`,
          latitude: coordinate?.latitude,
          longitude: coordinate?.longitude,
        })
        return
      }

      if (label) {
        setSelectedLocation({
          id: 'label-selection',
          name: label.text,
          floorName: floor.name || `Level ${floor.elevation}`,
          latitude: coordinate?.latitude,
          longitude: coordinate?.longitude,
        })
      }
    })

    mapView.Camera.focusOn(mapView.currentFloor)
    mapView.Camera.set({ pitch: 55, bearing: 0 })

    setLoadState('ready')
    return mapView
  }, [])

  useEffect(() => {
    let cancelled = false
    let activeMapView: MapView | undefined

    void loadMap()
      .then((mapView) => {
        if (cancelled) {
          mapView?.destroy()
          return
        }
        activeMapView = mapView
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(
          error instanceof Error ? error.message : 'The map failed to load.',
        )
        setLoadState('error')
      })

    return () => {
      cancelled = true
      mapViewRef.current = null
      mapDataRef.current = null
      activeMapView?.destroy()
    }
  }, [loadMap, reloadKey])

  const changeFloor = (floorId: string) => {
    mapViewRef.current?.setFloor(floorId)
  }

  const toggleLabels = async () => {
    const mapView = mapViewRef.current
    const mapData = mapDataRef.current
    if (!mapView || !mapData) return

    if (labelsVisible) {
      mapView.Labels.removeAll()
      setLabelsVisible(false)
    } else {
      await addPersistentLabels(mapView, mapData)
      setLabelsVisible(true)
    }
  }

  const rotateCamera = (degrees: number) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    const nextBearing = (bearingRef.current + degrees + 360) % 360
    bearingRef.current = nextBearing
    mapView.Camera.set({ bearing: nextBearing, pitch: 55 })
    setCameraMode('3d')
  }

  const toggleCameraMode = () => {
    const mapView = mapViewRef.current
    if (!mapView) return

    const nextMode = cameraMode === '3d' ? 'top' : '3d'
    mapView.Camera.set({ pitch: nextMode === 'top' ? 0 : 55 })
    setCameraMode(nextMode)
  }

  const resetCamera = () => {
    const mapView = mapViewRef.current
    if (!mapView) return

    bearingRef.current = 0
    mapView.Camera.focusOn(mapView.currentFloor)
    mapView.Camera.set({ bearing: 0, pitch: 55 })
    setCameraMode('3d')
  }

  const enterFullscreen = async () => {
    if (!shellRef.current) return

    if (document.fullscreenElement) await document.exitFullscreen()
    else await shellRef.current.requestFullscreen()
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
        const quality =
          accuracy <= 15
            ? 'Good device accuracy, but floor-level indoor positioning still requires an indoor positioning source.'
            : accuracy <= 50
              ? 'Useful general accuracy, but not reliable enough for room-level indoor blue dot.'
              : 'Too broad for indoor blue dot placement.'

        setLocationState({
          status: 'ready',
          message: `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · ±${Math.round(accuracy)} m. ${quality}`,
        })
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Use browser site settings to re-enable it.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'Your current position is unavailable.'
              : 'The location request timed out.'
        setLocationState({ status: 'error', message })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  }

  return (
    <div
      ref={shellRef}
      className="relative h-[100dvh] overflow-hidden bg-[#050816] text-slate-100"
    >
      <div ref={mapElementRef} className="absolute inset-0 h-full w-full" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050816]">
          <div className="rounded-3xl border border-white/10 bg-[#0b1120]/95 px-10 py-9 text-center shadow-2xl backdrop-blur-xl">
            <LoaderCircle size={34} className="mx-auto animate-spin text-cyan-300" />
            <p className="mt-5 text-base font-semibold text-white">
              Loading Robley Rex VAMC
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
              Building a full-screen Mappedin command center with floors,
              labels, search, camera controls, and location tools.
            </p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050816] px-6">
          <div className="max-w-lg rounded-3xl border border-red-300/25 bg-red-300/[0.07] p-8 text-center shadow-2xl">
            <AlertTriangle size={34} className="mx-auto text-red-300" />
            <h1 className="mt-5 text-xl font-semibold text-white">
              Unable to load the Mappedin experience
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <RotateCcw size={16} />
              Try again
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          {chromeVisible && (
            <>
              <header className="absolute left-4 right-4 top-4 z-30 flex items-center justify-between gap-4 rounded-2xl border border-slate-950/10 bg-white/90 px-4 py-3 text-slate-950 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <Link
                    to="/"
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50"
                    aria-label="Return to website"
                  >
                    <ArrowLeft size={18} />
                  </Link>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f3f55] text-white">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold tracking-tight">
                      Mappedin Demo1 Command Center
                    </p>
                    <p className="text-xs text-slate-500">
                      Robley Rex VAMC · full-screen digital twin workspace
                    </p>
                  </div>
                </div>

                <div className="hidden flex-1 justify-center lg:flex">
                  <label className="relative w-full max-w-2xl">
                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search mapped rooms, labels, departments, or spaces"
                      className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-300/20"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        aria-label="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLeftPanelOpen((current) => !current)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50"
                    aria-label="Toggle left panel"
                  >
                    {leftPanelOpen ? (
                      <PanelLeftClose size={18} />
                    ) : (
                      <PanelLeftOpen size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={enterFullscreen}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50"
                    aria-label="Fullscreen map"
                  >
                    <Expand size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setChromeVisible(false)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50"
                    aria-label="Hide controls"
                  >
                    <EyeOff size={18} />
                  </button>
                </div>
              </header>

              <aside
                className={`absolute bottom-4 left-4 top-24 z-30 w-[23rem] overflow-hidden rounded-3xl border border-slate-950/10 bg-white/92 text-slate-950 shadow-2xl backdrop-blur-xl transition-transform duration-300 ${
                  leftPanelOpen ? 'translate-x-0' : '-translate-x-[110%]'
                }`}
              >
                <div className="border-b border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.2em] text-cyan-700 uppercase">
                        Controls
                      </p>
                      <h2 className="mt-1 text-lg font-bold">Map command panel</h2>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Live
                    </span>
                  </div>
                </div>

                <div className="h-[calc(100%-5.5rem)] space-y-5 overflow-y-auto p-4">
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Layers3 size={16} className="text-cyan-700" />
                      Floors
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {floors.map((floor) => (
                        <button
                          key={floor.id}
                          type="button"
                          onClick={() => changeFloor(floor.id)}
                          className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                            currentFloorId === floor.id
                              ? 'border-cyan-400 bg-cyan-50 text-cyan-900 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/50'
                          }`}
                        >
                          {floor.name}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Compass size={16} className="text-cyan-700" />
                      Camera
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => rotateCamera(-30)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50"
                      >
                        <RotateCcw size={16} />
                        Rotate left
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateCamera(30)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50"
                      >
                        <RotateCw size={16} />
                        Rotate right
                      </button>
                      <button
                        type="button"
                        onClick={toggleCameraMode}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50"
                      >
                        {cameraMode === '3d' ? 'Top-down view' : '3D view'}
                      </button>
                      <button
                        type="button"
                        onClick={resetCamera}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50"
                      >
                        Reset view
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Mouse: scroll to zoom, drag to pan, and use modifier-drag for
                      bearing/pitch where supported.
                    </p>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Tags size={16} className="text-cyan-700" />
                      Visibility
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleLabels()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50"
                      >
                        {labelsVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        {labelsVisible ? 'Hide labels' : 'Show labels'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedBlueDot((current) => !current)}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          simulatedBlueDot
                            ? 'border-cyan-400 bg-cyan-50 text-cyan-900'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <Crosshair size={16} />
                        Demo dot
                      </button>
                    </div>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <LocateFixed size={16} className="text-cyan-700" />
                      Browser location
                    </div>
                    <button
                      type="button"
                      onClick={requestLocation}
                      disabled={locationState.status === 'requesting'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                    >
                      {locationState.status === 'requesting' ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : (
                        <LocateFixed size={16} />
                      )}
                      Use my location
                    </button>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {locationState.message}
                    </p>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Search size={16} className="text-cyan-700" />
                      Room search
                    </div>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Type room or label name"
                      className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-300/20 lg:hidden"
                    />
                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      {filteredSpaces.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-slate-500">
                          No matching mapped spaces.
                        </p>
                      ) : (
                        filteredSpaces.map((space) => (
                          <button
                            key={space.id}
                            type="button"
                            onClick={() => selectSpace(space)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-white hover:text-slate-950"
                          >
                            <MapPin size={14} className="text-cyan-700" />
                            <span className="truncate">{space.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </aside>

              <aside
                className={`absolute bottom-4 right-4 top-24 z-30 w-[24rem] overflow-hidden rounded-3xl border border-slate-950/10 bg-white/92 text-slate-950 shadow-2xl backdrop-blur-xl transition-transform duration-300 ${
                  rightPanelOpen ? 'translate-x-0' : 'translate-x-[110%]'
                }`}
              >
                <div className="border-b border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.2em] text-cyan-700 uppercase">
                        Selection
                      </p>
                      <h2 className="mt-1 text-lg font-bold">
                        {selectedLocation?.name ?? 'No room selected'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRightPanelOpen(false)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                      aria-label="Close details panel"
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedLocation?.floorName ??
                      'Click a mapped room, label, or search result to populate this panel.'}
                  </p>
                </div>

                <div className="h-[calc(100%-6.5rem)] space-y-4 overflow-y-auto p-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Floors</p>
                      <p className="mt-1 text-lg font-bold">{floors.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Spaces</p>
                      <p className="mt-1 text-lg font-bold">{spaces.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Mode</p>
                      <p className="mt-1 text-lg font-bold uppercase">{cameraMode}</p>
                    </div>
                  </div>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold">Mappedin object data</h3>
                    <dl className="mt-3 space-y-3 text-sm">
                      <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <dt className="text-slate-500">Name</dt>
                        <dd className="text-right font-medium">
                          {selectedLocation?.name ?? 'None'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <dt className="text-slate-500">Floor</dt>
                        <dd className="text-right font-medium">
                          {selectedLocation?.floorName ?? selectedFloor?.name ?? '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <dt className="text-slate-500">Mappedin ID</dt>
                        <dd className="max-w-[12rem] truncate text-right font-mono text-xs">
                          {selectedLocation?.id ?? '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Coordinate</dt>
                        <dd className="text-right text-xs text-slate-700">
                          {selectedLocation?.latitude !== undefined &&
                          selectedLocation.longitude !== undefined
                            ? `${selectedLocation.latitude.toFixed(5)}, ${selectedLocation.longitude.toFixed(5)}`
                            : 'Click map for coordinate'}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles size={18} className="mt-0.5 text-cyan-700" />
                      <div>
                        <h3 className="font-semibold text-cyan-950">
                          ActivationOS next layer
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-cyan-900/80">
                          This is the spatial foundation. The next build links
                          each selected Mappedin space ID to room equipment,
                          low-voltage drops, QC photos, documents, deficiencies,
                          DITL scenarios, and readiness status.
                        </p>
                      </div>
                    </div>
                  </section>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLocation(null)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50"
                    >
                      Clear selection
                    </button>
                    <button
                      type="button"
                      onClick={resetCamera}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-50"
                    >
                      Recenter map
                    </button>
                  </div>
                </div>
              </aside>
            </>
          )}

          {!rightPanelOpen && chromeVisible && (
            <button
              type="button"
              onClick={() => setRightPanelOpen(true)}
              className="absolute right-4 top-24 z-30 rounded-2xl border border-slate-950/10 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 shadow-xl backdrop-blur-xl transition hover:bg-white"
            >
              Show details
            </button>
          )}

          {!chromeVisible && (
            <button
              type="button"
              onClick={() => setChromeVisible(true)}
              className="absolute left-4 top-4 z-30 inline-flex items-center gap-2 rounded-2xl border border-slate-950/10 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-950 shadow-xl backdrop-blur-xl transition hover:bg-white"
            >
              <Eye size={17} />
              Show controls
            </button>
          )}

          {simulatedBlueDot && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <span className="absolute h-12 w-12 animate-ping rounded-full bg-cyan-400/40" />
                <span className="relative h-5 w-5 rounded-full border-4 border-white bg-cyan-400 shadow-2xl" />
              </div>
              <div className="mt-2 rounded-full bg-slate-950/80 px-3 py-1 text-center text-xs font-semibold text-white backdrop-blur-md">
                Simulated on-site dot
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-950/10 bg-white/90 px-4 py-2 text-xs font-medium text-slate-700 shadow-xl backdrop-blur-xl">
            {selectedLocation
              ? `${selectedLocation.name} · ${selectedLocation.floorName}`
              : 'Click a room, search a space, change floors, rotate, or go fullscreen'}
          </div>
        </>
      )}
    </div>
  )
}

export default MappedinImmersiveDemoPage

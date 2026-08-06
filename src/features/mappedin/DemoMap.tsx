import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import {
  AlertTriangle,
  Compass,
  Expand,
  Layers3,
  LoaderCircle,
  LocateFixed,
  MapPin,
  MousePointer2,
  RotateCcw,
  RotateCw,
  Search,
  Tags,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TokenPayload = {
  accessToken?: string
  mapId?: string
  error?: string
}

type LoadState = 'loading' | 'ready' | 'error'

type FloorOption = {
  id: string
  name: string
  elevation: number
}

type LocationState =
  | { status: 'idle'; message: string }
  | { status: 'requesting'; message: string }
  | { status: 'ready'; message: string }
  | { status: 'error'; message: string }

type MapData = Awaited<ReturnType<typeof getMapData>>
type MapView = Awaited<ReturnType<typeof show3dMap>>
type Space = ReturnType<MapData['getByType']>[number]

function findDashboardMapPanel(): HTMLElement | null {
  const heading = Array.from(document.querySelectorAll('h2')).find(
    (element) => element.textContent?.trim() === 'Mappedin map area',
  )

  return heading?.closest('.relative') as HTMLElement | null
}

function hidePlaceholderFloorButtons(): (() => void) | undefined {
  const facilityHeading = Array.from(document.querySelectorAll('p')).find(
    (element) => element.textContent?.trim() === 'Facility map',
  )
  const header = facilityHeading?.closest('div.flex')
  const controls = header?.lastElementChild as HTMLElement | null

  if (!controls) {
    return undefined
  }

  const previousDisplay = controls.style.display
  controls.style.display = 'none'

  return () => {
    controls.style.display = previousDisplay
  }
}

function setDefinitionValue(term: string, value: string) {
  const terms = Array.from(document.querySelectorAll('dt'))
  const target = terms.find((element) => element.textContent?.trim() === term)
  const definition = target?.parentElement?.querySelector('dd')

  if (definition) {
    definition.textContent = value
  }
}

function updateDashboardLocation(
  name: string,
  floorName: string,
  spaceId: string,
  latitude?: number,
  longitude?: number,
) {
  const label = Array.from(document.querySelectorAll('p')).find(
    (element) => element.textContent?.trim() === 'SELECTED LOCATION',
  )
  const section = label?.parentElement
  const title = section?.querySelector('h2')
  const details = section?.querySelector('div.mt-3')

  if (title) {
    title.textContent = name
  }

  if (details) {
    details.textContent = `${floorName} · Live Mappedin space`
  }

  setDefinitionValue('Department', 'Mappedin location data')
  setDefinitionValue('Room type', 'Interactive mapped space')
  setDefinitionValue('Equipment', 'Equipment integration pending')
  setDefinitionValue('IT devices', `Mappedin ID: ${spaceId.slice(0, 12)}`)
  setDefinitionValue(
    'Open deficiencies',
    latitude !== undefined && longitude !== undefined
      ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      : 'No linked QC records',
  )
}

async function addPersistentLabels(mapView: MapView, mapData: MapData) {
  mapView.Labels.removeAll()

  const spaces = mapData
    .getByType('space')
    .filter((space) => Boolean(space.name?.trim()))

  await Promise.all(
    spaces.map((space) =>
      mapView.Labels.add(space, space.name, {
        interactive: true,
        enabled: true,
        rank: 'always-visible',
        appearance: {
          margin: 6,
          maxLines: 2,
          maxWidth: 150,
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

function DemoMapContent() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<MapView | null>(null)
  const mapDataRef = useRef<MapData | null>(null)
  const searchCleanupRef = useRef<(() => void) | null>(null)
  const bearingRef = useRef(0)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [selectedSpace, setSelectedSpace] = useState('Select a mapped room')
  const [cameraMode, setCameraMode] = useState<'3d' | 'top'>('3d')
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'idle',
    message: 'Location is off until you request it.',
  })

  const selectSpace = useCallback(
    (space: Space, mapView: MapView, floorName?: string) => {
      const name = space.name?.trim() || 'Unnamed mapped location'
      const resolvedFloor = floorName || mapView.currentFloor.name

      mapView.Camera.focusOn(space)
      setSelectedSpace(name)
      updateDashboardLocation(name, resolvedFloor, space.id)
    },
    [],
  )

  const wireDashboardSearch = useCallback(
    (mapView: MapView, mapData: MapData) => {
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder="Search rooms, departments, assets, or documents"]',
      )

      if (!input) {
        return undefined
      }

      const namedSpaces = mapData
        .getByType('space')
        .filter((space) => Boolean(space.name?.trim()))

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter') {
          return
        }

        const query = input.value.trim().toLowerCase()

        if (!query) {
          return
        }

        const space = namedSpaces.find((candidate) =>
          candidate.name.toLowerCase().includes(query),
        )

        if (!space) {
          input.setCustomValidity('No mapped room matched that search.')
          input.reportValidity()
          return
        }

        input.setCustomValidity('')
        selectSpace(space, mapView)
      }

      input.addEventListener('keydown', onKeyDown)
      input.title = 'Enter a mapped room name and press Enter'

      return () => input.removeEventListener('keydown', onKeyDown)
    },
    [selectSpace],
  )

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current

    if (!mapElement) {
      return undefined
    }

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
      rotationAndTilt: true,
    })

    const floorOptions = mapData
      .getByType('floor')
      .map((floor) => ({
        id: floor.id,
        name: floor.name || `Level ${floor.elevation}`,
        elevation: floor.elevation,
      }))
      .sort((a, b) => b.elevation - a.elevation)

    setFloors(floorOptions)
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
      mapView.Camera.focusOn(event.floor)
    })

    mapView.on('camera-change', (transform) => {
      bearingRef.current = transform.bearing
    })

    mapView.on('click', (event) => {
      const space = event.spaces?.[0]
      const label = event.labels?.[0]
      const floor = event.floors?.[0] ?? mapView.currentFloor

      if (space) {
        const name = space.name?.trim() || 'Unnamed mapped location'
        mapView.Camera.focusOn(space)
        setSelectedSpace(name)
        updateDashboardLocation(
          name,
          floor.name || `Level ${floor.elevation}`,
          space.id,
          event.coordinate.latitude,
          event.coordinate.longitude,
        )
        return
      }

      if (label) {
        setSelectedSpace(label.text)
      }
    })

    searchCleanupRef.current = wireDashboardSearch(mapView, mapData) ?? null

    mapView.Camera.focusOn(mapView.currentFloor)
    mapView.Camera.set({ pitch: 55, bearing: 0 })

    setLoadState('ready')
    return mapView
  }, [wireDashboardSearch])

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
        if (cancelled) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'The map failed to load.'
        setErrorMessage(message)
        setLoadState('error')
      })

    return () => {
      cancelled = true
      searchCleanupRef.current?.()
      searchCleanupRef.current = null
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

    if (!mapView || !mapData) {
      return
    }

    if (labelsVisible) {
      mapView.Labels.removeAll()
      setLabelsVisible(false)
      return
    }

    await addPersistentLabels(mapView, mapData)
    setLabelsVisible(true)
  }

  const rotateCamera = (degrees: number) => {
    const mapView = mapViewRef.current

    if (!mapView) {
      return
    }

    const nextBearing = (bearingRef.current + degrees + 360) % 360
    bearingRef.current = nextBearing
    mapView.Camera.set({ bearing: nextBearing, pitch: 55 })
    setCameraMode('3d')
  }

  const toggleCameraMode = () => {
    const mapView = mapViewRef.current

    if (!mapView) {
      return
    }

    if (cameraMode === '3d') {
      mapView.Camera.set({ pitch: 0 })
      setCameraMode('top')
    } else {
      mapView.Camera.set({ pitch: 55 })
      setCameraMode('3d')
    }
  }

  const resetCamera = () => {
    const mapView = mapViewRef.current

    if (!mapView) {
      return
    }

    bearingRef.current = 0
    mapView.Camera.focusOn(mapView.currentFloor)
    mapView.Camera.set({ bearing: 0, pitch: 55 })
    setCameraMode('3d')
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
        const accuracyMessage =
          accuracy <= 50
            ? `Accuracy is approximately ${Math.round(accuracy)} m.`
            : `Accuracy is approximately ${Math.round(accuracy)} m, which is too broad for reliable indoor positioning.`

        setLocationState({
          status: 'ready',
          message: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}. ${accuracyMessage} An off-site position is reported but is not plotted as an indoor Blue Dot.`,
        })
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. You can change this in the browser site settings.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'Your current position is unavailable.'
              : 'The location request timed out.'

        setLocationState({ status: 'error', message })
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      },
    )
  }

  const enterFullscreen = async () => {
    if (!panelRef.current) {
      return
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await panelRef.current.requestFullscreen()
    }
  }

  return (
    <div
      ref={panelRef}
      className="absolute inset-0 z-20 overflow-hidden bg-[#070b16]"
    >
      <div ref={mapElementRef} className="h-full min-h-[56rem] w-full" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070b16]">
          <div className="rounded-2xl border border-white/10 bg-[#0b1120]/95 px-8 py-7 text-center shadow-2xl backdrop-blur-xl">
            <LoaderCircle
              size={30}
              className="mx-auto animate-spin text-cyan-300"
            />
            <p className="mt-4 text-sm font-medium text-white">
              Loading Robley Rex VAMC
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Securing map access and preparing the digital twin
            </p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070b16] px-6">
          <div className="max-w-md rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-7 text-center">
            <AlertTriangle size={30} className="mx-auto text-red-300" />
            <h2 className="mt-4 text-lg font-semibold text-white">
              Unable to load the facility map
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <RotateCcw size={16} />
              Try again
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-emerald-300/20 bg-[#07111a]/85 px-3 py-1.5 text-xs font-medium text-emerald-200 backdrop-blur-md">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300" />
            Live digital twin
          </div>

          <div className="absolute right-4 top-4 flex max-w-[calc(100%-2rem)] flex-col items-end gap-2">
            <div className="flex max-w-full flex-wrap justify-end gap-2 rounded-2xl border border-white/10 bg-[#07111a]/90 p-2 shadow-xl backdrop-blur-md">
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => changeFloor(floor.id)}
                  title={`Elevation ${floor.elevation}`}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    currentFloorId === floor.id
                      ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {floor.name}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => rotateCamera(-90)}
                className="rounded-xl border border-white/10 bg-[#07111a]/90 p-2.5 text-slate-200 backdrop-blur-md transition hover:bg-white/10"
                aria-label="Rotate map left 90 degrees"
                title="Rotate left"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                onClick={() => rotateCamera(90)}
                className="rounded-xl border border-white/10 bg-[#07111a]/90 p-2.5 text-slate-200 backdrop-blur-md transition hover:bg-white/10"
                aria-label="Rotate map right 90 degrees"
                title="Rotate right"
              >
                <RotateCw size={16} />
              </button>
              <button
                type="button"
                onClick={toggleCameraMode}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#07111a]/90 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur-md transition hover:bg-white/10"
              >
                <Compass size={15} />
                {cameraMode === '3d' ? 'Top view' : '3D view'}
              </button>
              <button
                type="button"
                onClick={resetCamera}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#07111a]/90 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur-md transition hover:bg-white/10"
              >
                <RotateCcw size={15} />
                Reset
              </button>
              <button
                type="button"
                onClick={() => void toggleLabels()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#07111a]/90 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur-md transition hover:bg-white/10"
              >
                <Tags size={15} />
                {labelsVisible ? 'Hide labels' : 'Show labels'}
              </button>
              <button
                type="button"
                onClick={() => void enterFullscreen()}
                className="rounded-xl border border-white/10 bg-[#07111a]/90 p-2.5 text-slate-200 backdrop-blur-md transition hover:bg-white/10"
                aria-label="Toggle fullscreen map"
              >
                <Expand size={16} />
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-4 top-14 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#07111a]/80 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur-md">
            <Layers3 size={13} />
            {floors.length} mapped floors loaded
          </div>

          <div className="pointer-events-none absolute left-4 top-24 hidden max-w-xs items-center gap-2 rounded-xl border border-white/10 bg-[#07111a]/80 px-3 py-2 text-[11px] leading-4 text-slate-300 backdrop-blur-md md:flex">
            <MousePointer2 size={14} className="shrink-0 text-cyan-300" />
            Drag to pan. Hold Control while dragging, or use the rotate buttons,
            to orbit a full 360° around the building.
          </div>

          <div className="absolute bottom-4 left-4 max-w-sm rounded-2xl border border-white/10 bg-[#07111a]/90 p-3 text-xs text-slate-300 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 font-medium text-white">
              <MapPin size={15} className="text-cyan-300" />
              {selectedSpace}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
              <Search size={13} />
              The top search box now finds mapped room names when you press Enter.
            </div>
          </div>

          <div className="absolute bottom-4 right-4 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-[#07111a]/92 p-3 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationState.status === 'requesting'}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
            >
              {locationState.status === 'requesting' ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <LocateFixed size={15} />
              )}
              Use my location
            </button>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {locationState.message}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function DemoMap() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let restoreFloorControls: (() => void) | undefined

    const locateTarget = () => {
      const target = findDashboardMapPanel()

      if (target) {
        target.style.minHeight = '56rem'
        restoreFloorControls = hidePlaceholderFloorButtons()
        setPortalTarget(target)
        return true
      }

      return false
    }

    if (locateTarget()) {
      return () => restoreFloorControls?.()
    }

    const observer = new MutationObserver(() => {
      if (locateTarget()) {
        observer.disconnect()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      restoreFloorControls?.()
    }
  }, [])

  return portalTarget ? createPortal(<DemoMapContent />, portalTarget) : null
}

export default DemoMap

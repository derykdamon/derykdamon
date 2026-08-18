import {
  AlertTriangle,
  Activity,
  Building2,
  Compass,
  Database,
  Eye,
  EyeOff,
  Flag,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Route as RouteIcon,
  Search,
  Target,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AetherShell from './components/AetherShell'
import {
  createCameraController,
  type CameraController,
} from './core/cameraController'
import { initializeMappedinMap } from './core/mapLifecycle'
import {
  createBrowserPresenceProvider,
  createSimulationPresenceProvider,
  type PresenceProvider,
  type PresenceProviderSource,
  type PresenceProviderUpdate,
} from './core/presenceProvider'
import {
  presenceActions,
  presenceSelectors,
  type PresenceState,
} from './core/presenceSubsystem'
import { enableSpaceInteractivity } from './core/spaces'
import {
  searchActions,
  searchSelectors,
  type SearchState,
  type SearchResult,
  type SearchSuggestion,
} from './core/searchSubsystem'
import {
  worldActions,
  worldSelectors,
  type WorldSpace,
  type WorldState,
} from './core/worldSubsystem'
import type {
  LoadState,
  MappedinCoordinate,
  MappedinMarker,
  MapView,
} from './types/mappedinTypes'

type AetherShellState = LoadState

function waitForFirstMapRender(mapView: MapView) {
  return new Promise<void>((resolve) => {
    let settled = false
    const timeout = window.setTimeout(finish, 1000)

    function finish() {
      if (settled) return

      settled = true
      window.clearTimeout(timeout)
      mapView.off('post-render', finish)
      resolve()
    }

    mapView.on('post-render', finish)
  })
}

function AetherMappedinPage() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<MapView | null>(null)
  const cameraControllerRef = useRef<CameraController | null>(null)
  const wakeTimerRef = useRef<number | null>(null)
  const labelRevealTimerRef = useRef<number | null>(null)
  const selectionMoveTimerRef = useRef<number | null>(null)
  const selectedSpaceRef = useRef<WorldSpace | null>(null)
  const handledSelectionRef = useRef<string | null>(null)
  const routeRequestRef = useRef(0)
  const presenceProviderStopRef = useRef<(() => void) | null>(null)
  const blueDotMarkerRef = useRef<MappedinMarker | null>(null)
  const accuracyMarkerRef = useRef<MappedinMarker | null>(null)
  const lastPresenceCoordinateRef = useRef<MappedinCoordinate | null>(null)
  const [loadState, setLoadState] = useState<AetherShellState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [searchState, setSearchState] = useState<SearchState>(
    searchSelectors.getState(),
  )
  const [presenceState, setPresenceState] = useState<PresenceState>(
    presenceSelectors.getState(),
  )
  const [worldState, setWorldState] = useState<WorldState>(
    worldSelectors.getState(),
  )

  const setAetherLoadState = useCallback((nextLoadState: AetherShellState) => {
    setLoadState(nextLoadState)
    presenceActions.setCurrentLoadState(nextLoadState)
  }, [])

  const clearSelectedSpaceHighlight = useCallback(() => {
    const mapView = mapViewRef.current
    const selectedSpace = selectedSpaceRef.current
    if (!mapView || !selectedSpace) return

    mapView.updateState(selectedSpace.raw, {
      color: 'initial',
      hoverColor: '#7dd3fc',
      interactive: true,
    })
    selectedSpaceRef.current = null
  }, [])

  const highlightSelectedSpace = useCallback(
    (space: WorldSpace) => {
      const mapView = mapViewRef.current
      if (!mapView) return

      clearSelectedSpaceHighlight()
      mapView.updateState(space.raw, {
        color: '#0891b2',
        hoverColor: '#a5f3fc',
        interactive: true,
      })
      selectedSpaceRef.current = space
    },
    [clearSelectedSpaceHighlight],
  )

  const focusCurrentFloor = useCallback(() => {
    const mapView = mapViewRef.current
    const cameraController = cameraControllerRef.current
    if (!mapView || !cameraController) return

    const { bearing } = cameraController.getState()
    cameraController.flyToFloor(mapView.currentFloor, {
      bearing,
      pitch: 48,
      zoom: 14.2,
      preset: 'floor',
      applyZoom: true,
      animate: true,
      duration: 900,
      easing: 'ease-in-out',
    })
    presenceActions.setCurrentFocus({ type: 'camera', label: 'Floor focus' })
  }, [])

  const syncPresenceFloor = useCallback((floorId: string) => {
    const floor = worldSelectors.getFloorById(floorId)
    if (!floor) return

    presenceActions.setCurrentFloor({
      id: floor.id,
      worldId: floor.worldId,
      type: 'floor',
      name: floor.name,
      elevation: floor.elevation,
    })
  }, [])

  const activateFloor = useCallback(
    (floorId: string) => {
      mapViewRef.current?.setFloor(floorId)
      syncPresenceFloor(floorId)
    },
    [syncPresenceFloor],
  )

  const focusFloorById = useCallback(
    (floorId: string) => {
      activateFloor(floorId)

      if (selectionMoveTimerRef.current) {
        window.clearTimeout(selectionMoveTimerRef.current)
      }

      selectionMoveTimerRef.current = window.setTimeout(() => {
        focusCurrentFloor()
        selectionMoveTimerRef.current = null
      }, 80)
    },
    [activateFloor, focusCurrentFloor],
  )

  const createSpaceSelection = useCallback((space: WorldSpace) => ({
    type: 'space' as const,
    id: space.id,
    worldId: space.worldId,
    name: space.name,
    floorId: space.floorId,
    floorWorldId: space.floorId ? `floor:${space.floorId}` : undefined,
    floorName: space.floorName,
  }), [])

  const addWorldLabels = useCallback(async () => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Labels.removeAll()
    const results = await Promise.allSettled(
      worldSelectors.getSpaces().slice(0, 600).map((space) =>
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

    const failedLabel = results.find((result) => result.status === 'rejected')
    if (failedLabel?.status === 'rejected') {
      throw failedLabel.reason
    }
  }, [])

  const clearRoute = useCallback(() => {
    routeRequestRef.current += 1
    mapViewRef.current?.Navigation.stopTracking?.()
    mapViewRef.current?.Navigation.clear()
    presenceActions.setCurrentRoute({ status: 'idle' })
    presenceActions.setCurrentFocus({ type: 'none' })
  }, [])

  const clearBlueDotMarkers = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return

    if (blueDotMarkerRef.current) {
      mapView.Markers.remove(blueDotMarkerRef.current)
      blueDotMarkerRef.current = null
    }

    if (accuracyMarkerRef.current) {
      mapView.Markers.remove(accuracyMarkerRef.current)
      accuracyMarkerRef.current = null
    }
  }, [])

  const stopPresenceProvider = useCallback(() => {
    presenceProviderStopRef.current?.()
    presenceProviderStopRef.current = null
    clearBlueDotMarkers()
    lastPresenceCoordinateRef.current = null
    presenceActions.setCurrentProvider({
      activeProvider: null,
      followCamera: false,
    })
    presenceActions.setCurrentUserLocation({ status: 'off' })
  }, [clearBlueDotMarkers])

  const renderBlueDot = useCallback(
    (coordinate: MappedinCoordinate, accuracy?: number) => {
      const mapView = mapViewRef.current
      if (!mapView) return

      const ringSize = Math.max(36, Math.min(120, Math.round(accuracy ?? 24)))
      const ringHtml = `<div class="aether-accuracy-ring" style="width:${ringSize}px;height:${ringSize}px"></div>`
      const dotHtml = '<div class="aether-blue-dot"><span></span></div>'

      if (accuracyMarkerRef.current) {
        mapView.Markers.remove(accuracyMarkerRef.current)
      }
      accuracyMarkerRef.current = mapView.Markers.add(coordinate, ringHtml, {
        rank: 'always-visible',
      })

      if (blueDotMarkerRef.current) {
        void mapView.Markers.animateTo(blueDotMarkerRef.current, coordinate, {
          duration: 650,
          easing: 'ease-in-out',
        })
      } else {
        blueDotMarkerRef.current = mapView.Markers.add(coordinate, dotHtml, {
          rank: 'always-visible',
        })
      }
    },
    [],
  )

  const applyPresenceUpdate = useCallback(
    (update: PresenceProviderUpdate) => {
      const mapView = mapViewRef.current
      if (!mapView) return

      const coordinate = mapView.createCoordinate({
        latitude: update.latitude,
        longitude: update.longitude,
        floorId: update.floorId ?? String(mapView.currentFloor.id),
        verticalOffset: 0.35,
      })
      lastPresenceCoordinateRef.current = coordinate
      renderBlueDot(coordinate, update.accuracy)

      presenceActions.setCurrentUserLocation({
        status: 'ready',
        latitude: update.latitude,
        longitude: update.longitude,
        accuracy: update.accuracy,
        heading: update.heading,
        floorId: coordinate.floorId,
        source: update.source,
        followCamera: presenceSelectors.getCurrentProvider().followCamera,
        updatedAt: Date.now(),
      })

      if (presenceSelectors.getCurrentProvider().followCamera) {
        void mapView.Camera.animateTo(
          {
            center: coordinate,
            pitch: Math.max(
              presenceSelectors.getCurrentCamera()?.pitch ?? 52,
              52,
            ),
            zoomLevel: Math.max(
              presenceSelectors.getCurrentCamera()?.zoom ?? 17,
              17,
            ),
          },
          { duration: 700, easing: 'ease-in-out' },
        )
      }

      if (presenceSelectors.getCurrentRoute().status !== 'idle') {
        mapView.Navigation.trackCoordinate(coordinate, {
          mode: 'tethered',
          tetherThresholdDistance: 12,
          coordinateOutsideThresholdMode: 'tether-and-dash',
        })
      }
    },
    [renderBlueDot],
  )

  const startPresenceProvider = useCallback(
    (source: PresenceProviderSource) => {
      const mapView = mapViewRef.current
      if (!mapView) return

      stopPresenceProvider()
      presenceActions.setCurrentUserLocation({ status: 'requesting' })
      presenceActions.setCurrentProvider({
        activeProvider: source,
        followCamera: presenceSelectors.getCurrentProvider().followCamera,
      })

      const provider: PresenceProvider =
        source === 'browser'
          ? createBrowserPresenceProvider(() => String(mapView.currentFloor.id))
          : createSimulationPresenceProvider(mapView)

      presenceProviderStopRef.current = provider.start(
        applyPresenceUpdate,
        (error) => {
          presenceActions.setCurrentUserLocation({ status: 'unavailable' })
          presenceActions.setCurrentProvider({
            activeProvider: error.source,
            followCamera: false,
          })
        },
      )
    },
    [applyPresenceUpdate, stopPresenceProvider],
  )

  const setCameraFollowMode = useCallback(
    (enabled: boolean) => {
      const currentProvider = presenceSelectors.getCurrentProvider()
      presenceActions.setCurrentProvider({
        ...currentProvider,
        followCamera: enabled,
      })

      const currentLocation = presenceSelectors.getCurrentUserLocation()
      if (currentLocation.status === 'ready') {
        presenceActions.setCurrentUserLocation({
          ...currentLocation,
          followCamera: enabled,
        })
      }

      if (enabled && lastPresenceCoordinateRef.current) {
        void mapViewRef.current?.Camera.animateTo(
          {
            center: lastPresenceCoordinateRef.current,
            pitch: 52,
            zoomLevel: 17,
          },
          { duration: 700, easing: 'ease-in-out' },
        )
      }
    },
    [],
  )

  const focusCampusCamera = useCallback(() => {
    const mapView = mapViewRef.current
    const cameraController = cameraControllerRef.current
    if (!mapView || !cameraController) return

    cameraController.flyToFloor(mapView.currentFloor, {
      bearing: 0,
      pitch: 48,
      zoom: 14.2,
      preset: 'campus',
      applyZoom: true,
      animate: true,
      duration: 900,
      easing: 'ease-in-out',
    })
    presenceActions.setCurrentFocus({ type: 'camera', label: 'Campus' })
  }, [])

  const focusSiteCamera = useCallback(() => {
    const cameraController = cameraControllerRef.current
    if (!cameraController) return

    cameraController.setView(
      {
        bearing: cameraController.getState().bearing,
        pitch: 50,
        zoom: 15.6,
        preset: 'site',
      },
      { applyZoom: true, animate: true, duration: 700, easing: 'ease-in-out' },
    )
    presenceActions.setCurrentFocus({ type: 'camera', label: 'Site' })
  }, [])

  const focusBuildingCamera = useCallback(() => {
    const mapView = mapViewRef.current
    const cameraController = cameraControllerRef.current
    if (!mapView || !cameraController) return

    const currentSelection = presenceSelectors.getCurrentSelection()
    const selectedWorldSpace =
      currentSelection.type === 'space' && currentSelection.id
        ? worldSelectors.getSpaceById(currentSelection.id)
        : null

    cameraController.flyToFloor(selectedWorldSpace?.raw ?? mapView.currentFloor, {
      bearing: cameraController.getState().bearing,
      pitch: 58,
      zoom: 17,
      preset: 'building',
      applyZoom: true,
      animate: true,
      duration: 800,
      easing: 'ease-in-out',
    })
    presenceActions.setCurrentFocus({ type: 'camera', label: 'Building' })
  }, [])

  const focusTopCamera = useCallback(() => {
    const cameraController = cameraControllerRef.current
    if (!cameraController) return

    const currentCamera = cameraController.getState()
    cameraController.setView(
      {
        bearing: currentCamera.bearing,
        pitch: 0,
        zoom: Math.max(currentCamera.zoom, 15.2),
        preset: 'top',
      },
      { applyZoom: true, animate: true, duration: 700, easing: 'ease-in-out' },
    )
    presenceActions.setCurrentFocus({ type: 'camera', label: 'Top' })
  }, [])

  const focusPerspectiveCamera = useCallback(() => {
    const cameraController = cameraControllerRef.current
    if (!cameraController) return

    const currentCamera = cameraController.getState()
    cameraController.setView(
      {
        bearing: currentCamera.bearing,
        pitch: Math.max(currentCamera.pitch, 52),
        zoom: Math.max(currentCamera.zoom, 15.2),
        preset: 'perspective',
      },
      { applyZoom: true, animate: true, duration: 700, easing: 'ease-in-out' },
    )
    presenceActions.setCurrentFocus({ type: 'camera', label: 'Perspective' })
  }, [])

  const adjustCamera = useCallback(
    (transform: { bearing?: number; pitch?: number; zoom?: number }) => {
      const cameraController = cameraControllerRef.current
      if (!cameraController) return

      const currentCamera = cameraController.getState()
      cameraController.setView(
        {
          bearing: transform.bearing ?? currentCamera.bearing,
          pitch: transform.pitch ?? currentCamera.pitch,
          zoom: transform.zoom ?? currentCamera.zoom,
          preset: 'custom',
        },
        { applyZoom: true, animate: true, duration: 450, easing: 'ease-out' },
      )
      presenceActions.setCurrentFocus({ type: 'camera', label: 'Custom' })
    },
    [],
  )

  const toggleOrbit = useCallback(() => {
    const cameraController = cameraControllerRef.current
    if (!cameraController) return

    if (cameraController.getState().orbiting) cameraController.stopOrbit()
    else cameraController.orbit()
  }, [])

  const resetCamera = useCallback(() => {
    clearRoute()
    presenceActions.setCurrentSelection({ type: 'none' })
    presenceActions.setCurrentSpace(null)
    searchActions.clear()
    setSuggestions([])
    focusCampusCamera()
  }, [clearRoute, focusCampusCamera])

  const toggleLabels = useCallback(async () => {
    const mapView = mapViewRef.current
    if (!mapView) return

    if (labelsVisible) {
      mapView.Labels.removeAll()
      setLabelsVisible(false)
      return
    }

    try {
      await addWorldLabels()
      setLabelsVisible(true)
    } catch (error) {
      console.warn('Aether labels are waiting for the map renderer:', error)
    }
  }, [addWorldLabels, labelsVisible])

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return undefined

    setAetherLoadState('loading')
    setErrorMessage('')

    if (wakeTimerRef.current) {
      window.clearTimeout(wakeTimerRef.current)
      wakeTimerRef.current = null
    }
    if (labelRevealTimerRef.current) {
      window.clearTimeout(labelRevealTimerRef.current)
      labelRevealTimerRef.current = null
    }

    const { mapData, mapView, token } = await initializeMappedinMap(mapElement)
    mapViewRef.current = mapView

    worldActions.normalizeFromMapData(mapData, {
      fallbackFloorName: mapView.currentFloor?.name || 'Mapped floor',
      floorSort: 'semantic-asc',
    })
    worldActions.setVenue({
      type: 'venue',
      worldId: `venue:${token.mapId}`,
      externalId: token.mapId,
      name: 'Mappedin Venue',
    })
    const building = {
      type: 'building',
      worldId: `building:${token.mapId}`,
      venueId: `venue:${token.mapId}`,
      externalId: token.mapId,
      name: 'Aether Building',
    } as const
    worldActions.setBuilding(building)
    presenceActions.setCurrentBuilding({
      id: building.externalId,
      worldId: building.worldId,
      type: 'building',
      name: building.name,
      externalId: building.externalId,
    })

    presenceActions.setCurrentFloor({
      id: String(mapView.currentFloor.id),
      worldId: `floor:${mapView.currentFloor.id}`,
      type: 'floor',
      name: mapView.currentFloor.name || 'Current floor',
      elevation: Number(mapView.currentFloor.elevation ?? 0),
    })

    enableSpaceInteractivity(mapView, worldSelectors.getSpaces(), '#7dd3fc')
    setLabelsVisible(false)

    const cameraController = createCameraController(mapView, {
      initialPitch: 0,
      initialZoom: 13.2,
      initialPreset: 'top',
    })
    cameraControllerRef.current = cameraController
    await waitForFirstMapRender(mapView)
    cameraController.reset(mapView.currentFloor, {
      pitch: 0,
      zoom: 13.2,
      preset: 'top',
      applyZoom: true,
    })

    setAetherLoadState('ready')

    wakeTimerRef.current = window.setTimeout(() => {
      cameraController.flyToFloor(mapView.currentFloor, {
        bearing: 18,
        pitch: 48,
        zoom: 14.2,
        preset: 'campus',
        applyZoom: true,
        animate: true,
        duration: 1400,
        easing: 'ease-in-out',
      })
    }, 420)

    labelRevealTimerRef.current = window.setTimeout(() => {
      void addWorldLabels()
        .then(() => {
          setLabelsVisible(true)
          labelRevealTimerRef.current = null
        })
        .catch((error) => {
          console.warn('Aether labels are waiting for the map renderer:', error)
          labelRevealTimerRef.current = window.setTimeout(() => {
            void addWorldLabels()
              .then(() => {
                setLabelsVisible(true)
                labelRevealTimerRef.current = null
              })
              .catch(() => {
                labelRevealTimerRef.current = null
              })
          }, 900)
        })
    }, 1200)

    mapView.on('floor-change', (event) => {
      presenceActions.setCurrentFloor({
        id: String(event.floor.id),
        worldId: `floor:${event.floor.id}`,
        type: 'floor',
        name: event.floor.name || 'Current floor',
        elevation: Number(event.floor.elevation ?? 0),
      })
    })

    mapView.on('camera-change', (transform) => {
      cameraController.syncFromCameraChange(transform)
    })

    mapView.on('click', (event) => {
      const clickedSpace = event.spaces?.[0]
      const clickedLabel = event.labels?.[0]

      if (clickedSpace?.id) {
        handledSelectionRef.current = null
        searchActions.select(String(clickedSpace.id))
        setSuggestions([])
        return
      }

      if (clickedLabel?.text) {
        const match = worldSelectors
          .getSpaces()
          .find((space) => space.name === clickedLabel.text)

        if (match) {
          handledSelectionRef.current = null
          searchActions.select(match.id)
          setSuggestions([])
        }
      }
    })

    mapView.on('navigation-connection-click', (event) => {
      activateFloor(String(event.toFloor.id))
    })

    return mapView
  }, [activateFloor, addWorldLabels, setAetherLoadState])

  useEffect(() => {
    return presenceSelectors.subscribe(setPresenceState)
  }, [])

  useEffect(() => {
    return worldSelectors.subscribe(setWorldState)
  }, [])

  useEffect(() => {
    return searchSelectors.subscribe(setSearchState)
  }, [])

  useEffect(() => {
    const selection = presenceState.currentSelection

    if (selection.type === 'none' || !selection.id) {
      handledSelectionRef.current = null
      clearSelectedSpaceHighlight()
      worldActions.setSelection({ type: 'none' })
      return
    }

    const selectionKey = selection.worldId ?? `${selection.type}:${selection.id}`
    if (handledSelectionRef.current === selectionKey) return
    handledSelectionRef.current = selectionKey

    const mapView = mapViewRef.current
    const cameraController = cameraControllerRef.current
    if (!mapView || !cameraController) return

    if (selectionMoveTimerRef.current) {
      window.clearTimeout(selectionMoveTimerRef.current)
      selectionMoveTimerRef.current = null
    }

    if (selection.type === 'building') {
      clearSelectedSpaceHighlight()
      worldActions.setSelection({
        type: 'building',
        id: selection.id,
        worldId: selection.worldId,
        name: selection.name,
      })
      cameraController.flyToFloor(mapView.currentFloor, {
        bearing: cameraController.getState().bearing,
        pitch: 48,
        zoom: 14.2,
        preset: 'building',
        applyZoom: true,
        animate: true,
        duration: 900,
        easing: 'ease-in-out',
      })
      return
    }

    if (selection.type === 'floor') {
      clearSelectedSpaceHighlight()
      worldActions.setSelection({
        type: 'floor',
        id: selection.id,
        worldId: selection.worldId,
        name: selection.name,
      })
      activateFloor(selection.id)

      selectionMoveTimerRef.current = window.setTimeout(() => {
        focusCurrentFloor()
        selectionMoveTimerRef.current = null
      }, 60)
      return
    }

    if (selection.type === 'label') {
      clearSelectedSpaceHighlight()
      worldActions.setSelection({
        type: 'label',
        id: selection.id,
        worldId: selection.worldId,
        name: selection.name,
        floorId: selection.floorId,
      })
      if (selection.floorId) {
        activateFloor(selection.floorId)

        selectionMoveTimerRef.current = window.setTimeout(() => {
          focusCurrentFloor()
          selectionMoveTimerRef.current = null
        }, 60)
      }
      return
    }

    if (selection.type !== 'space') {
      clearSelectedSpaceHighlight()
      worldActions.setSelection({
        type: selection.type,
        id: selection.id,
        worldId: selection.worldId,
        name: selection.name,
        floorId: selection.floorId,
      })
      return
    }

    const selectedSpace = worldSelectors.getSpaceById(selection.id)
    if (!selectedSpace) return

    worldActions.setSelection({
      type: 'space',
      id: selectedSpace.id,
      worldId: selectedSpace.worldId,
      name: selectedSpace.name,
      floorId: selectedSpace.floorId,
    })

    const activeRoute = presenceSelectors.getCurrentRoute()
    if (activeRoute.status === 'setting-origin') {
      presenceActions.setCurrentRoute({
        ...activeRoute,
        origin: createSpaceSelection(selectedSpace),
      })
    } else if (activeRoute.status === 'setting-destination') {
      presenceActions.setCurrentRoute({
        ...activeRoute,
        destination: createSpaceSelection(selectedSpace),
      })
    }

    if (
      selectedSpace.floorId &&
      String(mapView.currentFloor.id) !== selectedSpace.floorId
    ) {
      activateFloor(selectedSpace.floorId)
    }

    highlightSelectedSpace(selectedSpace)
    cameraController.flyToRoom(selectedSpace.raw, {
      bearing: cameraController.getState().bearing,
      pitch: Math.max(cameraController.getState().pitch, 52),
      zoom: 17.4,
      preset: 'room',
      applyZoom: true,
      animate: true,
      duration: 900,
      easing: 'ease-in-out',
    })
  }, [
    activateFloor,
    clearSelectedSpaceHighlight,
    createSpaceSelection,
    focusCurrentFloor,
    highlightSelectedSpace,
    presenceState,
  ])

  const updateSearch = (nextQuery: string) => {
    if (!nextQuery.trim()) {
      setSuggestions([])
      setActiveSuggestionIndex(0)
      searchActions.clear()
      return
    }

    const nextSuggestions = searchActions.suggest(nextQuery, {
      limit: 8,
      types: ['building', 'floor', 'space', 'label'],
    })
    setSuggestions(nextSuggestions)
    setActiveSuggestionIndex(0)
  }

  const selectSearchResult = (result: SearchResult) => {
    handledSelectionRef.current = null
    searchActions.select(result)
    setSuggestions([])
    setActiveSuggestionIndex(0)
  }

  const selectWorldSpace = (space: WorldSpace) => {
    handledSelectionRef.current = null
    searchActions.select(space.id)
    setSuggestions([])
    setActiveSuggestionIndex(0)
  }

  const setRouteEndpoint = (endpoint: 'origin' | 'destination') => {
    if (!selectedSpace) return

    const nextSelection = createSpaceSelection(selectedSpace)
    const currentRoute = presenceSelectors.getCurrentRoute()
    const currentOrigin =
      currentRoute.status === 'idle' ? undefined : currentRoute.origin
    const currentDestination =
      currentRoute.status === 'idle' ? undefined : currentRoute.destination
    const nextRoute = {
      status:
        endpoint === 'origin'
          ? ('setting-destination' as const)
          : ('setting-origin' as const),
      origin: endpoint === 'origin' ? nextSelection : currentOrigin,
      destination:
        endpoint === 'destination' ? nextSelection : currentDestination,
    }

    mapViewRef.current?.Navigation.clear()
    presenceActions.setCurrentRoute(nextRoute)
    presenceActions.setCurrentFocus({
      type: 'route',
      id: nextSelection.id,
      worldId: nextSelection.worldId,
      label: nextSelection.name,
    })
  }

  const startRoutePick = (endpoint: 'origin' | 'destination') => {
    const currentRoute = presenceSelectors.getCurrentRoute()
    const currentOrigin =
      currentRoute.status === 'idle' ? undefined : currentRoute.origin
    const currentDestination =
      currentRoute.status === 'idle' ? undefined : currentRoute.destination

    presenceActions.setCurrentRoute({
      status: endpoint === 'origin' ? 'setting-origin' : 'setting-destination',
      origin: currentOrigin,
      destination: currentDestination,
      message:
        endpoint === 'origin'
          ? 'Select a room for the start point'
          : 'Select a room for the destination',
    })
    presenceActions.setCurrentFocus({
      type: 'route',
      label:
        endpoint === 'origin'
          ? 'Picking route origin'
          : 'Picking route destination',
    })
  }

  const calculateRoute = async () => {
    const mapView = mapViewRef.current
    const currentRoute = presenceSelectors.getCurrentRoute()

    if (
      !mapView ||
      currentRoute.status === 'idle' ||
      currentRoute.origin?.type !== 'space' ||
      currentRoute.destination?.type !== 'space' ||
      !currentRoute.origin.id ||
      !currentRoute.destination.id
    ) {
      return
    }

    const origin = worldSelectors.getSpaceById(currentRoute.origin.id)
    const destination = worldSelectors.getSpaceById(currentRoute.destination.id)
    if (!origin || !destination) return

    const requestId = routeRequestRef.current + 1
    routeRequestRef.current = requestId
    mapView.Navigation.clear()
    presenceActions.setCurrentRoute({
      status: 'calculating',
      origin: currentRoute.origin,
      destination: currentRoute.destination,
      message: 'Calculating route',
    })
    presenceActions.setCurrentFocus({
      type: 'route',
      id: `${origin.id}:${destination.id}`,
      label: `${origin.name} to ${destination.name}`,
    })

    try {
      const directions = await mapView.getDirections(origin.raw, destination.raw, {
        smoothing: {
          enabled: true,
          __EXPERIMENTAL_METHOD: 'greedy-los',
          radius: 0.75,
        },
      })

      if (routeRequestRef.current !== requestId) return

      if (!directions) {
        presenceActions.setCurrentRoute({
          status: 'blocked',
          origin: currentRoute.origin,
          destination: currentRoute.destination,
          message: 'No route found',
        })
        return
      }

      await mapView.Navigation.draw(directions, {
        animatePathDrawing: true,
        setMapOnConnectionClick: true,
        setMapToDeparture: true,
        pathOptions: {
          color: '#22d3ee',
          accentColor: '#ffffff',
          width: 0.65,
          showPulse: true,
          animateDrawing: true,
          displayArrowsOnPath: true,
          drawDuration: 1400,
          verticalOffset: 0.18,
          __EXPERIMENTAL__CONNECTION_COLOR: '#a78bfa',
        },
        markerOptions: {
          departureColor: '#22d3ee',
          destinationColor: '#a78bfa',
          animated: true,
        },
      })

      if (routeRequestRef.current !== requestId) return

      const routeFloors = mapView.Navigation.floors.map((floor) =>
        String(floor.id),
      )
      presenceActions.setCurrentRoute({
        status: 'previewing',
        origin: currentRoute.origin,
        destination: currentRoute.destination,
        distanceMeters: Math.round(directions.distance),
        floorIds: routeFloors,
        instructionCount: directions.instructions.length,
        activeInstructionIndex: 0,
      })

      const firstFloorId = routeFloors[0]
      if (firstFloorId) activateFloor(firstFloorId)
      cameraControllerRef.current?.flyToRoom(origin.raw, {
        bearing: cameraControllerRef.current.getState().bearing,
        pitch: 52,
        zoom: 17,
        preset: 'room',
        applyZoom: true,
        animate: true,
        duration: 900,
        easing: 'ease-in-out',
      })
    } catch (error) {
      if (routeRequestRef.current !== requestId) return

      presenceActions.setCurrentRoute({
        status: 'blocked',
        origin: currentRoute.origin,
        destination: currentRoute.destination,
        message:
          error instanceof Error ? error.message : 'Route calculation failed',
      })
    }
  }

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
        setAetherLoadState('error')
      })

    return () => {
      cancelled = true
      if (wakeTimerRef.current) window.clearTimeout(wakeTimerRef.current)
      if (labelRevealTimerRef.current) {
        window.clearTimeout(labelRevealTimerRef.current)
      }
      if (selectionMoveTimerRef.current) {
        window.clearTimeout(selectionMoveTimerRef.current)
      }
      wakeTimerRef.current = null
      labelRevealTimerRef.current = null
      selectionMoveTimerRef.current = null
      presenceProviderStopRef.current?.()
      presenceProviderStopRef.current = null
      cameraControllerRef.current?.destroy()
      cameraControllerRef.current = null
      clearSelectedSpaceHighlight()
      clearBlueDotMarkers()
      lastPresenceCoordinateRef.current = null
      mapViewRef.current?.Navigation.clear()
      worldActions.reset()
      presenceActions.reset()
      mapViewRef.current = null
      activeMapView?.destroy()
    }
  }, [
    clearBlueDotMarkers,
    clearSelectedSpaceHighlight,
    loadMap,
    reloadKey,
    setAetherLoadState,
  ])

  const selectedSpace =
    presenceState.currentSelection.type === 'space' &&
    presenceState.currentSelection.id
      ? worldSelectors.getSpaceById(presenceState.currentSelection.id)
      : null
  const currentFloor =
    presenceState.currentFloor?.id === undefined
      ? null
      : worldSelectors.getFloorById(presenceState.currentFloor.id)
  const currentSelectionLabel =
    selectedSpace?.name ??
    (presenceState.currentSelection.type === 'none'
      ? null
      : presenceState.currentSelection.name)
  const currentFocusLabel =
    currentSelectionLabel ??
    (presenceState.currentFocus.type === 'none'
      ? presenceState.currentFocus.type
      : presenceState.currentFocus.label) ??
    presenceState.currentFocus.type
  const currentBuildingName =
    presenceState.currentBuilding?.name ??
    worldState.building?.name ??
    worldState.venue?.name ??
    ''
  const currentFloorName =
    presenceState.currentFloor?.name ?? currentFloor?.name ?? 'none'
  const currentRoomName =
    presenceState.currentSpace?.name ??
    selectedSpace?.name ??
    (presenceState.currentSpace?.id ? presenceState.currentSpace.id : 'none')
  const currentSelectionSummary =
    presenceState.currentSelection.type === 'none'
      ? 'none'
      : [
          presenceState.currentSelection.type,
          presenceState.currentSelection.name ??
            presenceState.currentSelection.id ??
            presenceState.currentSelection.worldId,
        ]
          .filter(Boolean)
          .join(' · ')
  const cameraSummary =
    presenceState.currentCamera === null
      ? 'none'
      : [
          `${Math.round(presenceState.currentCamera.bearing)}°`,
          `${Math.round(presenceState.currentCamera.pitch)}° pitch`,
          `${presenceState.currentCamera.zoom.toFixed(1)} zoom`,
          presenceState.currentCamera.preset,
          presenceState.currentCamera.orbiting ? 'orbiting' : undefined,
        ]
          .filter(Boolean)
          .join(' · ')
  const currentSearchQuery = presenceState.currentSearch.query || 'none'
  const presenceStatus = [
    presenceState.currentLoadState,
    presenceState.currentUserLocation.status,
    presenceState.currentProvider.activeProvider ?? 'no provider',
    presenceState.currentProvider.followCamera ? 'follow on' : 'follow off',
  ].join(' · ')
  const worldStatus = [
    worldState.venue ? 'venue' : 'no venue',
    worldState.building ? 'building' : 'no building',
    `${worldState.floors.length} floors`,
    `${worldState.spaces.length} spaces`,
    `${worldState.labels.length} labels`,
    `${worldState.overlays.length} overlays`,
  ].join(' · ')
  const missionControlRows = [
    ['Current Floor', currentFloorName],
    ['Current Room', currentRoomName],
    ['Current Selection', currentSelectionSummary],
    ['Camera', cameraSummary],
    ['Search Query', currentSearchQuery],
    ['Search Result Count', `${presenceState.currentSearch.resultCount}`],
    ['Presence Status', presenceStatus],
    ['World Status', worldStatus],
  ]
  const userLocation = presenceState.currentUserLocation
  const providerState = presenceState.currentProvider
  const userLocationSummary =
    userLocation.status === 'ready'
      ? `${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`
      : userLocation.status
  const userLocationAccuracy =
    userLocation.status === 'ready' && userLocation.accuracy !== undefined
      ? `${Math.round(userLocation.accuracy)} m`
      : ''
  const activeProviderLabel = providerState.activeProvider ?? ''
  const currentRoute = presenceState.currentRoute
  const currentCamera = presenceState.currentCamera
  const routeOriginName =
    currentRoute.status === 'idle' || currentRoute.origin?.type === 'none'
      ? ''
      : currentRoute.origin?.name ?? ''
  const routeDestinationName =
    currentRoute.status === 'idle' ||
    currentRoute.destination?.type === 'none'
      ? ''
      : currentRoute.destination?.name ?? ''
  const routeFloorNames =
    currentRoute.status === 'idle'
      ? []
      : currentRoute.floorIds
          ?.map((floorId) => worldSelectors.getFloorById(floorId)?.name)
          .filter((floorName): floorName is string => Boolean(floorName)) ?? []
  const canSetRouteEndpoint = Boolean(selectedSpace)
  const canCalculateRoute =
    currentRoute.status !== 'idle' &&
    currentRoute.status !== 'calculating' &&
    currentRoute.origin?.type === 'space' &&
    currentRoute.destination?.type === 'space'
  const routeSummary =
    currentRoute.status === 'idle'
      ? ''
      : currentRoute.message ??
        [
          currentRoute.distanceMeters === undefined
            ? undefined
            : `${currentRoute.distanceMeters} m`,
          currentRoute.instructionCount === undefined
            ? undefined
            : `${currentRoute.instructionCount} steps`,
        ]
          .filter(Boolean)
          .join(' · ')
  const visibleSpaces = searchState.query.trim()
    ? searchState.results
        .filter((result) => result.type === 'space')
        .map((result) => worldSelectors.getSpaceById(result.id))
        .filter((space): space is WorldSpace => Boolean(space))
        .slice(0, 40)
    : currentFloor?.id
      ? worldSelectors.getSpacesByFloor(currentFloor.id).slice(0, 40)
      : worldState.spaces.slice(0, 40)
  const nearbySpaces = selectedSpace?.floorId
    ? worldSelectors
        .getSpacesByFloor(selectedSpace.floorId)
        .filter((space) => space.id !== selectedSpace.id)
        .slice(0, 5)
    : []
  const cameraBearingValue = currentCamera?.bearing ?? 0
  const cameraPitchValue = currentCamera?.pitch ?? 48
  const cameraZoomValue = currentCamera?.zoom ?? 14.2
  const routeIsPicking =
    currentRoute.status === 'setting-origin' ||
    currentRoute.status === 'setting-destination'
  const selectionPanelRows = selectedSpace
    ? [
        ['Floor', selectedSpace.floorName],
        ['Mappedin ID', selectedSpace.id],
        ['Search', presenceState.currentSearch.selectedResultName ?? selectedSpace.name],
        ['Nearby Context', `${nearbySpaces.length} spaces`],
      ]
    : []

  return (
    <AetherShell
      mapReady={loadState === 'ready'}
      mapCanvas={<div ref={mapElementRef} className="h-full w-full" />}
      topBar={
        <div className="flex items-center justify-between gap-5 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200/75">
              Aether
            </p>
            <p className="mt-1 text-sm font-semibold text-white/88">
              Spatial Intelligence
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-300/12 bg-emerald-300/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200/85">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {loadState === 'ready' ? 'Mappedin online' : 'Preparing map'}
          </div>
        </div>
      }
      topOmnibox={
        <div className="relative">
          <label className="flex items-center gap-3 px-5 py-4">
            <Search size={17} className="shrink-0 text-cyan-200/80" />
            <div className="min-w-0 flex-1">
              <input
                value={searchState.query}
                onChange={(event) => updateSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && suggestions.length > 0) {
                    event.preventDefault()
                    setActiveSuggestionIndex((current) =>
                      current >= suggestions.length - 1 ? 0 : current + 1,
                    )
                  }

                  if (event.key === 'ArrowUp' && suggestions.length > 0) {
                    event.preventDefault()
                    setActiveSuggestionIndex((current) =>
                      current <= 0 ? suggestions.length - 1 : current - 1,
                    )
                  }

                  if (event.key === 'Enter' && suggestions[activeSuggestionIndex]) {
                    event.preventDefault()
                    selectSearchResult(suggestions[activeSuggestionIndex].result)
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setSuggestions([])
                    setActiveSuggestionIndex(0)
                  }
                }}
                placeholder="Search rooms, floors, assets, equipment"
                className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none placeholder:text-slate-400"
              />
              <p className="truncate text-xs text-slate-500">
                {searchState.query.trim()
                  ? `${searchState.results.length} results from World`
                  : selectedSpace?.floorName ?? `${worldState.spaces.length} searchable spaces`}
              </p>
            </div>
            <div className="hidden rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1 text-[11px] font-medium text-slate-400 sm:block">
              {searchState.query.trim()
                ? `${searchState.results.length} results`
                : `${worldState.spaces.length} spaces`}
            </div>
          </label>

          {suggestions.length > 0 && (
            <div className="absolute left-4 right-4 top-[calc(100%+0.65rem)] overflow-hidden rounded-2xl border border-cyan-100/[0.06] bg-[#061017]/86 backdrop-blur-[36px]">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}:${suggestion.id}`}
                  type="button"
                  onClick={() => selectSearchResult(suggestion.result)}
                  onMouseEnter={() => setActiveSuggestionIndex(index)}
                  className={`flex w-full items-center justify-between gap-4 border-b border-white/[0.055] px-5 py-3.5 text-left transition last:border-b-0 ${
                    activeSuggestionIndex === index
                      ? 'bg-cyan-200/[0.12] text-white'
                      : 'hover:bg-cyan-200/[0.07]'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {suggestion.value}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {suggestion.label}
                    </span>
                  </span>
                  <span className="rounded-full border border-white/[0.06] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">
                    {suggestion.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {searchState.query.trim() && suggestions.length === 0 && (
            <div className="absolute left-4 right-4 top-[calc(100%+0.65rem)] rounded-2xl border border-cyan-100/[0.06] bg-[#061017]/86 px-5 py-3.5 text-sm text-slate-400 backdrop-blur-[36px]">
              0 results in World
            </div>
          )}
        </div>
      }
      leftRail={
        <div className="space-y-4 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Systems
            </p>
            <div className="mt-3 grid gap-2">
              {[
                {
                  icon: Compass,
                  label: 'Camera',
                  value: presenceState.currentCamera?.preset ?? 'Ready',
                },
                {
                  icon: Database,
                  label: 'World',
                  value: `${worldState.spaces.length} spaces`,
                },
                {
                  icon: Activity,
                  label: 'Presence',
                  value: currentFocusLabel,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-sm text-slate-300 transition duration-300 ease-out hover:border-cyan-200/20 hover:bg-cyan-200/[0.06] hover:text-white"
                >
                  <span className="inline-flex min-w-0 items-center gap-3">
                    <item.icon size={16} className="shrink-0 text-cyan-200/80" />
                    <span>{item.label}</span>
                  </span>
                  <span className="truncate text-[11px] text-slate-500">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Building2 size={16} className="text-cyan-300" />
                Floors
              </div>
              <span className="text-xs text-slate-500">
                {worldState.floors.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {worldState.floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  disabled={loadState !== 'ready'}
                  onClick={() => focusFloorById(floor.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    currentFloor?.id === floor.id
                      ? 'border-cyan-200/40 bg-cyan-200/[0.14] text-cyan-100'
                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {floor.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Compass size={16} className="text-cyan-300" />
                Camera
              </div>
              <span className="text-xs text-slate-500">
                {currentCamera?.preset ?? 'ready'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={loadState !== 'ready'} onClick={focusCampusCamera} className="rounded-xl border border-cyan-200/20 bg-cyan-200/[0.06] px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/[0.12] disabled:cursor-not-allowed disabled:opacity-40"><Navigation className="mr-1 inline" size={14} />Campus</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={focusSiteCamera} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Target className="mr-1 inline" size={14} />Site</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={focusBuildingCamera} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Building2 className="mr-1 inline" size={14} />Bldg</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={focusTopCamera} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Compass className="mr-1 inline" size={14} />Top</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={focusPerspectiveCamera} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Compass className="mr-1 inline" size={14} />Perspective</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={focusCurrentFloor} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Building2 className="mr-1 inline" size={14} />Floor</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ bearing: cameraBearingValue - 25 })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="mr-1 inline" size={14} />Left</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ bearing: cameraBearingValue + 25 })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><RotateCw className="mr-1 inline" size={14} />Right</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ pitch: cameraPitchValue + 8 })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="mr-1 inline" size={14} />Pitch</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ pitch: cameraPitchValue - 8 })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Minus className="mr-1 inline" size={14} />Pitch</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ zoom: cameraZoomValue + 0.7 })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="mr-1 inline" size={14} />Zoom</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ zoom: cameraZoomValue - 0.7 })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><Minus className="mr-1 inline" size={14} />Zoom</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={toggleOrbit} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${currentCamera?.orbiting ? 'border-emerald-200/30 bg-emerald-200/[0.12] text-emerald-100' : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10'}`}><Play className="mr-1 inline" size={14} />Orbit</button>
              <button type="button" disabled={loadState !== 'ready'} onClick={resetCamera} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="mr-1 inline" size={14} />Reset</button>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Bearing {Math.round(cameraBearingValue)}° · Pitch {Math.round(cameraPitchValue)}° · Zoom {cameraZoomValue.toFixed(1)}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MapPin size={16} className="text-cyan-300" />
                Spaces
              </div>
              <button
                type="button"
                disabled={loadState !== 'ready'}
                onClick={() => void toggleLabels()}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {labelsVisible ? <EyeOff className="mr-1 inline" size={14} /> : <Eye className="mr-1 inline" size={14} />}
                {labelsVisible ? 'Hide labels' : 'Show labels'}
              </button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {visibleSpaces.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => selectWorldSpace(space)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedSpace?.id === space.id
                      ? 'border-cyan-200/40 bg-cyan-200/[0.12]'
                      : 'border-white/8 bg-white/[0.035] hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-slate-100">
                    {space.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    {space.floorName}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <LocateFixed size={16} className="text-cyan-300" />
              Presence
            </div>
            <div className="grid gap-2 text-xs text-slate-400">
              {[
                ['Provider', activeProviderLabel],
                ['Location', userLocationSummary],
                ['Accuracy', userLocationAccuracy],
                ['Follow', providerState.followCamera ? 'on' : 'off'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2"
                >
                  <span>{label}</span>
                  <span className="truncate text-right text-slate-300">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loadState !== 'ready'}
                onClick={() => startPresenceProvider('browser')}
                className="rounded-xl border border-cyan-200/20 bg-cyan-200/[0.06] px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Browser
              </button>
              <button
                type="button"
                disabled={loadState !== 'ready'}
                onClick={() => startPresenceProvider('simulated')}
                className="rounded-xl border border-violet-200/20 bg-violet-200/[0.06] px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-200/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Simulate
              </button>
              <button
                type="button"
                disabled={userLocation.status !== 'ready'}
                onClick={() => setCameraFollowMode(!providerState.followCamera)}
                className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-200/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Follow
              </button>
              <button
                type="button"
                disabled={userLocation.status === 'off'}
                onClick={stopPresenceProvider}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Off
              </button>
            </div>
          </div>
        </div>
      }
      navigation={
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <RouteIcon size={16} className="text-cyan-300" />
            Route
          </div>
          {routeIsPicking && (
            <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-2 text-xs leading-5 text-cyan-100">
              {currentRoute.status === 'setting-origin'
                ? 'Select a room from search, the space list, or the map to set the start.'
                : 'Select a room from search, the space list, or the map to set the destination.'}
            </p>
          )}
          <div className="grid gap-2 text-xs text-slate-400">
            {[
              ['Origin', routeOriginName],
              ['Destination', routeDestinationName],
              ['Status', currentRoute.status],
              ['Path', routeSummary],
              ['Floors', routeFloorNames.join(' · ')],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2"
              >
                <span>{label}</span>
                <span className="truncate text-right text-slate-300">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!canSetRouteEndpoint}
              onClick={() => setRouteEndpoint('origin')}
              className="rounded-xl border border-cyan-200/20 bg-cyan-200/[0.06] px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Flag className="mr-1 inline" size={14} />
              Set Origin
            </button>
            <button
              type="button"
              disabled={!canSetRouteEndpoint}
              onClick={() => setRouteEndpoint('destination')}
              className="rounded-xl border border-violet-200/20 bg-violet-200/[0.06] px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-200/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Target className="mr-1 inline" size={14} />
              Set Destination
            </button>
            <button
              type="button"
              disabled={loadState !== 'ready'}
              onClick={() => startRoutePick('origin')}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                currentRoute.status === 'setting-origin'
                  ? 'border-emerald-200/30 bg-emerald-200/[0.12] text-emerald-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10'
              }`}
            >
              Pick Start
            </button>
            <button
              type="button"
              disabled={loadState !== 'ready'}
              onClick={() => startRoutePick('destination')}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                currentRoute.status === 'setting-destination'
                  ? 'border-violet-200/30 bg-violet-200/[0.12] text-violet-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10'
              }`}
            >
              Pick Destination
            </button>
            <button
              type="button"
              disabled={!canCalculateRoute}
              onClick={() => void calculateRoute()}
              className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-200/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Calculate
            </button>
            <button
              type="button"
              disabled={currentRoute.status === 'idle'}
              onClick={clearRoute}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
      }
      rightMissionControl={
        <div className="space-y-4 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
              Mission Control
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {currentSelectionLabel ?? currentBuildingName}
            </p>
          </div>
          <div className="grid gap-2 text-xs text-slate-400">
            {missionControlRows.map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 transition duration-300 hover:border-cyan-200/20 hover:bg-cyan-200/[0.05]"
              >
                <span>{label}</span>
                <span className="truncate text-right text-slate-300">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      }
      selection={
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin size={16} className="text-cyan-300" />
            Focus
          </div>
          <p className="truncate text-sm font-semibold text-slate-100">
            {selectedSpace
              ? selectedSpace.name
              : currentSelectionLabel ?? 'No selection'}
          </p>
          {selectionPanelRows.length > 0 && (
            <div className="grid gap-2 text-xs text-slate-400">
              {selectionPanelRows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2"
                >
                  <span>{label}</span>
                  <span className="truncate text-right text-slate-300">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {nearbySpaces.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/60">
                Nearby
              </p>
              <div className="grid gap-2">
                {nearbySpaces.map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => selectWorldSpace(space)}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-left text-xs text-slate-300 transition duration-300 hover:border-cyan-200/20 hover:bg-cyan-200/[0.07] hover:text-cyan-50"
                  >
                    <span className="truncate">{space.name}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      {space.floorName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      }
      bottomStatusBar={
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs text-slate-400">
          <div className="flex min-w-0 items-center gap-3 text-slate-400/85">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
            <span className="shrink-0">Camera</span>
            <span className="truncate">
              {Math.round(cameraBearingValue)}° · {Math.round(cameraPitchValue)}° · {cameraZoomValue.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button type="button" disabled={loadState !== 'ready'} onClick={focusCurrentFloor} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 font-semibold text-slate-200/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Floor</button>
            <button type="button" disabled={loadState !== 'ready'} onClick={focusTopCamera} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 font-semibold text-slate-200/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Top</button>
            <button type="button" disabled={loadState !== 'ready'} onClick={focusPerspectiveCamera} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 font-semibold text-slate-200/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">3D</button>
            <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ bearing: cameraBearingValue - 25 })} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 font-semibold text-slate-200/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Rotate -</button>
            <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ bearing: cameraBearingValue + 25 })} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 font-semibold text-slate-200/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Rotate +</button>
            <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ zoom: cameraZoomValue + 0.7 })} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 font-semibold text-slate-200/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Zoom +</button>
            <button type="button" disabled={loadState !== 'ready'} onClick={() => adjustCamera({ zoom: cameraZoomValue - 0.7 })} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 font-semibold text-slate-200/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Zoom -</button>
            <button type="button" disabled={loadState !== 'ready'} onClick={toggleOrbit} className={`rounded-lg border px-2.5 py-1.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${currentCamera?.orbiting ? 'border-emerald-200/20 bg-emerald-200/[0.08] text-emerald-100/90' : 'border-white/[0.06] bg-white/[0.025] text-slate-200/90 hover:bg-white/[0.07]'}`}>Orbit</button>
            <button type="button" disabled={loadState !== 'ready'} onClick={resetCamera} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 font-semibold text-slate-200/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Reset</button>
          </div>
          <div className="flex min-w-0 items-center gap-4 text-slate-500">
            <span>State: {loadState}</span>
            <span className="truncate">Focus: {currentFocusLabel}</span>
          </div>
        </div>
      }
      glassPanels={loadState === 'ready' ? undefined : (
        <>
          {loadState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050816]">
              <div className="rounded-3xl border border-white/10 bg-[#0b1120]/95 px-10 py-9 text-center shadow-2xl backdrop-blur-xl">
                <LoaderCircle
                  size={34}
                  className="mx-auto animate-spin text-cyan-300"
                />
                <p className="mt-5 text-base font-semibold text-white">
                  Loading Aether
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                  Preparing the production spatial intelligence shell.
                </p>
              </div>
            </div>
          )}

          {loadState === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050816] px-6">
              <div className="max-w-lg rounded-3xl border border-red-300/25 bg-red-300/[0.07] p-8 text-center shadow-2xl">
                <AlertTriangle size={34} className="mx-auto text-red-300" />
                <h1 className="mt-5 text-xl font-semibold text-white">
                  Unable to load Aether
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
        </>
      )}
    />
  )
}

export default AetherMappedinPage

import {
  AlertTriangle,
  Activity,
  Compass,
  Database,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AetherShell from './components/AetherShell'
import {
  createCameraController,
  type CameraController,
} from './core/cameraController'
import { initializeMappedinMap } from './core/mapLifecycle'
import {
  presenceActions,
  presenceSelectors,
  type PresenceState,
} from './core/presenceSubsystem'
import {
  searchActions,
  type SearchResult,
  type SearchSuggestion,
} from './core/searchSubsystem'
import {
  worldActions,
  worldSelectors,
  type WorldSpace,
  type WorldState,
} from './core/worldSubsystem'
import type { LoadState, MapView } from './types/mappedinTypes'

type AetherShellState = LoadState

function AetherMappedinPage() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<MapView | null>(null)
  const cameraControllerRef = useRef<CameraController | null>(null)
  const wakeTimerRef = useRef<number | null>(null)
  const selectionMoveTimerRef = useRef<number | null>(null)
  const selectedSpaceRef = useRef<WorldSpace | null>(null)
  const handledSelectionRef = useRef<string | null>(null)
  const [loadState, setLoadState] = useState<AetherShellState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [presenceState, setPresenceState] = useState<PresenceState>(
    presenceSelectors.getState(),
  )
  const [worldState, setWorldState] = useState<WorldState>(
    worldSelectors.getState(),
  )

  const clearSelectedSpaceHighlight = useCallback(() => {
    const mapView = mapViewRef.current
    const selectedSpace = selectedSpaceRef.current
    if (!mapView || !selectedSpace) return

    mapView.updateState(selectedSpace.raw, {
      color: 'initial',
      hoverColor: '#22d3ee',
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
        color: '#22d3ee',
        hoverColor: '#67e8f9',
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
  }, [])

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return undefined

    setLoadState('loading')
    setErrorMessage('')

    if (wakeTimerRef.current) {
      window.clearTimeout(wakeTimerRef.current)
      wakeTimerRef.current = null
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
    worldActions.setBuilding({
      type: 'building',
      worldId: `building:${token.mapId}`,
      venueId: `venue:${token.mapId}`,
      externalId: token.mapId,
      name: 'Aether Building',
    })

    presenceActions.setCurrentFloor({
      id: String(mapView.currentFloor.id),
      worldId: `floor:${mapView.currentFloor.id}`,
      type: 'floor',
      name: mapView.currentFloor.name || 'Current floor',
      elevation: Number(mapView.currentFloor.elevation ?? 0),
    })

    worldSelectors.getSpaces().forEach((space) => {
      mapView.updateState(space.raw, {
        interactive: true,
        hoverColor: '#22d3ee',
      })
    })

    const cameraController = createCameraController(mapView, {
      initialPitch: 0,
      initialZoom: 13.2,
      initialPreset: 'top',
    })
    cameraControllerRef.current = cameraController
    cameraController.reset(mapView.currentFloor, {
      pitch: 0,
      zoom: 13.2,
      preset: 'top',
      applyZoom: true,
    })

    setLoadState('ready')

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
    }, 180)

    return mapView
  }, [])

  useEffect(() => {
    return presenceSelectors.subscribe(setPresenceState)
  }, [])

  useEffect(() => {
    return worldSelectors.subscribe(setWorldState)
  }, [])

  useEffect(() => {
    const selection = presenceState.currentSelection

    if (selection.type === 'none' || !selection.id) {
      handledSelectionRef.current = null
      clearSelectedSpaceHighlight()
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
      mapView.setFloor(selection.id)

      const floor = worldSelectors.getFloorById(selection.id)
      if (floor) {
        presenceActions.setCurrentFloor({
          id: floor.id,
          worldId: floor.worldId,
          type: 'floor',
          name: floor.name,
          elevation: floor.elevation,
        })
      }

      selectionMoveTimerRef.current = window.setTimeout(() => {
        focusCurrentFloor()
        selectionMoveTimerRef.current = null
      }, 60)
      return
    }

    if (selection.type === 'label') {
      clearSelectedSpaceHighlight()
      if (selection.floorId) {
        mapView.setFloor(selection.floorId)

        const floor = worldSelectors.getFloorById(selection.floorId)
        if (floor) {
          presenceActions.setCurrentFloor({
            id: floor.id,
            worldId: floor.worldId,
            type: 'floor',
            name: floor.name,
            elevation: floor.elevation,
          })
        }

        selectionMoveTimerRef.current = window.setTimeout(() => {
          focusCurrentFloor()
          selectionMoveTimerRef.current = null
        }, 60)
      }
      return
    }

    if (selection.type !== 'space') {
      clearSelectedSpaceHighlight()
      return
    }

    const selectedSpace = worldSelectors.getSpaceById(selection.id)
    if (!selectedSpace) return

    if (
      selectedSpace.floorId &&
      String(mapView.currentFloor.id) !== selectedSpace.floorId
    ) {
      mapView.setFloor(selectedSpace.floorId)

      const floor = worldSelectors.getFloorById(selectedSpace.floorId)
      if (floor) {
        presenceActions.setCurrentFloor({
          id: floor.id,
          worldId: floor.worldId,
          type: 'floor',
          name: floor.name,
          elevation: floor.elevation,
        })
      }
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
    clearSelectedSpaceHighlight,
    focusCurrentFloor,
    highlightSelectedSpace,
    presenceState,
  ])

  const updateSearch = (nextQuery: string) => {
    setQuery(nextQuery)

    if (!nextQuery.trim()) {
      setSuggestions([])
      searchActions.clear()
      return
    }

    setSuggestions(
      searchActions.suggest(nextQuery, {
        limit: 6,
        types: ['building', 'floor', 'space', 'label'],
      }),
    )
  }

  const selectSearchResult = (result: SearchResult) => {
    handledSelectionRef.current = null
    searchActions.select(result)
    setQuery(result.name)
    setSuggestions([])
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
        setLoadState('error')
      })

    return () => {
      cancelled = true
      if (wakeTimerRef.current) window.clearTimeout(wakeTimerRef.current)
      if (selectionMoveTimerRef.current) {
        window.clearTimeout(selectionMoveTimerRef.current)
      }
      wakeTimerRef.current = null
      selectionMoveTimerRef.current = null
      cameraControllerRef.current?.destroy()
      cameraControllerRef.current = null
      clearSelectedSpaceHighlight()
      worldActions.reset()
      presenceActions.reset()
      mapViewRef.current = null
      activeMapView?.destroy()
    }
  }, [clearSelectedSpaceHighlight, loadMap, reloadKey])

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

  return (
    <AetherShell
      mapReady={loadState === 'ready'}
      mapCanvas={<div ref={mapElementRef} className="h-full w-full" />}
      topBar={
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200/75">
              Aether
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Spatial Intelligence
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {loadState === 'ready' ? 'Mappedin online' : 'Preparing map'}
          </div>
        </div>
      }
      topOmnibox={
        <div className="relative">
          <label className="flex items-center gap-3 px-4 py-3">
            <Search size={17} className="shrink-0 text-cyan-200/80" />
            <div className="min-w-0 flex-1">
              <input
                value={query}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search rooms, floors, assets, equipment"
                className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none placeholder:text-slate-400"
              />
              <p className="truncate text-xs text-slate-500">
                {suggestions.length > 0
                  ? `${suggestions.length} live matches`
                  : selectedSpace?.floorName ?? 'Search the live World model'}
              </p>
            </div>
            <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-400 sm:block">
              {query.trim() ? 'Live' : 'Idle'}
            </div>
          </label>

          {suggestions.length > 0 && (
            <div className="absolute left-3 right-3 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-cyan-100/10 bg-[#061017]/95 shadow-2xl backdrop-blur-2xl">
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.type}:${suggestion.id}`}
                  type="button"
                  onClick={() => selectSearchResult(suggestion.result)}
                  className="flex w-full items-center justify-between gap-4 border-b border-white/8 px-4 py-3 text-left transition last:border-b-0 hover:bg-cyan-200/[0.07]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {suggestion.value}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {suggestion.label}
                    </span>
                  </span>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">
                    {suggestion.type}
                  </span>
                </button>
              ))}
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
          <p className="text-xs leading-5 text-slate-500">
            {currentFloor?.name ?? 'Aether Core'}
          </p>
        </div>
      }
      navigation={
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Navigation size={16} className="text-cyan-300" />
            Route
          </div>
          <p className="mt-2 text-xs text-slate-500">Standby</p>
        </div>
      }
      rightMissionControl={
        <div className="space-y-4 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
              Mission Control
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {currentSelectionLabel ?? 'Building Context'}
            </p>
          </div>
          <div className="grid gap-2 text-xs text-slate-400">
            <div className="flex justify-between rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 transition duration-300 hover:border-cyan-200/20 hover:bg-cyan-200/[0.05]">
              <span>World</span>
              <span className="text-slate-300">{worldState.spaces.length} spaces</span>
            </div>
            <div className="flex justify-between rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 transition duration-300 hover:border-cyan-200/20 hover:bg-cyan-200/[0.05]">
              <span>Presence</span>
              <span className="truncate pl-3 text-right text-slate-300">
                {currentFocusLabel}
              </span>
            </div>
            <div className="flex justify-between rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 transition duration-300 hover:border-cyan-200/20 hover:bg-cyan-200/[0.05]">
              <span>Floor</span>
              <span className="truncate pl-3 text-right text-slate-300">
                {selectedSpace?.floorName ?? currentFloor?.name ?? 'Ready'}
              </span>
            </div>
          </div>
        </div>
      }
      selection={
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin size={16} className="text-cyan-300" />
            Focus
          </div>
          <p className="mt-2 truncate text-xs text-slate-500">
            {selectedSpace
              ? `${selectedSpace.name} · ${selectedSpace.floorName}`
              : currentSelectionLabel ?? 'No selection'}
          </p>
        </div>
      }
      blueDot={
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <LocateFixed size={18} />
          </div>
        </div>
      }
      bottomStatusBar={
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            <span>Aether Core</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Mappedin</span>
            <span>State: {loadState}</span>
            <span>
              Focus:{' '}
              {currentFocusLabel}
            </span>
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

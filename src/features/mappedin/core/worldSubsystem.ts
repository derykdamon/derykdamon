import { normalizeFloors } from './floors'
import { normalizeSpaces } from './spaces'
import type {
  FloorOption,
  MapData,
  SpaceOption,
} from '../types/mappedinTypes'

export type WorldEntityType =
  | 'venue'
  | 'building'
  | 'floor'
  | 'space'
  | 'label'
  | 'overlay'

export type WorldEntityRef = {
  worldId: string
  type: WorldEntityType
}

export type WorldVenue = WorldEntityRef & {
  type: 'venue'
  name?: string
  externalId?: string
  metadata?: Record<string, unknown>
}

export type WorldBuilding = WorldEntityRef & {
  type: 'building'
  venueId?: string
  name?: string
  externalId?: string
  metadata?: Record<string, unknown>
}

export type WorldFloor = FloorOption &
  WorldEntityRef & {
    type: 'floor'
    buildingId?: string
    metadata?: Record<string, unknown>
  }

export type WorldSpace = SpaceOption &
  WorldEntityRef & {
    type: 'space'
    floorId?: string
    metadata?: Record<string, unknown>
  }

export type WorldLabel = WorldEntityRef & {
  type: 'label'
  text: string
  floorId?: string
  spaceId?: string
  metadata?: Record<string, unknown>
}

export type WorldOverlay = WorldEntityRef & {
  type: 'overlay'
  name: string
  floorId?: string
  spaceId?: string
  visible: boolean
  metadata?: Record<string, unknown>
}

export type WorldSelection =
  | { type: 'none' }
  | {
      type: WorldEntityType | 'coordinate' | 'custom'
      worldId?: string
      id?: string
      name?: string
      floorId?: string
      spaceId?: string
      latitude?: number
      longitude?: number
      metadata?: Record<string, unknown>
    }

export type WorldState = {
  venue: WorldVenue | null
  building: WorldBuilding | null
  floors: WorldFloor[]
  spaces: WorldSpace[]
  labels: WorldLabel[]
  overlays: WorldOverlay[]
  selection: WorldSelection
}

export type WorldNormalizeOptions = {
  floorSort?: 'elevation-desc' | 'semantic-asc'
  fallbackFloorName?: string
  useActualFloorName?: boolean
}

export type WorldSpatialQueries = {
  getFloorById(id: string): WorldFloor | undefined
  getSpaceById(id: string): WorldSpace | undefined
  getSpacesByFloor(floorId: string): WorldSpace[]
  getLabelsByFloor(floorId: string): WorldLabel[]
  getOverlaysByFloor(floorId: string): WorldOverlay[]
  searchSpaces(query: string, limit?: number): WorldSpace[]
}

export type WorldActions = {
  setVenue(venue: WorldVenue | null): void
  setBuilding(building: WorldBuilding | null): void
  setFloors(floors: WorldFloor[]): void
  setSpaces(spaces: WorldSpace[]): void
  setLabels(labels: WorldLabel[]): void
  setOverlays(overlays: WorldOverlay[]): void
  setSelection(selection: WorldSelection): void
  normalizeFromMapData(mapData: MapData, options?: WorldNormalizeOptions): void
  reset(): void
}

export type WorldSelectors = WorldSpatialQueries & {
  getState(): WorldState
  getVenue(): WorldVenue | null
  getBuilding(): WorldBuilding | null
  getFloors(): WorldFloor[]
  getSpaces(): WorldSpace[]
  getLabels(): WorldLabel[]
  getOverlays(): WorldOverlay[]
  getSelection(): WorldSelection
  subscribe(listener: WorldListener): () => void
}

export type WorldListener = (state: WorldState) => void

const initialWorldState: WorldState = {
  venue: null,
  building: null,
  floors: [],
  spaces: [],
  labels: [],
  overlays: [],
  selection: { type: 'none' },
}

function createInitialWorldState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    ...initialWorldState,
    ...overrides,
  }
}

function toWorldFloor(floor: FloorOption): WorldFloor {
  return {
    ...floor,
    worldId: `floor:${floor.id}`,
    type: 'floor',
  }
}

function toWorldSpace(space: SpaceOption): WorldSpace {
  return {
    ...space,
    floorId: space.raw.floor?.id === undefined ? undefined : String(space.raw.floor.id),
    worldId: `space:${space.id}`,
    type: 'space',
  }
}

function matchesSpace(space: WorldSpace, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return `${space.name} ${space.floorName} ${space.id}`
    .toLowerCase()
    .includes(normalizedQuery)
}

export class WorldSubsystem {
  private listeners = new Set<WorldListener>()
  private state: WorldState

  constructor(initialState: Partial<WorldState> = {}) {
    this.state = createInitialWorldState(initialState)
  }

  get selectors(): WorldSelectors {
    return {
      getState: () => this.getState(),
      getVenue: () => this.state.venue,
      getBuilding: () => this.state.building,
      getFloors: () => this.state.floors,
      getSpaces: () => this.state.spaces,
      getLabels: () => this.state.labels,
      getOverlays: () => this.state.overlays,
      getSelection: () => this.state.selection,
      getFloorById: (id) => this.state.floors.find((floor) => floor.id === id),
      getSpaceById: (id) => this.state.spaces.find((space) => space.id === id),
      getSpacesByFloor: (floorId) =>
        this.state.spaces.filter((space) => space.floorId === floorId),
      getLabelsByFloor: (floorId) =>
        this.state.labels.filter((label) => label.floorId === floorId),
      getOverlaysByFloor: (floorId) =>
        this.state.overlays.filter((overlay) => overlay.floorId === floorId),
      searchSpaces: (query, limit = 50) =>
        this.state.spaces
          .filter((space) => matchesSpace(space, query))
          .slice(0, limit),
      subscribe: (listener) => this.subscribe(listener),
    }
  }

  get actions(): WorldActions {
    return {
      setVenue: (venue) => this.setState({ venue }),
      setBuilding: (building) => this.setState({ building }),
      setFloors: (floors) => this.setState({ floors }),
      setSpaces: (spaces) => this.setState({ spaces }),
      setLabels: (labels) => this.setState({ labels }),
      setOverlays: (overlays) => this.setState({ overlays }),
      setSelection: (selection) => this.setState({ selection }),
      normalizeFromMapData: (mapData, options) =>
        this.normalizeFromMapData(mapData, options),
      reset: () => this.reset(),
    }
  }

  getState() {
    return this.state
  }

  subscribe(listener: WorldListener) {
    this.listeners.add(listener)
    listener(this.state)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private normalizeFromMapData(
    mapData: MapData,
    options: WorldNormalizeOptions = {},
  ) {
    const floors = normalizeFloors(mapData, {
      sort: options.floorSort,
    }).map(toWorldFloor)

    const fallbackFloorName = options.fallbackFloorName ?? 'Mapped floor'
    const spaces = normalizeSpaces(mapData, fallbackFloorName, {
      useActualFloorName: options.useActualFloorName,
    }).map(toWorldSpace)

    this.setState({ floors, spaces })
  }

  private setState(nextState: Partial<WorldState>) {
    this.state = {
      ...this.state,
      ...nextState,
    }
    this.notify()
  }

  private reset() {
    this.state = createInitialWorldState()
    this.notify()
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state))
  }
}

export function createWorldSubsystem(initialState?: Partial<WorldState>) {
  return new WorldSubsystem(initialState)
}

export const worldSubsystem = createWorldSubsystem()
export const worldSelectors = worldSubsystem.selectors
export const worldActions = worldSubsystem.actions

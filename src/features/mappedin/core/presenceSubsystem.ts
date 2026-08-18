import type { CameraState } from './cameraController'

export type PresenceEntity = {
  id: string
  name?: string
}

export type PresenceBuilding = PresenceEntity & {
  externalId?: string
}

export type PresenceFloor = PresenceEntity & {
  buildingId?: string
  elevation?: number
}

export type PresenceSpace = PresenceEntity & {
  floorId?: string
  floorName?: string
}

export type PresenceSelection =
  | { type: 'none' }
  | {
      type: 'building' | 'floor' | 'space' | 'label' | 'coordinate' | 'custom'
      id?: string
      name?: string
      floorId?: string
      floorName?: string
      latitude?: number
      longitude?: number
      metadata?: Record<string, unknown>
    }

export type PresenceUserLocation =
  | { status: 'off' | 'requesting' | 'unavailable' }
  | {
      status: 'ready'
      latitude: number
      longitude: number
      accuracy?: number
      floorId?: string
      spaceId?: string
      source?: 'browser' | 'blue-dot' | 'simulated' | 'manual'
    }

export type PresenceFocus =
  | { type: 'none' }
  | {
      type:
        | 'building'
        | 'floor'
        | 'space'
        | 'selection'
        | 'camera'
        | 'route'
        | 'user-location'
      id?: string
      label?: string
    }

export type PresenceRoute =
  | { status: 'idle' }
  | {
      status: 'previewing' | 'navigating' | 'complete' | 'blocked'
      origin?: PresenceSelection
      destination?: PresenceSelection
      activeInstructionIndex?: number
      metadata?: Record<string, unknown>
    }

export type PresenceState = {
  currentBuilding: PresenceBuilding | null
  currentFloor: PresenceFloor | null
  currentSpace: PresenceSpace | null
  currentSelection: PresenceSelection
  currentCamera: CameraState | null
  currentUserLocation: PresenceUserLocation
  currentFocus: PresenceFocus
  currentRoute: PresenceRoute
}

export type PresenceListener = (state: PresenceState) => void

export type PresenceActions = {
  setCurrentBuilding(building: PresenceBuilding | null): void
  setCurrentFloor(floor: PresenceFloor | null): void
  setCurrentSpace(space: PresenceSpace | null): void
  setCurrentSelection(selection: PresenceSelection): void
  setCurrentCamera(camera: CameraState | null): void
  setCurrentUserLocation(userLocation: PresenceUserLocation): void
  setCurrentFocus(focus: PresenceFocus): void
  setCurrentRoute(route: PresenceRoute): void
  reset(): void
}

export type PresenceSelectors = {
  getState(): PresenceState
  getCurrentBuilding(): PresenceBuilding | null
  getCurrentFloor(): PresenceFloor | null
  getCurrentSpace(): PresenceSpace | null
  getCurrentSelection(): PresenceSelection
  getCurrentCamera(): CameraState | null
  getCurrentUserLocation(): PresenceUserLocation
  getCurrentFocus(): PresenceFocus
  getCurrentRoute(): PresenceRoute
  subscribe(listener: PresenceListener): () => void
}

const initialPresenceState: PresenceState = {
  currentBuilding: null,
  currentFloor: null,
  currentSpace: null,
  currentSelection: { type: 'none' },
  currentCamera: null,
  currentUserLocation: { status: 'off' },
  currentFocus: { type: 'none' },
  currentRoute: { status: 'idle' },
}

function createInitialState(overrides: Partial<PresenceState> = {}): PresenceState {
  return {
    ...initialPresenceState,
    ...overrides,
  }
}

export class PresenceSubsystem {
  private listeners = new Set<PresenceListener>()
  private state: PresenceState

  constructor(initialState: Partial<PresenceState> = {}) {
    this.state = createInitialState(initialState)
  }

  get selectors(): PresenceSelectors {
    return {
      getState: () => this.getState(),
      getCurrentBuilding: () => this.state.currentBuilding,
      getCurrentFloor: () => this.state.currentFloor,
      getCurrentSpace: () => this.state.currentSpace,
      getCurrentSelection: () => this.state.currentSelection,
      getCurrentCamera: () => this.state.currentCamera,
      getCurrentUserLocation: () => this.state.currentUserLocation,
      getCurrentFocus: () => this.state.currentFocus,
      getCurrentRoute: () => this.state.currentRoute,
      subscribe: (listener) => this.subscribe(listener),
    }
  }

  get actions(): PresenceActions {
    return {
      setCurrentBuilding: (building) => this.setState({ currentBuilding: building }),
      setCurrentFloor: (floor) => this.setState({ currentFloor: floor }),
      setCurrentSpace: (space) => this.setState({ currentSpace: space }),
      setCurrentSelection: (selection) =>
        this.setState({ currentSelection: selection }),
      setCurrentCamera: (camera) => this.setState({ currentCamera: camera }),
      setCurrentUserLocation: (userLocation) =>
        this.setState({ currentUserLocation: userLocation }),
      setCurrentFocus: (focus) => this.setState({ currentFocus: focus }),
      setCurrentRoute: (route) => this.setState({ currentRoute: route }),
      reset: () => this.reset(),
    }
  }

  getState() {
    return this.state
  }

  subscribe(listener: PresenceListener) {
    this.listeners.add(listener)
    listener(this.state)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(nextState: Partial<PresenceState>) {
    this.state = {
      ...this.state,
      ...nextState,
    }
    this.notify()
  }

  private reset() {
    this.state = createInitialState()
    this.notify()
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state))
  }
}

export function createPresenceSubsystem(initialState?: Partial<PresenceState>) {
  return new PresenceSubsystem(initialState)
}

export const presenceSubsystem = createPresenceSubsystem()
export const presenceSelectors = presenceSubsystem.selectors
export const presenceActions = presenceSubsystem.actions

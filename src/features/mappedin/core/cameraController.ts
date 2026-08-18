import type { MapView } from '../types/mappedinTypes'
import {
  presenceActions,
  type PresenceActions,
} from './presenceSubsystem'

export type CameraMode = 'top' | 'perspective'

export type CameraPreset =
  | 'campus'
  | 'site'
  | 'building'
  | 'room'
  | 'floor'
  | 'top'
  | 'perspective'
  | 'orbit'
  | 'custom'

export type CameraState = {
  bearing: number
  pitch: number
  zoom: number
  mode: CameraMode
  preset: CameraPreset
  orbiting: boolean
}

type CameraTransform = {
  bearing?: number
  pitch?: number
  zoom?: number
}

type CameraActionOptions = CameraTransform & {
  preset?: CameraPreset
  applyZoom?: boolean
}

type CameraSetOptions = {
  applyZoom?: boolean
}

type CameraFocusTarget = Parameters<MapView['Camera']['focusOn']>[0]
type CameraPresenceActions = Pick<PresenceActions, 'setCurrentCamera'>

type CameraControllerOptions = {
  initialBearing?: number
  initialPitch?: number
  initialZoom?: number
  initialPreset?: CameraPreset
  minPitch?: number
  maxPitch?: number
  minZoom?: number
  maxZoom?: number
  orbitStep?: number
  orbitIntervalMs?: number
  presence?: CameraPresenceActions | null
}

type CameraStateListener = (state: CameraState) => void

function normalizeBearing(value: number) {
  return ((value % 360) + 360) % 360
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function modeFromPitch(pitch: number): CameraMode {
  return pitch === 0 ? 'top' : 'perspective'
}

function setCameraTransform(mapView: MapView, transform: CameraTransform) {
  ;(mapView.Camera.set as (nextTransform: CameraTransform) => void)(transform)
}

function hasCameraTransform(options: CameraActionOptions) {
  return (
    options.bearing !== undefined ||
    options.pitch !== undefined ||
    options.zoom !== undefined
  )
}

export class CameraController {
  private readonly mapView: MapView
  private readonly minPitch: number
  private readonly maxPitch: number
  private readonly minZoom: number
  private readonly maxZoom: number
  private readonly orbitStep: number
  private readonly orbitIntervalMs: number
  private readonly presence: CameraPresenceActions | null
  private readonly listeners = new Set<CameraStateListener>()
  private orbitTimer: number | null = null
  private state: CameraState

  constructor(mapView: MapView, options: CameraControllerOptions = {}) {
    this.mapView = mapView
    this.minPitch = options.minPitch ?? 0
    this.maxPitch = options.maxPitch ?? 75
    this.minZoom = options.minZoom ?? 12.5
    this.maxZoom = options.maxZoom ?? 19.5
    this.orbitStep = options.orbitStep ?? 2.5
    this.orbitIntervalMs = options.orbitIntervalMs ?? 120
    this.presence =
      options.presence === undefined ? presenceActions : options.presence
    this.state = {
      bearing: normalizeBearing(options.initialBearing ?? 0),
      pitch: clamp(options.initialPitch ?? 55, this.minPitch, this.maxPitch),
      zoom: clamp(options.initialZoom ?? 14.2, this.minZoom, this.maxZoom),
      mode: modeFromPitch(options.initialPitch ?? 55),
      preset: options.initialPreset ?? 'perspective',
      orbiting: false,
    }
    this.writePresence()
  }

  subscribe(listener: CameraStateListener) {
    this.listeners.add(listener)
    listener(this.state)

    return () => {
      this.listeners.delete(listener)
    }
  }

  getState() {
    return this.state
  }

  syncFromCameraChange(transform: CameraTransform) {
    this.setState({
      bearing:
        typeof transform.bearing === 'number'
          ? normalizeBearing(transform.bearing)
          : this.state.bearing,
      pitch:
        typeof transform.pitch === 'number'
          ? clamp(Math.round(transform.pitch), this.minPitch, this.maxPitch)
          : this.state.pitch,
      zoom:
        typeof transform.zoom === 'number'
          ? clamp(Number(transform.zoom.toFixed(1)), this.minZoom, this.maxZoom)
          : this.state.zoom,
      mode:
        typeof transform.pitch === 'number'
          ? modeFromPitch(clamp(Math.round(transform.pitch), this.minPitch, this.maxPitch))
          : this.state.mode,
    })
  }

  flyToRoom(target: CameraFocusTarget, options: CameraActionOptions = {}) {
    this.mapView.Camera.focusOn(target)
    if (!hasCameraTransform(options)) return

    this.setView(
      {
        bearing: options.bearing ?? this.state.bearing,
        pitch: options.pitch ?? this.state.pitch,
        zoom: options.zoom,
        preset: options.preset ?? 'room',
      },
      { applyZoom: options.applyZoom },
    )
  }

  flyToFloor(target: CameraFocusTarget, options: CameraActionOptions = {}) {
    this.mapView.Camera.focusOn(target)
    if (!hasCameraTransform(options)) return

    this.setView(
      {
        bearing: options.bearing ?? this.state.bearing,
        pitch: options.pitch ?? this.state.pitch,
        zoom: options.zoom,
        preset: options.preset ?? 'floor',
      },
      { applyZoom: options.applyZoom },
    )
  }

  reset(target: CameraFocusTarget, options: CameraActionOptions = {}) {
    this.stopOrbit()
    this.mapView.Camera.focusOn(target)
    this.setView(
      {
        bearing: options.bearing ?? 0,
        pitch: options.pitch ?? 55,
        zoom: options.zoom,
        preset: options.preset ?? (options.zoom === undefined ? 'perspective' : 'campus'),
      },
      { applyZoom: options.applyZoom },
    )
  }

  topView() {
    this.setView({ pitch: 0, preset: 'top' })
  }

  perspectiveView(pitch = 55) {
    this.setView({ pitch, preset: 'perspective' })
  }

  rotateLeft(degrees = 90) {
    this.setView({
      bearing: this.state.bearing - degrees,
      pitch: 55,
      preset: 'perspective',
    })
  }

  rotateRight(degrees = 90) {
    this.setView({
      bearing: this.state.bearing + degrees,
      pitch: 55,
      preset: 'perspective',
    })
  }

  orbit() {
    if (this.orbitTimer) return

    this.setState({ orbiting: true, preset: 'orbit' })
    this.orbitTimer = window.setInterval(() => {
      this.setView({
        bearing: this.state.bearing + this.orbitStep,
        pitch: Math.max(this.state.pitch, 45),
        preset: 'orbit',
      }, { applyZoom: true })
    }, this.orbitIntervalMs)
  }

  stopOrbit() {
    if (!this.orbitTimer) return

    window.clearInterval(this.orbitTimer)
    this.orbitTimer = null
    this.setState({ orbiting: false })
  }

  destroy() {
    this.stopOrbit()
    this.listeners.clear()
  }

  setView(
    transform: CameraTransform & { preset?: CameraPreset },
    options: CameraSetOptions = {},
  ) {
    const nextBearing =
      transform.bearing === undefined
        ? this.state.bearing
        : normalizeBearing(transform.bearing)
    const nextPitch =
      transform.pitch === undefined
        ? this.state.pitch
        : clamp(transform.pitch, this.minPitch, this.maxPitch)
    const nextZoom =
      transform.zoom === undefined
        ? this.state.zoom
        : clamp(transform.zoom, this.minZoom, this.maxZoom)

    this.state = {
      ...this.state,
      bearing: nextBearing,
      pitch: nextPitch,
      zoom: nextZoom,
      mode: modeFromPitch(nextPitch),
      preset: transform.preset ?? 'custom',
    }

    const nextTransform: CameraTransform = {
      bearing: nextBearing,
      pitch: nextPitch,
    }

    if (transform.zoom !== undefined || options.applyZoom) {
      nextTransform.zoom = nextZoom
    }

    setCameraTransform(this.mapView, nextTransform)
    this.notify()
  }

  private setState(nextState: Partial<CameraState>) {
    this.state = {
      ...this.state,
      ...nextState,
    }
    this.notify()
  }

  private notify() {
    this.writePresence()
    this.listeners.forEach((listener) => listener(this.state))
  }

  private writePresence() {
    this.presence?.setCurrentCamera(this.state)
  }
}

export function createCameraController(
  mapView: MapView,
  options?: CameraControllerOptions,
) {
  return new CameraController(mapView, options)
}

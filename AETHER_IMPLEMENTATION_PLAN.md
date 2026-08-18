# Aether Implementation Plan

Date: 2026-08-18

## Goal

Transform `src/features/mappedin` from a collection of historical demos into one production application experience named Aether.

End state:

```text
src/features/mappedin
  one production spatial intelligence application
  one Mappedin SDK lifecycle
  one state model
  one UI shell
  one implementation per subsystem
```

Every historical demo route and demo component should eventually disappear after its strongest behavior has been preserved in the production experience.

## Non-Goals For This Plan

- Do not implement code yet.
- Do not create a new project.
- Do not rewrite the app from scratch.
- Do not delete demos until parity is verified.
- Do not preserve demo routes as product architecture.

## Current Starting Point

Current files under `src/features/mappedin`:

```text
DemoMap.tsx
MappedinControlTowerDemoPage.tsx
MappedinFullMapExperience.tsx
MappedinImmersiveDemoPage.tsx
MappedinMissionControlDemoPage.tsx
```

Current mappedin routes:

```text
/demo   -> DashboardPage + DemoMap
/demo1  -> MappedinImmersiveDemoPage
/demo2  -> MappedinControlTowerDemoPage -> MappedinFullMapExperience
/demo3  -> MappedinMissionControlDemoPage -> MappedinFullMapExperience
```

Future product route:

```text
/mappedin -> Aether production experience
```

## Guiding Principles

- Build Aether inside the existing repository and existing `src/features/mappedin` feature area.
- Preserve proven behavior before deleting demos.
- Migrate subsystem by subsystem, not page by page.
- Keep Mappedin SDK side effects behind a typed core boundary.
- Keep UI components declarative and driven by Aether state.
- Treat `MappedinFullMapExperience` as the strongest current foundation for camera, floor-aware search, and full-map controls.
- Treat `MappedinImmersiveDemoPage` as a useful reference for command-center layout and selection panels.
- Treat `DemoMap` as a reference for dashboard integration requirements only, not as a future implementation pattern.
- Build real navigation and real Blue Dot as new production subsystems because current code does not contain production implementations.

## Target File Structure

Recommended final structure:

```text
src/features/mappedin
  AetherMappedinPage.tsx

  /app
    AetherApp.tsx
    AetherMapProvider.tsx
    aetherReducer.ts
    aetherState.ts

  /core
    mappedinClient.ts
    mapLifecycle.ts
    mapEvents.ts
    cameraController.ts
    labelsController.ts
    floors.ts
    spaces.ts
    tokenClient.ts

  /features
    /floor-selector
      FloorSelector.tsx
    /search
      SearchPanel.tsx
      searchIndex.ts
    /selection
      SelectionPanel.tsx
    /navigation
      NavigationPanel.tsx
      navigationController.ts
    /blue-dot
      BlueDotLayer.tsx
      blueDotProvider.ts
    /overlays
      overlaysController.ts

  /components
    MapCanvas.tsx
    MapShell.tsx
    MapToolbar.tsx
    LoadingOverlay.tsx
    ErrorOverlay.tsx
    Panel.tsx

  /types
    mappedinTypes.ts
    aetherTypes.ts

  /legacy
    retained temporarily during migration only
```

The exact file names can evolve during implementation, but the architectural boundary should not: one app, one SDK lifecycle, shared feature modules, legacy isolated.

## Source Of Truth By Subsystem

| Subsystem | Current Best Source | Production Direction |
| --- | --- | --- |
| Mappedin initialization | `MappedinFullMapExperience` | Extract typed lifecycle into `core/mapLifecycle.ts` |
| Token loading | `api/mappedin-token.ts` | Keep server boundary; add typed client wrapper |
| Floor selector | `MappedinFullMapExperience` | Shared `FloorSelector` driven by normalized floors |
| Camera | `MappedinFullMapExperience` | Extract `cameraController` with presets/actions |
| Search | `MappedinFullMapExperience` | Extract searchable index with floor-aware ranking |
| Selection details | `MappedinImmersiveDemoPage` and `MappedinFullMapExperience` | Unified `SelectionPanel` |
| Labels | `MappedinFullMapExperience` | Extract label manager with limits and cleanup |
| Dashboard integration | `DemoMap` | Replace DOM mutation with first-class state/UI |
| Navigation | None | Build new subsystem |
| Blue Dot | None | Build provider-backed subsystem |
| UI shell | `MappedinFullMapExperience` plus `MappedinImmersiveDemoPage` | One Aether shell |
| Performance | `MappedinFullMapExperience` | Add instrumentation and lifecycle caps |

## Phase 0: Migration Preparation

Purpose: make the current behavior explicit before code moves.

Actions:

1. Keep `AETHER_ARCHITECTURE_REVIEW.md` as the baseline.
2. Capture screenshots or notes for `/demo`, `/demo1`, `/demo2`, and `/demo3`.
3. Record expected behavior for:
   - map load
   - floor switching
   - camera controls
   - search
   - space selection
   - labels toggle
   - fullscreen
   - browser location messaging
   - simulated blue dot
4. Define the minimum parity checklist for `/mappedin`.

Exit criteria:

- Every demo has an explicit "behavior to preserve" list.
- Every demo has an explicit "behavior to discard" list.
- No implementation has started.

## Phase 1: Create The Aether Route And Shell

Purpose: introduce the future product entry without disturbing demos.

Actions:

1. Add a `/mappedin` route in `src/App.tsx`.
2. Create `AetherMappedinPage.tsx`.
3. Create a production shell that owns layout only.
4. Add loading, error, map canvas, toolbar, left panel, right panel, and bottom status regions.
5. Keep existing `/demo*` routes intact.

Design target:

```text
AetherMappedinPage
  AetherApp
    AetherMapProvider
      MapShell
        MapCanvas
        MapToolbar
        FloorSelector
        SearchPanel
        SelectionPanel
        NavigationPanel
        BlueDotLayer
```

Exit criteria:

- `/mappedin` renders an Aether shell.
- No demo route behavior changes.
- Shell does not duplicate full Mappedin logic yet.

## Phase 2: Extract Mappedin Core Lifecycle

Purpose: create one typed path for loading and destroying Mappedin.

Actions:

1. Extract token fetch into `core/tokenClient.ts`.
2. Extract `getMapData` and `show3dMap` into `core/mapLifecycle.ts`.
3. Define typed aliases in `types/mappedinTypes.ts`.
4. Normalize load states into one model:
   - `idle`
   - `loadingToken`
   - `loadingMapData`
   - `initializingMap`
   - `ready`
   - `error`
5. Centralize teardown:
   - map destroy
   - intervals
   - event handlers
   - labels
   - overlays
6. Harden API error handling in a later implementation pass, but keep this phase focused on client architecture.

Exit criteria:

- `/mappedin` loads the real Mappedin map through the shared lifecycle.
- Demos still use old code until parity is established.
- New lifecycle has one public interface.

## Phase 3: Normalize Floors And Spaces

Purpose: stop every component from deriving venue data differently.

Actions:

1. Extract `normalizeFloors`.
2. Extract `normalizeSpaces`.
3. Preserve useful behavior from `MappedinFullMapExperience`:
   - safe names
   - semantic floor ranking
   - floor-aware spaces
   - stable IDs as strings
4. Fix the current weak spots:
   - avoid assigning all spaces to the current floor
   - avoid inconsistent ascending/descending floor order
   - include enough metadata for search, selection, navigation, and future Aether data linkage

Exit criteria:

- Aether has one floor model.
- Aether has one space model.
- Floor selector, search, and selection read from the same normalized data.

## Phase 4: Extract Camera Controller

Purpose: preserve the strongest camera implementation and make it reusable.

Source of truth: `MappedinFullMapExperience`.

Actions:

1. Extract `applyCamera`.
2. Preserve:
   - normalized bearing
   - clamped pitch
   - clamped zoom
   - campus/site/building/room presets
   - floor-change camera preservation
   - reset
   - top view
3. Add a typed camera state:
   - `bearing`
   - `pitch`
   - `zoom`
   - `mode`
   - `preset`
4. Keep camera refs for high-frequency SDK updates, but throttle or batch UI state updates.
5. Keep orbit as a development/demo-only control unless product explicitly needs it.

Exit criteria:

- Camera controls in `/mappedin` match or exceed `/demo2` and `/demo3`.
- Camera behavior no longer lives inside a monolithic page component.

## Phase 5: Extract Labels And Overlays

Purpose: stop label creation from being copied and expensive.

Actions:

1. Extract `labelsController`.
2. Preserve `MappedinFullMapExperience` label cap behavior.
3. Make label visibility a first-class state value.
4. Add deterministic label cleanup.
5. Define future overlay boundaries for:
   - selected space
   - navigation route
   - blue dot
   - alerts/status

Exit criteria:

- Aether can show/hide labels.
- Label creation has a limit or strategy.
- Label code exists in one place.

## Phase 6: Build Production Search

Purpose: unify search into one product subsystem.

Source of truth: `MappedinFullMapExperience`, enhanced with future production behavior.

Actions:

1. Extract search indexing into `features/search/searchIndex.ts`.
2. Search across:
   - space name
   - floor name
   - mappedin ID
   - future Aether-linked metadata when available
3. Preserve capped result rendering.
4. Add better result states:
   - empty query
   - no results
   - active result
   - selected result
5. Add keyboard support:
   - arrow navigation
   - Enter to select
   - Escape to clear/close
6. Dispatch selection and camera focus through shared actions.

Exit criteria:

- Aether search replaces the three current search variants.
- Search behavior is floor-aware and selection-aware.
- Search no longer depends on external DOM selectors.

## Phase 7: Build Selection And Aether Data Linkage

Purpose: turn selected Mappedin spaces into Aether operational context.

Actions:

1. Create one `SelectionPanel`.
2. Preserve:
   - selected space name
   - floor name
   - Mappedin ID
   - coordinate display when available
3. Remove dashboard DOM mutation pattern.
4. Define linkage shape for future data:
   - equipment
   - low-voltage drops
   - QC photos
   - documents
   - deficiencies
   - DITL scenarios
   - readiness status

Exit criteria:

- Selection state has one owner.
- Selection panel is driven by Aether state.
- Dashboard-style operational fields are ready for real data.

## Phase 8: Build Navigation Subsystem

Purpose: add the missing wayfinding capability as production architecture.

Current source: none.

Actions:

1. Define route state:
   - origin
   - destination
   - active route
   - route status
   - current instruction
2. Create `NavigationPanel`.
3. Add route creation through the appropriate Mappedin SDK APIs after confirming the exact API shape during implementation.
4. Render route overlays through the overlay manager.
5. Support:
   - select origin
   - select destination
   - start route
   - clear route
   - floor transitions
   - inaccessible/error states

Exit criteria:

- Aether supports real space-to-space navigation.
- Navigation is separate from camera focus.
- Routes clean up when cleared or when map is destroyed.

## Phase 9: Build Blue Dot Subsystem

Purpose: replace demo location messaging with a provider-backed location architecture.

Current source: none for production; `MappedinImmersiveDemoPage` only has a visual simulation.

Actions:

1. Create `blueDotProvider.ts`.
2. Define provider interface:
   - `start`
   - `stop`
   - `subscribe`
   - `status`
   - `position`
   - `accuracy`
   - `floorId`
3. Keep browser geolocation as a diagnostic provider, not the indoor source of truth.
4. Add mock provider for development.
5. Add real indoor-positioning provider integration when selected.
6. Render the dot through a map-aware layer, not a fixed screen overlay.
7. Handle:
   - permission denied
   - unavailable location
   - stale location
   - floor mismatch
   - low confidence

Exit criteria:

- Aether has one Blue Dot subsystem.
- Demo dot is removed or demoted to a development-only mock.
- Blue Dot state is floor-aware and map-aware.

## Phase 10: Compose The Production Aether Experience

Purpose: merge the strongest UI ideas into one experience.

Actions:

1. Use `MappedinFullMapExperience` as the main shell reference.
2. Use `MappedinImmersiveDemoPage` as reference for command-center density and selected-location detail.
3. Avoid the `DemoMap` portal pattern.
4. Compose:
   - persistent map canvas
   - top search
   - floor selector
   - camera controls
   - selection panel
   - navigation panel
   - blue dot controls/status
   - overlays/status strip
5. Make prototype controls intentional:
   - production controls visible by default
   - debugging controls behind development mode
   - no route labels like Demo1/Demo2/Demo3

Exit criteria:

- `/mappedin` is the best and only product experience.
- Users no longer need to choose between demo variants.

## Phase 11: Verification

Purpose: prove parity before deleting anything.

Manual verification:

- `/mappedin` loads the configured Mappedin venue.
- token failure displays a useful error.
- map load failure displays a useful error.
- map destroys and reloads cleanly.
- floor selector matches current map floor.
- clicking a space updates selection.
- clicking a label updates selection when supported.
- search finds expected spaces.
- search focuses selected results.
- camera presets work.
- top/3D view works.
- bearing, pitch, and zoom controls work.
- labels show/hide without duplication.
- fullscreen works.
- navigation route can start and clear.
- Blue Dot provider can start, update, error, and stop.

Performance verification:

- initial token time
- map data load time
- `show3dMap` initialization time
- label creation time
- first interactive time
- search latency
- camera-change update frequency
- repeated mount/unmount memory behavior
- event listener cleanup

Suggested automated coverage:

- unit tests for floor normalization
- unit tests for space normalization
- unit tests for search ranking/filtering
- unit tests for camera clamping
- unit tests for reducer/state transitions
- browser smoke test for `/mappedin`

Exit criteria:

- `/mappedin` passes parity checklist.
- No known demo-only capability remains unaccounted for.
- Performance is at least as good as the strongest current demo.

## Phase 12: Retire Historical Demos

Purpose: remove the old architecture after Aether is production-ready.

Actions:

1. Mark demo routes as legacy.
2. Redirect or remove:
   - `/demo`
   - `/demo1`
   - `/demo2`
   - `/demo3`
3. Remove:
   - `DemoMap.tsx`
   - `MappedinImmersiveDemoPage.tsx`
   - `MappedinControlTowerDemoPage.tsx`
   - `MappedinMissionControlDemoPage.tsx`
   - `MappedinFullMapExperience.tsx` after its extracted behavior is fully represented
4. Remove unused imports from `src/App.tsx`.
5. Remove unused dependencies if still unused, especially `@mappedin/react-sdk` unless adopted.
6. Update README to describe Aether rather than the Vite template.

Exit criteria:

- No historical mappedin demo component remains in active runtime.
- `src/features/mappedin` contains one coherent production application.
- Documentation points to `/mappedin`.

## Target Aether Runtime Model

```text
AetherMappedinPage
  AetherApp
    AetherMapProvider
      MapCanvas
      LoadingOverlay
      ErrorOverlay
      MapShell
        SearchPanel
        FloorSelector
        CameraControls
        SelectionPanel
        NavigationPanel
        BlueDotLayer
        StatusBar
```

## Target Aether State Model

```text
map.status
map.error
map.mapView
map.mapData

venue.floors
venue.currentFloorId
venue.spaces

camera.bearing
camera.pitch
camera.zoom
camera.mode
camera.preset

selection.spaceId
selection.coordinate

search.query
search.results
search.activeResultId

navigation.originId
navigation.destinationId
navigation.route
navigation.status
navigation.error

blueDot.status
blueDot.position
blueDot.floorId
blueDot.accuracy
blueDot.provider

ui.leftPanel
ui.rightPanel
ui.labelsVisible
ui.fullscreen
ui.debugMode
```

## Deletion Rules

Do not delete a demo component until:

- every useful behavior has a production replacement
- the replacement has been verified in `/mappedin`
- the route no longer serves a product purpose
- the deletion is small and reviewable

Delete aggressively after parity:

- duplicated map initialization
- duplicated label creation
- duplicated search implementations
- duplicated camera controls
- DOM mutation integration code
- demo wrappers
- demo route labels and copy
- unused dependencies

## Recommended Implementation Order

1. Add `/mappedin` route and empty Aether shell.
2. Extract token client and map lifecycle.
3. Load map in Aether through the shared lifecycle.
4. Normalize floors/spaces.
5. Add floor selector.
6. Extract and add camera controller.
7. Extract and add label manager.
8. Build search.
9. Build selection panel.
10. Build navigation.
11. Build Blue Dot.
12. Verify parity and performance.
13. Retire demos.
14. Update documentation.

## Final Definition Of Done

Aether is complete when:

- `src/features/mappedin` is one production application, not a demo collection.
- `/mappedin` is the canonical product route.
- historical demos are removed from active runtime.
- Mappedin SDK initialization exists in one typed lifecycle module.
- camera, floor selector, search, navigation, Blue Dot, labels, overlays, and selection each have one owner.
- source code no longer uses DOM text matching to integrate the map.
- production UI is coherent and not variant/demo-driven.
- README documents Aether setup, environment variables, local development, and deployment.
- verification confirms load, floor, search, selection, camera, navigation, Blue Dot, cleanup, and performance behavior.

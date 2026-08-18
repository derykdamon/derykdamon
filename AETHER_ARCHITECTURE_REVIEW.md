# Aether Mappedin Architecture Review

Date: 2026-08-18

## Scope

Reviewed every file under `src/features/mappedin`:

- `src/features/mappedin/DemoMap.tsx`
- `src/features/mappedin/MappedinControlTowerDemoPage.tsx`
- `src/features/mappedin/MappedinFullMapExperience.tsx`
- `src/features/mappedin/MappedinImmersiveDemoPage.tsx`
- `src/features/mappedin/MappedinMissionControlDemoPage.tsx`

Also reviewed directly referenced integration files:

- `src/App.tsx`
- `src/main.tsx`
- `src/features/activation/DashboardPage.tsx`
- `api/mappedin-token.ts`
- `package.json`
- `vite.config.ts`
- `vercel.json`
- `src/index.css`
- `README.md`

This review is architectural only. No source code was modified.

## 1. Current Architecture

The current Mappedin implementation is a set of route-level demo components inside a Vite React application. The runtime is React 19, React Router 8, Tailwind CSS 4, and direct `@mappedin/mappedin-js` usage. `@mappedin/react-sdk` is installed but not used.

The app exposes Mappedin through legacy demo routes in `src/App.tsx`:

- `/demo`: `DashboardPage` plus `DemoMap`
- `/demo1`: `MappedinImmersiveDemoPage`
- `/demo2`: `MappedinControlTowerDemoPage`
- `/demo3`: `MappedinMissionControlDemoPage`

There is no `/mappedin` production route yet.

The implementation has three real Mappedin experiences:

- `DemoMap`: embeds a live map into the ActivationOS dashboard by creating a React portal into a DOM node found by text matching.
- `MappedinImmersiveDemoPage`: a full-screen dark command-center prototype with floor controls, search, selection, labels, camera controls, browser location messaging, and a simulated screen-centered blue dot.
- `MappedinFullMapExperience`: a white full-screen map-first shell used by both `MappedinControlTowerDemoPage` and `MappedinMissionControlDemoPage`, with variant text/config differences.

The server-side token boundary is `api/mappedin-token.ts`. It reads `MAPPEDIN_KEY`, `MAPPEDIN_SECRET`, and `MAPPEDIN_MAP_ID`, exchanges the key/secret for a Mappedin access token, and returns `{ accessToken, expiresIn, mapId }` to the browser.

## 2. Component Hierarchy

Current route hierarchy:

```text
main.tsx
  BrowserRouter
    App
      SiteLayout
        HomePage
        PlatformPage
        SolutionsPage
        AboutPage
        ContactPage

      /demo
        DashboardPage
        DemoMap
          DemoMapContent
            Mappedin map portal mounted into DashboardPage's map panel

      /demo0
        SynthesiaDemoPage

      /demo1
        MappedinImmersiveDemoPage

      /demo2
        MappedinControlTowerDemoPage
          MappedinFullMapExperience variant="control-tower"

      /demo3
        MappedinMissionControlDemoPage
          MappedinFullMapExperience variant="mappedin-plus"
```

`MappedinControlTowerDemoPage` and `MappedinMissionControlDemoPage` are thin wrappers. The shared implementation is `MappedinFullMapExperience`.

`DemoMap` is structurally different from the other two experiences. It is not rendered in a normal component-owned container. Instead, it searches the existing dashboard DOM for an `h2` containing `Mappedin map area`, hides the dashboard's placeholder floor buttons, adjusts the target panel height, and portals `DemoMapContent` into that target.

## 3. State Flow

State is local to each demo component. There is no shared Mappedin store, context, reducer, service layer, or feature module.

Common state patterns:

- `loadState`: `loading | ready | error`
- `errorMessage`
- `reloadKey` to retry map initialization
- `floors`
- `currentFloorId`
- `labelsVisible`
- selection state
- camera state or refs
- browser geolocation state

`DemoMap` state:

- React state owns loading, errors, floors, selected-space label, label visibility, camera mode, and location message.
- Refs own `mapView`, `mapData`, search cleanup, and bearing.
- Dashboard data is mutated outside React through `document.querySelector`, `textContent`, and direct inline style updates.

`MappedinImmersiveDemoPage` state:

- React state owns floors, spaces, selected location, panels, chrome visibility, search query, simulated blue-dot toggle, labels, camera mode, and location message.
- Refs own `mapView`, `mapData`, and bearing.
- Search derives `filteredSpaces` with `useMemo`.

`MappedinFullMapExperience` state:

- React state owns floors, spaces, selected space, query, labels, UI visibility, left/right panels, orbiting, bearing, pitch, zoom, view mode, and location message.
- Refs own `mapView`, `spaces`, orbit timer, bearing, pitch, and zoom.
- This component has the strongest state model because it tracks camera transform values in both refs and UI state, and exposes more granular view modes.

## 4. Mappedin Initialization

All Mappedin experiences initialize independently using the same basic sequence:

1. Fetch `/api/mappedin-token`.
2. Validate `accessToken` and `mapId`.
3. Call `getMapData({ accessToken, mapId })`.
4. Call `show3dMap(mapElement, mapData)`.
5. Store `mapView` in a ref.
6. Enable camera interactions.
7. Derive floors and spaces from `mapData`.
8. Mark spaces interactive with `mapView.updateState`.
9. Add persistent labels through `mapView.Labels.add`.
10. Wire `floor-change`, `camera-change`, and `click` events.
11. Set initial camera and mark the component ready.

`api/mappedin-token.ts` is a reasonable security boundary because credentials stay server-side. It also sets `s-maxage=300, stale-while-revalidate=60`, which reduces token-fetch pressure at the edge. It does not currently validate response shape beyond `access_token`, include request correlation, or handle non-JSON upstream errors.

Initialization duplication is high:

- `DemoMap` duplicates token fetch, map data fetch, show3dMap, floor derivation, space interactivity, label creation, event wiring, camera setup, and teardown.
- `MappedinImmersiveDemoPage` duplicates nearly the same path.
- `MappedinFullMapExperience` duplicates the path again, with better floor/space normalization and more camera state.

The strongest initialization implementation is currently `MappedinFullMapExperience` because it normalizes names, ranks floors, stores spaces in a ref for event handlers, limits label volume, and preserves camera state across floor changes.

## 5. Camera Implementation

Camera support exists in all three real Mappedin experiences.

`DemoMap`:

- Tracks bearing in a ref.
- Sets interactions for pan, zoom, bearing, and pitch.
- Initial camera focuses on current floor with pitch 55 and bearing 0.
- Provides rotate left/right, top/3D toggle, reset, and fullscreen.
- Floor change focuses on the new floor.

`MappedinImmersiveDemoPage`:

- Similar to `DemoMap`.
- Uses 30-degree rotation steps.
- Maintains only a coarse `cameraMode` state.
- Does not expose zoom controls.

`MappedinFullMapExperience`:

- Strongest camera implementation.
- Centralizes camera mutation in `applyCamera`.
- Normalizes bearing to 0-359.
- Clamps pitch to 0-75 and zoom to 12.5-19.5.
- Tracks bearing, pitch, and zoom in refs and React state.
- Supports campus/site/building/room focus modes.
- Preserves camera settings across floor changes.
- Adds an orbit mode with interval cleanup.

The future Aether camera controller should be extracted from `MappedinFullMapExperience`.

## 6. Search Implementation

There are three different search approaches.

`DemoMap`:

- Does not render its own search input.
- Locates the dashboard search input by placeholder text.
- Adds a raw `keydown` listener.
- On Enter, performs a case-insensitive substring match against named spaces.
- Uses native `setCustomValidity` for no-result feedback.
- Focuses the matched space and mutates dashboard details.

`MappedinImmersiveDemoPage`:

- Owns `searchQuery`.
- Filters named spaces by `space.name`.
- Displays up to 60 results.
- Clicking a result focuses the space and updates selected location.
- Search does not include floor name in matching.

`MappedinFullMapExperience`:

- Owns `query`.
- Filters by combined `space.name` and `space.floorName`.
- Displays 50 default spaces or 120 query results.
- Pressing Enter focuses the first match.
- Clicking a result focuses the selected space.

The strongest current search base is `MappedinFullMapExperience`, mainly because it includes floor-aware matching and caps result rendering. It is still a simple client-side substring filter with no ranking, tokenization, keyboard result navigation, highlighting, or empty-state affordance in the top search input.

## 7. Navigation Implementation

There is no true routing/navigation implementation in the Mappedin sense.

The code uses the word "Navigation" only as UI labeling/iconography and React Router page navigation. There is no evidence of:

- route calculation between spaces
- path rendering
- multi-floor route transitions
- origin/destination selection
- directions panel
- route clearing
- accessible route instructions
- use of Mappedin directions APIs

Current "navigation" behavior is camera focus and floor switching, not wayfinding.

For future Aether, navigation should become a first-class subsystem rather than being conflated with camera focus.

## 8. Blue Dot Implementation

There is no production indoor Blue Dot implementation.

Current behavior:

- All three Mappedin experiences can call `navigator.geolocation.getCurrentPosition`.
- Browser coordinates and accuracy are displayed as text.
- `DemoMap` and `MappedinFullMapExperience` explicitly state that off-site positions are not plotted as an indoor Blue Dot.
- `MappedinImmersiveDemoPage` includes a "Demo dot" toggle, but it renders a fixed HTML overlay at the center of the viewport, not a coordinate-bound Mappedin marker.

The current Blue Dot capability is best described as:

- browser geolocation permission and accuracy probe
- indoor-positioning education copy
- simulated visual marker for demo storytelling

It is not yet:

- tied to a Mappedin coordinate
- tied to an indoor positioning provider
- floor-aware
- updated continuously
- represented as a map object
- synchronized with camera or floor state

## 9. Shared Code Opportunities

High-value extraction targets:

- `MappedinTokenPayload` and token fetch client
- `loadMappedinMap` service for token fetch, `getMapData`, `show3dMap`, and error handling
- typed `MapData` and `MapView` aliases
- floor normalization and sorting
- space normalization and sorting
- persistent label manager
- space interactivity setup
- map event registration and teardown
- camera controller from `MappedinFullMapExperience`
- search indexing/filtering
- location/geolocation service
- shared loading/error overlays
- floor selector component
- map controls component
- selection details panel

Recommended future module boundaries:

```text
src/features/mappedin
  /app
    MappedinApp.tsx
    MappedinRoute.tsx
  /core
    mappedinClient.ts
    mapLifecycle.ts
    cameraController.ts
    labelsController.ts
    floors.ts
    spaces.ts
    events.ts
  /features
    /floor-selector
    /search
    /navigation
    /blue-dot
    /selection
    /overlays
  /components
    MapCanvas.tsx
    MapShell.tsx
    MapToolbar.tsx
    SidePanel.tsx
    StatusOverlay.tsx
  /state
    mappedinStore.ts
  /types
    mappedinTypes.ts
```

If the product direction is to retire demos into a future `/mappedin` app, the code should move toward one production route and one reusable Mappedin runtime boundary, not more route-level demo components.

## 10. Technical Debt

Primary debt:

- Three duplicated Mappedin initialization flows.
- No shared SDK lifecycle abstraction.
- No unified app state model.
- `DemoMap` uses DOM text matching to locate and mutate dashboard UI.
- Dashboard integration bypasses React state and can break from copy/layout changes.
- Event handlers are registered on `mapView`, but there is no explicit per-handler unsubscribe. The code relies on `mapView.destroy()` for cleanup.
- `MappedinFullMapExperience` uses `any` for map view, map events, floors, and spaces despite direct SDK typing being available elsewhere.
- Floor sorting is inconsistent: `DemoMap` and `MappedinImmersiveDemoPage` sort by descending elevation, while `MappedinFullMapExperience` uses a semantic `floorRank`.
- Space floor names are unreliable in `MappedinImmersiveDemoPage`; it assigns the current floor name as fallback while building all spaces.
- Search behavior differs per demo.
- Label styling and limits differ per demo.
- Location behavior differs per demo.
- There is no real navigation subsystem.
- There is no real Blue Dot subsystem.
- The route names are demo-era paths rather than product paths.
- The README remains the default Vite template and does not document the actual architecture.
- `@mappedin/react-sdk` is installed but unused.

Secondary debt:

- Large monolithic TSX files combine SDK orchestration, state management, UI layout, and product copy.
- Inline Tailwind-heavy UI makes repeated controls hard to consolidate.
- Product copy is embedded inside component implementations.
- Error handling is user-facing but not operationally observable.
- No tests or verification harness were found for map initialization, search, floor changes, or camera controls.
- No feature flags distinguish prototype controls from production controls.

## 11. Performance Observations

Positive observations:

- Map initialization is async and uses loading/error states.
- Map instances are destroyed on component cleanup.
- `MappedinFullMapExperience` caps labels to 650 and search result rendering to 50/120.
- Search result filtering is memoized in the full-screen components.
- Orbit interval is cleared on cleanup in `MappedinFullMapExperience`.
- Token endpoint uses edge caching headers.

Risks:

- `DemoMap` and `MappedinImmersiveDemoPage` add labels for every named space with no cap.
- `Promise.all` label creation across all named spaces may spike startup work on larger venues.
- All spaces are made interactive at startup in every demo.
- Each demo independently fetches token, map data, initializes labels, and wires events.
- There is no shared cache for token, map data, floor lists, or normalized spaces.
- Camera-change events can trigger frequent React state updates in `MappedinFullMapExperience`.
- Rebuilding labels after toggling visibility can be expensive.
- Search is linear over all spaces on every query.
- No instrumentation measures map load, label creation, search latency, or event listener growth.
- The simulated Blue Dot is cheap, but not representative of the eventual performance profile of live indoor positioning.

## 12. Recommended Future Aether Architecture

The future Aether implementation should preserve the best work from the demos while retiring the demo architecture.

Recommended product direction:

```text
/mappedin
  One production spatial intelligence application

/demo, /demo1, /demo2, /demo3
  Legacy prototypes, removed from active runtime after parity
```

Recommended source direction:

```text
src/features/mappedin
  core SDK boundary
  typed map lifecycle
  typed camera controller
  typed floor/space normalization
  shared label/overlay managers
  feature modules for search, navigation, blue dot, and selection
  production UI shell
```

Subsystem recommendations:

- Use `MappedinFullMapExperience` as the strongest source for camera behavior and full-map UI composition.
- Use `MappedinFullMapExperience` as the starting point for floor-aware search, then improve ranking and keyboard interaction.
- Use `MappedinImmersiveDemoPage` as a reference for command-center panel composition and selected-location details.
- Use `DemoMap` only as a reference for dashboard integration requirements, not as a future implementation pattern.
- Keep `api/mappedin-token.ts` as the seed for the server-side credential boundary, but harden error handling and document required environment variables.
- Build real navigation as a new subsystem; no current implementation is strong enough to preserve.
- Build real Blue Dot as a provider-backed subsystem; no current implementation is strong enough to preserve.

Recommended runtime model:

```text
MappedinApp
  MappedinProvider
    owns token/mapData/mapView lifecycle
    exposes typed actions and selectors

  MapCanvas
    owns only the DOM element for show3dMap

  MapShell
    composes panels and controls

  FloorSelector
    reads floors/currentFloor
    dispatches setFloor

  SearchPanel
    reads search index/query/results
    dispatches selectSpace/focusSpace

  CameraControls
    dispatches camera controller actions

  NavigationPanel
    owns route origin/destination and rendered path state

  BlueDotLayer
    subscribes to indoor positioning provider
    renders floor-aware location marker

  SelectionPanel
    renders selected Mappedin object plus linked Aether data
```

Recommended state model:

- `map.status`
- `map.error`
- `mapView`
- `mapData`
- `floors`
- `currentFloorId`
- `spaces`
- `selectedSpaceId`
- `search.query`
- `search.results`
- `camera.bearing`
- `camera.pitch`
- `camera.zoom`
- `navigation.originId`
- `navigation.destinationId`
- `navigation.route`
- `blueDot.status`
- `blueDot.position`
- `blueDot.floorId`
- `overlays.visible`

Recommended migration sequence:

1. Preserve current demos as read-only reference behavior.
2. Create a `/mappedin` route.
3. Extract token loading and Mappedin initialization into a typed lifecycle module.
4. Extract floor and space normalization.
5. Extract camera behavior from `MappedinFullMapExperience`.
6. Extract label management with volume limits and teardown.
7. Build a unified production shell using the strongest UI patterns.
8. Migrate search into a shared feature module.
9. Add a real navigation subsystem.
10. Add a real Blue Dot provider boundary.
11. Replace `/demo*` routes with either redirects or archived legacy access.
12. Remove duplicated demo code after parity is verified.

## Principal Engineer Bottom Line

The current Mappedin code proves that the team can load the real venue, render a 3D map, expose floor controls, select spaces, search spaces, add labels, manage camera views, and present polished demo shells. The strongest implementation is `MappedinFullMapExperience`, especially for camera control, space normalization, label limiting, and reusable route variants.

The architecture is still prototype-shaped. The largest risks are duplicated SDK lifecycle code, DOM-coupled dashboard integration, absence of real navigation, absence of real Blue Dot, and monolithic components that combine product UI with SDK side effects.

Future Aether should not create another demo. It should consolidate the strongest parts into one `/mappedin` production experience with a typed Mappedin core, explicit feature modules, and a clean state/action boundary around the SDK.

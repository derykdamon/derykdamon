import {
  worldSelectors,
  type WorldBuilding,
  type WorldFloor,
  type WorldLabel,
  type WorldSelectors,
  type WorldSpace,
} from './worldSubsystem'
import {
  presenceActions,
  type PresenceActions,
  type PresenceBuilding,
  type PresenceFloor,
  type PresenceSelection,
  type PresenceSpace,
} from './presenceSubsystem'

export type SearchEntityType =
  | 'building'
  | 'floor'
  | 'space'
  | 'label'
  | 'asset'
  | 'equipment'

export type SearchIndexRecord = {
  type: SearchEntityType
  id: string
  worldId?: string
  name: string
  floorId?: string
  floorWorldId?: string
  floorName?: string
  keywords?: string[]
  metadata?: Record<string, unknown>
}

export type SearchResult = SearchIndexRecord & {
  score: number
  matchReason: 'exact' | 'prefix' | 'contains' | 'keyword' | 'browse'
}

export type SearchSuggestion = {
  id: string
  type: SearchEntityType
  value: string
  label: string
  result: SearchResult
}

export type SearchOptions = {
  limit?: number
  types?: SearchEntityType[]
}

export type SearchState = {
  query: string
  results: SearchResult[]
  selected: SearchResult | null
}

export type SearchActions = {
  search(query: string, options?: SearchOptions): SearchResult[]
  suggest(query: string, options?: SearchOptions): SearchSuggestion[]
  select(resultOrId: SearchResult | string): SearchResult | null
  clear(): void
}

export type SearchSelectors = {
  getState(): SearchState
  getResults(): SearchResult[]
  getSelected(): SearchResult | null
  subscribe(listener: SearchListener): () => void
}

export type SearchListener = (state: SearchState) => void

type SearchWorldSelectors = Pick<
  WorldSelectors,
  'getBuilding' | 'getFloors' | 'getSpaces' | 'getLabels'
>

type SearchPresenceActions = Pick<
  PresenceActions,
  | 'setCurrentBuilding'
  | 'setCurrentFloor'
  | 'setCurrentSpace'
  | 'setCurrentSelection'
  | 'setCurrentFocus'
  | 'setCurrentSearch'
>

type SearchSubsystemOptions = {
  world?: SearchWorldSelectors
  presence?: SearchPresenceActions | null
  futureAssets?: SearchIndexRecord[]
  futureEquipment?: SearchIndexRecord[]
}

const initialSearchState: SearchState = {
  query: '',
  results: [],
  selected: null,
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function definedKeywords(record: SearchIndexRecord) {
  return [
    record.name,
    record.id,
    record.worldId,
    record.floorName,
    ...(record.keywords ?? []),
  ].filter((value): value is string => Boolean(value?.trim()))
}

function scoreRecord(record: SearchIndexRecord, query: string): SearchResult | null {
  const normalizedQuery = normalize(query)
  const haystack = definedKeywords(record).map(normalize)

  if (!normalizedQuery) {
    return { ...record, score: 1, matchReason: 'browse' }
  }

  if (haystack.some((value) => value === normalizedQuery)) {
    return { ...record, score: 100, matchReason: 'exact' }
  }

  if (haystack.some((value) => value.startsWith(normalizedQuery))) {
    return { ...record, score: 75, matchReason: 'prefix' }
  }

  if (haystack.some((value) => value.includes(normalizedQuery))) {
    return { ...record, score: 50, matchReason: 'contains' }
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const keywordMatch = queryTokens.every((token) =>
    haystack.some((value) => value.includes(token)),
  )

  if (keywordMatch) {
    return { ...record, score: 35, matchReason: 'keyword' }
  }

  return null
}

function byScoreThenName(a: SearchResult, b: SearchResult) {
  if (a.score !== b.score) return b.score - a.score
  return a.name.localeCompare(b.name)
}

function buildingToRecord(building: WorldBuilding): SearchIndexRecord {
  return {
    type: 'building',
    id: building.externalId ?? building.worldId,
    worldId: building.worldId,
    name: building.name ?? 'Building',
    keywords: [building.externalId, building.venueId].filter(
      (value): value is string => Boolean(value),
    ),
    metadata: building.metadata,
  }
}

function floorToRecord(floor: WorldFloor): SearchIndexRecord {
  return {
    type: 'floor',
    id: floor.id,
    worldId: floor.worldId,
    name: floor.name,
    keywords: [String(floor.elevation)],
    metadata: floor.metadata,
  }
}

function spaceToRecord(space: WorldSpace): SearchIndexRecord {
  return {
    type: 'space',
    id: space.id,
    worldId: space.worldId,
    name: space.name,
    floorId: space.floorId,
    floorWorldId: space.floorId ? `floor:${space.floorId}` : undefined,
    floorName: space.floorName,
    metadata: space.metadata,
  }
}

function labelToRecord(label: WorldLabel): SearchIndexRecord {
  return {
    type: 'label',
    id: label.worldId,
    worldId: label.worldId,
    name: label.text,
    floorId: label.floorId,
    floorWorldId: label.floorId ? `floor:${label.floorId}` : undefined,
    metadata: label.metadata,
  }
}

function createPresenceSelection(result: SearchResult): PresenceSelection {
  return {
    type:
      result.type === 'asset' || result.type === 'equipment'
        ? 'custom'
        : result.type,
    id: result.id,
    worldId: result.worldId,
    name: result.name,
    floorId: result.floorId,
    floorWorldId: result.floorWorldId,
    floorName: result.floorName,
    metadata: {
      ...result.metadata,
      searchType: result.type,
      matchReason: result.matchReason,
    },
  }
}

export class SearchSubsystem {
  private readonly world: SearchWorldSelectors
  private readonly presence: SearchPresenceActions | null
  private readonly futureAssets: SearchIndexRecord[]
  private readonly futureEquipment: SearchIndexRecord[]
  private listeners = new Set<SearchListener>()
  private state: SearchState = initialSearchState

  constructor(options: SearchSubsystemOptions = {}) {
    this.world = options.world ?? worldSelectors
    this.presence =
      options.presence === undefined ? presenceActions : options.presence
    this.futureAssets = options.futureAssets ?? []
    this.futureEquipment = options.futureEquipment ?? []
  }

  get selectors(): SearchSelectors {
    return {
      getState: () => this.getState(),
      getResults: () => this.state.results,
      getSelected: () => this.state.selected,
      subscribe: (listener) => this.subscribe(listener),
    }
  }

  get actions(): SearchActions {
    return {
      search: (query, options) => this.search(query, options),
      suggest: (query, options) => this.suggest(query, options),
      select: (resultOrId) => this.select(resultOrId),
      clear: () => this.clear(),
    }
  }

  getState() {
    return this.state
  }

  subscribe(listener: SearchListener) {
    this.listeners.add(listener)
    listener(this.state)

    return () => {
      this.listeners.delete(listener)
    }
  }

  search(query: string, options: SearchOptions = {}) {
    const limit = options.limit ?? 50
    const allowedTypes = new Set(options.types)
    const results = this.buildIndex()
      .filter(
        (record) => allowedTypes.size === 0 || allowedTypes.has(record.type),
      )
      .map((record) => scoreRecord(record, query))
      .filter((result): result is SearchResult => Boolean(result))
      .sort(byScoreThenName)
      .slice(0, limit)

    this.setState({ query, results })
    this.presence?.setCurrentSearch({
      query,
      resultCount: results.length,
    })
    return results
  }

  suggest(query: string, options: SearchOptions = {}) {
    const results = this.search(query, {
      ...options,
      limit: options.limit ?? 8,
    })

    return results.map((result) => ({
      id: result.worldId ?? `${result.type}:${result.id}`,
      type: result.type,
      value: result.name,
      label: result.floorName
        ? `${result.name} · ${result.floorName}`
        : result.name,
      result,
    }))
  }

  select(resultOrId: SearchResult | string) {
    const result =
      typeof resultOrId === 'string'
        ? this.findResultById(resultOrId)
        : resultOrId

    if (!result) return null

    const results = this.state.results.some(
      (currentResult) =>
        currentResult.id === result.id && currentResult.type === result.type,
    )
      ? this.state.results
      : [result]

    this.writePresence(result)
    this.presence?.setCurrentSearch({
      query: result.name,
      resultCount: results.length,
      selectedResultId: result.id,
      selectedResultName: result.name,
    })
    this.setState({
      query: result.name,
      results,
      selected: result,
    })
    return result
  }

  clear() {
    this.presence?.setCurrentSelection({ type: 'none' })
    this.presence?.setCurrentSpace(null)
    this.presence?.setCurrentFocus({ type: 'none' })
    this.presence?.setCurrentSearch({
      query: '',
      resultCount: 0,
    })
    this.setState(initialSearchState)
  }

  private buildIndex() {
    const building = this.world.getBuilding()
    const records: SearchIndexRecord[] = []

    if (building) records.push(buildingToRecord(building))

    return records.concat(
      this.world.getFloors().map(floorToRecord),
      this.world.getSpaces().map(spaceToRecord),
      this.world.getLabels().map(labelToRecord),
      this.futureAssets,
      this.futureEquipment,
    )
  }

  private findResultById(id: string) {
    return (
      this.state.results.find(
        (result) => result.id === id || result.worldId === id,
      ) ??
      this.buildIndex()
        .map((record) => scoreRecord(record, record.name))
        .filter((result): result is SearchResult => Boolean(result))
        .find((result) => result.id === id || result.worldId === id) ??
      null
    )
  }

  private writePresence(result: SearchResult) {
    if (result.type !== 'space') {
      this.presence?.setCurrentSpace(null)
    }

    this.presence?.setCurrentSelection(createPresenceSelection(result))
    this.presence?.setCurrentFocus({
      type: 'selection',
      id: result.id,
      worldId: result.worldId,
      label: result.name,
    })

    if (result.type === 'building') {
      this.presence?.setCurrentBuilding({
        id: result.id,
        worldId: result.worldId,
        type: 'building',
        name: result.name,
      } satisfies PresenceBuilding)
    }

    if (result.type === 'floor') {
      this.presence?.setCurrentFloor({
        id: result.id,
        worldId: result.worldId,
        type: 'floor',
        name: result.name,
      } satisfies PresenceFloor)
    }

    if (result.type === 'space') {
      this.presence?.setCurrentSpace({
        id: result.id,
        worldId: result.worldId,
        type: 'space',
        name: result.name,
        floorId: result.floorId,
        floorName: result.floorName,
      } satisfies PresenceSpace)
    }
  }

  private setState(nextState: Partial<SearchState>) {
    this.state = {
      ...this.state,
      ...nextState,
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state))
  }
}

export function createSearchSubsystem(options?: SearchSubsystemOptions) {
  return new SearchSubsystem(options)
}

export const searchSubsystem = createSearchSubsystem()
export const searchSelectors = searchSubsystem.selectors
export const searchActions = searchSubsystem.actions

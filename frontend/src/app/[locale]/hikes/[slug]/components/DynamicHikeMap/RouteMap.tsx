'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type {
  GeoJSONSource,
  Map as MapInstance,
  Marker as PositionMarker,
  StyleSpecification,
} from 'maplibre-gl'

import contour from 'maplibre-contour'
import styles from './RouteMap.module.css'
import { MapFrame } from './MapFrame'
import { MapUnavailable } from './MapUnavailable'
import { MediaModal } from '@/components/MediaModal/MediaModal'
import { MediaControl } from '@/components/MediaModal/MediaControl'
import type { PlannedMap, TrackingProgress } from '@/api/tracking'
import { useCharacterShortcutsEnabled } from '@/navigation/shortcutPreferences'
import { usePageShortcut } from '@/navigation/usePageShortcut'

import { addTopography, createTopography, preparePeakLabels } from '@/maps/topography.mjs'
import terrain from '@/maps/topography.json'
import {
  addDetailLabelLayer,
  addOutdoorFacilities,
  prepareOutdoorFacilities,
} from '@/maps/detailLabels'
import { illustrationPaint } from '@/maps/illustrationPaint.mjs'

import 'maplibre-gl/dist/maplibre-gl.css'

type Point = [number, number]
type Lines = number[][][]
const source = 'hike-route'
const routePadding = 32
const endpointLabelClearance = 16
const maximumOverviewZoom = 14

function fitTrail(map: MapInstance, bounds: [Point, Point], creditsHeight: number) {
  map.fitBounds(bounds, {
    padding: {
      top: routePadding,
      right: routePadding,
      bottom: creditsHeight + routePadding + endpointLabelClearance,
      left: routePadding,
    },
    maxZoom: maximumOverviewZoom,
    duration: 0,
  })
}

function groupAttribution(style: StyleSpecification, terrainLabel: string) {
  const basemap = style.sources.openmaptiles
  if (basemap.type !== 'vector') {
    return
  }
  const groups = [
    basemap.attribution && `<span class="hike-map-credit-group">${basemap.attribution}</span>`,
    `<span class="hike-map-credit-group"><a href="${terrain.provider.attributionUrl}">${terrainLabel}</a></span>`,
  ]
  basemap.attribution = groups.filter(Boolean).join(' ')
}

function displayPoint(point: number[], route: PlannedMap): Point {
  const center = (route.bounds[0][0] + route.bounds[1][0]) / 2
  const delta = point[0] - center
  const lon =
    Math.abs(delta) <= 180 ? point[0] : center + ((((delta + 180) % 360) + 360) % 360) - 180
  return [lon, point[1]]
}

function features(route: PlannedMap, completed: boolean, progress?: TrackingProgress) {
  const position = progress?.position ?? route.stop
  const walked: Lines = []
  const remaining: Lines = []
  for (const [index, line] of route.lines.entries()) {
    if (completed || progress?.remaining === 0) {
      walked.push(line)
    } else if (!position || index > position.line) {
      remaining.push(line)
    } else if (index < position.line) {
      walked.push(line)
    } else {
      walked.push([...line.slice(0, position.edge + 1), position.coordinates])
      remaining.push([position.coordinates, ...line.slice(position.edge + 1)])
    }
  }

  const lines = (kind: string, paths: Lines) => ({
    type: 'Feature' as const,
    properties: { kind },
    geometry: {
      type: 'MultiLineString' as const,
      coordinates: paths.map((line) => line.map((point) => displayPoint(point, route))),
    },
  })
  const point = (kind: string, coordinates: number[]) => ({
    type: 'Feature' as const,
    properties: { kind },
    geometry: { type: 'Point' as const, coordinates: displayPoint(coordinates, route) },
  })

  const data = {
    type: 'FeatureCollection' as const,
    features: [
      lines('remaining', remaining),
      lines('walked', walked),
      point(route.circular ? 'loop' : 'start', route.start),
      ...(route.circular ? [] : [point('finish', route.finish)]),
      ...(progress?.position ? [point('position', progress.position.coordinates)] : []),
    ],
  }
  return data
}

function finishColor(route: PlannedMap, aborted: boolean) {
  return route.tokens[aborted ? route.overlay.startColorToken : 'orange-dark']
}

function addLayers(
  map: MapInstance,
  route: PlannedMap,
  data: ReturnType<typeof features>,
  aborted: boolean,
) {
  const { tokens, overlay } = route
  map.addSource(source, { type: 'geojson', data })
  const routeColor = tokens[overlay.routeColorToken]
  const outline = tokens[overlay.outlineColorToken]
  const endpoint = tokens[overlay.startColorToken]
  const layout = { 'line-join': 'round', 'line-cap': 'round' } as const
  const solidKinds = aborted ? ['walked'] : ['walked', 'remaining']
  map.addLayer({
    id: 'outline',
    source,
    type: 'line',
    layout,
    filter: ['in', ['get', 'kind'], ['literal', solidKinds]],
    paint: { 'line-color': outline, 'line-width': overlay.outlineWidth },
  })
  const remainingLayers: [string, string, number][] = aborted
    ? [
        ['remaining-outline', outline, overlay.outlineWidth],
        ['remaining', endpoint, overlay.routeWidth],
      ]
    : [['remaining', endpoint, overlay.routeWidth]]
  for (const [id, color, width] of remainingLayers) {
    map.addLayer({
      id,
      source,
      type: 'line',
      layout,
      filter: ['==', ['get', 'kind'], 'remaining'],
      paint: {
        'line-color': color,
        'line-width': width,
        // Dash lengths are measured in line widths. Align the stroke and its outline.
        ...(aborted && {
          'line-dasharray': [
            'step',
            ['zoom'],
            ['literal', [2.5, 2.75].map((length) => (length * overlay.routeWidth) / width)],
            10,
            ['literal', [2.5, 4.5].map((length) => (length * overlay.routeWidth) / width)],
          ],
        }),
      },
    })
  }
  map.addLayer({
    id: 'walked',
    source,
    type: 'line',
    layout,
    filter: ['==', ['get', 'kind'], 'walked'],
    paint: { 'line-color': routeColor, 'line-width': overlay.routeWidth },
  })
  map.addLayer({
    id: 'endpoint',
    source,
    type: 'circle',
    filter: ['in', ['get', 'kind'], ['literal', ['start', 'finish', 'loop']]],
    paint: {
      'circle-radius': [
        'case',
        ['==', ['get', 'kind'], 'finish'],
        overlay.markerRadius - 1,
        overlay.markerRadius,
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'kind'], 'finish'],
        finishColor(route, aborted),
        endpoint,
      ],
      'circle-stroke-width': overlay.markerStrokeWidth,
      'circle-stroke-color': outline,
    },
  })
  if (route.circular) {
    map.addLayer({
      id: 'endpoint-loop-ring',
      source,
      type: 'circle',
      filter: ['==', ['get', 'kind'], 'loop'],
      paint: {
        'circle-radius':
          overlay.markerRadius + overlay.markerStrokeWidth + overlay.markerStrokeWidth / 2,
        'circle-color': 'transparent',
        'circle-stroke-width': overlay.markerStrokeWidth,
        'circle-stroke-color': finishColor(route, aborted),
      },
    })
  }
}

function addEndpointLabels(
  map: MapInstance,
  Marker: typeof PositionMarker,
  route: PlannedMap,
  aborted: boolean,
) {
  const endpoints = [
    {
      point: route.start,
      name: route.labels.start || (route.circular ? route.labels.finish : undefined),
      color: route.tokens[route.overlay.startColorToken],
    },
    ...(!route.circular
      ? [{ point: route.finish, name: route.labels.finish, color: finishColor(route, aborted) }]
      : []),
  ]
  const markers = endpoints.flatMap(({ point, name, color }) => {
    if (!name) {
      return []
    }
    const element = document.createElement('div')
    element.className = styles.endpointLabelAnchor
    const label = document.createElement('span')
    label.className = styles.endpointLabel
    label.textContent = name
    label.style.color = color
    element.append(label)
    const coordinates = displayPoint(point, route)
    const marker = new Marker({ element }).setLngLat(coordinates).addTo(map)
    return [{ marker, coordinates, label }]
  })
  function positionLabels() {
    const midpoint = map.getCanvas().clientWidth / 2
    for (const { coordinates, label } of markers) {
      label.classList.toggle(styles.endpointLabelLeft, map.project(coordinates).x > midpoint)
    }
  }
  map.on('move', positionLabels)
  map.on('resize', positionLabels)
  positionLabels()
  return () => {
    map.off('move', positionLabels)
    map.off('resize', positionLabels)
    for (const { marker } of markers) {
      marker.remove()
    }
  }
}

function updateMarker(
  marker: PositionMarker,
  map: MapInstance,
  current: ReturnType<typeof features>,
) {
  const position = current.features.find((feature) => feature.properties.kind === 'position')
  if (position?.geometry.type === 'Point') {
    marker.setLngLat(position.geometry.coordinates).addTo(map)
  } else {
    marker.remove()
  }
}

export function RouteMap({
  route,
  progress,
  stalePosition = false,
  completed = false,
  aborted = false,
  areaName,
  hikeId,
  hasMapShareCard,
  overlay,
}: {
  route: PlannedMap
  progress?: TrackingProgress
  stalePosition?: boolean
  completed?: boolean
  aborted?: boolean
  areaName?: string
  hikeId: string
  hasMapShareCard?: boolean
  overlay?: React.ReactNode
}) {
  const t = useTranslations('Site.map')
  const host = useRef<HTMLDivElement>(null)
  const fullscreenHost = useRef<HTMLDivElement>(null)
  const mapFrame = useRef<HTMLDivElement>(null)
  const keepViewport = useRef(false)
  const creditsHeight = useRef(0)
  const [fullscreen, setFullscreen] = useState(false)
  const mapRef = useRef<MapInstance | null>(null)
  const data = useMemo(() => features(route, completed, progress), [route, completed, progress])
  const latest = useRef(data)
  const latestStaleness = useRef(stalePosition)
  const markerRef = useRef<PositionMarker | null>(null)
  const [failed, setFailed] = useState(false)
  const characterShortcutsEnabled = useCharacterShortcutsEnabled()

  function openFullscreen() {
    keepViewport.current = true
    setFullscreen(true)
  }

  usePageShortcut(
    'm',
    () => {
      if (!mapRef.current) {
        return false
      }
      openFullscreen()
    },
    { enabled: !fullscreen && !failed },
  )

  useEffect(() => {
    latest.current = data
    if (markerRef.current && mapRef.current) {
      updateMarker(markerRef.current, mapRef.current, data)
    }
    void mapRef.current?.getSource<GeoJSONSource>(source)?.setData(data)
  }, [data])

  useEffect(() => {
    latestStaleness.current = stalePosition
    const marker = markerRef.current?.getElement()
    marker?.classList.toggle(styles.stalePosition, stalePosition)
    marker?.classList.toggle('live-position-pulse', !stalePosition)
  }, [stalePosition])

  useLayoutEffect(() => {
    const map = mapRef.current
    const target = fullscreen ? fullscreenHost.current : host.current
    if (map && target) {
      target.append(map.getContainer())
      if (fullscreen) {
        map.cooperativeGestures.disable()
      } else if (!map.cooperativeGestures.isEnabled()) {
        map.cooperativeGestures.enable()
      }
      const frame = requestAnimationFrame(() => {
        map.resize()
      })
      return () => {
        cancelAnimationFrame(frame)
      }
    }
  }, [fullscreen])

  useEffect(() => {
    const inlineHost = host.current
    if (!inlineHost || failed) {
      return
    }
    let disposed = false
    let map: MapInstance | undefined
    let stopMarker: PositionMarker | undefined
    let removeOutdoorFacilities: (() => void) | undefined
    let removeEndpointLabels: (() => void) | undefined
    const labelRequests = new AbortController()
    let creditsObserver: ResizeObserver | undefined
    let topography: ReturnType<typeof createTopography> = null

    async function initialize() {
      try {
        const maplibre = await import(/* webpackChunkName: 'hike-map' */ 'maplibre-gl')
        const target = fullscreenHost.current ?? inlineHost
        if (disposed || !target) {
          return
        }
        const { Map, Marker, NavigationControl, setWorkerUrl } = maplibre
        // Let Next serve the worker from the same pinned package as the map bundle.
        setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href)
        const bounds = route.bounds as [Point, Point]
        const style = illustrationPaint(route.style as unknown as StyleSpecification, route.tokens)
        preparePeakLabels(style, terrain)
        prepareOutdoorFacilities(style)
        groupAttribution(style, t('terrainSources'))
        const container = document.createElement('div')
        container.className = `${styles.mapCanvas} h-full w-full`
        target.append(container)
        topography = createTopography(maplibre, contour, terrain, 90_000)
        map = new Map({
          container,
          style,
          attributionControl: { compact: false },
          cooperativeGestures: target === inlineHost,
          bounds,
          fitBoundsOptions: { padding: routePadding, maxZoom: maximumOverviewZoom, duration: 0 },
          locale: {
            'Map.Title': t('title'),
            'AttributionControl.ToggleAttribution': t('attribution'),
            'NavigationControl.ZoomIn': t('zoomIn'),
            'NavigationControl.ZoomOut': t('zoomOut'),
            'CooperativeGesturesHandler.WindowsHelpText': t('scrollZoom', { key: 'Ctrl' }),
            'CooperativeGesturesHandler.MacHelpText': t('scrollZoom', { key: '⌘' }),
            'CooperativeGesturesHandler.MobileHelpText': t('twoFingerPan'),
          },
        })
        const basemap = style.sources.openmaptiles
        map.on('error', ({ error }) => {
          if (basemap.type === 'vector' && 'url' in error && error.url === basemap.url) {
            setFailed(true)
          }
        })
        mapRef.current = map
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
        const element = document.createElement('div')
        element.className = styles.position
        element.classList.toggle(styles.stalePosition, latestStaleness.current)
        element.classList.toggle('live-position-pulse', !latestStaleness.current)
        element.setAttribute('aria-hidden', 'true')
        markerRef.current = new Marker({ element })
        updateMarker(markerRef.current, map, latest.current)
        if (route.stop) {
          const stopElement = document.createElement('div')
          stopElement.className = styles.stop
          stopElement.style.color = route.tokens[route.overlay.startColorToken]
          stopElement.style.setProperty(
            '--stop-outline-color',
            route.tokens[route.overlay.outlineColorToken],
          )
          stopElement.style.setProperty(
            '--stop-outline-width',
            `${String(route.overlay.markerStrokeWidth)}px`,
          )
          stopElement.append(document.createElement('span'))
          stopElement.setAttribute('aria-hidden', 'true')
          stopMarker = new Marker({ element: stopElement })
            .setLngLat(displayPoint(route.stop.coordinates, route))
            .addTo(map)
        }
        const initializedMap = map
        const credits = container.querySelector<HTMLElement>('.maplibregl-ctrl-attrib')
        function reserveCreditsSpace() {
          const height = credits?.offsetHeight ?? 0
          creditsHeight.current = height
          mapFrame.current?.style.setProperty('--map-credits-height', `${String(height)}px`)
          if (!keepViewport.current) {
            fitTrail(initializedMap, bounds, height)
          }
        }
        initializedMap.on('movestart', (event) => {
          if (event.originalEvent) {
            keepViewport.current = true
          }
        })
        if (credits) {
          creditsObserver = new ResizeObserver(reserveCreditsSpace)
          creditsObserver.observe(credits)
        }
        initializedMap.on('style.load', () => {
          addTopography(initializedMap, topography, terrain, route.tokens)
          addLayers(initializedMap, route, latest.current, aborted)
          removeOutdoorFacilities = addOutdoorFacilities(initializedMap, route)
          addDetailLabelLayer(initializedMap, route, labelRequests.signal, areaName)
          removeEndpointLabels = addEndpointLabels(initializedMap, Marker, route, aborted)
          reserveCreditsSpace()
        })
      } catch {
        if (!disposed) {
          setFailed(true)
        }
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect()
        void initialize()
      }
    })
    observer.observe(inlineHost)
    return () => {
      disposed = true
      observer.disconnect()
      creditsObserver?.disconnect()
      labelRequests.abort()
      removeOutdoorFacilities?.()
      removeEndpointLabels?.()
      stopMarker?.remove()
      markerRef.current?.remove()
      markerRef.current = null
      map?.remove()
      map?.getContainer().remove()
      topography?.dispose()
      mapRef.current = null
    }
  }, [aborted, areaName, failed, route, t])

  if (failed) {
    return <MapUnavailable hikeId={hikeId} hasMapShareCard={hasMapShareCard} />
  }

  const summary = overlay && (
    <div className="pointer-events-none absolute top-2 left-2 z-10">{overlay}</div>
  )

  const position = progress?.position
  const centerControl = position && (
    <MediaControl
      action="center"
      label={t('centerOnPosition')}
      onClick={() => {
        const map = mapRef.current
        if (map) {
          keepViewport.current = true
          map.panTo(displayPoint(position.coordinates, route))
        }
      }}
    />
  )
  function showWholeTrail() {
    const map = mapRef.current
    if (map) {
      keepViewport.current = false
      fitTrail(map, route.bounds as [Point, Point], creditsHeight.current)
    }
  }

  const trailControls = (
    <>
      <MediaControl action="overview" label={t('showWholeTrail')} onClick={showWholeTrail} />
      {centerControl}
    </>
  )
  const controlClass = `${styles.bottomControls} absolute right-2 z-10 flex gap-2`

  return (
    <MapFrame ref={mapFrame}>
      <div ref={host} className="absolute inset-0 overflow-hidden bg-cream" />
      {!fullscreen && summary}
      <div className={controlClass}>
        {!fullscreen && trailControls}
        <MediaControl action="expand" label={t('open')} onClick={openFullscreen} />
      </div>
      {fullscreen && (
        <MediaModal
          title={t('title')}
          closeLabel={t('close')}
          keyboardShortcuts={characterShortcutsEnabled ? '0' : undefined}
          onKeyDown={(event) => {
            if (
              characterShortcutsEnabled &&
              event.key === '0' &&
              !event.altKey &&
              !event.ctrlKey &&
              !event.metaKey
            ) {
              event.preventDefault()
              showWholeTrail()
            }
          }}
          onClose={() => {
            setFullscreen(false)
          }}
        >
          <div ref={fullscreenHost} className={`${styles.fullscreenHost} h-full w-full`} />
          {summary}
          <div className={controlClass}>{trailControls}</div>
        </MediaModal>
      )}
    </MapFrame>
  )
}

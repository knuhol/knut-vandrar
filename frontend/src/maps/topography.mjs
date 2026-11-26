export function preparePeakLabels(style, settings) {
  const layer = style.layers.find((layer) => layer.id === 'vandrar-mountain-context')
  if (!layer) {
    return
  }
  layer.filter = ['>=', ['to-number', ['get', 'ele'], 0], settings.peakLabels.minimumElevation]
  layer.layout['symbol-sort-key'] = ['-', 0, ['to-number', ['get', 'ele'], 0]]
  layer.layout['text-padding'] = settings.peakLabels.padding
  layer.layout['text-size'] = settings.peakLabels.fontSize
}

export function createTopography(maplibre, contour, settings, timeoutMs) {
  if (!settings.hillshade.enabled && !settings.contours.enabled) {
    return null
  }
  const dem = new contour.DemSource({
    id: 'vandrar-dem',
    url: settings.provider.url,
    encoding: settings.provider.encoding,
    maxzoom: settings.provider.maxZoom,
    worker: true,
    cacheSize: settings.cacheSize,
    timeoutMs,
  })
  dem.setupMaplibre(maplibre)
  return {
    dem,
    dispose() {
      maplibre.removeProtocol(dem.sharedDemProtocolId)
      maplibre.removeProtocol(dem.contourProtocolId)
    },
  }
}

export function addTopography(map, runtime, settings, tokens) {
  if (!runtime) {
    return
  }
  // Water is painted after relief and isolines, masking them without a second hydro dataset.
  const water = map
    .getStyle()
    .layers.find((layer) => layer.type === 'fill' && layer['source-layer'] === 'water')
  const before = water?.id ?? map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
  if (settings.hillshade.enabled) {
    map.addSource('vandrar-dem', {
      type: 'raster-dem',
      tiles: [runtime.dem.sharedDemProtocolUrl],
      encoding: settings.provider.encoding,
      tileSize: settings.provider.tileSize,
      maxzoom: settings.provider.maxZoom,
    })
    const shade = settings.hillshade
    map.addLayer(
      {
        id: 'vandrar-hillshade',
        type: 'hillshade',
        source: 'vandrar-dem',
        paint: {
          'hillshade-exaggeration': shade.exaggeration,
          'hillshade-illumination-direction': shade.illuminationDirection,
          'hillshade-illumination-anchor': 'map',
          'hillshade-shadow-color': tokens[shade.shadowColorToken],
          'hillshade-highlight-color': tokens[shade.highlightColorToken],
          'hillshade-accent-color': tokens[shade.accentColorToken],
        },
      },
      before,
    )
  }
  if (settings.contours.enabled) {
    const lines = settings.contours
    map.addSource('vandrar-contours', {
      type: 'vector',
      tiles: [
        runtime.dem.contourProtocolUrl({
          thresholds: lines.thresholds,
          contourLayer: 'contours',
          elevationKey: 'ele',
          levelKey: 'level',
          multiplier: 1,
        }),
      ],
      maxzoom: 14,
    })
    map.addLayer(
      {
        id: 'vandrar-contour-lines',
        type: 'line',
        source: 'vandrar-contours',
        'source-layer': 'contours',
        minzoom: lines.minZoom,
        paint: {
          'line-color': [
            'case',
            ['>', ['get', 'level'], 0],
            tokens[lines.majorColorToken],
            tokens[lines.minorColorToken],
          ],
          'line-opacity': [
            'case',
            ['>', ['get', 'level'], 0],
            lines.majorOpacity,
            lines.minorOpacity,
          ],
          'line-width': ['case', ['>', ['get', 'level'], 0], lines.majorWidth, lines.minorWidth],
        },
      },
      before,
    )
    map.addLayer(
      {
        id: 'vandrar-contour-labels',
        type: 'symbol',
        source: 'vandrar-contours',
        'source-layer': 'contours',
        minzoom: lines.minZoom,
        filter: ['>', ['get', 'level'], 0],
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['concat', ['to-string', ['get', 'ele']], ' m'],
          'text-font': ['Noto Sans Regular'],
          'text-size': lines.labelSize,
          'text-padding': lines.labelPadding,
          // Coarse overview contours have sharp vertices; upright labels stay legible.
          'text-max-angle': 180,
          'text-rotation-alignment': lines.labelAlignment,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': tokens[lines.majorColorToken],
          'text-halo-color': tokens.cream,
          'text-halo-width': 1,
          'text-opacity': lines.labelOpacity,
        },
      },
      before,
    )
  }
}

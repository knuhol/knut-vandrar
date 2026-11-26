const mix = (a, b, t) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')

export function illustrationPaint(base, tokens) {
  const style = structuredClone(base)
  delete style.metadata['vandrar:tokens']
  const water = mix(tokens.sage, tokens.paper, 0.52)
  for (const layer of style.layers) {
    const id = layer.id
    const source = layer['source-layer']
    const paint = (layer.paint ??= {})
    if (layer.type === 'background') {
      paint['background-color'] = tokens.cream
    }
    if (layer.type === 'raster') {
      layer.layout = { ...layer.layout, visibility: 'none' }
    }
    if (layer.type === 'fill') {
      if (source === 'water') {
        paint['fill-color'] = water
      } else if (source === 'landcover' || source === 'park') {
        const shade = id.includes('wood') ? 0.73 : id.includes('ice') ? 0.96 : 0.86
        paint['fill-color'] = mix(tokens.sage, tokens.cream, shade)
        paint['fill-opacity'] = 1
      } else if (source === 'landuse') {
        paint['fill-color'] = mix(tokens.beige, tokens.cream, 0.6)
      }
    }
    if (layer.type === 'line') {
      if (source === 'waterway') {
        paint['line-color'] = mix(tokens.sage, tokens.paper, 0.35)
      } else if (source === 'boundary') {
        paint['line-color'] = tokens.sage
        paint['line-opacity'] = 0.35
      } else if (source === 'transportation') {
        paint['line-color'] = id.includes('casing') ? tokens.cream : tokens.beige
        paint['line-opacity'] = 0.65
      } else if (source === 'park') {
        paint['line-color'] = mix(tokens.sage, tokens.cream, 0.65)
      }
    }
    if (layer.type === 'symbol') {
      layer.layout = { ...layer.layout, visibility: 'visible' }
      if (source === 'place' || source === 'water_name' || source === 'waterway') {
        paint['text-color'] = tokens.forest
        paint['text-halo-color'] = tokens.cream
        if (source === 'place') {
          layer.layout['text-padding'] = 12
        } else {
          layer.layout['text-size'] = 10
          layer.layout['text-padding'] = 6
        }
      }
    }
  }

  const name = ['coalesce', ['get', 'name'], ['get', 'name:latin'], '']
  const paint = {
    'text-color': tokens.forest,
    'text-halo-color': tokens.cream,
    'text-halo-width': 1.5,
  }
  style.layers.push(
    {
      id: 'vandrar-mountain-context',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'mountain_peak',
      minzoom: 8,
      layout: {
        'text-field': [
          'case',
          ['!=', name, ''],
          ['concat', '△ ', name, ' · ', ['to-string', ['get', 'ele']]],
          '',
        ],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 12,
      },
      paint,
    },
    {
      id: 'vandrar-area-context',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'park',
      minzoom: 8,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['upcase', name],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
        'text-letter-spacing': 0.08,
        'text-max-width': 16,
        'text-padding': 10,
        'symbol-sort-key': ['to-number', ['get', 'rank'], 999],
      },
      paint,
    },
  )
  return style
}

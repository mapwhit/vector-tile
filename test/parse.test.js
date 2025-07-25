const test = require('node:test');
const fs = require('node:fs');
const Protobuf = require('@mapwhit/pbf');
const { VectorTile, VectorTileLayer, VectorTileFeature } = require('..');

function approximateDeepEqual(a, b, epsilon = 1e-6) {
  if (typeof a !== typeof b) return false;
  if (typeof a === 'number') return Math.abs(a - b) < epsilon;
  if (a === null || typeof a !== 'object') return a === b;

  const ka = Object.keys(a);
  const kb = Object.keys(b);

  if (ka.length !== kb.length) return false;

  return ka.every(key => approximateDeepEqual(a[key], b[key], epsilon));
}

test('parsing vector tiles', async t => {
  const data = fs.readFileSync(`${__dirname}/fixtures/14-8801-5371.vector.pbf`);

  await t.test('should have all layers', t => {
    const tile = new VectorTile(new Protobuf(data));

    t.assert.deepEqual(Object.keys(tile.layers), [
      'landuse',
      'waterway',
      'water',
      'barrier_line',
      'building',
      'landuse_overlay',
      'tunnel',
      'road',
      'bridge',
      'place_label',
      'water_label',
      'poi_label',
      'road_label',
      'waterway_label'
    ]);
  });

  await t.test('should extract the tags of a feature', t => {
    const tile = new VectorTile(new Protobuf(data));

    t.assert.equal(tile.layers.poi_label.length, 558);

    const park = tile.layers.poi_label.feature(11);

    t.assert.deepEqual(park.bbox(), [3898, 1731, 3898, 1731]);

    t.assert.throws(() => tile.layers.poi_label.feature(1e9), 'throws on reading a feature out of bounds');

    t.assert.equal(park.id, 3000003150561);

    t.assert.equal(park.properties.name, 'Mauerpark');
    t.assert.equal(park.properties.type, 'Park');

    // Check point geometry
    t.assert.deepEqual(park.loadGeometry(), [[{ x: 3898, y: 1731 }]]);

    // Check line geometry
    t.assert.deepEqual(tile.layers.road.feature(656).loadGeometry(), [
      [
        { x: 1988, y: 306 },
        { x: 1808, y: 321 },
        { x: 1506, y: 347 }
      ]
    ]);
  });

  await t.test('changing first point of a polygon should not change last point', t => {
    const tile = new VectorTile(new Protobuf(data));

    const building = tile.layers.building.feature(0).loadGeometry();
    t.assert.deepEqual(building, [
      [
        { x: 2039, y: -32 },
        { x: 2035, y: -31 },
        { x: 2032, y: -31 },
        { x: 2032, y: -32 },
        { x: 2039, y: -32 }
      ]
    ]);
    building[0][0].x = 1;
    building[0][0].y = 2;
    building[0][1].x = 3;
    building[0][1].y = 4;
    t.assert.deepEqual(building, [
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 2032, y: -31 },
        { x: 2032, y: -32 },
        { x: 2039, y: -32 }
      ]
    ]);
  });

  await t.test('toGeoJSON', t => {
    const tile = new VectorTile(new Protobuf(data));

    t.assert.ok(
      approximateDeepEqual(tile.layers.poi_label.feature(11).toGeoJSON(8801, 5371, 14), {
        type: 'Feature',
        id: 3000003150561,
        properties: {
          localrank: 1,
          maki: 'park',
          name: 'Mauerpark',
          name_de: 'Mauerpark',
          name_en: 'Mauerpark',
          name_es: 'Mauerpark',
          name_fr: 'Mauerpark',
          osm_id: 3000003150561,
          ref: '',
          scalerank: 2,
          type: 'Park'
        },
        geometry: {
          type: 'Point',
          coordinates: [13.402258157730103, 52.54398925380624]
        }
      })
    );

    t.assert.ok(
      approximateDeepEqual(tile.layers.bridge.feature(0).toGeoJSON(8801, 5371, 14), {
        type: 'Feature',
        id: 238162948,
        properties: {
          class: 'service',
          oneway: 0,
          osm_id: 238162948,
          type: 'service'
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [13.399457931518555, 52.546334844036416],
            [13.399441838264465, 52.546504478525016]
          ]
        }
      })
    );

    t.assert.ok(
      approximateDeepEqual(tile.layers.building.feature(0).toGeoJSON(8801, 5371, 14), {
        type: 'Feature',
        id: 1000267229912,
        properties: {
          osm_id: 1000267229912
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [13.392285704612732, 52.54974045706258],
              [13.392264246940613, 52.549737195107554],
              [13.392248153686523, 52.549737195107554],
              [13.392248153686523, 52.54974045706258],
              [13.392285704612732, 52.54974045706258]
            ]
          ]
        }
      })
    );

    function geoJSONFromFixture(name) {
      const tile = new VectorTile(new Protobuf(fs.readFileSync(`${__dirname}/fixtures/${name}.pbf`)));
      return tile.layers.geojson.feature(0).toGeoJSON(0, 0, 0);
    }

    // https://github.com/mapbox/vector-tile-spec/issues/30
    t.assert.ok(
      approximateDeepEqual(
        geoJSONFromFixture('singleton-multi-point').geometry,
        {
          type: 'Point',
          coordinates: [1, 2]
        },
        1e-1
      )
    );
    t.assert.ok(
      approximateDeepEqual(
        geoJSONFromFixture('singleton-multi-line').geometry,
        {
          type: 'LineString',
          coordinates: [
            [1, 2],
            [3, 4]
          ]
        },
        1e-1
      )
    );
    t.assert.ok(
      approximateDeepEqual(
        geoJSONFromFixture('singleton-multi-polygon').geometry,
        {
          type: 'Polygon',
          coordinates: [
            [
              [1, 0],
              [0, 0],
              [1, 1],
              [1, 0]
            ]
          ]
        },
        1e-1
      )
    );

    t.assert.ok(
      approximateDeepEqual(
        geoJSONFromFixture('multi-point').geometry,
        {
          type: 'MultiPoint',
          coordinates: [
            [1, 2],
            [3, 4]
          ]
        },
        1e-1
      )
    );
    t.assert.ok(
      approximateDeepEqual(
        geoJSONFromFixture('multi-line').geometry,
        {
          type: 'MultiLineString',
          coordinates: [
            [
              [1, 2],
              [3, 4]
            ],
            [
              [5, 6],
              [7, 8]
            ]
          ]
        },
        1e-1
      )
    );
    t.assert.ok(
      approximateDeepEqual(
        geoJSONFromFixture('multi-polygon').geometry,
        {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [1, 0],
                [0, 0],
                [1, 1],
                [1, 0]
              ]
            ],
            [
              [
                [-1, -1],
                [-1, 0],
                [0, 0],
                [-1, -1]
              ]
            ]
          ]
        },
        1e-1
      )
    );

    // https://github.com/mapbox/vector-tile-js/issues/32
    t.assert.ok(
      approximateDeepEqual(
        geoJSONFromFixture('polygon-with-inner').geometry,
        {
          type: 'Polygon',
          coordinates: [
            [
              [2, -2],
              [-2, -2],
              [-2, 2],
              [2, 2],
              [2, -2]
            ],
            [
              [-1, 1],
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1]
            ]
          ]
        },
        1e-1
      )
    );
    t.assert.ok(
      approximateDeepEqual(
        geoJSONFromFixture('stacked-multipolygon').geometry,
        {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [2, -2],
                [-2, -2],
                [-2, 2],
                [2, 2],
                [2, -2]
              ]
            ],
            [
              [
                [1, -1],
                [-1, -1],
                [-1, 1],
                [1, 1],
                [1, -1]
              ]
            ]
          ]
        },
        1e-1
      )
    );
  });
});

test('VectorTileLayer', t => {
  const emptyLayer = new VectorTileLayer(new Protobuf(Buffer.alloc(0)));
  t.assert.ok(emptyLayer, 'can be created with no values');
});

test('VectorTileFeature', t => {
  const emptyFeature = new VectorTileFeature(new Protobuf(Buffer.alloc(0)));
  t.assert.ok(emptyFeature, 'can be created with no values');
  t.assert.ok(Array.isArray(VectorTileFeature.types));
  t.assert.deepEqual(VectorTileFeature.types, ['Unknown', 'Point', 'LineString', 'Polygon']);
});

test('https://github.com/mapbox/vector-tile-js/issues/15', t => {
  const data = fs.readFileSync(`${__dirname}/fixtures/lots-of-tags.vector.pbf`);
  const tile = new VectorTile(new Protobuf(data));
  t.assert.ok(tile.layers['stuttgart-rails'].feature(0));
});

test('https://github.com/mapbox/mapbox-gl-js/issues/1019', t => {
  const data = fs.readFileSync(`${__dirname}/fixtures/12-1143-1497.vector.pbf`);
  const tile = new VectorTile(new Protobuf(data));
  t.assert.ok(tile.layers.water.feature(1).loadGeometry());
});

test('https://github.com/mapbox/vector-tile-js/issues/60', () => {
  const data = fs.readFileSync(`${__dirname}/fixtures/multipolygon-with-closepath.pbf`);
  const tile = new VectorTile(new Protobuf(data));
  for (const id in tile.layers) {
    const layer = tile.layers[id];
    for (let i = 0; i < layer.length; i++) {
      layer.feature(i).loadGeometry();
    }
  }
});

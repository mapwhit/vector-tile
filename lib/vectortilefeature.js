import { Point } from '@mapwhit/point-geometry';

const invPi = 360 / Math.PI;

export class VectorTileFeature {
  static types = ['Unknown', 'Point', 'LineString', 'Polygon'];

  constructor(pbf, end, extent, keys, values) {
    // Public
    this.properties = {};
    this.extent = extent;
    this.type = 0;

    // Private
    this._pbf = pbf;
    this._geometry = -1;
    this._keys = keys;
    this._values = values;

    pbf.readFields(readFeature, this, end);
  }

  loadGeometry() {
    const pbf = this._pbf;
    pbf.pos = this._geometry;

    const end = pbf.readVarint() + pbf.pos;
    let cmd = 1;
    let length = 0;
    let x = 0;
    let y = 0;
    const lines = [];
    let line;

    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 0x7;
        length = cmdLen >> 3;
      }

      length--;

      if (cmd === 1 || cmd === 2) {
        x += pbf.readSVarint();
        y += pbf.readSVarint();

        if (cmd === 1) {
          // moveTo
          if (line) lines.push(line);
          line = [];
        }

        line.push(new Point(x, y));
      } else if (cmd === 7) {
        // Workaround for https://github.com/mapbox/mapnik-vector-tile/issues/90
        if (line) {
          const p = line[0];
          line.push(new Point(p.x, p.y)); // closePolygon
        }
      } else {
        throw new Error(`unknown command ${cmd}`);
      }
    }

    if (line) lines.push(line);

    return lines;
  }

  bbox() {
    const pbf = this._pbf;
    pbf.pos = this._geometry;

    const end = pbf.readVarint() + pbf.pos;
    let cmd = 1;
    let length = 0;
    let x = 0;
    let y = 0;
    let x1 = Number.POSITIVE_INFINITY;
    let x2 = Number.NEGATIVE_INFINITY;
    let y1 = Number.POSITIVE_INFINITY;
    let y2 = Number.NEGATIVE_INFINITY;

    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 0x7;
        length = cmdLen >> 3;
      }

      length--;

      if (cmd === 1 || cmd === 2) {
        x += pbf.readSVarint();
        y += pbf.readSVarint();
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      } else if (cmd !== 7) {
        throw new Error(`unknown command ${cmd}`);
      }
    }

    return [x1, y1, x2, y2];
  }

  toGeoJSON(x, y, z) {
    const size = this.extent * 2 ** z;
    const scale = 360 / size;
    const x0 = this.extent * x;
    const y0 = this.extent * y;
    let coords = this.loadGeometry();
    let type = VectorTileFeature.types[this.type];

    function project(line) {
      for (let j = 0; j < line.length; j++) {
        const p = line[j];
        const lon = (p.x + x0) * scale - 180;
        const y2 = 180 - (p.y + y0) * scale;
        const lat = invPi * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90;
        line[j] = [lon, lat];
      }
    }

    switch (this.type) {
      case 1: {
        const points = new Array(coords.length);
        for (let i = 0; i < coords.length; i++) {
          points[i] = coords[i][0];
        }
        coords = points;
        project(coords);
        break;
      }

      case 2:
        for (let i = 0; i < coords.length; i++) {
          project(coords[i]);
        }
        break;

      case 3:
        coords = classifyRings(coords);
        for (let i = 0; i < coords.length; i++) {
          for (let j = 0; j < coords[i].length; j++) {
            project(coords[i][j]);
          }
        }
        break;
    }

    if (coords.length === 1) {
      coords = coords[0];
    } else {
      type = `Multi${type}`;
    }

    const result = {
      type: 'Feature',
      geometry: {
        type,
        coordinates: coords
      },
      properties: this.properties
    };

    if ('id' in this) {
      result.id = this.id;
    }

    return result;
  }
}

function readFeature(tag, feature, pbf) {
  switch (tag) {
    case 1:
      feature.id = pbf.readVarint();
      break;
    case 2:
      {
        const end = pbf.readVarint() + pbf.pos;
        while (pbf.pos < end) {
          const key = feature._keys[pbf.readVarint()];
          const value = feature._values[pbf.readVarint()];
          feature.properties[key] = value;
        }
      }
      break;
    case 3:
      feature.type = pbf.readVarint();
      break;
    case 4:
      feature._geometry = pbf.pos;
      break;
  }
}

// classifies an array of rings into polygons with outer rings and holes

function classifyRings(rings) {
  const len = rings.length;

  if (len <= 1) return [rings];

  const polygons = [];
  let polygon;
  let ccw;

  for (let i = 0; i < len; i++) {
    const area = signedArea(rings[i]);
    if (area === 0) continue;

    ccw ??= area < 0;

    if (ccw === area < 0) {
      if (polygon) polygons.push(polygon);
      polygon = [rings[i]];
    } else {
      polygon.push(rings[i]);
    }
  }
  if (polygon) polygons.push(polygon);

  return polygons;
}

function signedArea(ring) {
  let sum = 0;
  let to = ring.at(-1);
  for (const from of ring) {
    sum += (to.x - from.x) * (from.y + to.y);
    to = from;
  }
  return sum;
}

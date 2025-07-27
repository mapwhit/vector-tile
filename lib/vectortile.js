import { VectorTileLayer } from './vectortilelayer.js';

export class VectorTile {
  constructor(pbf, end) {
    this.layers = pbf.readFields(readTile, {}, end);
  }
}

function readTile(tag, layers, pbf) {
  if (tag === 3) {
    const layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
    if (layer.length) layers[layer.name] = layer;
  }
}

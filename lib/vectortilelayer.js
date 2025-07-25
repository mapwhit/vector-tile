import { VectorTileFeature } from './vectortilefeature.js';

export class VectorTileLayer {
  constructor(pbf, end) {
    // Public
    this.version = 1;
    this.name = null;
    this.extent = 4096;
    this.length = 0;

    // Private
    this._pbf = pbf;
    this._keys = [];
    this._values = [];
    this._features = [];

    pbf.readFields(readLayer, this, end);

    this.length = this._features.length;
  }

  // return feature `i` from this layer as a `VectorTileFeature`
  feature(i) {
    if (i < 0 || i >= this._features.length) throw new Error('feature index out of bounds');

    this._pbf.pos = this._features[i];

    const end = this._pbf.readVarint() + this._pbf.pos;
    return new VectorTileFeature(this._pbf, end, this.extent, this._keys, this._values);
  }
}

function readLayer(tag, layer, pbf) {
  switch (tag) {
    case 1:
      layer.name = pbf.readString();
      break;
    case 5:
      layer.extent = pbf.readVarint();
      break;
    case 2:
      layer._features.push(pbf.pos);
      break;
    case 3:
      layer._keys.push(pbf.readString());
      break;
    case 4:
      layer._values.push(readValueMessage(pbf));
      break;
    case 15:
      layer.version = pbf.readVarint();
      break;
  }
}

function readValueMessage(pbf) {
  let value = null;
  const end = pbf.readVarint() + pbf.pos;

  while (pbf.pos < end) {
    switch (pbf.readVarint() >> 3) {
      case 1:
        value = pbf.readString();
        break;
      case 2:
        value = pbf.readFloat();
        break;
      case 3:
        value = pbf.readDouble();
        break;
      case 4:
        value = pbf.readVarint64();
        break;
      case 5:
        value = pbf.readVarint();
        break;
      case 6:
        value = pbf.readSVarint();
        break;
      case 7:
        value = pbf.readBoolean();
        break;
      default:
        value = null;
    }
  }

  return value;
}

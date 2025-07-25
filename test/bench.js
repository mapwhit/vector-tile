import fs from 'node:fs';
import Pbf from '@mapwhit/pbf';
import Benchmark from 'benchmark';
import { VectorTile } from '../index.js';

const data = fs.readFileSync(`${import.meta.dirname}/fixtures/14-8801-5371.vector.pbf`);
const suite = new Benchmark.Suite();

readTile(); // output any errors before running the suite
readTile(true);

suite
  .add('read tile with geometries', () => {
    readTile(true);
  })
  .add('read tile without geometries', () => {
    readTile();
  })
  .on('cycle', event => {
    console.log(String(event.target));
  })
  .run();

function readTile(loadGeom) {
  const buf = new Pbf(data);
  const vt = new VectorTile(buf);

  for (const id in vt.layers) {
    const layer = vt.layers[id];
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      if (loadGeom) feature.loadGeometry();
    }
  }
}

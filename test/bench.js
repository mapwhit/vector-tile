const Pbf = require('pbf');
const VectorTile = require('..').VectorTile;
const Benchmark = require('benchmark');
const fs = require('fs');
const suite = new Benchmark.Suite();
const data = fs.readFileSync(__dirname + '/fixtures/14-8801-5371.vector.Pbf');

readTile(); // output any errors before running the suite
readTile(true);

suite
.add('read tile with geometries', function() {
    readTile(true);
})
.add('read tile without geometries', function() {
    readTile();
})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.run();


function readTile(loadGeom, loadPacked) {
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

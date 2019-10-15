// to do:
//
// - pass input and output filenames from CLI
// - add flag for logging

const fs = require('fs');
const JSONStream = require('JSONStream');
const turf = require('@turf/turf');
var argv = require('minimist')(process.argv.slice(2));

if (!argv.i) return console.log('please provide an input file with -i {filename}');
if (!argv.t) return console.log('please provide an input file with -t {filename}');
if (!argv.o) return console.log('please provide an input file with -o {filename');

const input = argv.i;
const tollbooths = argv.t;
const output = argv.o;

const peaje = JSON.parse(fs.readFileSync(tollbooths));

const write = fs.createWriteStream(output);
// append geojson start
write.write('{"type": "FeatureCollection", "features": ');

var closest_way = peaje.features.map((i)=>{ return { way_id: 0, peaje_id: 0, dist: 1  } });

const stream = fs.createReadStream(input).pipe(JSONStream.parse(['features', true]));
// stream in the geojson, edit, and stream it out to a new file
stream.on('data', (data) => {
  for (var i = 0; i < peaje.features.length; i ++){
    const dist = turf.nearestPointOnLine(data, peaje.features[i]).properties.dist;
    if (dist < closest_way[i].dist) {
      closest_way[i].dist = dist;
      closest_way[i].peaje_id = i;
      closest_way[i].way_id = data.properties.id;
    }
  }
});

stream.on('close',((err) => {
  // open up a new stream for the file again
  // now that we know which peaje matches to which way
  const sec_stream = fs.createReadStream(input).pipe(JSONStream.parse(['features', true]));

  sec_stream.on('data', (data) => {
    var match = false;
    for (var i = 0; i < closest_way.length; i ++) {
      if (data.properties.id == closest_way[i].way_id) {
        var match = true;
        if (closest_way[i].dist = 0) {
          console.log('point already existed in w' + data.properties.id);  
          break;
        } 
        const toll = peaje.features[closest_way[i].peaje_id];

        if (data.geometry.coordinates.length <= 2) {
          data.geometry.coordinates.splice(1,0, toll.geometry.coordinates);
        } else {
          // split the string on the intersection
          const split = turf.lineSplit(data, toll).features;
          
          split[0].geometry.coordinates[split[0].geometry.coordinates.length -1] = toll.geometry.coordinates;

          if (split.length > 1) {
            // drop the first point in the coordinate array
            split[1].geometry.coordinates.shift();
            // join the arrays back together
            split[0].geometry.coordinates = split[0].geometry.coordinates.concat(split[1].geometry.coordinates);
          }

          data.geometry.coordinates = split[0].geometry.coordinates;
        }
        console.log('added point to w' + data.properties.id);
      }
      if (match == true) break;
    }
  });
  sec_stream.pipe(JSONStream.stringify()).pipe(write);

  sec_stream.on('close',((err)=>{
    if (err) return console.log(err);
    // add the closing bracket -- this is a shitty way to do this
    // but tired of fighting with stream events
    fs.appendFile(output, '}', (err) => {
      if (err) return console.log(err);
      console.log('ALL DONE <3', output);
    });
  }));
}));

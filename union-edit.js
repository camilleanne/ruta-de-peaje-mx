// to do:
//
// - pass input and output filenames from CLI
// - add flag for logging

const fs = require('fs');
const JSONStream = require('JSONStream');

const input = './data/union-oaxaca.geojson';
const output = './data/union-oaxaca-edited.geojson';

const stream = fs.createReadStream(input).pipe(JSONStream.parse(['features', true]));

let log = {};

// stream in the geojson, edit, and stream it out to a new file
stream.on('data', (data) => {
  let props = data.properties;

  props.id = props.ID_UNION;
  delete props.CALIREPR;
  delete props.ID_UNION;
});

const write = fs.createWriteStream(output);

// append geojson start
write.write('{"type": "FeatureCollection", "features": ');

stream.pipe(JSONStream.stringify()).pipe(write);

// print logs
stream.on('close',((err)=>{
  if (err) return console.log(err);
  console.log(JSON.stringify(log, null, 2));

  // add the closing bracket -- this is a shitty way to do this
  // but tired of fighting with stream events
  fs.appendFile(output, '}', (err) => {
    if (err) return console.log(err);
    console.log('ALL DONE <3');
  });
}));

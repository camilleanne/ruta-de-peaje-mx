// to do:
//
// - pass input and output filenames from CLI
// - add flag for logging


const fs = require('fs');
const JSONStream = require('JSONStream');
const angle = require('@turf/angle');
const bearing = require('@turf/bearing');

const turf = require('@turf/turf')

const input = './data/oaxaca-tiny/mp-tiny-u.geojson';
const output = './data/oaxaca-tiny/mp-tiny-edited.geojson';

const stream = fs.createReadStream(input).pipe(JSONStream.parse(['features', true]));

let vial_output_log = {};
let circular = 0;
let multi = {};
let id_length = 0;

// stream in the geojson, edit, and stream it out to a new file
stream.on('data', (data) => {
  let props = data.properties;

  let member_count = 0;

  if (props.ID_RED1 !== 'N/A') member_count++;
  if (props.ID_RED2 !== 'N/A') member_count++;
  if (props.ID_RED3 !== 'N/A') member_count++;
  if (props.ID_RED4 !== 'N/A') member_count++;
  if (props.ID_RED5 !== 'N/A') member_count++;
  if (props.ID_RED6 !== 'N/A') member_count++;

  props.member_count = member_count;
  if (props.ID_RED1 > id_length) id_length = props.ID_RED1.length;

  if (props.ID_RED1 == props.ID_RED2) props.no_u_turn = 'true';

  //MultiLineString -> LineString
  if (data.geometry.type == 'MultiLineString') {
    if (multi[props.member_count]) multi[props.member_count] ++;
    else multi[props.member_count] = 1;
    props.multi = 'true';
    let coordinates = [];
    for (let i = 0; i < data.geometry.coordinates.length; i ++) {
      coordinates = coordinates.concat(data.geometry.coordinates[i]);
    }
    // console.log(coordinates.length)
    data.geometry.coordinates = coordinates;
    if (props.ID_MAN == 29772) console.log(data.geometry.coordinates)

    data.geometry.type = 'LineString';
  }

  // find the union point (the initial point of the turn)
  let union_idx;
  for (let i = 0; i < data.geometry.coordinates.length; i ++) {
    if (data.geometry.coordinates[i][0] == +props.union_xcoord &&
      data.geometry.coordinates[i][1] == +props.union_ycoord) {
      union_idx = i;
      continue;
    }
  }

  // if there wasn't a match, go through again and find the closest point
  if (!union_idx && union_idx != 0) {
    console.log(data)
    let distance = 100;
    for (var i = 0; i < data.geometry.coordinates.length; i ++) {
      const tmp = turf.distance(turf.point([props.union_xcoord, props.union_ycoord]), turf.point(data.geometry.coordinates[i]));
      if (distance > tmp) {
        distance = tmp;
        union_idx = i;
      }
    }
  }

  // IS THIS THE RIGHT WAY TO SKIP THE STREAM??
  if (!union_idx || union_idx == 0) {
    // console.log('NO UNION:', props.ID_MAN);
    // indicates a CIRCULAR restriction
    if (union_idx == 0) {
      props.union_idx = 'zero';
      props.circular = 'true';
      circular ++;
    } else props.union_idx = 'missing';
  } else if (union_idx) {
    // clip the geometry to around the union
    if (member_count == 2) data.geometry.coordinates = data.geometry.coordinates.slice(union_idx - 1, union_idx + 2);

    props.vertices = data.geometry.coordinates.length;

    if (member_count == 2 && props.vertices == 3) {
      props.from = props.ID_RED1;
      props.via = props.ID_UNION;
      props.to = props.ID_RED2;

      // calculate the bearing of the "entry" line
      const entry_bearing = +bearing.default(data.geometry.coordinates[0], data.geometry.coordinates[1], {normalize: true}).toFixed(3);
      const options = { pivot: data.geometry.coordinates[1] };
      // rotate the turn geometry by the bearing of the entry line so the line points to 0 North
      const rotated = turf.transformRotate(data, 360 - entry_bearing, options);
      // calculate the angle of the turn
      const exit_bearing = bearing.default(rotated.geometry.coordinates[1], rotated.geometry.coordinates[2]).toFixed(3);
      props.bearing = exit_bearing;

      // 0-180 degrees is towards the right
      // -180 - 0 degrees is towards the left
      if (exit_bearing >= -20 && exit_bearing <= 20) props.restriction = 'no_straight_on';
      else if (exit_bearing > 20 && exit_bearing <= 155) props.restriction = 'no_right_turn';
      else if (exit_bearing >= -155 && exit_bearing < -20) props.restriction = 'no_left_turn';
      else if (exit_bearing >= -180 && exit_bearing < -155 || exit_bearing > 155 && exit_bearing <= 180) props.restriction = 'no_u_turn';
      else props.restriction = 'unknown';

      if (vial_output_log[props.restriction]) vial_output_log[props.restriction] ++;
      else vial_output_log[props.restriction] = 1;
    }
  }
  

  // if (vial_output_log['v'+props.vertices]) vial_output_log['v'+props.vertices] ++;
  // else vial_output_log['v'+props.vertices] = 1;
  if (vial_output_log['m'+props.member_count]) vial_output_log['m'+props.member_count] ++;
  else vial_output_log['m'+props.member_count] = 1;
});

const write = fs.createWriteStream(output);

// append geojson start
write.write('{"type": "FeatureCollection", "features": ');

stream.pipe(JSONStream.stringify()).pipe(write);

// print logs
stream.on('close',((err)=>{
  if (err) return console.log(err);
  console.log(JSON.stringify(vial_output_log, null, 2));
  console.log('circular', circular)
  console.log('multi', multi)
  console.log('id_length', id_length)


  // add the closing bracket -- this is a shitty way to do this
  // but tired of fighting with stream events
  fs.appendFile(output, '}', (err) => {
    if (err) return console.log(err);
    console.log('ALL DONE <3');
  });
}));

// to do:
//
// - pass input and output filenames from CLI
// - add flag for logging

const fs = require('fs');
const JSONStream = require('JSONStream');

const input = './data/red-vial.geojson';
const output = './data/red-vial-edited.geojson';

const stream = fs.createReadStream(input).pipe(JSONStream.parse(['features', true]));

let vial_log = {
  '1': {},
  '2': {},
  '3': {},
  '4': {},
  '5': {}
};
let vial_output_log = {};

// stream in the geojson, edit, and stream it out to a new file
stream.on('data', (data) => {
  let props = data.properties;

  props.id = +props.ID_RED.toString();

  // highway type logging by visualization scale
  if (vial_log[props.ESCALA_VIS][props.TIPO_VIAL]) vial_log[props.ESCALA_VIS][props.TIPO_VIAL] ++;
  else vial_log[props.ESCALA_VIS][props.TIPO_VIAL] = 1;

  // delete extra props
  delete props.CODIGO;
  delete props.ADMINISTRA;
  delete props.JURISDI;
  delete props.CALIREPR;
  delete props.FECHA_ACT;
  delete props.ESTATUS;

  // NOMBRE -> name
  props.name = props.NOMBRE;
  delete props.NOMBRE;
  if (props.name == 'N/A') delete props.name;
  if (props.name == 'N/D') delete props.name;

  // PEAJE -> toll
  props.toll = props.PEAJE;
  delete props.PEAJE;
  props.toll = props.toll == 'Si' ? 'yes' : 'no';

  // NIVEL -> level
  props.level = props.NIVEL;
  delete props.NIVEL;

  // CARRILES -> lanes
  // cast to int from string
  props.lane = props.CARRILES;
  delete props.CARRILES;
  if (props.lane == 'N/A') delete props.lane;
  props.lane = +props.lane;

  // ANCHO -> width
  props.width = props.ANCHO;
  delete props.ANCHO;
  if (props.width == 'N/A') delete props.width;

  // TIPO_VIAL -> highway
  // classify highway type by visualization level
  props.highway = props.TIPO_VIAL.toString();
  // keep TIPO_VIAL around for testing
  // delete props.TIPO_VIAL;
  if (props.highway == 'Rampa de frenado') props.highway = 'escape';
  else if (props.highway == 'Peatonal' || props.highway == 'Vereda' || props.highway == 'Andador') props.highway = 'pedestrian';
  else if (props.highway == 'Otro') props.highway = 'road';
  // road ramps 
  else if (props.highway == 'Enlace') {
    if (props.ESCALA_VIS == 1) props.highway = 'trunk-link';
    if (props.ESCALA_VIS == 2) props.highway = 'primary-link';
    if (props.ESCALA_VIS == 3) props.highway = 'secondary-link';
    if (props.ESCALA_VIS == 4) props.highway = 'tertiary-link';
    if (props.ESCALA_VIS == 5) props.highway = 'tertiary-link';
  } else {
    if (props.highway == 'Glorieta') props.junction = 'roundabout';
    else if (props.highway == 'Callejón') props.service = 'alley';

    if (props.highway == 'Carretera' &&
      props.ESCALA_VIS == 1 &&
      props.toll == 'yes') {
      props.highway = 'motorway';
    }
    else if (
      (props.highway == 'Carretera' ||
        props.highway == 'Calle' ||
        props.highway == 'Periférico' ||
        props.highway == 'Circunvalación') &&
      props.ESCALA_VIS == 1 &&
      props.toll == 'no') {
      props.highway = 'trunk';
    }
    else if (props.ESCALA_VIS = 1) props.highway = 'primary';
    else if (props.ESCALA_VIS = 2) props.highway = 'secondary';
    else if (props.ESCALA_VIS = 3) props.highway = 'tertiary';
    else if (props.ESCALA_VIS = 4) props.highway = 'unclassified';
    else if (props.ESCALA_VIS = 5) props.highway = 'unclassified';
  }

  if (props.CONDICION == 'En construcción - abierto') {
    props.construction = 'minor';
  }
  else if (props.CONDICION == 'En construcción - cerrado') {
    props.construction = props.highway.toString();
    props.highway = 'construction';
  }
  delete props.CONDICION;

  // output highway type logging
  if (vial_output_log[props.highway]) vial_output_log[props.highway] ++;
  else vial_output_log[props.highway] = 1;

  // VELOCIDAD -> maxspeed
  // cast to int from string
  props.maxspeed = props.VELOCIDAD;
  delete props.VELOCIDAD;
  if (props.maxspeed == 'N/A') delete props.width;
  props.maxspeed = +props.maxspeed;

  // CIRCULA -> oneway
  props.oneway = props.CIRCULA;
  delete props.CIRCULA;
  if (props.oneway == 'Un sentido') props.oneway = 'yes';
  else delete props.oneway;
  // else if (props.oneway == 'Dos sentidos') props.oneway = 'no';
  // else if (props.oneway == 'Cerrada en ambos sentidos') delete props.oneway;
  // else if (props.oneway == 'N/A') delete props.oneway;

  // COND_PAV -> surface
  // classify surface by RECUBRI as well
  props.surface = props.COND_PAV;
  delete props.COND_PAV;
  if (props.surface == 'Con pavimento') props.surface = 'paved';
  else if (props.surface == 'Sin pavimento') props.surface = 'unpaved';
  else delete props.surface;

  if (props.RECUBRI == 'Asfalto') props.surface = 'asphalt';
  else if (props.RECUBRI == 'Concreto') props.surface = 'concrete';
  else if (props.RECUBRI == 'Grava') props.surface = 'gravel';
  else if (props.RECUBRI == 'Tierra') props.surface = 'ground';

  delete props.RECUBRI;
});

const write = fs.createWriteStream(output);

// append geojson start
write.write('{"type": "FeatureCollection", "features": ');

stream.pipe(JSONStream.stringify()).pipe(write);

// print logs
stream.on('close',((err)=>{
  if (err) return console.log(err);
  console.log(JSON.stringify(vial_log, null, 2));
  console.log(JSON.stringify(vial_output_log, null, 2));

  // add the closing bracket -- this is a shitty way to do this
  // but tired of fighting with stream events
  fs.appendFile(output, '}', (err) => {
    if (err) return console.log(err);
    console.log('ALL DONE <3');
  });
}));

const fs = require('fs')

const L = require('@turf/length');

var argv = require('minimist')(process.argv.slice(2));
if (!argv.i) return console.log('please provide an input file with -i {filename}');
if (!argv.o) return console.log('please provide an input file with -o {filename');

const input = argv.i;
const output = argv.o;

const tarifas = JSON.parse(fs.readFileSync('./data/tarifas.geojson').toString())
const peajes = JSON.parse(fs.readFileSync(input).toString())

for (var i = 0; i < peajes.features.length; i++) {
  let peaje = peajes.features[i]
  const id = peaje.properties.ID_PLAZA;

  delete peaje.properties.SECCION;
  delete peaje.properties.SUBSECCION;
  delete peaje.properties.FUNCIONAL;
  delete peaje.properties.ADMINISTRA;
  delete peaje.properties.CALIREPR;
  

  for (var j = 0; j < tarifas.features.length; j++) {
    const tarifa = tarifas.features[j]

    const id_start = tarifa.properties.ID_PLAZA_E
    const id_end = tarifa.properties.ID_PLAZA

    if (id == id_start && id == id_end) {
      
      peaje.properties.TYPE = 'entry'
      peaje.properties.barrier = 'toll_booth';
      peaje.properties.fee = tarifa.properties.T_AUTO;

      peaje.properties.name = peaje.properties.NOMBRE
      delete peaje.properties.NOMBRE

      if (peaje.properties.MODALIDAD == 'Abierto') {
         peaje.properties.open = 'yes'
      } else if (peaje.properties.MODALIDAD == 'Mixto') {
         peaje.properties.open = 'mixed'
      } else {
         peaje.properties.open = 'no'
      }
      delete peaje.properties.MODALIDAD;
    }
  }
}

fs.writeFileSync(output,JSON.stringify(peajes,null,2));

console.log('ALL DONE <3:', output);


const fs = require('fs')

const L = require('@turf/length');

const tarifas = JSON.parse(fs.readFileSync('./data/tarifas.geojson').toString())
const peajes = JSON.parse(fs.readFileSync('./data/plaza_cobro-oaxaca.geojson').toString())

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
      peaje.properties.barrier = 'toll-booth';
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

fs.writeFileSync('./data/tarifas-entry-merged-oaxaca.geojson',JSON.stringify(peajes,null,2))

# project "new peaje map for mexico"

### goal:
* Make a map that can calculate the cost of toll roads
  * Convert the mexican road network to OSM friendly data for import to OSRM
  * Build a home for it so I (and other people) can use it

### why? 
* because the current peaje cobro calculation website is bad and always down -- it's put out by the government and it's trying, but I don't think it gets much love.
* trying to make it better
* trying to relearn everything I forgot about mapping
* I always wanted to futz with OSRM

### to do:
* give the project a name
* tidy up the data processing (this stuff)
* build the back end
* build the front end
  * make new map tiles from the data 
* figure out how much it'll cost to host the osrm instance
* figure out what changes need to be made to `OSRM-backend` to calculate tolls
* write tests
* open tickets for all this instead of having it in the readme

## Data Processing:

### Download data
From [INEGI](https://www.inegi.org.mx/app/biblioteca/ficha.html?upc=889463674641)


```
curl -o ./data/red_vial_nacional.zip http://internet.contenidos.inegi.org.mx/contenidos/Productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/caminos/2018/889463674641_s.zip

tar xvf ./data/red_vial_nactional.zip -C ./data/
```

### RED_VIAL (road network)

#### Convert to geojson and reproject to WGS84

`ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 ./data/red_vial.geojson ./data/conjunto_de_datos/red_vial.shp`


<!-- -s_srs EPSG:42310  -->

Note: ogr2ogr will kick out a warning. ignore and it'll finish anyways -- the .prj files have a weird addition of `,AUTHORITY["INEGI",200008]` that's throwing off ogr2ogr.

this is technically unecessary, and makes the files large and difficult to move -- I could do the tag editing from the `shp` files using ogr2osm, but geojson is significantly easier to read, and the workflow is faster than importing into QGIS to verify changes.

To pull out a smaller test area (city of Oaxaca):

`ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 -clipdst -96.2815845252 16.6653639064 -97.1650256074 17.4549186072 ./data/red_vial-oaxaca.geojson ./data/conjunto_de_datos/red_vial.shp`


#### Edit tags
  run `esp-to-osm-stream.js`:
  
  ``` 
  removes CODIGO, ADMINISTRA, JURISDI, CALIREPR, FECHA_ACT, ESTATUS

  NOMBRE -> name
  PEAJE -> toll
  NIVEL -> layer
  CARRILES -> lanes
  ANCHO -> width
  TIPO_VIAL -> highway // further classification of highway tag by ESCALA_VIS
  VELOCIDAD -> maxspeed
  CIRCULA -> oneway
  COND_PAV -> surface
  ```

### convert to .shp for easy loading in qgis
  ```
  ogr2ogr -f "ESRI Shapefile" ./data/red-vial-edited.shp ./data/red-vial-edited.geojson

  // note will cut key names to 10 characters ('construction' -> 'constructi')
  ```
### convert to .osm for OSRM
  `python3 ogr2osm.py ../data/red-vial-edited.geojson`
 
  * ~issues with ids -- why are they all negative? to keep out of osm id space? need to see if I can use id of geojson way as osm way id. I may need the original id's to integrate the plazas de peaje~
    * use `red-vial` branch of [ogr2osm](https://github.com/camilleanne/ogr2osm/)
    * this branch will keep all original IDs, any any generated IDs will be cast as negative.
    * there will need to be an extra renumber step using osmium because OSRM doesn't like negative ids: https://github.com/Project-OSRM/osrm-backend/issues/5068#issuecomment-387508689
  * oneways -- everything seems ok in qgis -- oneways look like oneways going in the right direction, but need to confirm
  * to run the entire country from geojson is going to take... forever. need a bigger instance (running out of memory, not CPU)

### PLAZA_COBRO (toll booths)

needs to be combined with the tarifas. There are two types of tarifas -- on entry, and by distance. A tarifa on entry will have the same value for both entry and exit plazas.

`ogr2ogr -f "CSV" ./data/tarifas.csv ./data/conjunto_de_datos/tarifas.dbf -oo ENCODING=UTF-8`
`ogr2ogr -f "GeoJSON" ./data/tarifas.geojson ./data/conjunto_de_datos/tarifas.dbf -oo ENCODING=UTF-8`

#### to geojson

`ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 ./data/plaza_cobro.geojson ./data/conjunto_de_datos/plaza_cobro.shp`

for Oaxaca only:

`ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 -clipdst -96.2815845252 16.6653639064 -97.1650256074 17.4549186072 ./data/plaza_cobro-oaxaca.geojson ./data/conjunto_de_datos/plaza_cobro.shp`

### UNION (important for the maniobra_prohibda)

...

#### to geojson

`ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 ./data/union.geojson ./data/conjunto_de_datos/union.shp`

for Oaxaca only:

`ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 -clipdst -96.2815845252 16.6653639064 -97.1650256074 17.4549186072 ./data/union-oaxaca.geojson ./data/conjunto_de_datos/union.shp`


### MANIOBRA_PROHIBIDA

Turn restrictions -- these needs to become relations on the ways of the `RED_VIAL`

`ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 ./data/maniobra_prohibida.geojson ./data/conjunto_de_datos/maniobra_prohibida.shp`

for Oaxaca only:

`ogr2ogr -f "GeoJSON" -t_srs EPSG:4326 -clipdst -96.2815845252 16.6653639064 -97.1650256074 17.4549186072 ./data/maniobra_prohibida-oaxaca.geojson ./data/conjunto_de_datos/maniobra_prohibida.shp`

#### merge `maniobra_prohibida` with `union` in QGIS

* open `union`
* `vector` -> `geometry tools` -> `add geometry attributes`
* merge `maniobra_prohibida` with `union` on `id_union`
* export `maniobra_prohibida` before running `maniobra_prohibida-stream.js`

node maniobra_prohibida-stream.js -i ./data/maniobra_prohibida-oaxaca-union.geojson -o ./data/maniobra_prohibida-oaxaca-edited.geojson

* these restrictions do not include any sort of field for type of restriction. OSM requires one of: `no_right_turn`, `no_left_turn`, `no_u_turn`, `no_straight_on`, `only_right_turn`, `only_left_turn`, `only_straight_on`, `no_entry`, or `no_exit`. A restriction consists of a `from` member, 1 or more `via` members, and a `to` member. 
* also only one node is every implicated in the restriction, regardless of number of ways involved. A heuristic for determining if the `via` should be the `union` node or multiple ways is number of implicated ways (have to count ways with `"N/A"` values)
* A hueristic for assuming type of restriction is turn angle and number of members in the restriction. A simple restriction of two members and an angle of 90 is `no_right_turn`.

NOTE: there's a massive problem with the turn restrictions in the data set. The union nodes have a range of 0 to over 1000000, but the referenced nodes in the turn restrictions data limits the id to 6 digits.

how to turn a geojson into a relations file???


### docker and osrm:
```
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/oaxaca.osm

docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/oaxaca.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/oaxaca.osrm

docker run -t -i -p 5000:5000 -v "${PWD}:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/oaxaca.osrm
```
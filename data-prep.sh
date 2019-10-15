# /bin/sh

REGION="guadalajara"
COORDINATES="-103.87847900390625 20.948614979019347 -102.74139404296875 20.360077646657153"

# REGION="oaxaca"
# COORDINATES="-96.82147979736 17.34146252563 -97.0195770263 17.24115372398"

# 1. extract red-vial
echo "extracting road network"

ogr2ogr -f "GeoJSON" \
  -t_srs EPSG:4326 \
  -clipdst $COORDINATES \
  ./data/red_vial-$REGION.geojson \
  ./data/conjunto_de_datos/red_vial.shp

# 2. extract plaza-cobro
echo "extracting toll booths"

ogr2ogr \
  -f "GeoJSON" \
  -t_srs EPSG:4326 \
  -clipdst $COORDINATES \
  ./data/plaza_cobro-$REGION.geojson \
  ./data/conjunto_de_datos/plaza_cobro.shp

# 3. extract union
echo "extracting unions"

ogr2ogr \
  -f "GeoJSON" \
  -t_srs EPSG:4326 \
  -clipdst $COORDINATES \
  ./data/union-$REGION.geojson \
  ./data/conjunto_de_datos/union.shp

# 4. Process files:
echo "first pass on files"

node scripts/esp-to-osm-stream.js \
  -i ./data/red_vial-$REGION.geojson \
  -o ./data/red_vial-$REGION-edited.geojson

node scripts/union-edit.js \
  -i ./data/union-$REGION.geojson \
  -o ./data/union-$REGION-edited.geojson

node scripts/combine-plaza-tarifa.js \
  -i ./data/plaza_cobro-$REGION.geojson \
  -o ./data/plaza_cobro-$REGION-merged.geojson

# 5. merge peajes into ways
echo "merge peajes into ways"

node scripts/insert-tollbooth-into-way.js \
  -i ./data/red_vial-$REGION-edited.geojson \
  -t ./data/plaza_cobro-$REGION-merged.geojson \
  -o ./data/red_vial-$REGION-edited-split.geojson

# 6. merge it all
echo "merging"

geojson-merge \
  ./data/plaza_cobro-$REGION-merged.geojson \
  ./data/union-$REGION-edited.geojson \
  ./data/red_vial-$REGION-edited-split.geojson > ./data/$REGION-ALL.geojson

cp ./data/red_vial-$REGION-edited.geojson ./data/$REGION-ALL.geojson

echo "merged"

# # 6. convert to OSM
echo "ogr2osm start"

python3 ./ogr2osm/ogr2osm.py -f ./data/$REGION-ALL.geojson

echo "ogr2osm end"

# # 7. renumber all the negative node ids:
echo "osmium start"

osmium sort -O -o $REGION-ALL-sort.osm $REGION-ALL.osm

osmium renumber -O --object-type=node -o $REGION-ALL-renum.osm $REGION-ALL-sort.osm 

echo "osmium end"

# OSRM and DOCKER

# docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract --small-component-size 1 -p ./car.lua /data/$REGION-ALL-renum.osm

# docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/$REGION-ALL-renum.osrm
# docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/$REGION-ALL-renum.osrm

# docker run -t -i -p 5000:5000 -v "${PWD}:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/$REGION-ALL-renum.osrm

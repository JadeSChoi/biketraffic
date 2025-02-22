mapboxgl.accessToken = 'pk.eyJ1IjoiamFkZWNob2k3MjciLCJhIjoiY203Zm5haG92MDI3cjJycHJrNjJkdHllMCJ9.vZpXYB_tLFx-rwdFzFPydw';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

// ✅ Select the SVG element and initialize stations array BEFORE fetching data
const svg = d3.select('#map').select('svg');
let stations = []; // This will be updated once data is fetched

map.on('style.load', () => { 
  console.log("✅ Map style loaded!");

  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4
    }
  });

  map.addSource('cambridge_bike_lanes', {
    type: 'geojson',
    data: 'https://data.cambridgema.gov/api/geospatial/gb5w-yva3?method=export&format=GeoJSON'
  });

  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_bike_lanes',
    paint: {
      'line-color': 'blue', 
      'line-width': 3,
      'line-opacity': 0.6
    }
  });

  console.log("✅ Cambridge bike lanes added!");
});

map.on('load', () => {
  console.log("✅ Map fully loaded!");

  const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
  
  d3.json(jsonurl)
    .then(jsonData => {
      console.log('✅ Loaded JSON Data:', jsonData);

      // ✅ Update the global `stations` variable with fetched data
      stations = jsonData.data.stations;
      console.log('✅ Stations Array:', stations.slice(0, 5)); // Debugging

      // ✅ Append circles for each station
      const circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', 5)               // Radius of the circle
        .attr('fill', 'steelblue')  // Circle fill color
        .attr('stroke', 'white')    // Circle border color
        .attr('stroke-width', 1)    // Circle border thickness
        .attr('opacity', 0.8);

      console.log("✅ Bike station circles added!");

      // ✅ Initial positioning of circles
      updatePositions(circles);

      // ✅ Update positions when the map moves/zooms
      map.on('move', () => updatePositions(circles));
      map.on('zoom', () => updatePositions(circles));
      map.on('resize', () => updatePositions(circles));
      map.on('moveend', () => updatePositions(circles));
    })
    .catch(error => {
      console.error('❌ Error loading JSON:', error);
    });
});

// ✅ Function to convert lat/lon to screen coordinates
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// ✅ Function to update circle positions dynamically
function updatePositions(circles) {
  circles
    .attr("cx", d => getCoords(d).cx)  
    .attr("cy", d => getCoords(d).cy);
}
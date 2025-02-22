// Set your Mapbox access token here
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

map.on('style.load', () => { 
    //code 

  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
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
    // Load the nested JSON file
    const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json"
    d3.json(jsonurl).then(jsonData => {
      console.log('Loaded JSON Data:', jsonData);  // Log to verify structure
      const stations = jsonData.data.stations;
      console.log('✅ Stations Array:', stations);
    }).catch(error => {
      console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
    });
  });
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

const svg = d3.select('#map').append('svg');
let stations = [];  // Initialize an empty array to store station data

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
    const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
    const trafficUrl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";

    d3.json(jsonurl).then(jsonData => {
        console.log('✅ Loaded JSON Data:', jsonData);
        stations = jsonData.data.stations;
        console.log('✅ Stations Array:', stations);

        // ✅ Draw initial station circles
        const circles = svg.selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', 5)               // Default size before traffic data
            .attr('fill', 'steelblue')  // Color
            .attr('stroke', 'white')    // Border color
            .attr('stroke-width', 1)    // Border thickness
            .attr('opacity', 0.8);      // Transparency

        console.log("✅ Bike station circles added!");

        function updatePositions() {
            circles
                .attr('cx', d => getCoords(d).cx)
                .attr('cy', d => getCoords(d).cy);
        }

        // Initial position update when map loads
        updatePositions();

        // Attach event listeners to dynamically update positions
        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);

        // ✅ Now fetch traffic data
        return d3.csv(trafficUrl);

    }).then(trips => {
        console.log("✅ Loaded Traffic Data:", trips.slice(0, 5));

        // ✅ Compute traffic metrics for each station
        const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
        const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

        stations = stations.map(station => {
            let id = station.short_name;
            station.departures = departures.get(id) ?? 0;
            station.arrivals = arrivals.get(id) ?? 0;
            station.totalTraffic = station.departures + station.arrivals;
            return station;
        });

        console.log("✅ Updated Station Traffic Data:", stations.slice(0, 5));

        // ✅ Define the radius scale
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, d => d.totalTraffic)])
            .range([0, 25]);

        // ✅ Resize circles based on traffic
        svg.selectAll('circle')
            .transition().duration(500)
            .attr("r", d => radiusScale(d.totalTraffic));
        
        const circles = svg.selectAll('circle')

        .each(function(d) {
             // Add <title> for browser tooltips
            d3.select(this)
            .append('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });

    }).catch(error => {
        console.error('❌ Error loading traffic CSV:', error);  
    });  // ✅ CLOSES .then(trips => {...})

}); // ✅ Closes map.on('load', () => {...})

// ✅ Function to convert longitude/latitude to map coordinates
function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}
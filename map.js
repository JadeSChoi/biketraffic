mapboxgl.accessToken = 'pk.eyJ1IjoiamFkZWNob2k3MjciLCJhIjoiY203Zm5haG92MDI3cjJycHJrNjJkdHllMCJ9.vZpXYB_tLFx-rwdFzFPydw';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

// A quantize scale to map a continuous ratio [0,1] to three discrete values
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

// Append an SVG overlay to the map container
const svg = d3.select('#map').append('svg');

// Global variables to hold data and current time filter
let stations = [];  
let trips = [];
let timeFilter = -1;  

// Select slider and display elements (make sure your HTML IDs match these)
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

// Helper: Format minutes into a time string (HH:MM AM/PM)
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

let updateScatterPlotFn;

// When the slider moves, update the display and scatterplot
function updateTimeDisplay() {
  timeFilter = Number(timeSlider.value);
  
  if (timeFilter === -1) {
    selectedTime.textContent = '';
    anyTimeLabel.style.display = 'block';
  } else {
    selectedTime.textContent = formatTime(timeFilter);
    anyTimeLabel.style.display = 'none';
  }
  
  // Update the visualization (scatterplot) based on the selected time filter
  if (updateScatterPlotFn) {
    updateScatterPlotFn(timeFilter);
}
timeSlider.addEventListener('input', updateTimeDisplay);

// Helper: Convert a Date object to minutes since midnight
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Compute traffic at each station using d3.rollup for departures and arrivals
function computeStationTraffic(stations, tripsSubset) {
  const departures = d3.rollup(
    tripsSubset,
    v => v.length,
    d => d.start_station_id
  );
  
  const arrivals = d3.rollup(
    tripsSubset,
    v => v.length,
    d => d.end_station_id
  );
  
  return stations.map(station => {
    let id = station.short_name;
    return {
      ...station,
      arrivals: arrivals.get(id) ?? 0,
      departures: departures.get(id) ?? 0,
      totalTraffic: (arrivals.get(id) ?? 0) + (departures.get(id) ?? 0)
    };
  });
}

// Filter trips based on the selected time (within ±60 minutes)
function filterTripsByTime(trips, timeFilter) {
  return timeFilter === -1 ? trips : trips.filter(trip => {
    const startedMinutes = minutesSinceMidnight(trip.started_at);
    const endedMinutes = minutesSinceMidnight(trip.ended_at);
    return (
      Math.abs(startedMinutes - timeFilter) <= 60 ||
      Math.abs(endedMinutes - timeFilter) <= 60
    );
  });
}

// Add bike lanes (Boston and Cambridge) once the map style loads
map.on('style.load', () => { 
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

// Once the map has loaded, fetch station and traffic data
map.on('load', () => {
  const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
  const trafficUrl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
  
  d3.json(jsonurl).then(jsonData => {
    return d3.csv(trafficUrl).then(loadedTrips => {
      // Convert trip time strings into Date objects
      trips = loadedTrips.map(trip => ({
        ...trip,
        started_at: new Date(trip.started_at),
        ended_at: new Date(trip.ended_at)
      }));
      console.log("✅ Trips Loaded:", trips.slice(0, 5));
      
      // Compute station traffic using all trips (initially no filtering)
      stations = computeStationTraffic(jsonData.data.stations, trips);
      console.log('✅ Stations Traffic Computed:', stations);
      
      // Define a square-root scale for circle radii based on total traffic.
      // (The range will be updated dynamically when filtering.)
      const radiusScale = d3.scaleSqrt()
          .domain([0, d3.max(stations, d => d.totalTraffic)])
          .range([2, 25]);
      
      // Create initial circle markers for each station using D3.
      // Use a key function (d.short_name) so that D3 tracks elements.
      const circles = svg.selectAll('circle')
        .data(stations, d => d.short_name)
        .enter()
        .append('circle')
        .attr('r', d => radiusScale(d.totalTraffic))
        .attr('fill', 'steelblue')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        // Set the custom property for traffic flow color (see Step 6)
        .style('--departure-ratio', d => d.totalTraffic ? stationFlow(d.departures / d.totalTraffic) : 0.5)
        .each(function(d) {
          d3.select(this)
            .append('title')
            .text(`${d.totalTraffic || 0} trips (${d.departures || 0} departures, ${d.arrivals || 0} arrivals)`);
        });
      
      // Helper: Update circle positions based on current map view using Mapbox's projection.
      function updatePositions() {
        circles
          .attr('cx', d => getCoords(d).cx)
          .attr('cy', d => getCoords(d).cy);
      }
      updatePositions();
      map.on('move', updatePositions);
      map.on('zoom', updatePositions);
      map.on('resize', updatePositions);
      map.on('moveend', updatePositions);
      
      // Define updateScatterPlot() inside map.on('load') so it has access to loaded data.
      function updateScatterPlot(timeFilter) {
        // Filter trips based on the slider value.
        const filteredTrips = filterTripsByTime(trips, timeFilter);
        // Recompute station traffic using the filtered trips.
        const filteredStations = computeStationTraffic(stations, filteredTrips);
        
        // Dynamically adjust the radius scale range.
        if (timeFilter === -1) {
          radiusScale.range([2, 25]);
        } else {
          radiusScale.range([3, 50]);
        }
        
        // Re-bind the filtered station data to the circles using the key function.
        const updatedCircles = svg.selectAll('circle')
          .data(filteredStations, d => d.short_name);
        
        updatedCircles
          .join('circle')
          .transition().duration(500)
          .attr('r', d => radiusScale(d.totalTraffic))
          .attr('fill', 'steelblue')
          .attr('stroke', 'white')
          .attr('stroke-width', 1)
          .attr('opacity', 0.8)
          .style('--departure-ratio', d => d.totalTraffic ? stationFlow(d.departures / d.totalTraffic) : 0.5);
        
        // Update tooltips with the new traffic counts.
        updatedCircles.each(function(d) {
          let circle = d3.select(this);
          let title = circle.select("title");
          if (title.empty()) {
            title = circle.append("title");
          }
          title.text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });
      }
      
      // Initially call updateScatterPlot() so that the visualization reflects all trips.
      updateScatterPlot(timeFilter);
      updateScatterPlotFn = updateScatterPlot;

      
    });
  }).catch(error => console.error('❌ Error loading data:', error));
});

// Helper: Convert station lon/lat to pixel coordinates using Mapbox’s project() function.
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}
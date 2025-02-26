mapboxgl.accessToken = 'pk.eyJ1IjoiamFkZWNob2k3MjciLCJhIjoiY203Zm5haG92MDI3cjJycHJrNjJkdHllMCJ9.vZpXYB_tLFx-rwdFzFPydw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027], 
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);


const svg = d3.select('#map').append('svg');
let stations = [];  
let trips = [];
let timeFilter = -1;  

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');


function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);  // ✅ Global update

    if (timeFilter === -1) {
      selectedTime.textContent = '';  
      anyTimeLabel.style.display = 'block';  
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }
    updateScatterPlot(timeFilter);  // ✅ Updates visualization
}



timeSlider.addEventListener('input', updateTimeDisplay);

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function computeStationTraffic(stations, trips) {
    const departures = d3.rollup(
        trips, 
        (v) => v.length, 
        (d) => d.start_station_id
    );

    const arrivals = d3.rollup(
        trips, 
        (v) => v.length, 
        (d) => d.end_station_id
    );

    return stations.map((station) => {
        let id = station.short_name;
        return {
            ...station,
            arrivals: arrivals.get(id) ?? 0,  
            departures: departures.get(id) ?? 0,  
            totalTraffic: (arrivals.get(id) ?? 0) + (departures.get(id) ?? 0)  
        };
    });
}


function filterTripsByTime() {
    filteredTrips = timeFilter === -1 ? trips : trips.filter(trip => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        return (
            Math.abs(startedMinutes - timeFilter) <= 60 ||
            Math.abs(endedMinutes - timeFilter) <= 60
        );
    });

    const filteredArrivals = d3.rollup(filteredTrips, v => v.length, d => d.end_station_id);
    const filteredDepartures = d3.rollup(filteredTrips, v => v.length, d => d.start_station_id);

    filteredStations = stations.map(station => {
        let id = station.short_name;
        return {
            ...station,
            arrivals: filteredArrivals.get(id) ?? 0,
            departures: filteredDepartures.get(id) ?? 0,
            totalTraffic: (filteredArrivals.get(id) ?? 0) + (filteredDepartures.get(id) ?? 0)
        };
    });

    updateCircles();
}


function updateCircles() {
    const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);

    const circles = svg.selectAll('circle')
        .data(filteredStations, d => d.short_name);

    circles.join('circle')
        .transition().duration(500)
        .attr("r", d => radiusScale(d.totalTraffic))
        .style("--departure-ratio", d => 
            d.totalTraffic > 0 ? stationFlow(d.departures / d.totalTraffic) : 0.5 // Ensures no NaN values
        );

    circles.each(function(d) {
        let circle = d3.select(this);
        let title = circle.select("title");
        if (title.empty()) {
            title = circle.append("title");
        }
        title.text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });
}

map.on('style.load', () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: { 'line-color': 'green', 'line-width': 3, 'line-opacity': 0.4 }
    });

    map.addSource('cambridge_bike_lanes', {
        type: 'geojson',
        data: 'https://data.cambridgema.gov/api/geospatial/gb5w-yva3?method=export&format=GeoJSON'
    });

    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_bike_lanes',
        paint: { 'line-color': 'blue', 'line-width': 3, 'line-opacity': 0.6 }
    });

    console.log("✅ Cambridge bike lanes added!");
});

map.on('load', () => {
    const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
    const trafficUrl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";

    d3.json(jsonurl).then(jsonData => {
        stations = computeStationTraffic(jsonData.data.stations, trips);
        console.log('✅ Stations Loaded:', stations);

        const circles = svg.selectAll('circle')
            .data(stations, (d) => d.short_name)
            .enter()
            .append('circle')
            .attr('r', 5)
            .attr('fill', 'steelblue')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('opacity', 0.8)
            .each(function (d) {
                d3.select(this)
                    .append('title') // Tooltip
                    .text(`${d.totalTraffic || 0} trips (${d.departures || 0} departures, ${d.arrivals || 0} arrivals)`);
            });

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

        return d3.csv(trafficUrl);
    }).then(loadedTrips => {
        trips = loadedTrips.map(trip => ({
            ...trip,
            started_at: new Date(trip.started_at),
            ended_at: new Date(trip.ended_at)
        }));

        console.log("✅ Trips Loaded:", trips.slice(0, 5));
        filterTripsByTime();  // Initialize filtering

        function updateScatterPlot(timeFilter) {
            // Get only the trips that match the selected time filter
            const filteredTrips = filterTripsbyTime(trips, timeFilter);
            
            // Recompute station traffic based on the filtered trips
            const filteredStations = computeStationTraffic(stations, filteredTrips);
            
            // Update the scatterplot by adjusting the radius of circles
            circles
              .data(filteredStations , (d) => d.short_name)
              .join('circle') // Ensure the data is bound correctly
              .attr('r', (d) => radiusScale(d.totalTraffic)); // Update circle sizes
        }
        updateScatterPlot(timeFilter);

    }).catch(error => console.error('❌ Error loading data:', error));
});

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}
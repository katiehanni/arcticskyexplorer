/* Arctic Sky Explorer
 * Interactive D3 dashboard for MODIS Arctic seasonal patterns.
 */

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthToSeason = {
  0: 'Winter', 1: 'Winter', 2: 'Spring', 3: 'Spring', 4: 'Spring', 5: 'Summer',
  6: 'Summer', 7: 'Summer', 8: 'Fall', 9: 'Fall', 10: 'Fall', 11: 'Winter'
};
const seasonMonthIndices = {
  All: d3.range(12),
  Winter: [11, 0, 1],
  Spring: [2, 3, 4],
  Summer: [5, 6, 7],
  Fall: [8, 9, 10]
};

const state = {
  data: [],
  dataBySite: new Map(),
  currentMonth: 0,
  selectedSite: null,
  seasonFilter: 'All',
  seasonAverages: [],
  colorScale: null,
  radiusScale: d3.scaleSqrt().domain([0, 24]).range([4, 24]),
  map: null,
  chart: null,
  tooltip: null,
  playTimer: null,
  playing: false
};

const monthSlider = document.getElementById('month-slider');
const playButton = document.getElementById('play-button');
const resetButton = document.getElementById('reset-button');
const seasonButtonsContainer = document.getElementById('season-buttons');
const selectedSiteLabel = document.getElementById('selected-site-label');

function initSeasonButtons() {
  const seasons = ['All', 'Winter', 'Spring', 'Summer', 'Fall'];
  seasons.forEach(season => {
    const btn = document.createElement('button');
    btn.textContent = season;
    btn.classList.add('toggle');
    if (season === 'All') {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      setSeasonFilter(season);
      updateSeasonButtonStyles();
    });
    seasonButtonsContainer.appendChild(btn);
  });
}

function updateSeasonButtonStyles() {
  const buttons = seasonButtonsContainer.querySelectorAll('button.toggle');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.textContent === state.seasonFilter);
  });
}

function setSeasonFilter(season) {
  state.seasonFilter = season;
  const allowedMonths = seasonMonthIndices[season];
  if (!allowedMonths.includes(state.currentMonth)) {
    state.currentMonth = allowedMonths[0];
    monthSlider.value = state.currentMonth;
  }

  stopPlayback();
  updateUI();
}

function handleSliderInput(value) {
  let target = value;
  if (state.seasonFilter !== 'All') {
    const allowed = seasonMonthIndices[state.seasonFilter];
    if (!allowed.includes(target)) {
      target = allowed.reduce((prev, curr) =>
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
      , allowed[0]);
    }
  }
  state.currentMonth = target;
  monthSlider.value = state.currentMonth;
  stopPlayback(false);
  updateUI();
}

function stopPlayback(resetButtonLabel = true) {
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
  state.playing = false;
  if (resetButtonLabel) {
    playButton.textContent = '▶ Play';
  }
}

function togglePlayback() {
  if (state.playing) {
    stopPlayback();
    return;
  }

  state.playing = true;
  playButton.textContent = '⏸ Pause';
  const allowed = seasonMonthIndices[state.seasonFilter];
  state.playTimer = setInterval(() => {
    advanceMonth(allowed);
  }, 1600);
}

function advanceMonth(monthSet) {
  const months = monthSet ?? seasonMonthIndices[state.seasonFilter];
  const currentIdx = months.indexOf(state.currentMonth);
  const nextIdx = (currentIdx + 1) % months.length;
  state.currentMonth = months[nextIdx];
  monthSlider.value = state.currentMonth;
  updateUI();
}

function resetView() {
  stopPlayback();
  state.currentMonth = 0;
  state.selectedSite = state.data.length ? state.data[0].site : null;
  state.seasonFilter = 'All';
  monthSlider.value = state.currentMonth;
  updateSeasonButtonStyles();
  updateUI();
}

function initTooltip() {
  state.tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('background', 'rgba(15, 60, 93, 0.92)')
    .style('color', '#fff')
    .style('padding', '10px 12px')
    .style('border-radius', '8px')
    .style('font-size', '0.85rem')
    .style('line-height', '1.4')
    .style('opacity', 0)
    .style('z-index', 20);
}

function showTooltip(event, html) {
  if (!state.tooltip) return;
  state.tooltip
    .html(html)
    .style('opacity', 1)
    .style('left', `${event.pageX + 14}px`)
    .style('top', `${event.pageY - 24}px`);
}

function hideTooltip() {
  if (!state.tooltip) return;
  state.tooltip.style('opacity', 0);
}

function initMap(worldData) {
  const mapContainer = d3.select('#map-container');
  mapContainer.selectAll('*').remove();

  const width = mapContainer.node()?.clientWidth || 520;
  const height = width;

  const svg = mapContainer
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const projection = d3.geoAzimuthalEqualArea()
    .rotate([0, -90])
    .fitSize([width, height], { type: 'Sphere' })
    .clipAngle(100)
    .precision(0.5);

  const path = d3.geoPath().projection(projection);

  const graticule = d3.geoGraticule().step([20, 10]);

  svg.append('path')
    .datum({ type: 'Sphere' })
    .attr('d', path)
    .attr('fill', '#e9f4fa');

  svg.append('path')
    .datum(graticule())
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#c8ddea')
    .attr('stroke-width', 0.5)
    .attr('opacity', 0.7);

  const arcticCircle = d3.geoCircle()
    .center([0, 90])
    .radius(23.5);

  svg.append('path')
    .datum(arcticCircle())
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#0f8cc6')
    .attr('stroke-dasharray', '4 4')
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.8);

  const land = topojson.feature(worldData, worldData.objects.countries);

  svg.append('g')
    .selectAll('path')
    .data(land.features)
    .join('path')
    .attr('d', path)
    .attr('fill', '#d1e1ed')
    .attr('stroke', '#9eb7c9')
    .attr('stroke-width', 0.5)
    .attr('opacity', d => {
      const centroid = path.centroid(d);
      return centroid[1] < height * 1.1 ? 1 : 0;
    });

  const siteLayer = svg.append('g').attr('class', 'sites');

  state.map = {
    svg,
    projection,
    siteLayer
  };
}

function renderMap() {
  if (!state.map) return;

  const monthData = state.data.filter(d => d.month === state.currentMonth + 1);
  const allowedMonths = seasonMonthIndices[state.seasonFilter];
  const monthSeason = monthToSeason[state.currentMonth];

  const circles = state.map.siteLayer
    .selectAll('circle.site')
    .data(monthData, d => d.site);

  circles.join(
    enter => enter
      .append('circle')
      .attr('class', 'site')
      .attr('r', 0)
      .attr('cx', d => state.map.projection([d.lon, d.lat])[0])
      .attr('cy', d => state.map.projection([d.lon, d.lat])[1])
      .attr('fill', d => state.colorScale(d.brightnessIndex))
      .attr('stroke', d => d.site === state.selectedSite ? '#0b3c5d' : '#ffffff')
      .attr('stroke-width', d => d.site === state.selectedSite ? 3 : 1.5)
      .attr('opacity', allowedMonths.includes(state.currentMonth) ? 0.92 : 0.45)
      .call(enter => enter.transition().duration(500)
        .attr('r', d => state.radiusScale(d.daylightHours)))
      .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke-width', 3.2);
        showTooltip(event, `<strong>${d.site}</strong><br>
          ${monthNames[d.month - 1]} (${monthSeason})<br>
          Brightness: ${d.brightnessIndex.toFixed(0)}<br>
          Daylight: ${d.daylightHours.toFixed(1)} h<br>
          Sea ice: ${d.seaIce.toFixed(0)}%<br>
          Cloud cover: ${d.cloudCover}%`);
      })
      .on('mouseout', function() {
        hideTooltip();
        d3.select(this)
          .attr('stroke-width', d => d.site === state.selectedSite ? 3 : 1.5);
      })
      .on('click', (_, d) => {
        state.selectedSite = d.site;
        updateUI();
      }),
    update => update
      .transition()
      .duration(500)
      .attr('cx', d => state.map.projection([d.lon, d.lat])[0])
      .attr('cy', d => state.map.projection([d.lon, d.lat])[1])
      .attr('r', d => state.radiusScale(d.daylightHours))
      .attr('fill', d => state.colorScale(d.brightnessIndex))
      .attr('stroke', d => d.site === state.selectedSite ? '#0b3c5d' : '#ffffff')
      .attr('stroke-width', d => d.site === state.selectedSite ? 3 : 1.6)
      .attr('opacity', allowedMonths.includes(state.currentMonth) ? 0.92 : 0.45),
    exit => exit
      .transition()
      .duration(300)
      .attr('opacity', 0)
      .remove()
  );
}

function initMapLegend() {
  const legend = d3.select('#map-legend');
  legend.selectAll('*').remove();

  const stops = d3.range(0, 1.01, 0.25);
  const domain = state.colorScale.domain();
  const gradient = stops.map(t => {
    const value = domain[0] + t * (domain[1] - domain[0]);
    return `${state.colorScale(value)} ${Math.round(t * 100)}%`;
  }).join(', ');

  legend.append('div')
    .style('width', '180px')
    .style('height', '12px')
    .style('border-radius', '6px')
    .style('background', `linear-gradient(to right, ${gradient})`)
    .style('border', '1px solid rgba(15,140,198,0.4)');

  const scale = legend.append('div')
    .style('display', 'flex')
    .style('justify-content', 'space-between')
    .style('width', '180px')
    .style('font-size', '0.75rem')
    .style('color', '#526479')
    .style('margin-top', '6px');

  scale.append('span').text(`${Math.round(domain[0])} (darker ground)`);
  scale.append('span').text(`${Math.round(domain[1])} (bright snow/ice)`);
}

function initChart() {
  const container = d3.select('#chart-container');
  container.selectAll('*').remove();
  const width = container.node()?.clientWidth || 520;
  const height = 340;
  const margin = { top: 24, right: 52, bottom: 42, left: 52 };

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  state.chart = {
    svg,
    width,
    height,
    margin
  };
}

function renderChart() {
  if (!state.chart || !state.selectedSite) return;

  const { svg, width, height, margin } = state.chart;
  svg.selectAll('*').remove();

  const siteRecords = (state.dataBySite.get(state.selectedSite) || []).slice()
    .sort((a, b) => a.month - b.month);

  if (!siteRecords.length) return;

  const x = d3.scalePoint()
    .domain(siteRecords.map(d => d.monthName))
    .range([margin.left, width - margin.right])
    .padding(0.5);

  const yBrightness = d3.scaleLinear()
    .domain([0, 100])
    .range([height - margin.bottom, margin.top]);

  const yDaylight = d3.scaleLinear()
    .domain([0, 24])
    .range([height - margin.bottom, margin.top]);

  const ySeaIce = d3.scaleLinear()
    .domain([0, 100])
    .range([height - margin.bottom, margin.top]);

  const areaDaylight = d3.area()
    .x(d => x(d.monthName))
    .y0(height - margin.bottom)
    .y1(d => yDaylight(d.daylightHours))
    .curve(d3.curveCatmullRom);

  const lineBrightness = d3.line()
    .x(d => x(d.monthName))
    .y(d => yBrightness(d.brightnessIndex))
    .curve(d3.curveCatmullRom);

  const lineSeaIce = d3.line()
    .x(d => x(d.monthName))
    .y(d => ySeaIce(d.seaIce))
    .curve(d3.curveCatmullRom);

  svg.append('path')
    .datum(siteRecords)
    .attr('d', areaDaylight)
    .attr('fill', 'rgba(246, 185, 59, 0.25)');

  svg.append('path')
    .datum(siteRecords)
    .attr('d', lineBrightness)
    .attr('fill', 'none')
    .attr('stroke', '#0f8cc6')
    .attr('stroke-width', 3);

  svg.append('path')
    .datum(siteRecords)
    .attr('d', lineSeaIce)
    .attr('fill', 'none')
    .attr('stroke', '#34495e')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '6 4');

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('font-size', '11px')
    .attr('fill', '#526479');

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(yBrightness).ticks(5).tickFormat(d => `${d}`))
    .call(g => g.selectAll('text').attr('fill', '#0f8cc6'))
    .call(g => g.selectAll('path, line').attr('stroke', 'rgba(15,140,198,0.35)'));

  svg.append('g')
    .attr('transform', `translate(${width - margin.right},0)`)
    .call(d3.axisRight(yDaylight).ticks(5).tickFormat(d => `${d} h`))
    .call(g => g.selectAll('text').attr('fill', '#f6b93b'))
    .call(g => g.selectAll('path, line').attr('stroke', 'rgba(246,185,59,0.4)'));

  svg.append('g')
    .attr('transform', `translate(${width - margin.right - 24},0)`)
    .call(d3.axisRight(ySeaIce).ticks(5).tickFormat(d => `${d}%`))
    .call(g => g.selectAll('text').attr('fill', '#34495e'))
    .call(g => g.selectAll('path, line').attr('stroke', 'rgba(52,73,94,0.3)'));

  const highlightMonth = monthNames[state.currentMonth];
  const highlightX = x(highlightMonth);

  svg.append('line')
    .attr('x1', highlightX)
    .attr('x2', highlightX)
    .attr('y1', height - margin.bottom + 6)
    .attr('y2', margin.top - 10)
    .attr('stroke', '#0b3c5d')
    .attr('stroke-width', 1.6)
    .attr('stroke-dasharray', '4 3');

  svg.selectAll('circle.point')
    .data(siteRecords)
    .join('circle')
    .attr('class', 'point')
    .attr('cx', d => x(d.monthName))
    .attr('cy', d => yBrightness(d.brightnessIndex))
    .attr('r', 5)
    .attr('fill', '#0f8cc6')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .on('mouseover', (event, d) => {
      showTooltip(event, `<strong>${d.site}</strong><br>${d.monthName} (${d.season})<br>
        Brightness: ${d.brightnessIndex.toFixed(0)}<br>
        Daylight: ${d.daylightHours.toFixed(1)} h<br>
        Sea ice: ${d.seaIce.toFixed(0)}%`);
    })
    .on('mouseout', hideTooltip)
    .on('click', (_, d) => {
      state.currentMonth = d.month - 1;
      monthSlider.value = state.currentMonth;
      updateUI();
    });
}

function computeSeasonAverages() {
  const orders = ['Winter', 'Spring', 'Summer', 'Fall'];
  state.seasonAverages = orders.map(season => {
    const months = seasonMonthIndices[season];
    const values = state.data.filter(d => months.includes(d.month - 1));
    return {
      season,
      brightness: d3.mean(values, v => v.brightnessIndex),
      daylight: d3.mean(values, v => v.daylightHours)
    };
  });
}

function renderSeasonSummary() {
  const container = d3.select('#season-summary');
  container.selectAll('*').remove();

  const width = container.node()?.clientWidth || 520;
  const height = 220;
  const margin = { top: 40, right: 30, bottom: 40, left: 120 };

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const seasons = state.seasonAverages;
  if (!seasons.length) return;

  const y = d3.scaleBand()
    .domain(seasons.map(d => d.season))
    .range([margin.top, height - margin.bottom])
    .padding(0.35);

  const xBrightness = d3.scaleLinear()
    .domain([0, 100])
    .range([margin.left, width - margin.right]);

  const xDaylight = d3.scaleLinear()
    .domain([0, 24])
    .range([margin.left, width - margin.right]);

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xBrightness).ticks(5).tickFormat(d => d))
    .call(g => g.selectAll('text').attr('fill', '#0f8cc6').attr('font-size', '11px'))
    .call(g => g.selectAll('path, line').attr('stroke', 'rgba(15,140,198,0.35)'));

  svg.append('g')
    .attr('transform', `translate(0,${margin.top})`)
    .call(d3.axisTop(xDaylight).ticks(5).tickFormat(d => `${d} h`))
    .call(g => g.selectAll('text').attr('fill', '#f6b93b').attr('font-size', '11px'))
    .call(g => g.selectAll('path, line').attr('stroke', 'rgba(246,185,59,0.35)'));

  svg.append('g')
    .attr('transform', `translate(${margin.left - 8},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .call(g => g.selectAll('text').attr('fill', '#0b3c5d').attr('font-weight', 600))
    .call(g => g.select('.domain').remove());

  const rows = svg.append('g')
    .selectAll('g')
    .data(seasons)
    .join('g')
    .attr('transform', d => `translate(0,${y(d.season)})`);

  rows.append('rect')
    .attr('x', xBrightness(0))
    .attr('height', y.bandwidth())
    .attr('width', d => xBrightness(d.brightness) - xBrightness(0))
    .attr('fill', d => d.season === state.seasonFilter ? '#0b3c5d' : '#0f8cc6')
    .attr('opacity', 0.85)
    .attr('rx', 8);

  rows.append('rect')
    .attr('x', xDaylight(0))
    .attr('y', y.bandwidth() / 3)
    .attr('height', y.bandwidth() / 3)
    .attr('width', d => xDaylight(d.daylight) - xDaylight(0))
    .attr('fill', 'rgba(246,185,59,0.55)')
    .attr('rx', 6);

  rows.append('text')
    .attr('x', d => xBrightness(d.brightness) + 6)
    .attr('y', y.bandwidth() * 0.4)
    .attr('fill', '#0f8cc6')
    .attr('font-size', '0.78rem')
    .attr('font-weight', 600)
    .text(d => `${d.brightness.toFixed(0)} idx`);

  rows.append('text')
    .attr('x', d => xDaylight(d.daylight) + 6)
    .attr('y', y.bandwidth() * 0.9)
    .attr('fill', '#f6b93b')
    .attr('font-size', '0.78rem')
    .attr('font-weight', 600)
    .text(d => `${d.daylight.toFixed(1)} h`);
}

function renderDetailGrid() {
  const detailGrid = d3.select('#detail-grid');
  detailGrid.selectAll('*').remove();

  if (!state.selectedSite) return;

  const siteRecords = state.dataBySite.get(state.selectedSite);
  if (!siteRecords) return;

  const record = siteRecords.find(d => d.month === state.currentMonth + 1);
  if (!record) return;

  const items = [
    { label: 'Brightness Index', value: `${record.brightnessIndex.toFixed(0)}` },
    { label: 'Daylight Hours', value: `${record.daylightHours.toFixed(1)} h` },
    { label: 'Sea Ice Concentration', value: `${record.seaIce.toFixed(0)} %` },
    { label: 'Cloud Cover', value: `${record.cloudCover} %` },
    { label: 'NDVI', value: record.ndvi >= 0 ? `+${record.ndvi.toFixed(2)}` : record.ndvi.toFixed(2) },
    { label: 'Season', value: record.season }
  ];

  const cards = detailGrid.selectAll('div.detail-chip')
    .data(items)
    .join('div')
    .attr('class', 'detail-chip');

  cards.append('h4').text(d => d.label);
  cards.append('p').text(d => d.value);
}

function updateSelectedLabel() {
  const monthName = monthNames[state.currentMonth];
  const season = monthToSeason[state.currentMonth];
  selectedSiteLabel.textContent = `${state.selectedSite ?? '—'} · ${monthName} (${season})`;
}

function updateUI() {
  renderMap();
  renderChart();
  renderSeasonSummary();
  renderDetailGrid();
  updateSelectedLabel();
}

function attachEventListeners() {
  monthSlider.addEventListener('input', e => handleSliderInput(+e.target.value));
  playButton.addEventListener('click', togglePlayback);
  resetButton.addEventListener('click', resetView);
}

async function init() {
  initSeasonButtons();
  initTooltip();
  attachEventListeners();

  const [data, world] = await Promise.all([
    fetch('data/modis_arctic_2023.json').then(res => res.json()),
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(res => res.json())
  ]);

  state.data = data;
  state.dataBySite = d3.group(data, d => d.site);
  state.selectedSite = data[0]?.site ?? null;
  state.colorScale = d3.scaleSequential(d3.interpolatePuBuGn)
    .domain(d3.extent(data, d => d.brightnessIndex));

  computeSeasonAverages();
  initMap(world);
  initMapLegend();
  initChart();
  resetView();
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeunload', () => stopPlayback(false));


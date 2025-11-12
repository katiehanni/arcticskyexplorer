/* Arctic Sky Explorer - Seasonal Dynamics single interactive visual */

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const seasonMonthIndices = {
  All: d3.range(12),
  Winter: [11, 0, 1],
  Spring: [2, 3, 4],
  Summer: [5, 6, 7],
  Fall: [8, 9, 10]
};

const metricConfig = {
  brightnessIndex: {
    label: 'Surface brightness index',
    accessor: d => d.brightnessIndex,
    format: d3.format('.0f'),
    suffix: ' idx',
    color: '#0f8cc6',
    yLabel: 'Brightness index (0–100)'
  },
  daylightHours: {
    label: 'Daylight hours',
    accessor: d => d.daylightHours,
    format: d3.format('.1f'),
    suffix: ' h',
    color: '#f6b93b',
    yLabel: 'Daylight duration (hours)'
  }
};

const layout = {
  width: 1100,
  height: 520,
  margin: { top: 54, right: 40, bottom: 72, left: 92 }
};

const state = {
  data: [],
  allSites: [],
  activeSites: new Set(),
  season: 'All',
  metric: 'brightnessIndex',
  colorScale: null,
  svg: null,
  layers: {},
  scales: {},
  tooltip: null
};

const dom = {
  seasonContainer: document.getElementById('season-filter'),
  siteContainer: document.getElementById('site-filter'),
  metricSelect: document.getElementById('metric-select'),
  resetButton: document.getElementById('reset-filters'),
  legend: d3.select('#legend'),
  summary: document.getElementById('viz-summary')
};

function initTooltip() {
  state.tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('background', 'rgba(11, 60, 93, 0.92)')
    .style('color', '#fff')
    .style('padding', '10px 14px')
    .style('border-radius', '10px')
    .style('font-size', '0.85rem')
    .style('line-height', '1.5')
    .style('opacity', 0)
    .style('z-index', 50);
}

function showTooltip(event, lines) {
  state.tooltip
    .html(lines.join('<br>'))
    .style('opacity', 1)
    .style('left', `${event.pageX + 16}px`)
    .style('top', `${event.pageY - 32}px`);
}

function hideTooltip() {
  state.tooltip.style('opacity', 0);
}

function initFilters(sites) {
  dom.metricSelect.addEventListener('change', event => {
    state.metric = event.target.value;
    updateMetricSelect();
    updateVisualization();
  });

  const seasons = ['All', 'Winter', 'Spring', 'Summer', 'Fall'];
  seasons.forEach(season => {
    const button = document.createElement('button');
    button.textContent = season;
    button.className = 'toggle-button';
    if (season === state.season) button.classList.add('active');
    button.addEventListener('click', () => {
      state.season = season;
      updateSeasonButtons();
      updateVisualization();
    });
    dom.seasonContainer.appendChild(button);
  });

  sites.forEach(site => {
    const button = document.createElement('button');
    button.className = 'site-toggle active';
    button.dataset.site = site;
    button.innerHTML = `<span style="background:${state.colorScale(site)}"></span>${site}`;
    button.addEventListener('click', () => toggleSite(site));
    dom.siteContainer.appendChild(button);
  });

  dom.resetButton.addEventListener('click', () => {
    state.metric = 'brightnessIndex';
    state.season = 'All';
    state.activeSites = new Set(state.allSites);
    updateSeasonButtons();
    updateSiteButtons();
    updateMetricSelect();
    updateVisualization();
  });
}

function updateSeasonButtons() {
  Array.from(dom.seasonContainer.querySelectorAll('button')).forEach(btn => {
    btn.classList.toggle('active', btn.textContent === state.season);
  });
}

function toggleSite(site) {
  const isActive = state.activeSites.has(site);
  if (isActive && state.activeSites.size === 1) return;
  if (isActive) {
    state.activeSites.delete(site);
  } else {
    state.activeSites.add(site);
  }
  updateSiteButtons();
  updateVisualization();
}

function updateSiteButtons() {
  Array.from(dom.siteContainer.querySelectorAll('.site-toggle')).forEach(btn => {
    const site = btn.dataset.site;
    const active = state.activeSites.has(site);
    btn.classList.toggle('active', active);
    btn.style.opacity = active ? '1' : '0.45';
  });
  updateLegend();
}

function updateMetricSelect() {
  dom.metricSelect.value = state.metric;
}

function buildChart() {
  const container = d3.select('#viz-root');
  container.selectAll('*').remove();

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${layout.width} ${layout.height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  state.svg = svg;

  const innerWidth = layout.width - layout.margin.left - layout.margin.right;
  const innerHeight = layout.height - layout.margin.top - layout.margin.bottom;

  const baseGroup = svg.append('g')
    .attr('transform', `translate(${layout.margin.left}, ${layout.margin.top})`);

  baseGroup.append('rect')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('rx', 18)
    .attr('fill', '#f2f7fb');

  const gridGroup = baseGroup.append('g').attr('class', 'grid');
  const lineGroup = baseGroup.append('g').attr('class', 'series-lines');
  const pointGroup = baseGroup.append('g').attr('class', 'series-points');

  const xAxisGroup = svg.append('g')
    .attr('class', 'axis axis-x')
    .attr('transform', `translate(${layout.margin.left}, ${layout.height - layout.margin.bottom})`);

  const yAxisGroup = svg.append('g')
    .attr('class', 'axis axis-y')
    .attr('transform', `translate(${layout.margin.left}, ${layout.margin.top})`);

  const yAxisLabel = svg.append('text')
    .attr('class', 'axis-label')
    .attr('transform', `translate(${layout.margin.left - 58}, ${layout.margin.top + innerHeight / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('fill', '#0b3c5d')
    .attr('font-weight', 600)
    .attr('font-size', '0.95rem');

  state.layers = {
    innerWidth,
    innerHeight,
    baseGroup,
    gridGroup,
    lineGroup,
    pointGroup,
    xAxisGroup,
    yAxisGroup,
    yAxisLabel
  };
}

function buildSeries(metric) {
  const allowedMonths = seasonMonthIndices[state.season];
  const monthOrder = new Map(allowedMonths.map((m, idx) => [monthNames[m], idx]));

  return Array.from(state.activeSites).map(site => {
    const records = state.data
      .filter(d => d.site === site && allowedMonths.includes(d.month - 1))
      .map(d => ({
        site,
        monthIndex: d.month - 1,
        monthName: d.monthName,
        season: d.season,
        region: d.region,
        value: metric.accessor(d)
      }))
      .filter(d => d.value !== null && !Number.isNaN(d.value))
      .sort((a, b) => monthOrder.get(a.monthName) - monthOrder.get(b.monthName));
    return { site, values: records };
  });
}

function updateVisualization() {
  const metric = metricConfig[state.metric];
  const series = buildSeries(metric);
  const flattened = series.flatMap(s => s.values);

  state.layers.yAxisLabel.text(metric.yLabel);

  if (!flattened.length) {
    state.layers.xAxisGroup.selectAll('*').remove();
    state.layers.yAxisGroup.selectAll('*').remove();
    state.layers.gridGroup.selectAll('*').remove();
    state.layers.lineGroup.selectAll('*').remove();
    state.layers.pointGroup.selectAll('*').remove();
    dom.summary.textContent = 'No data available for the selected filters.';
    return;
  }

  const xDomain = (state.season === 'All')
    ? monthNames
    : seasonMonthIndices[state.season].map(index => monthNames[index]);

  const xScale = d3.scalePoint()
    .domain(xDomain)
    .range([0, state.layers.innerWidth])
    .padding(0.5);

  const [minValue, maxValue] = d3.extent(flattened, d => d.value);
  const yScale = d3.scaleLinear()
    .domain([Math.min(minValue, 0), maxValue])
    .nice()
    .range([state.layers.innerHeight, 0]);

  state.scales = { xScale, yScale };

  const xAxis = d3.axisBottom(xScale)
    .tickSizeOuter(0);

  const yAxis = d3.axisLeft(yScale)
    .ticks(6)
    .tickFormat(d => metric.format(d) + metric.suffix);

  state.layers.xAxisGroup
    .transition()
    .duration(400)
    .call(xAxis)
    .selectAll('text')
    .attr('fill', '#526479')
    .attr('font-size', '0.82rem');

  state.layers.yAxisGroup
    .transition()
    .duration(400)
    .call(yAxis)
    .selectAll('text')
    .attr('fill', '#526479')
    .attr('font-size', '0.8rem');

  state.layers.yAxisGroup.selectAll('.tick line')
    .attr('stroke', 'rgba(15, 140, 198, 0.35)')
    .attr('stroke-dasharray', '2 4');

  state.layers.xAxisGroup.selectAll('.tick line').remove();

  const gridLines = state.layers.gridGroup.selectAll('line')
    .data(yScale.ticks(6));

  gridLines.join(
    enter => enter.append('line')
      .attr('x1', 0)
      .attr('x2', state.layers.innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', 'rgba(15, 140, 198, 0.12)'),
    update => update
      .transition()
      .duration(400)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d)),
    exit => exit.remove()
  );

  const lineGenerator = d3.line()
    .defined(d => d.value !== undefined && d.value !== null)
    .x(d => xScale(d.monthName))
    .y(d => yScale(d.value))
    .curve(d3.curveCatmullRom.alpha(0.65));

  const seriesPaths = state.layers.lineGroup
    .selectAll('path.series')
    .data(series, d => d.site);

  seriesPaths.join(
    enter => enter.append('path')
      .attr('class', 'series')
      .attr('fill', 'none')
      .attr('stroke', d => state.colorScale(d.site))
      .attr('stroke-width', 2.6)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('opacity', d => state.activeSites.has(d.site) ? 1 : 0.35)
      .attr('d', d => lineGenerator(d.values)),
    update => update
      .transition()
      .duration(500)
      .attr('stroke', d => state.colorScale(d.site))
      .attr('opacity', d => state.activeSites.has(d.site) ? 1 : 0.35)
      .attr('d', d => lineGenerator(d.values)),
    exit => exit.remove()
  );

  const pointSelection = state.layers.pointGroup
    .selectAll('g.series-points')
    .data(series, d => d.site);

  const pointEnter = pointSelection.enter()
    .append('g')
    .attr('class', 'series-points')
    .attr('data-site', d => d.site);

  pointSelection.exit().remove();

  pointSelection.merge(pointEnter).each(function(seriesDatum) {
    const siteColor = state.colorScale(seriesDatum.site);
    const circles = d3.select(this)
      .selectAll('circle')
      .data(seriesDatum.values, d => d.monthName);

    circles.join(
      enter => enter.append('circle')
        .attr('cx', d => xScale(d.monthName))
        .attr('cy', d => yScale(d.value))
        .attr('r', 0)
        .attr('fill', siteColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.6)
        .attr('opacity', 0)
        .call(sel => sel.transition().duration(350)
          .attr('r', 5)
          .attr('opacity', 1))
        .on('mouseenter', function(event, d) {
          d3.select(this).transition().duration(150).attr('r', 7).attr('opacity', 1);
          showTooltip(event, [
            `<strong>${d.site}</strong> · ${d.region}`,
            `${d.monthName} (${d.season})`,
            `${metric.label}: ${metric.format(d.value)}${metric.suffix}`
          ]);
        })
        .on('mousemove', (event) => {
          state.tooltip
            .style('left', `${event.pageX + 16}px`)
            .style('top', `${event.pageY - 32}px`);
        })
        .on('mouseleave', function() {
          d3.select(this).transition().duration(150).attr('r', 5);
          hideTooltip();
        }),
      update => update
        .transition()
        .duration(350)
        .attr('cx', d => xScale(d.monthName))
        .attr('cy', d => yScale(d.value))
        .attr('fill', siteColor),
      exit => exit
        .transition()
        .duration(200)
        .attr('opacity', 0)
        .attr('r', 0)
        .remove()
    );
  });

  updateLegend();
  updateSummary(metric, flattened);
}

function updateLegend() {
  const entries = state.allSites.map(site => ({
    site,
    active: state.activeSites.has(site),
    color: state.colorScale(site)
  }));

  const items = dom.legend.selectAll('.legend-item').data(entries, d => d.site);

  const enterItems = items.enter()
    .append('div')
    .attr('class', 'legend-item')
    .style('gap', '8px')
    .style('align-items', 'center');

  enterItems.append('span')
    .attr('class', 'legend-dot')
    .style('display', 'inline-block')
    .style('width', '12px')
    .style('height', '12px')
    .style('border-radius', '50%');

  enterItems.append('span')
    .attr('class', 'legend-label');

  items.merge(enterItems)
    .style('opacity', d => d.active ? 1 : 0.4)
    .select('.legend-dot')
    .style('background', d => d.color);

  items.merge(enterItems)
    .select('.legend-label')
    .text(d => d.site);

  items.exit().remove();
}

function updateSummary(metric, values) {
  if (!values.length) {
    dom.summary.textContent = 'No data available for the selected filters.';
    return;
  }

  const maxRecord = values.reduce((acc, curr) => (curr.value > acc.value ? curr : acc), values[0]);
  const minRecord = values.reduce((acc, curr) => (curr.value < acc.value ? curr : acc), values[0]);

  const seasonCopy = state.season === 'All'
    ? 'the full 2023 cycle'
    : `${state.season.toLowerCase()} months`;

  dom.summary.innerHTML = `
    Viewing <strong>${metric.label.toLowerCase()}</strong> across <strong>${seasonCopy}</strong> for
    <strong>${state.activeSites.size}</strong> site${state.activeSites.size > 1 ? 's' : ''}.
    Highest value: <strong>${maxRecord.site}</strong> in ${maxRecord.monthName} (${metric.format(maxRecord.value)}${metric.suffix}).
    Lowest value: <strong>${minRecord.site}</strong> in ${minRecord.monthName} (${metric.format(minRecord.value)}${metric.suffix}).
  `;
}

async function init() {
  initTooltip();

  const data = await fetch('data/modis_arctic_2023.json').then(res => res.json());
  state.data = data;
  state.allSites = Array.from(new Set(data.map(d => d.site)));
  state.activeSites = new Set(state.allSites);
  state.colorScale = d3.scaleOrdinal()
    .domain(state.allSites)
    .range(d3.schemeTableau10.slice(0, state.allSites.length));

  initFilters(state.allSites);
  buildChart();
  updateMetricSelect();
  updateLegend();
  updateVisualization();
}

window.addEventListener('DOMContentLoaded', init);

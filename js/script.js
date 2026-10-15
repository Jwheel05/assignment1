
 // CMSC471 Assignment 1 — U.S. Weather Explorer

const margin = { top: 35, right: 22, bottom: 48, left: 65 };
const svgWidth = 1000, svgHeight = 360;
const innerW = svgWidth - margin.left - margin.right;
const innerH = svgHeight - margin.top - margin.bottom;

const palette = ['#2468ad', '#e07a32'];
const key = (state, station) => JSON.stringify([state, station]);

const fmt = d3.timeFormat('%b %d, %Y');
const monthFmt = d3.timeFormat('%b');
const dayFmt = d3.timeFormat('%b %d');

const yearStart = new Date(2017, 0, 1);
const periodEnd = new Date(2017, 9, 1);
const months = d3.timeMonth.range(yearStart, periodEnd);

const tooltip = d3.select('#tooltip');

let byState = new Map();
let byStation = new Map();
let selectedRange = null;

function createChart(selector) {
    const root = d3.select(selector)
        .append('svg')
        .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    root.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${innerH})`);

    root.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${innerH})`);

    root.append('g').attr('class', 'axis y-axis');
    root.append('g').attr('class', 'marks');

    root.append('text')
        .attr('class', 'ylabel')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -48)
        .attr('text-anchor', 'middle');

    return root;
}

const tempChart = createChart('#temperature');
const rainChart = createChart('#precipitation');

function selections() {
    return ['A', 'B'].map((side, i) => ({
        state: d3.select('#state' + side).property('value'),
        station: d3.select('#station' + side).property('value'),
        color: palette[i]
    }));
}

function showTip(event, html) {
    tooltip
        .style('display', 'block')
        .html(html);

    moveTip(event);
}

function moveTip(event) {
    tooltip
        .style(
            'left',
            Math.max(
                8,
                Math.min(event.clientX + 15, window.innerWidth - 230)
            ) + 'px'
        )
        .style(
            'top',
            Math.max(8, event.clientY - 80) + 'px'
        );
}

function hideTip() {
    tooltip.style('display', 'none');
}

function resetDateSelection() {
    selectedRange = null;
    hideTip();
    updateVis();
}


// Update the temperature axes and grid.
function updateTempAxes(x, y, ticks, tickFormat) {
    tempChart.select('.x-axis')
        .call(
            d3.axisBottom(x)
                .tickValues(ticks)
                .tickFormat(tickFormat)
        );

    tempChart.select('.y-axis')
        .call(d3.axisLeft(y));

    tempChart.select('.grid')
        .call(
            d3.axisBottom(x)
                .tickValues(ticks)
                .tickSize(-innerH)
                .tickFormat('')
        );

    tempChart.select('.ylabel')
        .text('Temperature (°F)');
}

// Update the station names and colors above both charts.
function updateLegend() {
    const selectedStations = selections();

    ['#tempLegend', '#rainLegend'].forEach(selector => {
        const items = d3.select(selector)
            .selectAll('.legend-item')
            .data(selectedStations)
            .join('div')
            .attr('class', 'legend-item');

        items.selectAll('*').remove();

        items.append('span')
            .attr('class', 'legend-color')
            .style('background-color', d => d.color);

        items.append('span')
            .text(d => `${d.station} (${d.state})`);
    });
}

function updateVis() {
    const metric = d3.select('#metric').property('value');

    updateLegend();
    const selectedStations = selections();

    // Update temperature chart title
    const tempTitles = {
        TMAX: 'Daily Maximum Temperature (°F)',
        TMIN: 'Daily Minimum Temperature (°F)',
        TAVG: 'Daily Average Temperature (°F)'
    };

    d3.select('#tempTitle')
        .text(tempTitles[metric]);

    const x = d3.scaleTime()
        .domain(selectedRange || [yearStart, periodEnd])
        .range([0, innerW]);

    const [start, end] = x.domain();

    const series = selectedStations.map(s => ({
        ...s,
        values: (
            byStation.get(key(s.state, s.station)) || []
        ).filter(d =>
            d.date >= start &&
            d.date <= end
        )
    }));

    const valid = series
        .flatMap(s => s.values)
        .filter(d => Number.isFinite(d[metric]));

    const extent = d3.extent(valid, d => d[metric]);

    const y = d3.scaleLinear()
        .domain(
            Number.isFinite(extent[0]) ? extent : [0, 100]
        )
        .nice()
        .range([innerH, 0]);

    const durationDays = (end - start) / 86400000;

    let ticks;
    let tickFormat;

    if (!selectedRange) {
        ticks = months;
        tickFormat = monthFmt;
    } else if (durationDays <= 21) {
        ticks = d3.timeDay
            .every(durationDays <= 10 ? 1 : 2)
            .range(d3.timeDay.ceil(start), end);

        tickFormat = dayFmt;
    } else if (durationDays <= 75) {
        ticks = d3.timeWeek.range(
            d3.timeWeek.ceil(start),
            end
        );

        tickFormat = dayFmt;
    } else {
        ticks = d3.timeMonth.range(
            d3.timeMonth.ceil(start),
            end
        );

        tickFormat = monthFmt;
    }

    updateTempAxes(x, y, ticks, tickFormat);

    const line = d3.line()
        .defined(d => Number.isFinite(d[metric]))
        .x(d => x(d.date))
        .y(d => y(d[metric]));

    tempChart.select('.marks')
        .selectAll('.series')
        .data(series, (d, i) => i)
        .join(enter => {
            const g = enter.append('g')
                .attr('class', 'series');

            g.append('path')
                .attr('class', 'trend')
                .attr('fill', 'none')
                .attr('stroke-width', 2);

            g.append('g').attr('class', 'dots');

            return g;
        })
        .each(function (s) {
            const g = d3.select(this);

            g.select('.trend')
                .attr('d', line(s.values))
                .attr('stroke', s.color)
                .style('pointer-events', 'none');

            g.select('.dots')
                .selectAll('circle')
                .data(
                    s.values.filter(d =>
                        Number.isFinite(d[metric])
                    ),
                    d => +d.date
                )
                .join('circle')
                .attr('cx', d => x(d.date))
                .attr('cy', d => y(d[metric]))
                .attr('r', 4)
                .attr('fill', s.color)
                .attr('opacity', 0.7)
                .style('cursor', 'pointer')

                .on('mouseover', function (event, d) {
                    d3.select(this)
                        .raise()
                        .attr('r', 7)
                        .attr('opacity', 1)
                        .attr('stroke', 'black')
                        .attr('stroke-width', 2);

                    const name = metric === 'TMAX'
                        ? 'Maximum Temperature'
                        : metric === 'TMIN'
                            ? 'Minimum Temperature'
                            : 'Average Temperature';

                    showTip(event, `
                        <strong>${s.station} (${s.state})</strong>
                        <div>${fmt(d.date)}</div>
                        <div>
                            <strong>${name}:</strong>
                            ${d[metric].toFixed(1)} °F
                        </div>
                    `);
                })

                .on('mousemove', moveTip)

                .on('mouseout', function () {
                    d3.select(this)
                        .attr('r', 4)
                        .attr('opacity', 0.7)
                        .attr('stroke', 'none');

                    hideTip();
                });
        });

    // Drag-to-zoom brushing
    const brush = d3.brushX()
        .extent([[0, 0], [innerW, innerH]])
        .on('end', event => {
            if (!event.sourceEvent || !event.selection) {
                return;
            }

            const range = event.selection.map(x.invert);

            if (range[1] - range[0] < 86400000) {
                tempChart.select('.brush')
                    .call(brush.move, null);

                return;
            }

            selectedRange = range;
            hideTip();
            updateVis();
        });

    tempChart.selectAll('.brush')
        .data([null])
        .join('g')
        .attr('class', 'brush')
        .call(brush);

    tempChart.select('.brush')
        .call(brush.move, null);

    tempChart.select('.marks').raise();

    updatePrecip();
}


// Update the precipitation axes and grid.
function updateRainAxes(x0, y, ticks, labelFormat, metric, name) {
    rainChart.select('.x-axis')
        .call(
            d3.axisBottom(x0)
                .tickValues(ticks)
                .tickFormat(d =>
                    labelFormat(new Date(d))
                )
        );

    rainChart.select('.y-axis')
        .call(d3.axisLeft(y));

    rainChart.select('.grid')
        .call(
            d3.axisBottom(x0)
                .tickValues(ticks)
                .tickSize(-innerH)
                .tickFormat('')
        );

    const axisLabel = metric === 'SNWD'
        ? 'Average snow depth (in)'
        : `Total ${name.toLowerCase()} (in)`;

    rainChart.select('.ylabel')
        .text(axisLabel);
}

function updatePrecip() {
    const metric = d3.select('#rainMetric').property('value');

    const metricLabels = {
        PRCP: 'Precipitation',
        SNOW: 'Snowfall',
        SNWD: 'Snow depth'
    };

    const name = metricLabels[metric];
    const selected = selections();

    const start = selectedRange
        ? selectedRange[0]
        : yearStart;

    const end = selectedRange
        ? selectedRange[1]
        : periodEnd;

    const durationDays = (end - start) / 86400000;

    const dailyMode =
        selectedRange !== null &&
        durationDays <= 31;

    // Update precipitation/snow chart title
    const periodLabel = dailyMode ? 'Daily' : 'Monthly';

    const rainTitles = {
        PRCP: `${periodLabel} Precipitation Totals (in)`,
        SNOW: `${periodLabel} Snowfall Totals (in)`,
        SNWD: dailyMode
            ? 'Daily Snow Depth (in)'
            : 'Monthly Average Snow Depth (in)'
    };

    d3.select('#rainTitle')
        .text(rainTitles[metric]);

    let periods;

    if (dailyMode) {
        periods = d3.timeDay.range(
            d3.timeDay.floor(start),
            d3.timeDay.offset(
                d3.timeDay.floor(end),
                1
            )
        );
    } else if (selectedRange) {
        periods = d3.timeMonth.range(
            d3.timeMonth.floor(start),
            d3.timeMonth.offset(
                d3.timeMonth.floor(end),
                1
            )
        );
    } else {
        periods = months;
    }

    const bars = periods.flatMap(period =>
        selected.map((s, i) => {
            const rows = (
                byStation.get(key(s.state, s.station)) || []
            ).filter(d => {
                const inRange =
                    d.date >= start &&
                    d.date <= end;

                const samePeriod = dailyMode
                    ? +d3.timeDay.floor(d.date) === +period
                    : +d3.timeMonth.floor(d.date) === +period;

                return inRange &&
                    samePeriod &&
                    Number.isFinite(d[metric]);
            });

            let value = 0;

            if (rows.length) {
                value = metric === 'SNWD'
                    ? d3.mean(rows, d => d[metric])
                    : d3.sum(rows, d => d[metric]);
            }

            return {
                i,
                station: s.station,
                state: s.state,
                color: s.color,
                period,
                value,
                count: rows.length
            };
        })
    );

    const x0 = d3.scaleBand()
        .domain(periods.map(d => +d))
        .range([0, innerW])
        .padding(0.2);

    const x1 = d3.scaleBand()
        .domain([0, 1])
        .range([0, x0.bandwidth()])
        .padding(0.07);

    const y = d3.scaleLinear()
        .domain([
            0,
            d3.max(bars, d => d.value) || 1
        ])
        .nice()
        .range([innerH, 0]);

    const labelStep = dailyMode
        ? Math.max(1, Math.ceil(periods.length / 10))
        : 1;

    const ticks = periods
        .filter((d, i) => i % labelStep === 0)
        .map(d => +d);

    const labelFormat = dailyMode
        ? dayFmt
        : monthFmt;

    updateRainAxes(x0, y, ticks, labelFormat, metric, name);

    rainChart.select('.marks')
        .selectAll('rect')
        .data(
            bars,
            d => d.i + '-' + +d.period
        )
        .join('rect')
        .attr('x', d =>
            x0(+d.period) + x1(d.i)
        )
        .attr('y', d => y(d.value))
        .attr('width', x1.bandwidth())
        .attr('height', d =>
            innerH - y(d.value)
        )
        .attr('fill', d => d.color)
        .style(
            'cursor',
            d => d.count ? 'pointer' : 'default'
        )

        .on('mouseover', (event, d) => {
            if (!d.count) return;

            const dateLabel = dailyMode
                ? fmt(d.period)
                : `${monthFmt(d.period)} 2017`;

            const valueLabel =
                metric === 'SNWD' && !dailyMode
                    ? 'Average snow depth'
                    : name;

            showTip(event, `
                <strong>${d.station} (${d.state})</strong>
                <div>${dateLabel}</div>
                <div>
                    <strong>${valueLabel}:</strong>
                    ${d.value.toFixed(2)} in
                </div>
            `);
        })

        .on('mousemove', moveTip)
        .on('mouseout', hideTip);

    // Describe the displayed data without suggesting
    // that the bar chart has its own zoom controls.
    const rangeText = selectedRange
        ? `Selected: ${fmt(start)} – ${fmt(end)}. Showing ${dailyMode ? 'daily' : 'monthly'} ${name.toLowerCase()}${metric === 'SNWD' && !dailyMode ? ' averages' : ''}.`
        : `Showing January–September ${metric === 'SNWD' ? 'monthly average snow depth' : 'monthly ' + name.toLowerCase() + ' totals'}.`;

    d3.select('#rangeText')
        .text(rangeText);
}

function populateStations(side, preferred) {
    const state = d3.select('#state' + side)
        .property('value');

    const stations = byState.get(state) || [];

    const select = d3.select('#station' + side);

    select.selectAll('option')
        .data(stations)
        .join('option')
        .attr('value', d => d)
        .text(d => d);

    select.property(
        'value',
        stations.includes(preferred)
            ? preferred
            : stations[0]
    );
}

// Attach the dropdown and button interactions (Lab 4-5 pattern).
function setupSelector() {
    for (const side of ['A', 'B']) {
        d3.select('#state' + side)
            .on('change', () => {
                populateStations(side);
                resetDateSelection();
            });

        d3.select('#station' + side)
            .on('change', resetDateSelection);
    }

    d3.select('#metric')
        .on('change', updateVis);

    d3.select('#rainMetric')
        .on('change', () => {
            hideTip();
            updatePrecip();
        });

    d3.select('#reset')
        .on('click', resetDateSelection);
}

function init() {
    d3.csv('./data/weather_stations.csv', d => {
        const TMIN = d.TMIN === '' ? NaN : +d.TMIN;
        const TMAX = d.TMAX === '' ? NaN : +d.TMAX;

        const TAVG =
            Number.isFinite(TMIN) &&
                Number.isFinite(TMAX)
                ? (TMIN + TMAX) / 2
                : NaN;

        return {
            state: d.state,
            station: d.station,
            date: d3.timeParse('%Y%m%d')(d.date),

            TMIN,
            TMAX,
            TAVG,

            PRCP:
                d.PRCP == null || d.PRCP === ''
                    ? NaN
                    : +d.PRCP,

            SNOW:
                d.SNOW == null || d.SNOW === ''
                    ? NaN
                    : +d.SNOW,

            SNWD:
                d.SNWD == null || d.SNWD === ''
                    ? NaN
                    : +d.SNWD
        };
    })
        .then(data => {
            const allData = data.filter(d => d.date);

            const states = [
                ...new Set(allData.map(d => d.state))
            ].sort();

            byState = d3.rollup(
                allData,
                v => [
                    ...new Set(v.map(d => d.station))
                ].sort(),
                d => d.state
            );

            byStation = d3.group(
                allData,
                d => key(d.state, d.station)
            );

            for (const values of byStation.values()) {
                values.sort((a, b) =>
                    a.date - b.date
                );
            }

            for (const side of ['A', 'B']) {
                d3.select('#state' + side)
                    .selectAll('option')
                    .data(states)
                    .join('option')
                    .attr('value', d => d)
                    .text(d => d);
            }

            d3.select('#stateA')
                .property(
                    'value',
                    states.includes('MD')
                        ? 'MD'
                        : states[0]
                );

            d3.select('#stateB')
                .property(
                    'value',
                    states.includes('PR')
                        ? 'PR'
                        : states[1] || states[0]
                );

            populateStations('A');

            populateStations(
                'B',
                'SAN JUAN L M MARIN AP'
            );

            setupSelector();

            updateVis();
        })
        .catch(error => {
            console.error(error);

            d3.select('#temperature')
                .append('p')
                .text(
                    'Could not load data. Run with a local server (see README).'
                );
        });
}

window.addEventListener('load', init);

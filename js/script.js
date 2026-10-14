
 // CMSC471 Assignment 1 — Weather Explorer
 // State and station selection, temperature comparison, precipitation, and tooltips

 const margin = { top: 35, right: 22, bottom: 48, left: 65 };
 const W = 1000, H = 360;
 const innerW = W - margin.left - margin.right;
 const innerH = H - margin.top - margin.bottom;

 const palette = ['#2468ad', '#e07a32'];

 let allData = [];
 let byState = new Map();
 let byStation = new Map();
 let selectedRange = null;

 const fmt = d3.timeFormat('%b %d, %Y');
 const monthFmt = d3.timeFormat('%b');
 const tooltip = d3.select('#tooltip');

 const key = (state, station) => JSON.stringify([state, station]);

 function createChart(selector) {
     const root = d3.select(selector)
         .append('svg')
         .attr('viewBox', `0 0 ${W} ${H}`)
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

 // Tooltip functions
 function showTip(event, html) {
     tooltip
         .style('display', 'block')
         .html(html);

     moveTip(event);
 }

 function moveTip(event) {
     tooltip
         .style('left', Math.max(8, Math.min(event.clientX + 15, window.innerWidth - 230)) + 'px')
         .style('top', Math.max(8, event.clientY - 80) + 'px');
 }

 function hideTip() {
     tooltip.style('display', 'none');
 }

 function updateVis() {
     const selected = selections();
     const metric = d3.select('#metric').property('value');

     const domain = d3.extent(allData, d => d.date);

     const x = d3.scaleTime()
         .domain(domain)
         .range([0, innerW]);

     const series = selected.map(s => ({
         ...s,
         values: byStation.get(key(s.state, s.station)) || []
     }));

     const valid = series
         .flatMap(s => s.values)
         .filter(d => Number.isFinite(d[metric]));

     const yDomain = d3.extent(valid, d => d[metric]);

     const y = d3.scaleLinear()
         .domain(Number.isFinite(yDomain[0]) ? yDomain : [0, 100])
         .nice()
         .range([innerH, 0]);

     // Axes
     tempChart.select('.x-axis')
         .call(d3.axisBottom(x).ticks(9));

     tempChart.select('.y-axis')
         .call(d3.axisLeft(y));

     tempChart.select('.grid')
         .call(d3.axisBottom(x).ticks(9).tickSize(-innerH).tickFormat(''));

     tempChart.select('.ylabel')
         .text('Temperature (°F)');

     // Temperature line
     const line = d3.line()
         .defined(d => Number.isFinite(d[metric]))
         .x(d => x(d.date))
         .y(d => y(d[metric]));

     tempChart.select('.marks')
         .selectAll('.series')
         .data(series, (d, i) => i)
         .join(enter => {
             const g = enter.append('g').attr('class', 'series');

             g.append('path')
                 .attr('class', 'trend')
                 .attr('fill', 'none')
                 .attr('stroke-width', 2);

             g.append('g').attr('class', 'dots');

             return g;
         })
         .each(function(s) {
             const g = d3.select(this);

             g.select('.trend')
                 .attr('d', line(s.values))
                 .attr('stroke', s.color);

             // Temperature points with hover tooltips
             g.select('.dots')
                 .selectAll('circle')
                 .data(
                     s.values.filter(d => Number.isFinite(d[metric])),
                     d => +d.date
                 )
                 .join('circle')
                 .attr('cx', d => x(d.date))
                 .attr('cy', d => y(d[metric]))
                 .attr('r', 4)
                 .attr('fill', s.color)
                 .attr('opacity', 0.7)
                 .style('cursor', 'pointer')

                 .on('mouseover', function(event, d) {
                     // Highlight selected point
                     d3.select(this)
                         .attr('r', 7)
                         .attr('opacity', 1)
                         .attr('stroke', 'black')
                         .attr('stroke-width', 2);

                     const metricName = metric === 'TMAX'
                         ? 'Maximum Temperature'
                         : 'Minimum Temperature';

                     showTip(event, `
                         <strong>${s.station} (${s.state})</strong>
                         <div>${fmt(d.date)}</div>
                         <div><strong>${metricName}:</strong> ${d[metric].toFixed(1)} °F</div>
                     `);
                 })

                 .on('mousemove', function(event) {
                     moveTip(event);
                 })

                 .on('mouseout', function() {
                     d3.select(this)
                         .attr('r', 4)
                         .attr('opacity', 0.7)
                         .attr('stroke', 'none');

                     hideTip();
                 });
         });

     // Date-range brushing
     const brush = d3.brushX()
         .extent([[0, 0], [innerW, innerH]])
         .on('end', event => {
             if (!event.sourceEvent) return;

             selectedRange = event.selection
                 ? event.selection.map(x.invert)
                 : null;

             updatePrecip();
         });

     tempChart.selectAll('.brush')
         .data([null])
         .join('g')
         .attr('class', 'brush')
         .call(brush);

     if (selectedRange) {
         tempChart.select('.brush')
             .call(brush.move, selectedRange.map(x));
     }

     // Keep temperature points above brush for hover interaction
     tempChart.select('.marks').raise();

     updatePrecip();
 }

 function updatePrecip() {
     const selected = selections();

     const months = d3.timeMonth.range(
         d3.timeMonth.floor(d3.min(allData, d => d.date)),
         d3.timeMonth.offset(
             d3.timeMonth.floor(d3.max(allData, d => d.date)),
             1
         )
     );

     const bars = months.flatMap(month =>
         selected.map((s, i) => {
             const rows = (
                 byStation.get(key(s.state, s.station)) || []
             ).filter(d =>
                 (!selectedRange ||
                     (d.date >= selectedRange[0] &&
                      d.date <= selectedRange[1])) &&
                 +d3.timeMonth.floor(d.date) === +month &&
                 Number.isFinite(d.PRCP)
             );

             return {
                 i,
                 station: s.station,
                 state: s.state,
                 color: s.color,
                 month,
                 value: d3.sum(rows, d => d.PRCP)
             };
         })
     );

     const x0 = d3.scaleBand()
         .domain(months.map(d => +d))
         .range([0, innerW])
         .padding(0.2);

     const x1 = d3.scaleBand()
         .domain([0, 1])
         .range([0, x0.bandwidth()])
         .padding(0.07);

     const y = d3.scaleLinear()
         .domain([0, d3.max(bars, d => d.value) || 1])
         .nice()
         .range([innerH, 0]);

     rainChart.select('.x-axis')
         .call(d3.axisBottom(x0)
             .tickFormat(d => monthFmt(new Date(d))));

     rainChart.select('.y-axis')
         .call(d3.axisLeft(y));

     rainChart.select('.grid')
         .call(d3.axisBottom(x0).tickSize(-innerH).tickFormat(''));

     rainChart.select('.ylabel')
         .text('Total precipitation (in)');

     rainChart.select('.marks')
         .selectAll('rect')
         .data(bars, d => d.i + '-' + +d.month)
         .join('rect')
         .attr('x', d => x0(+d.month) + x1(d.i))
         .attr('y', d => y(d.value))
         .attr('width', x1.bandwidth())
         .attr('height', d => innerH - y(d.value))
         .attr('fill', d => d.color)

         .on('mouseover', (event, d) => {
             showTip(event, `
                 <strong>${d.station} (${d.state})</strong>
                 <div>${monthFmt(d.month)} 2017</div>
                 <div><strong>Precipitation:</strong> ${d.value.toFixed(2)} in</div>
             `);
         })

         .on('mousemove', moveTip)
         .on('mouseout', hideTip);

     d3.select('#rangeText').text(
         selectedRange
             ? `Selected: ${fmt(selectedRange[0])} – ${fmt(selectedRange[1])}`
             : 'Showing all available dates. Drag across the temperature chart to filter precipitation.'
     );
 }

 function populateStations(side, preferred) {
     const state = d3.select('#state' + side).property('value');
     const stations = byState.get(state) || [];
     const select = d3.select('#station' + side);

     select.selectAll('option')
         .data(stations)
         .join('option')
         .attr('value', d => d)
         .text(d => d);

     select.property(
         'value',
         stations.includes(preferred) ? preferred : stations[0]
     );
 }

 function init() {
     d3.csv('./data/weather_stations.csv', d => ({
         state: d.state,
         station: d.station,
         date: d3.timeParse('%Y%m%d')(d.date),
         TMIN: d.TMIN === '' ? NaN : +d.TMIN,
         TMAX: d.TMAX === '' ? NaN : +d.TMAX,
         PRCP: d.PRCP === '' ? NaN : +d.PRCP
     }))
     .then(data => {
         allData = data.filter(d => d.date);

         const states = [
             ...new Set(allData.map(d => d.state))
         ].sort();

         byState = d3.rollup(
             allData,
             v => [...new Set(v.map(d => d.station))].sort(),
             d => d.state
         );

         byStation = d3.group(
             allData,
             d => key(d.state, d.station)
         );

         for (const values of byStation.values()) {
             values.sort((a, b) => a.date - b.date);
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
             .property('value', states.includes('MD') ? 'MD' : states[0]);

         d3.select('#stateB')
             .property('value', states.includes('PR') ? 'PR' : states[1] || states[0]);

         populateStations('A');
         populateStations('B', 'SAN JUAN L M MARIN AP');

         for (const side of ['A', 'B']) {
             d3.select('#state' + side).on('change', () => {
                 populateStations(side);
                 selectedRange = null;
                 updateVis();
             });

             d3.select('#station' + side).on('change', () => {
                 selectedRange = null;
                 updateVis();
             });
         }

         d3.select('#metric')
             .on('change', updateVis);

         d3.select('#reset')
             .on('click', () => {
                 selectedRange = null;
                 updateVis();
             });

         updateVis();
     })
     .catch(error => {
         console.error(error);

         d3.select('#temperature')
             .append('p')
             .text('Could not load data. Run with a local server (see README).');
     });
 }

 window.addEventListener('load', init);

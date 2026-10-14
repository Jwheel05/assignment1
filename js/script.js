// Setting the margins
const margin = {top: 40, right: 40, bottom: 40, left: 60};
const width = 600 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

let allData = []
let xVar = 'income', yVar = 'lifeExp', sizeVar = 'population', targetYear = 2000
let xScale, yScale, sizeScale

const continents = ['Africa', 'Asia', 'Oceania', 'Americas', 'Europe']
const colorScale = d3.scaleOrdinal(continents, d3.schemeSet2); // d3.schemeSet2 is a set of predefined colors.

const options = ['income', 'lifeExp', 'gdp', 'population', 'childDeaths']

const t = 1000; // 1000ms = 1 second

// Create SVG
const svg = d3.select('#vis')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

function init(){
    d3.csv("./data/weather.csv", 
    // this is the callback function, applied to each item in the array
    function(d){
        return {  
        // Besides converting the types, we also simpilify the variable names here.
            station: d.station,
            state: d.state,
            lat: +d.latitude,
            long: +d.longitude,
            elevation: +d.elevation,
            date: d.date,
            tmin: +d.TMIN, // min temp
            tmax: +d.TMAX, // max temp
            tavg: +d.TAVG, // avg temp
            awnd: +d.AWND, // avg wind
            wdf5: +d.WDF5, // wind direction in degrees
            wsf5: +d.WSF5, // fastest wind speed
            snow: +d.SNOW, // snowfall 
            snwd: +d.SNWD, // snow already on ground
            prcp: +d.PRCP // precipation
     }
    })
    .then(data => {
            console.log(data) // Check the structure in the console
            allData = data // Save the processed data
            setupSelector()
            
            // Initial rendering steps:
            // P.S. You could move these into setupSelector(), 
            // but calling them separately makes the flow clearer.
            updateAxes()
            updateVis()
            addLegend()
        })
    .catch(error => console.error('Error loading data:', error));
}

window.addEventListener("load", init);

// Commenting everything out from here on to check data
/*


// Here’s what each function is responsible for:

function setupSelector(){
    let slider = d3
        .sliderHorizontal()
        .min(d3.min(allData.map(d => +d.year))) // setup the range
        .max(d3.max(allData.map(d => +d.year))) // setup the range
        .step(1)
        .width(width)  // Widen the slider if needed
        .displayValue(false)
        .on('onchange', (val) => {
            // Updates the text on top of the page with the slider’s value
            d3.select('#value').text(val);
            targetYear = +val // Update the year
            updateVis() // Refresh the chart
        });

    d3.select('#slider')
        .append('svg')
        .attr('width', width)  // Adjust width if needed
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(30,30)')
        .call(slider);

    d3.selectAll('.variable')
    // loop over each dropdown button
        .each(function() {
            d3.select(this).selectAll('myOptions')
            .data(options)
            .enter()
            .append('option')
            .text(d => d) // The displayed text
            .attr("value",d => d) // The actual value used in the code
    })
    .on("change", function (event) {
        switch(d3.select(this).property("id")) {
            case "xVariable":
                xVar = d3.select(this).property("value")
            case "yVariable":
                yVar = d3.select(this).property("value")
            case "sizeVariable":
                sizeVar = d3.select(this).property("value")
        }
        updateAxes(); 
        updateVis();
    })
    
    d3.select('#xVariable').property('value', xVar)
    d3.select('#yVariable').property('value', yVar)
    d3.select('#sizeVariable').property('value', sizeVar)
}

function updateAxes(){
    // Draws the x-axis and y-axis
    // Adds ticks, labels, and makes sure everything lines up nicely
    svg.selectAll('.axis').remove()
    svg.selectAll('.labels').remove()
    xScale = d3.scaleLinear()
    .domain([0, d3.max(allData, d => d[xVar])])
    .range([0, width]);
    const xAxis = d3.axisBottom(xScale)

    svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`) // Position at the bottom
    .call(xAxis);

    // Your turn: Create the y-axis using the same approach.
    // Use d3.scaleLinear() again.
    // Adjust .domain(), .range(), and the .attr("transform", ...) to position it on the left.
    yScale = d3.scaleLinear()
    .domain([0, d3.max(allData, d => d[yVar])])
    .range([height, 0]);
    const yAxis = d3.axisLeft(yScale)

    svg.append("g")
    .attr("class", "axis")
    .call(yAxis);

    sizeScale = d3.scaleSqrt()
    .domain([0, d3.max(allData, d => d[sizeVar])]) // Largest bubble = largest data point 
    .range([5, 20]); // Feel free to tweak these values if you want bigger or smaller bubbles

    // X-axis label
    svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 5)
    .attr("text-anchor", "middle")
    .text(xVar) // Displays the current x-axis variable
    .attr('class', 'labels')

    // Y-axis label (rotated)
    svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 40)
    .attr("text-anchor", "middle")
    .text(yVar) // Displays the current y-axis variable
    .attr('class', 'labels')
}

function updateVis(){
  // Draws (or updates) the bubbles
  // Filter data for the current year
    let currentData = allData.filter(d => d.year === targetYear)

    svg.selectAll('.points')
        // Why use d => d.country as the key?
        // Because each country is unique in the dataset for the current year. 
        // This helps D3 know which bubbles to keep, update, or remove.
        .data(currentData, d => d.country)
        .join(
            function(enter){
                 return enter
                .append('circle')
                .attr('class', 'points')
                .attr('cx', d => xScale(d[xVar])) // Position on x-axis
                .attr('cy', d => yScale(d[yVar])) // Position on y-axis
                .attr('r',  d => sizeScale(d[sizeVar])) // Bubble size
                // Apply continent colors
                .style('fill', d => colorScale(d.continent))
                .style('opacity', .5) // Slight transparency for better visibility
                .attr('r', 0) // before transition r = 0
                .on('mouseover', function (event, d) {
                    d3.select('#tooltip')
                    // if you change opacity to hide it, you should also change opacity here
                    .style("display", 'block') // Make the tooltip visible
                    .html( // Change the html content of the <div> directly
                    `<strong>${d.country}</strong><br/>
                    Continent: ${d.continent}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
                    d3.select(this) // Refers to the hovered circle
                    .style('stroke', 'black')
                    .style('stroke-width', '4px')
                })
                .on("mouseout", function (event, d) {
                    d3.select('#tooltip')
                    .style('display', 'none')   // hide tooltip
                    d3.select(this)              
                    .style('stroke', 'none') 
                })
                .transition(t) // Animate the transition
                .attr('r', d => sizeScale(d[sizeVar])) // Expand to target size
            },
            function(update){
                // existing points gets updated here
                return update
                .transition(t)
                .attr('cx', d => xScale(d[xVar]))
                .attr('cy', d => yScale(d[yVar]))
                .attr('r',  d => sizeScale(d[sizeVar]))
                // Apply continent colors
                .style('fill', d => colorScale(d.continent))
                .style('opacity', .5) // Slight transparency for better visibility

            },
            function(exit){
                // old points get updated here
                exit.remove()
                .transition(t)
                .attr('r', 0)  // Shrink to radius 0
                .remove()  // Then remove the bubble
            }
        )
}

function addLegend(){
  let size = 10  // Size of the legend squares

  // Your turn, draw a set of rectangles using D3
  svg.selectAll('continentSquare')
  // data here should be "continents", which we've defined as a global variable
  // the rect's y could be  -margin.top/2, x could be based on i * (size + 100) + 100
  // i is the index in the continents array
  .data(continents)
    .enter()
    .append("rect")
      .attr("x", (d, i) => i * (size + 100))
      .attr("y", -margin.top / 2)
      .attr("width", size)
      .attr("height", size)
  // use "colorScale" to fill them; colorScale is a global variable we defined, used in coloring bubbles
  .style("fill", d => colorScale(d))

   svg.selectAll("continentName")
        .data(continents)
        .enter()
        .append("text")
        .attr("y", -margin.top/2 + size) // Align vertically with the square
        .attr("x", (d, i) => i * (size + 100)+ 20)  
        .style("fill", d => colorScale(d))  // Match text color to the square
        .text(d => d) // The actual continent name
        .attr("text-anchor", "left")
        .style('font-size', '13px')
}

window.addEventListener('load', init);

/*
svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 4)
    .style('text-anchor', 'middle')
    .text('fruit');

svg.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 15)
    .style('text-anchor', 'middle')
    .text('count'); */


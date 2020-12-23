var crimeColorScale = d3.scaleQuantize();
var incomeColorScale = d3.scaleQuantize();
var crimeData;
var incomeData;
var crimeColorMapping;
var incomeColorMapping;
let censusTractsGeoJSON;
var areaName;

const dboardWidth = 2000;
const dboardHeight = 1000;
const dboardX = 1000;
const dboardY = 500;
var dashboard = d3.select("#dashboard")
  .append("svg")
  .attr("viewBox", [dboardX, dboardY, dboardWidth, dboardHeight])
  .attr('class', 'dashSvg')
  .style("overflow", "visible")
  .style("display", "block")
  .style("z-index", "3");

dashboard.append("text")
  .attr("class", "areaLabel")
  .attr("x", dboardWidth * .90)
  .attr("y", dboardHeight * 1.0725)
  .attr("text-anchor", "middle")
  .style("font-size", "32px")
  .style("font-weight", "bold");

const tractsWidth = 700;
const tractsHeight = 900;
const tractsMargin = 50;
const tractsX = dboardX + 50;
const tractsY = (dboardHeight - tractsHeight) / 2 + dboardY;

var tractMap = dashboard
  .append("svg")
  .attr("width", tractsWidth)
  .attr("height", tractsHeight)
  .attr("x", tractsX)
  .attr("y", tractsY)
  .style("z-index", "3");

var mapLegend = tractMap.append("g")
  .style("z-index", "5");


var crimeLegend;
var incomeLegend;

const pieWidth = 500;
const pieHeight = 300;
const pieRadius = Math.min(pieWidth, pieHeight) / 2.7;
const pieX = tractsWidth + dboardX - 70;
const pieY = tractsY + tractsHeight / 2 + 130;
var pieChart = dashboard
  .append("svg")
  .attr("width", pieWidth)
  .attr("height", pieHeight)
  .attr("x", pieX)
  .attr("y", pieY);

const fancyWidth = 300;
const fancyHeight = tractsHeight;
const fancyX = pieX + pieWidth - 50;
const fancyY = tractsY + 30;
var fancyBarChart = dashboard
  .append("svg")
  .attr("width", fancyWidth)
  .attr("height", fancyHeight)
  .attr("x", fancyX)
  .attr("y", fancyY);

const plotMargin = { top: 10, right: 30, bottom: 150, left: 60 },
  plotWidth = 400 - plotMargin.left - plotMargin.right,
  plotHeight = 400 - plotMargin.top - plotMargin.bottom;
const plotX = pieX;
const plotY = tractsY + 50;
var plotG = dashboard
  .append("svg")
  .attr("width", plotWidth + plotMargin.left + plotMargin.right)
  .attr("height", plotHeight + plotMargin.top + plotMargin.bottom)
  .attr("x", plotX)
  .attr("y", plotY)
  .append("g")
  .attr("transform", "translate(" + plotMargin.left + "," + plotMargin.top + ")");

var tractToIncome;

d3.csv("./data/final_data/AggIncomeData.csv").then(data => {
  incomeData = data;

  d3.csv("./data/final_data/AggCrimeData.csv").then(data2 => {
    crimeData = data2;

    // initialize the crime color scale
    crimeColorMapping = createMapping(crimeData, "Count");
    crimeColorScale.domain([0, crimeColorMapping.size - 1]);
    crimeColorScale.range(d3.schemePurples[5]);

    // initialize the income color scale
    incomeColorMapping = createMapping(incomeData, "Median Income")
    incomeColorScale.domain([0, incomeColorMapping.size - 1]);
    incomeColorScale.range(d3.schemeBlues[5]);

    // Make the legend
    crimeLegend = makeChoroplethLegend(crimeColorScale, "Number of Crimes");
    incomeLegend = makeChoroplethLegend(incomeColorScale, "Median Income");

    // mapping for text field in scatter plot
    tractToIncome = new Map();
    for (let i = 0; i < incomeData.length; i++) {
      tractToIncome.set(parseInt(incomeData[i]["Tract"]), parseInt(incomeData[i]["Median Income"]));
    }

    // mapping for text field in pie chart
    tractToRacePercentages = new Map();
    for (let i = 0; i < incomeData.length; i++) {
      let value = [incomeData[i]['Percent White'], incomeData[i]['Percent Black'],
      incomeData[i]['Percent Indigenous'], incomeData[i]['Percent Asian'],
      incomeData[i]['Percent Islander'], incomeData[i]['Percent Other'],
      incomeData[i]['Percent Latino']];
      var total = 0;
      for (let j = 0; j < value.length; j++) {
        total += parseFloat(value[j])
      }

      if (total < 100) {
        var missing = 100 - total;
        value.push(missing);
      }

      let key = parseInt(incomeData[i]['Tract']);
      tractToRacePercentages.set(key, value);
    }

    // Parse topoJSON file, convert to geoJSON, and draw map
    d3.json("./data/final_data/Census_Tracts_2010_TopoJSON.json").then(tracts => {
      censusTractsGeoJSON = topojson.feature(tracts, tracts.objects.Census_Tracts_2010);

      drawMap(censusTractsGeoJSON, "Total Crime");
      createPieLegend();
      // addMapMouseEventListeners();
      drawPlot();
      updateAuxiliaryCharts(undefined)
      dashboard.selectAll("text").style("font-family", "TiemposText-Regular")

    }).catch(error => console.log(error));
  }).catch(error => console.log(error))
}).catch(error => console.log(error));

var stripePattern = dashboard
  .append("pattern")
  .attr("id", "pattern-stripe")
  .attr("patternUnits", "userSpaceOnUse")
  .attr("width", "20.5")
  .attr("height", "20.5")
  .attr("patternTransform", "rotate(45)");

stripePattern.append("line")
  .attr("x1", "0")
  .attr("y1", "0")
  .attr("x2", "0")
  .attr("y2", "20.5")
  .attr("stroke", "#d3d3d3")
  .attr("stroke-width", "21");
/*
************************************************************************
* CHOROPLETH
************************************************************************
*/

var projection = d3.geoMercator();

var path = d3.geoPath().projection(projection);

// Define legends for crime and income

// For the radio buttons
d3.selectAll("input").on("change", function change() {
  drawMap(censusTractsGeoJSON);
})

// Make an interactive text to toggle between median income and crime count
const choices = ['Total Crime', 'Median Income'];
const choicesColor = ["DarkOrchid", 'DodgerBlue'];
var toggler = tractMap.selectAll(".text-toggler")
  .data(choices)
  .enter()
  .append("g")
  .attr("class", "text-toggler")
  .attr("id", d => d)
  .append("text")
  .attr("x", (d, i) => 220 + 135 * i)
  .attr("y", 15)
  .text(d => d == "Total Crime" ? `> ${d}` : d)
  .style("fill", (d, i) => choicesColor[i])
  .style("opacity", d => d == "Total Crime" ? 1 : 0.5)
  .attr("font-weight", d => d == "Total Crime" ? 'bold' : 'normal')
  .attr("text-decoration", d => d == "Total Crime" ? 'underline' : 'none');

toggler.on("click", function (event, d) {
  toggler
    .text(datum => datum == d ? `> ${datum}` : datum)
    .style("opacity", datum => datum == d ? 1 : 0.5)
    .attr("font-weight", datum => datum == d ? 'bold' : 'normal')
    .attr("text-decoration", datum => datum == d ? 'underline' : 'none');
  drawMap(censusTractsGeoJSON, d);
});

function makeChoroplethLegend(colorScale, legendTitle) {
  // const svg = d3.create("svg").attr("class", "choropleth-legend");
  const legendSvg = tractMap.append("g")
    .attr("transform", "translate(10, 70)")
    .attr("class", "choropleth-legend");

  let legendCreator = d3.legendColor()
    .title(legendTitle)
    .shape("circle")
    .shapePadding(5)
    .shapeRadius(6)
    .orient("vertical")
    .labels(function ({ i, domain, range }) {
      let max = domain[1];
      let bins = range.length;
      let intervalSize = (max / bins);
      if (colorScale == crimeColorScale) {
        let tractNumOne;
        let tractNumTwo;
        for (let [key, value] of crimeColorMapping.entries()) {
          if (value === Math.ceil(intervalSize * i)) {
            tractNumOne = key;
          }
          if (value == Math.ceil(intervalSize * (i + 1))) {
            tractNumTwo = key;
          }
          if (tractNumOne && tractNumTwo) {
            break;
          }
        }
        let tractOne = crimeData.filter(function (x) { return x["Tract"] == tractNumOne })
        let tractTwo = crimeData.filter(function (x) { return x["Tract"] == tractNumTwo })
        let valueOne = 0;
        let valueTwo = 0;
        for (let i = 0; i < tractOne.length; i++) {
          valueOne += parseInt(tractOne[i].Count)
        }
        for (let i = 0; i < tractTwo.length; i++) {
          valueTwo += parseInt(tractTwo[i].Count)
        }

        return numberWithCommas(valueOne) + " - " + numberWithCommas(valueTwo)
      } else {
        let tractNumOne;
        let tractNumTwo;
        for (let [key, value] of incomeColorMapping.entries()) {
          if (value === Math.ceil(intervalSize * i)) {
            tractNumOne = key;
          }
          if (value == Math.ceil(intervalSize * (i + 1))) {
            tractNumTwo = key;
          }
          if (tractNumOne && tractNumTwo) {
            break;
          }
        }
        let tractOne = incomeData.filter(function (x) { return x["Tract"] == tractNumOne })
        let tractTwo = incomeData.filter(function (x) { return x["Tract"] == tractNumTwo })
        let valueOne = 0;
        let valueTwo = 0;
        for (let i = 0; i < tractOne.length; i++) {
          valueOne += parseInt(tractOne[i]["Median Income"])
        }
        for (let i = 0; i < tractTwo.length; i++) {
          valueTwo += parseInt(tractTwo[i]["Median Income"])
        }

        return "$" + numberWithCommas(valueOne) + " - $" + numberWithCommas(valueTwo)
      }
    })
    .cellFilter(function (d) { return d.label !== "e" })
    .scale(colorScale);

  legendSvg
    //.style("font-family", "Avenir")
    .style("font-size", "14px")
    .call(legendCreator);

  return legendSvg;
}

/*
* Draws the choropleth.
*/
function drawMap(tracts, filter) {
  // let filter = d3.select('input[name="filter"]:checked').property("value");
  projection.fitExtent([[tractsMargin, tractsMargin], [tractsWidth - tractsMargin, tractsHeight - tractsMargin]], tracts);

  // drawing the tracts
  tractMap.selectAll("path")
    .data(tracts.features, function (d) {
      return d.properties.TRACT;
    })
    .join(
      function (enter) {
        enter.append("path")
          .attr("d", path)
          .attr("id", d => d.properties.TRACT)
          .style("stroke", "#A9A9A9")
          .style("stroke-width", "1")
          .style("fill", function (d) {
            if (filter == "Income") {
              if (!incomeColorMapping.get(d.properties.TRACT)) {
                return "url(#pattern-stripe)";
              }
              return incomeColorScale(incomeColorMapping.get(d.properties.TRACT));
            } else {
              return crimeColorScale(crimeColorMapping.get(d.properties.TRACT))
            }
          })
          .on('mousemove', function (event, d) {
            d3.select(this).raise().style("stroke", "#fff").style("stroke-width", 2);
          })
          .on('mouseleave', function (event, d) {
            // Preserve the selected path's pronounced outline
            if (selected && currentSelectedTract == d.properties.TRACT) {
              d3.select(currentSelectedRef).raise().style("stroke", "#d5ab09").style("stroke-width", 3);

            } else if (selected && currentSelectedTract != d.properties.TRACT) {
              d3.select(this).raise().style("stroke", "#A9A9A9").style("stroke-width", 1);
              d3.select(currentSelectedRef).raise().style("stroke", "#d5ab09").style("stroke-width", 3);

            } else {
              d3.select(this).raise().style("stroke", "#A9A9A9").style("stroke-width", 1);
            }

          })
          .on("click", function (event, d) {
            // "selection" behavior
            if (d.properties.TRACT == 26001) {
              return;
            }
            if (selected && currentSelectedTract == d.properties.TRACT) {
              selected = false;
              d3.select(this).raise().style("stroke", "#FFF").style("stroke-width", 2);
              currentSelectedRef = undefined;
              currentSelectedTract = 0;
              updateAuxiliaryCharts(undefined);
            } else {
              if (selected && currentSelectedTract != d.properties.TRACT) {
                d3.select(currentSelectedRef).raise().style("stroke", "#A9A9A9").style("stroke-width", 1);
              }
              selected = true;
              currentSelectedRef = this;
              currentSelectedTract = d.properties.TRACT;
              d3.select(this).raise().style("stroke", "#d5ab09").style("stroke-width", 3);
              updateAuxiliaryCharts(d);
            }
          });
      },
      function (change) {
        change.transition()
          .style("fill", function (d) {
            if (filter == "Median Income") {
              if (incomeColorMapping.get(d.properties.TRACT) == undefined) {
                return "url(#pattern-stripe)";
              }
              return incomeColorScale(incomeColorMapping.get(d.properties.TRACT));
            } else {
              return crimeColorScale(crimeColorMapping.get(d.properties.TRACT))
            }
          });
      }
    );

  // Update legend
  tractMap.selectAll(".choropleth-legend").classed("hidden", true);

  if (filter == "Median Income") {
    // mapLegend.node().append(incomeLegend);
    // mapLegend
    //   .attr("viewBox", [0, 0, 200, 200])
    //   .attr("transform", "translate(" + 20 + "," + 80 + ")");
    // mapLegend.selectAll(".legendCells")
    //   .attr("transform", "translate(" + 20 + "," + 20 + ")");
    // mapLegend.selectAll(".legendTitle")
    //   .attr("transform", "translate(" + 20 + "," + 5 + ")");
    incomeLegend.classed("hidden", false);
    crimeLegend.classed("hidden", true);
  } else {
    // mapLegend.node().append(crimeLegend);
    // mapLegend
    //   .attr("viewBox", [0, 0, 200, 200])
    //   .attr("transform", "translate(" + 20 + "," + 80 + ")");
    // mapLegend.selectAll(".legendCells")
    //   .attr("transform", "translate(" + 20 + "," + 20 + ")");
    // mapLegend.selectAll(".legendTitle")
    //   .attr("transform", "translate(" + 20 + "," + 5 + ")");

    incomeLegend.classed("hidden", true);
    crimeLegend.classed("hidden", false);
  }
}

var selected = false;
var currentSelectedTract = 0;
var currentSelectedRef = undefined;

/*
* Adds mouse listeners for the choropleth.
*/
// function addMapMouseEventListeners() {
//   let filter = d3.select('input[name="filter"]:checked').property("value");

// // Make map interactive on mouse events
// tractMap.selectAll("path")


/*
* Updates auxiliary charts.
*/
function updateAuxiliaryCharts(d) {
  let tractnum;
  if (typeof d == "undefined") {
    tractnum = 0;
    areaName = "City of Seattle";
  } else {
    tractnum = d.properties.TRACT;
    areaName = d.properties.NAMELSAD10
  }
  income = tractToIncome.get(tractnum);
  let incomeText;
  if (income == -1) {
    incomeText = "Ovr. Med. Income: N/A";
  } else {
    incomeText = "Ovr. Med. Income: $" + numberWithCommas(tractToIncome.get(tractnum))
  }
  plotG.select(".medianIncome").text(incomeText)
  drawFancyBarThing(tractnum);
  dashboard.selectAll(".areaLabel").text(areaName);
  makeFancyBarLegend();
  // pieG.selectAll(".racePercentage").text()
  createPieChart(tractnum);
  plotG.selectAll(".dot")
    .sort(function (a, b) {
      if ((a.t == tractnum && b.t == tractnum) ||
        (a.t != tractnum && b.t != tractnum)) {
        return 0;
      } else if (a.t == tractnum && b.t != tractnum) {
        return 1;
      } else {
        return -1;
      }
    })
    .transition()
    .attr("r", 3)
    .style("opacity", 0.1)
    .filter(function (s) { return s.t == tractnum; })
    .attr("r", 8)
    .style("opacity", 1.0)

  plotG.selectAll(".dot")
    .filter(function (s) { return s.t == tractnum; })
    .on('mousemove', function (event, d) {
      d3.select("#plotTooltip")
        .style("left", (event.clientX + 20) + "px")
        .style("top", (event.clientY - 28) + "px")
        .select("#TractNumber")
        .text(`${tooltipTitle(d.t)}`);
      d3.select("#plotTooltip")
        .select("#value")
        .text(`\$${numberWithCommas(d.y)}`)
      d3.select("#plotTooltip").classed("hidden", false);
      d3.select(this).raise().style("stroke", "#d5ab09").style("stroke-width", 4);

    })
    .on('mouseleave', function (event, d) {
      d3.select("#plotTooltip").classed("hidden", true);
      d3.select(this).raise().style("stroke", null);
    })
  plotG.selectAll(".dot")
    .filter(function (s) { return s.t != tractnum; })
    .on('mousemove', null)
    .on('mouseleave', null)
}

/*
************************************************************************
* STACKED BAR CHART
************************************************************************
*/


var fancyBar = fancyBarChart.append("g")
  .attr("transform", "translate(" + 50 + "," + 40 + ")");

var fancyXScale = d3.scaleBand().range([0, fancyWidth - 150]).padding(0.4);
var fancyYScale = d3.scaleLinear().range([fancyHeight - 200, 0]);

var fancyXAxis = fancyBar.append("g").attr("transform", "translate(0," + (fancyHeight - 200) + ")");
var fancyYAxis = fancyBar.append("g").attr("class", "myYaxis");
var barText = fancyBar.append("text").attr("class", "myLabel");

//Below is code for the legend for the stacked bar barChart
var fancyLegend = fancyBar.append("g")
var fancyLegendG = fancyLegend.append("g")
  .attr("class", "legendThreshold")
  .attr("transform", "translate(" + fancyWidth * 0.45 + "," + fancyHeight * 0.1 + ")");

function getMaxForFancyBarThing() {
  var max = 0;
  for (var i = 0; i < incomeData.length; i++) {
    obj = incomeData[i];
    tractNum = obj.Tract;
    var crimeForTract = crimeData.filter(y => y.Tract == tractNum);
    var sum = 0;
    for (var j = 0; j < crimeForTract.length; j++) {
      sum = sum + parseInt(crimeForTract[j]['Count']);
    };
    if (sum > max) {
      max = sum;
    }
  }

  return max;
}


var colors = ["#575757", "#B7B7B7", "#DEDEDE"];
var crimeTypes = ['PROPERTY', 'PERSON', 'SOCIETY'];
function makeFancyBarLegend() {
  var ordinal = d3.scaleOrdinal()
    .domain(crimeTypes)
    .range(colors);
  var legendOrdinal = d3.legendColor()
    .title("Type of Crime")
    .shape("path", d3.symbol().type(d3.symbolCircle).size(200)())
    .shapePadding(10)
    .cellFilter(function (d) { return d.label !== "e" })
    .scale(ordinal);
  fancyLegend.select(".legendThreshold")
    .style("font-family", "TiemposText-Regular")
    .style("font-size", "16px")
    .call(legendOrdinal);
}


function drawFancyBarThing(tractNum) {
  var crimeForTract = crimeData.filter(y => y.Tract == tractNum);
  crimeForTract.sort(function (a, b) {
    if (a["Crime Against"] == "PROPERTY") {
      return -1;
    } else if (a["Crime Against"] == "SOCIETY") {
      return 0;
    } else {
      return 1;
    }
  })

  // height to offset the bars
  sum = 0;
  for (var i = 0; i < 3; i++) {
    sum = sum + parseInt(crimeForTract[i]['Count']);
  };
  var offsetHeight = fancyHeight - 200;
  fancyXScale.domain(['Recorded Crimes']);
  if (tractNum == 0) {
    fancyYScale.domain([0, 450000]).nice();
  } else {
    fancyYScale.domain([0, 30310]).nice();
  }
  //max calculated using getMaxForFancyBarThing() for the largest
  //total crime out of all tracts

  //Creates the x axis line
  fancyXAxis.call(d3.axisBottom(fancyXScale));

  //creates the y axis line
  fancyYAxis.transition().call(d3.axisLeft(fancyYScale));

  var textHeight = Number.MAX_VALUE;
  var total = 0;

  fancyBar.selectAll("rect")
    .data(crimeForTract, function (d) {
      return d["Crime Against"]
    })
    .join(
      function (enter) {
        enter.append("rect")
          .attr("class", "fancyBar")
          .attr("x", fancyXScale('Recorded Crimes'))
          .attr("width", fancyXScale.bandwidth())
          .attr("y", function (d) {
            let ret = barPosition(crimeForTract, offsetHeight, d);
            if (textHeight > ret) {
              textHeight = ret;
            }
            total += parseInt(d.Count);
            return ret;
          })
          .attr("height", function (d) {
            return offsetHeight - fancyYScale(parseInt(d.Count));
          })
          .attr("fill", function (d) {
            return colors[crimeTypes.indexOf(d["Crime Against"])];
          });
      },
      function (update) {
        update.transition()
          .attr("y", function (d) {
            let ret = barPosition(crimeForTract, offsetHeight, d);
            if (textHeight > ret) {
              textHeight = ret;
            }
            total += parseInt(d.Count);
            return ret;
          })
          .attr("height", function (d) {
            return offsetHeight - fancyYScale(parseInt(d.Count));
          })
      },
      function (exit) {
        exit.transition().remove();
      }
    );

  fancyBar.selectAll("rect")
    .on("mousemove", function (event, d) {
      d3.select(this).raise().style("stroke", "#d5ab09").style("stroke-width", 4);

      d3.select("#stackedBarTooltip")
        .style("left", (event.clientX + 20) + "px")
        .style("top", (event.clientY - 28) + "px")
        .classed("hidden", false);
      d3.select("#stackedBarTooltip")
        .select("#value")
        .text(`${numberWithCommas(d["Count"])}`)
    })
    .on("mouseleave", function (event, d) {
      d3.select(this).raise().style("stroke", null);
      d3.select("#stackedBarTooltip")
        .classed("hidden", true);
    });

  fancyBar.selectAll("text.myLabel")
    .attr("x", fancyXScale('Recorded Crimes') + fancyXScale.bandwidth() / 2)
    .transition()
    .attr("y", textHeight - 5)
    .style("text-anchor", "middle")
    .text(numberWithCommas(total));
}

function barPosition(crimeForTract, offsetHeight, d) {
  index = crimeForTract.indexOf(d)
  var thisheight = 0
  var val = crimeForTract[0]
  if (index == 1) {
    thisheight = offsetHeight - fancyYScale(d.Count)
  } else if (index == 2) {
    var valOne = crimeForTract[1]
    var prevheight = offsetHeight - fancyYScale(valOne.Count)
    thisheight = prevheight + offsetHeight - fancyYScale(d.Count)
  }
  return fancyYScale(val.Count) - thisheight
}

/*
************************************************************************
* PIE CHART
************************************************************************
*/
var pie = d3.pie().value(function (d) {
  return d.value;
}).sort(null);

var piePath = d3.arc()
  .outerRadius(pieRadius * 0.9)
  .innerRadius(pieRadius * 0.5);

var pieLabel = d3.arc()
  .outerRadius(pieRadius)
  .innerRadius(pieRadius * 0.5);

var pieChartColors = ['#154360', '#17a589', '#56C3F2', '#5663F2', '#7fb3d5', '#8FA75A', '#BCFD8E', '#676767'];
// var pieChartColors = ['#dedede', '#1c1c1c', '#ad1111', '#d4c439', '#3062b8', '#702e99', '#2b9e7f'];

var pieChartLabels = ['White', 'Black', 'Indigenous', 'Asian', 'Islander', 'Other', 'Latino', 'Unknown'];

var pieG = pieChart.append("g")
  .attr("transform", "translate(" + pieWidth / 3 + "," + pieHeight / 2.85 + ")");
//Below is things for the pie chart pieChartLegend
// var pieLegend = d3.select("#pieChart").select("svg");
// var pieLegendG = pieLegend.append("g")
//   .attr("class", "legendThreshold")
//   .attr("transform", "translate(" + pieWidth * 0.5 + "," + pieHeight * 0.1 + ")");
pieG.append("g")
  .append("text")
  .attr("class", "racePercentage")
  .style("font-size", "16px")
  .style("text-anchor", "middle")
  .attr("transform", `translate(0, ${plotHeight * 0.015})`)


function pointIsInArc(pt, ptData, d3Arc) {
  // Center of the arc is assumed to be 0,0
  // (pt.x, pt.y) are assumed to be relative to the center
  var r1 = d3Arc.innerRadius()(ptData), // Note: Using the innerRadius
    r2 = d3Arc.outerRadius()(ptData),
    theta1 = d3Arc.startAngle()(ptData),
    theta2 = d3Arc.endAngle()(ptData);

  var dist = pt.x * pt.x + pt.y * pt.y,
    angle = Math.atan2(pt.x, -pt.y); // Note: different coordinate system.

  angle = (angle < 0) ? (angle + Math.PI * 2) : angle;

  return (r1 * r1 <= dist) && (dist <= r2 * r2) &&
    (theta1 <= angle) && (angle <= theta2);
}

const pieChartColorScale = d3.scaleOrdinal()
  .domain(pieChartLabels)
  .range(pieChartColors);

var raceDist = [
  { index: 0, label: 'White', value: 0 },
  { index: 1, label: 'Black', value: 0 },
  { index: 2, label: 'Indigenous', value: 0 },
  { index: 3, label: 'Asian', value: 0 },
  { index: 4, label: 'Islander', value: 0 },
  { index: 5, label: 'Other', value: 0 },
  { index: 6, label: 'Latino', value: 0 },
  { index: 7, label: 'Unknown', value: 0 }
];
// track down pie chart state
var selmodel = SelectionModel();
function createPieChart(tractNum) {
  data = tractToRacePercentages.get(tractNum);
  // update the distribution value
  for (let i = 0; i < raceDist.length; i++) {
    raceDist[i].value = data[i];
  }

  pieG.selectAll("path")
    .data(pie(raceDist), function (d) { return d.data.label })
    .join(
      function (enter) {
        enter
          .append("path")
          .attr("fill", function (d) {
            return selmodel.has(d.data.index) ? pieChartColorScale(d.data.label) : '#ccc';
          })
          .attr("d", piePath)
          .attr("stroke", "white")
          .each(function (d) { this._current = d; })
          .on("mousemove", function (event, d) {
            d3.select(this).raise().style("stroke", "#d5ab09").style("stroke-width", 4);
            pieG.selectAll(".racePercentage")
              .text(parseFloat(tractToRacePercentages.get(currentSelectedTract)[d.index]).toFixed(1) + "%")
          })
          .on("mouseleave", function (event, d) {
            d3.select(this).raise().style("stroke", "white").style("stroke-width", 1);
            pieG.selectAll(".racePercentage")
              .text(null)
          });
      },
      function (update) {
        update
          .attr("fill", function (d) {
            return selmodel.has(d.data.index) ? pieChartColorScale(d.data.label) : '#ccc';
          })
          .attr("stroke", "white")
          .call(update => update.transition()
            .attrTween("d", arcTween))
      },
      function (exit) {
        exit.remove();
      }
    )
  // Making the legend
  // pieChart.append('g')
  //   .attr('transform', `translate(${pieWidth * 0.8}, 10)`)
  //   .call(container => createPieLegend(container, selmodel));

  // update the chart accordingly to the legend selection
  selmodel.on('change.chart', () => {
    pieG.selectAll("path").attr('fill', d => selmodel.has(d.data.index) ? pieChartColorScale(d.data.label) : '#ccc');
  });
}

function arcTween(a) {
  var i = d3.interpolate(this._current, a);
  this._current = i(0);
  return function (t) {
    return piePath(i(t));
  };
}

// container is a d3 selection for the container group (<g>) element
// selmodel is a selection model instance for tracking selected legend entries
// make the pie legend
function createPieLegend() {
  const titlePadding = 14;
  const entrySpacing = 16;
  const entryRadius = 5;
  const labelOffset = 6;
  const baselineOffset = 4;
  const positionYOffset = 7;
  const pieLegend = pieChart.append('g')
    .attr('transform', `translate(${pieWidth * 0.65}, 15)`);

  const title = pieLegend.append('text')
    .attr('x', 0)
    .attr('y', positionYOffset)
    .attr('fill', 'black')
    .attr('font-weight', 'bold')
    .attr('font-size', '20px')
    .text('Race');

  // The "on" method registers event listeners
  // We update the selection model in response
  const entries = pieLegend.selectAll('g')
    .data(raceDist)
    .join('g')
    .attr('transform', d => `translate(0, ${titlePadding + d.index * entrySpacing})`)
  // .on('click', (e, d) => selmodel.toggle(d.index)) // <-- respond to clicks
  // .on('dblclick', () => selmodel.clear());         // <-- respond to double clicks

  const symbols = entries.append('circle')
    .attr('cx', entryRadius)
    .attr('cy', positionYOffset)
    .attr('r', entryRadius)
    .attr('fill', d => pieChartColorScale(d.index));

  const labels = entries.append('text')
    .attr('x', 2 * entryRadius + labelOffset)
    .attr('y', baselineOffset + positionYOffset)
    .attr('fill', 'black')
    .attr('font-size', '14px')
    .style('user-select', 'none')
    .text(d => d.label);

  // Listen to selection model, update symbol and labels upon changes
  // selmodel.on('change.legend', () => {
  //   symbols.attr('fill', d => selmodel.has(d.index) ? pieChartColorScale(d.index) : '#ccc');
  //   labels.attr('fill', d => selmodel.has(d.index) ? 'black' : '#bbb');
  // });
}

/*
************************************************************************
* SCATTER PLOT
************************************************************************
*/

var scatterLabels = ['Median Income White', 'Median Income Asian', 'Median Income Latino', 'Median Income Other', 'Median Income Black'];

var plotXScale, plotYScale, plotXAxis, plotYAxis;

function drawPlot() {
  var data = []
  var defaultNum = 0
  var seattleData = []
  incomeData.forEach(function (entry) {
    for (var i = 0; i < scatterLabels.length; i++) {
      var label = scatterLabels[i]
      var income = parseInt(entry[label])
      if (income > 0) {
        data.push({ x: label, y: income, t: entry.Tract })
        if (entry.Tract == 0) {
          seattleData.push({ x: label, y: income, t: entry.Tract })
        }
      }
    }
  })
  plotXScale = d3.scaleBand().range([0, plotWidth]).padding(0.4)
    .domain(scatterLabels)

  plotYScale = d3.scaleLinear()
    .domain([0, 260000])
    .range([plotHeight, 0]);

  plotXAxis = plotG.append("g")
    .attr("transform", "translate(0," + (plotHeight) + ")")
    .call(d3.axisBottom(plotXScale))
    .selectAll("text")
    .style("text-anchor", "start")
    .attr("dx", "-12em")
    .attr("dy", "2em")
    .style("font-size", "14px")
    .attr("transform", "rotate(-45)");

  plotYAxis = plotG.append("g")
    .call(d3.axisLeft(plotYScale));

  plotG.selectAll(".bar")
    .data(seattleData)
    .enter().append("rect")
    .style("fill", "silver")
    .attr("x", function (d) {
      return plotXScale(d.x) + (plotXScale.bandwidth() / 2) - 20
    })
    .attr("width", 40)
    .attr("y", function (d) { return plotYScale(d.y); })
    .attr("height", 2);

  plotG.selectAll(".dot")
    .data(data)
    .enter().append("circle")
    .attr("class", "dot")
    .attr("cx", function (d) {
      return plotXScale(d.x) + (plotXScale.bandwidth() / 2)
    })
    .attr("cy", function (d) { return plotYScale(d.y) })
    .attr("r", 3)
    .attr("tractNum", function (d) { return d.t })
    .style("fill", function (d) {
      if (d.x == "Median Income White") {
        return '#154360'
      } else if (d.x == "Median Income Asian") {
        return '#5663F2'
      } else if (d.x == "Median Income Black") {
        return '#17a589'
      } else if (d.x == "Median Income Other") {
        return '#8FA75A'
      } else {
        return '#BCFD8E'
      }
    })

  plotG.append("g")
    .append("text")
    .attr("class", "medianIncome")
    .style("font-size", "16px")
    .attr("transform", `translate(${plotWidth * 0.35}, ${plotHeight * 0.05})`)
}

function tooltipTitle(t) {
  if (t == 0) {
    return "City of Seattle"
  } else {
    if (t % 10 != 0) {
      t = t / 100.0
    } else {
      t = t / 100
    }
    return "Census Tract " + t
  }
}
/*
************************************************************************
* HELPER FUNCTIONS
************************************************************************
*/

/*
* Helper function that assigns an index based on sorted order for explicit
* quantile color scale.
*/
function createMapping(crimeData, quantiledValue) {
  let sortable = [];
  let tempMap = new Map();

  // create array for sorting
  for (let i = 0; i < crimeData.length; i++) {
    let entry = crimeData[i];
    if (entry["Tract"] == "0") {
      continue;
    }
    if (!tempMap.has(entry["GEO_ID"])) {
      let index = sortable.length;
      tempMap.set(entry["GEO_ID"], index);

      // Create object
      let sortableEntry = new Object();
      sortableEntry[quantiledValue] = parseInt(entry[quantiledValue]);
      sortableEntry["Tract"] = entry["Tract"];
      sortableEntry["GEO_ID"] = entry["GEO_ID"];
      sortable.push(sortableEntry);
    } else {
      // else, if object already exists, update count
      let index = tempMap.get(entry["GEO_ID"]);
      let sortableEntry = sortable[index];
      sortableEntry[quantiledValue] += parseInt(entry[quantiledValue]);
    }
  }
  sortable = removeItemAll(sortable, -1, quantiledValue);
  // perform sort
  sortable.sort(function (a, b) {
    return a[quantiledValue] - b[quantiledValue];
  })

  let mapping = new Map();
  for (let i = 0; i < sortable.length; i++) {
    mapping.set(parseInt(sortable[i]["Tract"]), i);
  }

  return mapping;
}

// Our selection model wraps two components:
// - A JavaScript Set for tracking the selected elements
// - A D3 dispatch helper for registering and invoking listener callbacks upon changes
function SelectionModel(values) {
  const dispatch = d3.dispatch('change');
  const state = new Set(values);

  const api = {
    on: (type, fn) => (dispatch.on(type, fn), api),
    clear: () => (clear(), api),
    has: value => !state.size || state.has(value),
    set: value => (update(value, true), api),
    toggle: value => (update(value, !state.has(value)), api)
  };

  function clear() {
    if (state.size) {
      state.clear();
      dispatch.call('change', api, api);
    }
  }

  function update(value, add) {
    if (add && !state.has(value)) {
      state.add(value);
      dispatch.call('change', api, api);
    } else if (!add && state.has(value)) {
      state.delete(value);
      dispatch.call('change', api, api);
    }
  }

  return api;
}

// converts numbers to numbers with commas
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/*
************************************************************************
* HANDLE SCROLLYTELLING
************************************************************************
*/
// const ID_INCOME = "Median Income"
// const ID_CRIME = "Total Crime"
const ID_DOWNTOWN = "8100"  // TRACT ID
const ID_MONTLAKE = "6200"  // TRACT ID
const ID_BRIARCLIFF = "5600"
const ID_LAURELHURST = "4100"
const ID_BROADVIEW = "500"
const ID_NORTHGATE = "1200"
const ID_BALLARD = "4700"
const ID_COLUMBIA = "10100"
const ID_BEACON_HILL = "9400"
const ID_INTERNATIONAL = "9100"
const ID_RAINIER = "11800"

const container = d3.select('#scrolly-overlay')
const stepSel = container.selectAll('.step')

function resetMouseovers() {
  plotG.selectAll(".dot").style("stroke", null);
  pieG.selectAll("path").style("stroke", "white").style("stroke-width", 1);
  pieG.selectAll(".racePercentage").text(null);
  d3.selectAll(".tooltip").classed("hidden", true);
  fancyBar.selectAll("rect").style("stroke", null);
  tractMap.selectAll("path").style("stroke", "#A9A9A9").style("stroke-width", 1);
}

function updateCharts(index) {
  if (index == 0) {
    return;
  }
  if (index == 1) {
    tractEl = document.getElementById(ID_DOWNTOWN);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 2) {
    tractEl = document.getElementById(ID_MONTLAKE);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 3) {
    tractEl = document.getElementById(ID_BRIARCLIFF);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 4) {
    tractEl = document.getElementById(ID_LAURELHURST);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 5) {
    tractEl = document.getElementById(ID_BROADVIEW);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 6) {
    tractEl = document.getElementById(ID_NORTHGATE);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 7) {
    tractEl = document.getElementById(ID_BALLARD);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 8) {
    tractEl = document.getElementById(ID_COLUMBIA);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 9) {
    tractEl = document.getElementById(ID_BEACON_HILL);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 10) {
    tractEl = document.getElementById(ID_INTERNATIONAL);
    resetMouseovers()
    eventFire(tractEl, 'click')
  } else if (index == 11) {
    tractEl = document.getElementById(ID_RAINIER);
    resetMouseovers()
    eventFire(tractEl, 'click')
  }
  // if (index == 0) {
  //   tractEl = document.getElementById(ID_DOWNTOWN)
  //   resetMouseovers()
  //   eventFire(tractEl, 'click')
  // } else if (index == 1) {
  //   tractEl = document.getElementById(ID_62)
  //   resetMouseovers()
  //   eventFire(tractEl, 'click')
  // } else if (index == 2) {
  //   tractEl = document.getElementById(ID_CRIME)
  //   resetMouseovers()
  //   eventFire(tractEl, 'click')
  // }
}

function exitCharts() {
  if (selected) {
    tractEl = document.getElementById(ID_DOWNTOWN)
    eventFire(tractEl, 'click')
    eventFire(tractEl, 'mouseleave')
  }
}

enterView({
  selector: stepSel.nodes(),
  offset: 0.5,
  enter: el => {
    const index = +d3.select(el).attr('data-index');
    updateCharts(index, "enter");
  },
  exit: el => {
    let index = +d3.select(el).attr('data-index');
    index == 0 ? exitCharts() : updateCharts(index - 1)
  }
});

function eventFire(el, etype) {
  if (el == null) {
    return;
  }
  if (el.fireEvent) {
    el.fireEvent('on' + etype);
  } else {
    var evObj = document.createEvent('Events');
    evObj.initEvent(etype, true, false);
    el.dispatchEvent(evObj);
  }
}

function removeItemAll(arr, value, quantiledValue) {
  var i = 0;
  while (i < arr.length) {
    if (arr[i][quantiledValue] === value) {
      arr.splice(i, 1);
    } else {
      ++i;
    }
  }
  return arr;
}

/*
************************************************************************
* HANDLE RESIZING OF DASHBOARD
************************************************************************
*/
function handleResize() {
  d3.select("#dashboard").select('.dashSvg').style("width", window.innerWidth - 20 + "px")
  d3.select("#dashboard").select('.dashSvg').style("height", window.innerHeight - 20 + "px")
}
handleResize()
window.addEventListener("resize", handleResize);

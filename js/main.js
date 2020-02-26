var debugMode = true;
var arch, regimes, worldCountries;
Promise.all([
    d3.csv("data/arch_output.csv"),
    d3.csv("data/regimes_output.csv"),
    d3.json('data/world_countries.json')

]).then(function(files) {
    arch = files[0];
    regimes = files[1];
    worldCountries = files[2];
    init();
}).catch(function(err) {
    console.error("Error:", err);
});

var countryColorScheme = d3.schemeSet2;
var genderColorScheme = ['#42bcf4', '#ef88a9'];


var countrySets = [{
	name: 'North America',
	countries: ['USA', 'CAN', 'CRI', 'CUB', 'DOM', 'SLV', 'GTM', 'HTI', 'HND', 'JAM', 'MEX', 'NIC', 'PAN'],
	selected: false
}, {
	name: 'South America',
	countries: ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PRY', 'PER', 'SUR', 'URY', 'VEN'],
	selected: false
}, {
	name: 'Post-Soviet States',
	countries: ['ARM', 'AZE', 'BLR', 'EST', 'GEO', 'KAZ', 'KGZ', 'LVA', 'LTU', 'MDA', 'RUS', 'TJK', 'TKM', 'UKR', 'UZB'],
	selected: false
}, {
	name: 'European Union',
	countries: ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRK', 'HUN', 'IRL', 
				'ITA', 'LVA', 'LTU', 'NLD', 'POL', 'PRT', 'ROU', 'SVN', 'ESP', 'SWE', 'GBR'],
	selected: false
}, {
	name: 'United States and Canada',
	countries: ['USA', 'CAN'],
	selected: false
}, {
	name: 'Arab League',
	countries: ['DZA', 'BHR', 'COM', 'DJI', 'EGY', 'IRQ', 'JOR', 'KWT', 'LBN', 'LBY', 
				'MRT', 'MAR', 'OMN', 'QAT', 'SAU', 'SOM', 'SDN', 'SYR', 'TUN', 'ARE'],
	selected: false
}, {
	name: 'Group of Seven',
	countries: ['USA', 'CAN', 'FRA', 'DEU', 'ITA', 'GBR', 'JPN'],
	selected: false
}];
var heatMapOptions = ['Age', 'Gender'];
var continents = [];
var regimesByCountry = [];
var filteredCountries = [];
var filteredCountriesArch = [];
var leadersByCountry = [];
var legendData = {
	countryColorScheme: countryColorScheme,
	continents: continents,

}
var appData = {
	selectedSetName: 'All',
	selectedHeatMap: 'Age',
	sets: [],
	heatMapOptions: heatMapOptions,
	hoveredCountry: '',
	hoveredLeader: null
}

function init() {
	new Vue({
		el: '#map-legend',
		data: legendData
	});
	new Vue({
		el: '#quick-selection select',
		data: appData,
		methods: {
			onChange: function (event){
				onSetChange(event.target.value);
			}    
		}
	});
	new Vue({
		el: '#heatmap-selection select',
		data: appData,
		methods: {
			onChange: function (event){
				update();
			}    
		}
	});


	for(var i=0;i<regimes.length;i++) {
		var regime = regimes[i];
		if(!regimesByCountry.some(function(entry){ return entry.country == regime.Entity })) {
			regimesByCountry.push({
				code: regime.Code,
				country: regime.Entity,
				continent: regime.continent,
				scores: []
			});
		} 
		countryRegime = regimesByCountry.filter(function(entry) { return entry.country == regime.Entity })[0];
		if(countryRegime) {
			countryRegime.scores.push({
				year: parseInt(regime.Year),
				score: parseInt(regime.Score)
			});
		}

		if(!continents.some(function(cont){ return cont == regime.continent }))
			continents.push(regime.continent);
	}

	for(var i=continents.length-1;i>=0;--i) {
		var continent = continents[i];
		var countries_in_cont = regimesByCountry.filter(function(regime){ return regime.continent == continent }).map(function(regime){ return regime.code });
		countrySets.unshift({
			name: continent,
			countries: countries_in_cont,
			selected: false
		});
	}

	countrySets.unshift({
		name: 'All',
		countries: regimesByCountry.map(function(regime){ return regime.code }),
		selected: false
	});

	countrySets.unshift({
		name: 'Custom',
		countries: [],
		selected: false
	});

	appData.sets = countrySets;

	// Adding continents to JSON data
	for(var i=0;i<worldCountries.features.length;i++) {
		var feature = worldCountries.features[i];
		for(var j=0;j<regimesByCountry.length;j++) {
			var regime = regimesByCountry[j];
			if(feature.id == regime.code) {
				feature.properties.name = regime.country;
				feature.properties.continent = regime.continent;
				feature.properties.code = regime.code;
				break;
			}
		}
	}

	for(var i=0;i<arch.length;i++) {
		var archEntry = arch[i];
		if(!leadersByCountry.some(function(entry){ return entry.country == archEntry.polity_country })) {
			leadersByCountry.push({
				country: archEntry.polity_country,
				continent: archEntry.continent,
				leaders: []
			});
		}
		countryLeader = leadersByCountry.filter(function(entry){ return entry.country == archEntry.polity_country })[0];
		if(countryLeader) {
			countryLeader.leaders.push({
				leader: archEntry.leader,
				endage: archEntry.endage,
				startdate: archEntry.startdate,
				enddate: archEntry.enddate,
				gender: archEntry.gender,
				country: countryLeader.country,
				ccode: archEntry.idacr
			});
		}
	}
	update();
}

function onSetChange(setName) {
	if(setName != 'Custom') {
		for(var i=0;i<countrySets.length;i++) {
			var set = countrySets[i];
			if(set.name == 'Custom') {
				set.countries = [];
				break;
			}
		}
	}
	update();
}

function onMapCountryClick(countryCode) {
	var selectedSet = this.getSelectedSet();
	var currentCountries = selectedSet.countries;

	appData.selectedSetName = 'Custom';
	var customSet = this.getSelectedSet();
	customSet.countries = currentCountries.slice();
	if(customSet.countries.some(function(cCode) { return cCode == countryCode })) {
		customSet.countries.splice(customSet.countries.indexOf(countryCode), 1);
	} else {
		customSet.countries.push(countryCode);
	}
	update();
}

function update() {
	updateFilteredCountries();
	d3.selectAll("svg").selectAll("*").remove();
	// drawLineChart();
	drawMap();
	drawLeadersChart();
}

function updateFilteredCountries() {
	var selectedSet = getSelectedSet();
	if(selectedSet) {
		filteredCountries = regimesByCountry.filter(function(regime) { return selectedSet.countries.indexOf(regime.code) != -1 });

		var selectedCountryNames = filteredCountries.map(function(regime) { return regime.country; });
		filteredCountriesArch = leadersByCountry.filter(function(entry) { return selectedCountryNames.indexOf(entry.country) != -1 });
	}
}

function getSelectedSet() {
	for(var i=0;i<countrySets.length;i++) {
		if(countrySets[i].name == appData.selectedSetName) {
			return countrySets[i];
		}
	}
	return null;
}

function getCountryRegimes(countryName) {
	for(var i=0;i<regimesByCountry.length;i++) {
		var regime = regimesByCountry[i];
		if(regime.country == countryName) {
			return regime;
		}
	}
	return null;
}

function getScoreByCountryAndYear(countryName, year) {
	for(var i=0;i<regimesByCountry.length;i++) {
		var regime = regimesByCountry[i];
		if(regime.country == countryName) {
			for(var j=0;j<regime.scores.length;j++) {
				var scoreRecord = regime.scores[j];
				if(scoreRecord.year == year && scoreRecord.score != 0 && scoreRecord.score != -20) {
					return scoreRecord.score;
				}
			}
		}
	}
	return null;
}

function getContinentByCountry(countryName) {
	for(var i=0;i<filteredCountriesArch.length;i++) {
		if(filteredCountriesArch[i].country == countryName) {
			return filteredCountriesArch[i].continent;
		}
	}
	return null;
}

function drawLineChart() {
	var tooltip = d3.select("#dd-index .tooltip")
					.attr("class", "tooltip")				
					.style("opacity", 0);

	var vMargin = 30, hMargin = 20;
	var svgWidth = d3.select("#dd-index").node().getBoundingClientRect().width - 2 * hMargin,
	    svgHeight = d3.select("#dd-index").node().getBoundingClientRect().height - 2 * vMargin;            

	var svg = d3.select('#dd-index .chart')
		.attr('width', svgWidth)
		.attr('height', svgHeight)
		.attr("transform", "translate(" + hMargin + ", " + vMargin +")");

	var minDate = d3.min(regimes, function(d){ return moment.utc(d.Year, 'YYYY-MM-DD').toDate() });
	var maxDate = d3.max(regimes, function(d){ return moment.utc(d.Year, 'YYYY-MM-DD').toDate() });
	var xScale = d3.scaleTime()
	    .domain([minDate, 
	    		 maxDate])
	    .range([0, svgWidth-2*hMargin]);

	var yScale = d3.scaleLinear()
		.domain([-11, 11])
		.range([svgHeight-2*vMargin, 0]);

	var xAxis = d3.axisBottom()
		.scale(xScale)
		.ticks(20);
	var yAxis = d3.axisLeft().scale(yScale);


	var zeroLine = svg.append("line")
		.attr("x1", xScale(minDate) + hMargin)
		.attr("x2", xScale(maxDate) + hMargin)
		.attr("y1", yScale(0) + vMargin + 0.5)
		.attr("y2", yScale(0) + vMargin + 0.5)
		.attr("stroke", "#000")
		.attr("stroke-width", 2);

	var xAxisYTranslate = svgHeight - vMargin;
	svg.append("g")
		.attr("transform", "translate(" + hMargin + ", " + xAxisYTranslate  +")")
		.call(xAxis);

	svg.append("g")
		.attr("transform", "translate(" + hMargin + ", " + vMargin + ")")
		.call(yAxis);

	// var g = svg.append("g")
 //    	.attr("transform", "translate(" + hMargin + "," + vMargin + ")");

    var line = d3.line()
    	.curve(d3.curveBasis)
	    .x(function(d) { return xScale(moment.utc(d.year, 'YYYY').toDate()) + hMargin; })
	    .y(function(d) { return yScale(d.score) + vMargin })
	    .defined(function(d) { return d.score != -20 && d.score != 0 });

    svg.selectAll("g.dd-index")
      	.data(filteredCountries)
    	.enter().append("g")
    	// .attr('class', 'dd-index')
    	.attr('class', function(d){return "dd-index " + d.code})
      	.each(function(d, i) { 
      		d3.select(this).selectAll('path')
                .data([d.scores])
            	.enter()
                .append('path')
                .attr("class", "line")
                .attr('data-country', d.country)
                .attr("fill", "none")
			    .attr("stroke", "gray")
			    .attr("stroke-linejoin", "round")
			    .attr("stroke-linecap", "round")
			    .attr("stroke-opacity", 0.8)
                .attr('d', line)
                .exit()
                .remove();
      	})
      	.on('mouseover',function(d){
			tooltip.text(d.country)
				.style('opacity', 1);
			appData.hoveredCountry = d.country;

			updateLineChart();
			updateMap();
			updateLeadersChart();
		})
		.on('mouseout', function(d){
			tooltip.text(d.country)
				.style('opacity', 0);
			appData.hoveredCountry = "";

			updateLineChart();
			updateMap();
			updateLeadersChart();
		})
		.on('mousemove',function(d){
			var mouse = d3.mouse(d3.event.target);
			tooltip.style('left', mouse[0] + 10 + "px")
				.style('top', mouse[1] - 10 + "px")
		})
      	.exit().remove();
    updateLineChart();
}

function updateLineChart() {
	d3.selectAll("g.dd-index")
      	.each(function(d, i) { 
      		var lineEl = this;
      		d3.select(this).selectAll('path')
			    .attr("stroke-width", function(score) {
			    	if(d.country == appData.hoveredCountry) {
			    		d3.select(lineEl).moveToFront();
			    		return 4;
			    	} else {
			    		return 2;
			    	}
			    })
			    .style('stroke', function(score) {
			    	if(appData.hoveredCountry) {
			    		if(d.country != appData.hoveredCountry) {
			    			return "#ddd";
			    		} else {
			    			return countryColorScheme[continents.indexOf(d.continent)]; 	
			    		}
			    	} else {
			    		var selectedSet = getSelectedSet();
						var index = selectedSet.countries.indexOf(d.code);
						if(index != -1) {
							return countryColorScheme[continents.indexOf(d.continent)]; 	
						} else {
							return "#ddd";
						}
			    	}
                })
      	})
}

function drawMap() {
	var tooltip = d3.select("#map .tooltip")
			    .attr("class", "tooltip")				
			    .style("opacity", 0);

	var margin = {top: 0, right: 0, bottom: 0, left: 0},
	            mapWidth = d3.select("#map").node().getBoundingClientRect().width - margin.left - margin.right,
	            mapHeight = d3.select("#map").node().getBoundingClientRect().height - margin.top - margin.bottom;

	var color = d3.scaleOrdinal(countryColorScheme);

	var svg = d3.select("#map .chart")
	            .attr("width", "100%")
	            .attr("height", "100%")
	            .append('g')
	            .attr('class', 'map')

	var projection = d3.geoMercator()
	                   	.scale(100)
	                  	.translate( [mapWidth / 2, mapHeight / 1.5]);

	var path = d3.geoPath().projection(projection);

	svg.append("g")
		.attr("class", "countries")
	.selectAll("path")
	  	.data(worldCountries.features)
	.enter().append("path")
		.attr("d", path)
		.style("fill", function(d) { 
			var selectedSet = getSelectedSet();
			var index = selectedSet.countries.indexOf(d.properties.code);
			if(index != -1) {
				return countryColorScheme[continents.indexOf(d.properties.continent)]; 	
			} else {
				return "#ddd";
			}
		})
		.style('stroke', 'white')		
		.style("opacity",0.8)
		.style('stroke-width', 0.3)
		.on('mouseover',function(d){
			tooltip.text(d.properties.name)
				.style('opacity', 1);
			appData.hoveredCountry = d.properties.name;
			
			updateMap();
			updateLineChart();
			updateLeadersChart();
		})
		.on('mouseout', function(d){
			tooltip.text(d.properties.name)
				.style('opacity', 0);
			appData.hoveredCountry = "";
			
			updateMap();
			updateLineChart();
			updateLeadersChart();
		})
		.on('mousemove',function(d){
			var mouse = d3.mouse(d3.event.target);
			tooltip.style('left', mouse[0] + 10 + "px")
				.style('top', mouse[1] - 10 + "px")
		})
		.on('click', function(d){
			if(d.properties.code) {
				onMapCountryClick(d.properties.code);
			}
		})
		.attr("pointer-events", "all");

	svg.append("path")
		.datum(topojson.mesh(worldCountries.features, function(a, b) { return a.id !== b.id; }))
		.attr("class", "names")
		.attr("d", path);
	updateMap();
}

function updateMap() {
	d3.selectAll(".countries path")
		.style("opacity", function(d) {
			return (d.properties.name == appData.hoveredCountry) ? 1 : 0.8;
		})
		.style("stroke-width", function(d) {
			return (d.properties.name == appData.hoveredCountry) ? 2 : 0.3;
		});
}

function drawLeadersChart() {
	var tooltip = d3.select("#leaders-tooltip svg")
		.attr("class", "tooltip")				
		// .attr("width", 200)
		// .attr("height", 70)
		.style('display', 'none');
	var tooltipContent = tooltip.append('g')
    	.attr('class', 'tooltip-content')
    	// .style('display', 'none');		
    tooltipContent.append('rect')
    	.attr('class', 'tooltip-rect')
    	.attr('x', yAxisOffset)
		.attr('y', 0)
		.style('fill', '#000')
		.style('opacity', 0.6);

	tooltipContent.append('text')
		.attr('class', 'tooltip-text')
		.attr('x', 10)
		.attr('y', 5)
		.style("fill", "black")
	    .text("");			

	var yUnit = 30;
	var vMargin = 30, hMargin = 20;
	var svgWidth = d3.select("#leaders").node().getBoundingClientRect().width - 2 * hMargin,
	    svgHeight = filteredCountriesArch.length * yUnit + 2 * vMargin;

	var svg = d3.select('#leaders .chart')
		.attr('width', svgWidth)
		.attr('height', svgHeight)
		.attr("transform", "translate(" + hMargin + ",  0)");

	// var timeFormat = d3.timeFormat('%Y-%m-%d');
	var minDate = d3.min(arch, function(d){ return moment.utc(d.startdate, 'YYYY-MM-DD').toDate() });
	var maxDate = d3.max(arch, function(d){ return moment.utc(d.enddate, 'YYYY-MM-DD').toDate() });

	var yAxisOffset = 140;

	var xScale = d3.scaleTime()
	    .domain([minDate, 
	    		 maxDate])
	    .range([yAxisOffset, svgWidth-2*hMargin]);

	var sortedCountriesArch = filteredCountriesArch.sort(function(a, b){
	    if(a.country < b.country) { return -1; }
	    if(a.country > b.country) { return 1; }
	    return 0;
	});

	var yScale = d3.scaleBand()
		.domain(sortedCountriesArch.map(function(archEntry){ return archEntry.country }).reverse())
		.range([(svgHeight-2*vMargin), 0]);

	var xAxis = d3.axisBottom()
		.scale(xScale)
		.ticks(20);
	// var yAxis = d3.axisLeft().scale(yScale);

	var yAxis = d3.axisRight(yScale)
	    .tickSize(svgWidth-2*hMargin-yAxisOffset)

	function customXAxis(g) {
		g.call(xAxis);
		g.selectAll(".tick line").attr("stroke", "#ddd");
		g.selectAll(".domain").attr("stroke", "#ddd");
	}

	function customYAxis(g) {
		g.call(yAxis);
		g.select(".domain").remove();
		g.selectAll(".tick line").attr("stroke", "#ddd").attr("transform", "translate(" + yAxisOffset + ", 0)");
		g.selectAll(".tick text").attr("x", 10).attr("dy", -12)
			.attr('fill', function(countryName) {
				var continent = getContinentByCountry(countryName);
				if(continent) {
					return countryColorScheme[continents.indexOf(continent)]
				} else {
					return "#000";
				}
			});
	}

	var xAxisYTranslate = svgHeight - vMargin;
	svg.append("g")
		.attr("transform", "translate(0, " + (vMargin-5)  +")")
		.call(customXAxis);

	svg.append("text")             
      .attr("transform",
            "translate(" + ((svgWidth - yAxisOffset)/2 + yAxisOffset) + " , 15)")
      .style("text-anchor", "middle")
      .text("Year");

	svg.append("g")
		.attr('class', 'y-axis')
		.attr("transform", "translate(0, " + 2*vMargin + ")")
		.call(customYAxis);


	var mainChart = svg.append("g")
    	.attr('id', 'leaders-main-chart')
    	.attr('width', svgWidth-2*hMargin-yAxisOffset)
    	.attr('height', svgHeight)
    	.attr("transform", "translate(0, " + vMargin  +")")
    	.on("mouseover", function(countryName) {
			// console.log("MOUSEOVER", countryName);
			d3.selectAll('.line-over')
				.style('display', 'block');
			d3.selectAll('.time-indicator')
				.style('display', 'block');
			tooltip.style('display', 'block');
		})
		.on("mouseout", function(countryName) {
			d3.selectAll('.line-over')
				.style('display', 'none');
			d3.selectAll('.time-indicator')
				.style('display', 'none');
			tooltip.style('display', 'none')
				.style('left', "-10000px")
				.style('top', "-10000px");
		})
		.on("mousemove", function(countryName) {
			var mouseScreen = d3.mouse(d3.event.target);
			// console.log("MOUSEMOVE", mouse);
			redrawLine(mouseScreen[0], mouseScreen[1]);
			redrawTag(mouseScreen[0], mouseScreen[1]);

			var tooltipText = tooltip.selectAll(".tooltip-text");
			tooltipText.selectAll('tspan').remove();

			if(appData.hoveredLeader) {
				tooltipText.append('tspan').text("Country: " + appData.hoveredLeader.country);
				tooltipText.append('tspan').text("Name: " + appData.hoveredLeader.leader);
				tooltipText.append('tspan').text("Age: " + appData.hoveredLeader.endage);
				tooltipText.append('tspan').text("In Office: " + moment.utc(appData.hoveredLeader.startdate, 'YYYY-MM-DD').format("MMM D, YYYY") + 
						  						 " - " + moment.utc(appData.hoveredLeader.enddate, 'YYYY-MM-DD').format("MMM D, YYYY") + "");
			}

			var countryName = "";
			for(var i=0;i<sortedCountriesArch.length;i++) {
				var diff = mouseScreen[1] - (i*yUnit + vMargin - yUnit/2);
				if(diff > 0 && diff < 30) {
					countryName = sortedCountriesArch[i].country;
				} 
			}
			var year = moment.utc(xScale.invert(mouseScreen[0])).format("YYYY");
			var score = getScoreByCountryAndYear(countryName, year);
			if(score) {
				tooltipText.append('tspan').text("DD Score: " + score);
			}

			tooltipText.selectAll('tspan')
				.attr('x', 10)
				.attr('dy', '18px')
				.style('font-size', '12px')
				.style('fill', '#fff')

			var textWidth = d3.max(tooltipText.selectAll('.tooltip-text tspan').nodes(), function(tspan){
				return tspan.getComputedTextLength()
			});
			var textHeight = tooltipText.selectAll('.tooltip-text tspan').size() * 18;
			var tooltipWidth = textWidth + 20;
			var tooltipHeight = textHeight + 18;

			var mousePage = [d3.event.pageX, d3.event.pageY];

			tooltip.style('width', tooltipWidth)
				.style('height', tooltipHeight)
				.style('left', mousePage[0] - (tooltipWidth/2) + "px")
				.style('top', mousePage[1] - (tooltipHeight + 10) + "px");

			tooltipContent.selectAll('rect')
				.style('width', tooltipWidth)
				.style('height', tooltipHeight)

			if(!appData.hoveredLeader && !score) {
				tooltip.style('display', 'none');  
			}
		})
		
	svg.selectAll(".y-axis .tick")
		.each(function(d,i){
			var tick = d3.select(this),
				text = tick.select('text'),
				bBox = text.node().getBBox();

			tick.insert('rect', ':first-child')
			.attr('x', bBox.x - 10)
			.attr('y', bBox.y - 8)
			.attr('height', yUnit)
			.attr('width', yAxisOffset)
			.style('fill', "#fff")
			.style('stroke', '#ddd');      
		});

	mainChart.append('rect')
		.attr('x', yAxisOffset)
		.attr('y', 0)
		.attr('width', svgWidth-2*hMargin-yAxisOffset)
		.attr('height', svgHeight - 2*hMargin)
		.style('visibility', 'hidden');

    mainChart.selectAll("g.arch-country-item")
      	.data(sortedCountriesArch)
    	.enter().append("g")
    	// .attr('class', 'dd-index')
    	.attr('class', function(d){return "arch-country-item " + d.country})
      	.each(function(d, i) { 
      		d3.select(this).selectAll('rect')
                .data(d.leaders)
            	.enter()
                .append('rect')
                .attr('data-country', d.country)
                .attr("rx", 5)
	            .attr("ry", 5)
	            .attr("x", function(leaderEntry){
					return xScale(moment.utc(leaderEntry.startdate, 'YYYY-MM-DD').toDate());
	            })
	            .attr("y", function(leaderEntry, index){
	                return i*yUnit + vMargin - 7.5;
	            })
	            .attr("width", function(leaderEntry){
	                return (xScale(moment.utc(leaderEntry.enddate, 'YYYY-MM-DD').toDate()) - xScale(moment.utc(leaderEntry.startdate, 'YYYY-MM-DD').toDate()));
	            })
	            .attr("height", 15)
	            .on("mouseover", function(leaderEntry) {
	            	appData.hoveredLeader = leaderEntry;
				})
				.on("mouseout", function(leaderEntry) {
					appData.hoveredLeader = null;
				})
				.on("mousemove", function(leaderEntry) {
					
				})
                .exit()
                .remove();

            var regime = getCountryRegimes(d.country);

            d3.select(this)
            	.selectAll('path')
                .data([regime.scores])
            	.enter()
                .append('path')
                .attr('data-country', regime.country)
                .attr('class', 'score-line')
                .attr("fill", "none")
			    .attr("stroke", "black")
			    .attr("stroke-linejoin", "round")
			    .attr("stroke-linecap", "round")
			    .attr("stroke-width", 2)
			    .attr("stroke-opacity", 0.8)
                .attr('d', d3.line()
					    	.curve(d3.curveBasis)
						    .x(function(scoreEntry) { return xScale(moment.utc(scoreEntry.year, 'YYYY').toDate()); })
						    .y(function(scoreEntry, index) { 
						    	return i*yUnit + vMargin - (scoreEntry.score/20 * (yUnit-6)) 
						    })
						    .defined(function(scoreEntry) { return scoreEntry.score != -20 && scoreEntry.score != 0 })
                )
                .exit()
                .remove();
      	})
      	.exit().remove();

    mainChart.append("line")
	    //d3.select("svg").append("line")
	    .attr("class", 'line-over')
        .attr("x1", -10000)
        .attr("y1", -10000)
        .attr("x2", -10000)
        .attr("y2", -10000)
        .style("stroke", "#666")
        .attr("stroke-dasharray", ("3,3"))
        .style("stroke-width", "1")
        .style("display", "none");

    var timeIndicator = mainChart.append('g')
    	.attr('class', 'time-indicator')
    	.style('display', 'none');

    timeIndicator.append('rect')
    	.attr('class', 'time-tag')
    	.attr('x', -10000)
		.attr('y', -10000)
		.attr('width', 65)
		.attr('height', 20)
		.style('fill', '#000')
		.style('opacity', '0.6');

	timeIndicator.append('text')
		.attr('class', 'time-tag-text')
		.style("fill", "white")
		.style('font-size', '12px')
		.attr('baseline-shift', '0%')
		.attr('text-anchor', 'end')
	    .text("");

    function redrawLine(cx, cy) {
        d3.selectAll('.line-over')
            .attr("x1", cx)
            .attr("y1", 15)
            .attr("x2", cx)
            .attr("y2", svgHeight - 2*hMargin - 5)
            .style("display", "block");
    }

    function redrawTag(cx, cy) {
    	var x = cx;
    	if((svgWidth - cx) < 100) {
    		x = cx - 50;
    	}
    	d3.selectAll('.time-tag')
	    	.attr('x', x)
			.attr('y', cy+25)

		d3.selectAll('.time-tag-text')
			.attr('x', x + 57)
			.attr('y', cy+39)
			.text(moment.utc(xScale.invert(cx)).format("MMM YYYY"))
    }
    updateLeadersChart();
}

function updateLeadersChart() {
	var endAgeExtent = d3.extent(arch.filter(function(d){return d.endage != 0}).map(function(d){return d.endage}));
	var ageColorScale = d3.scaleSequential()
		.domain(endAgeExtent)
		.interpolator(d3.interpolateYlGn);
	d3.selectAll(".arch-country-item")
		.style("opacity", function(d) {
        	// return (d.country == appData.hoveredCountry) ? 1 : 0.8
        	return 1;
        })
        .each(function(d, i) {
        	d3.select(this).selectAll("rect")
	        	.attr("fill", function(leaderEntry) {
	        		if(appData.selectedHeatMap == "Age") {
	        			if(appData.hoveredCountry) {
			        		if(d.country == appData.hoveredCountry) {
			        			return ageColorScale(leaderEntry.endage)	
			        		} else {
			        			return "#ddd";
			        		}
			        	} else {
			        		if(leaderEntry.endage) {
				        		return ageColorScale(leaderEntry.endage)	
				        	} else {
				        		return "#ddd";
				        	}
			        	}
	        		} else if(appData.selectedHeatMap == "Gender") {
	        			if(appData.hoveredCountry) {
			        		if(d.country == appData.hoveredCountry) {
			        			return genderColorScheme[leaderEntry.gender == 'F' ? 1 : 0]	
			        		} else {
			        			return "#ddd";
			        		}
			        	} else {
			        		if(leaderEntry.gender) {
				        		return genderColorScheme[leaderEntry.gender == 'F' ? 1 : 0]	
				        	} else {
				        		return "#ddd";
				        	}
			        	}
	        		}
		        })
        });

    d3.selectAll("#heatmap-legend svg").selectAll("g").remove();
    
    var legendBlockWidth = 50;
    var ddLineGroupOffset = 450;
    if(appData.selectedHeatMap == "Age") {
		var legend = d3.selectAll("#heatmap-legend svg")
			.attr('width', 650)
			.attr('height', 60)
			.selectAll(".legend-color-block")
			.data(ageColorScale.ticks(6).slice(0))
			.enter().append("g")
		  	.attr("class", "legend-color-block")
		  	.attr("transform", function(d, i) { return "translate(" + (i * legendBlockWidth) + ", 0)"; });
			
		legend.append("rect")
			.attr("width", legendBlockWidth)
			.attr("height", 30)
			.style("fill", ageColorScale);

		legend.append("text")
			.attr("x", legendBlockWidth-5)
			.attr("y", 40)
			.attr("dy", ".35em")
			.style('font-size', '12px')
			.text(String);
    } else if(appData.selectedHeatMap == "Gender") {
    	ddLineGroupOffset = 150;
    	var legend = d3.selectAll("#heatmap-legend svg")
    		.attr('width', 350)
			.attr('height', 60)
			.selectAll(".legend-color-block")
			.data(['Male', 'Female'])
			.enter().append("g")
		  	.attr("class", "legend-color-block")
		  	.attr("transform", function(d, i) { return "translate(" + (i * legendBlockWidth) + ", 0)"; });
			
		legend.append("rect")
			.attr("width", legendBlockWidth)
			.attr("height", 30)
			.style("fill", function(d) {
				if(d == 'Male') {
					return genderColorScheme[0];
				} else {
					return genderColorScheme[1];
				}
			});

		var txt = legend.append("text")
			.attr("y", 40)
			.attr("dy", ".35em")
			.style('font-size', '12px')
			.text(String);

		txt.attr("x", function(d) {
				return (legendBlockWidth - this.getBBox().width)/2;
			});
    }

    var legendDDLineGroup = d3.selectAll("#heatmap-legend svg")
    	.append('g');
    legendDDLineGroup.append('line')
    	.attr("x1", ddLineGroupOffset)
		.attr("x2", ddLineGroupOffset+20)
		.attr("y1", 15)
		.attr("y2", 15)
		.attr("stroke", "#000")
		.attr("stroke-width", 2);
	legendDDLineGroup.append('text')
		.attr("x", ddLineGroupOffset+25)
		.attr("y", 15)
		.attr("dy", ".35em")
		.style('font-size', '12px')
		.style('stroke-width', 1)
		.text('Democracy-Dictatorship Score');
}

function $log(msg) {
	if(debugMode) {
		console.log(msg);
	}
}

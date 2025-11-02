export class TabularView {
    constructor(selector, manager) {
        this.container = d3.select(selector);
        this.manager = manager;
        this.currentSortColumn = null;
        this.currentSortDirection = 1; 
        this.setupView();
    }

    setupView() {
        const tableContainer = this.container.append('div')
            .attr('class', 'data-table');

        this.table = tableContainer.append('table')
            .attr('class', 'table-fixed');
        
        this.thead = this.table.append('thead');
        this.tbody = this.table.append('tbody');
        
        
        const headers = [
            'Country',
            'Happiness Score',
            'GDP per Capita',
            'Social Support',
            'Life Expectancy',
            'Freedom',
            'Generosity',
            'Corruption'
        ];

        
        this.thead.append('tr')
            .selectAll('th')
            .data(headers)
            .enter()
            .append('th')
            .text(d => d)
            .attr('class', 'sortable')
            .on('click', (event, d) => this.handleSort(d));
    }

    handleSort(column) {
        const sortKey = this.getSortKey(column);
        const isSameColumn = this.currentSortColumn === sortKey;

        
        this.currentSortDirection = isSameColumn ? -this.currentSortDirection : 1;
        this.currentSortColumn = sortKey;

        this.update(this.currentData);
    }

    getSortKey(header) {
        const keyMap = {
            'Country': 'country',
            'Happiness Score': 'happiness_score',
            'GDP per Capita': 'gdp_per_capita',
            'Social Support': 'social_support',
            'Life Expectancy': 'healthy_life_expectancy',
            'Freedom': 'freedom_to_make_life_choices',
            'Generosity': 'generosity',
            'Corruption': 'perceptions_of_corruption'
        };
        return keyMap[header];
    }

    update(data) {
        this.currentData = data;

        
        const sortedData = [...data].sort((a, b) => {
            if (this.currentSortColumn) {
                const aVal = a[this.currentSortColumn];
                const bVal = b[this.currentSortColumn];

                if (typeof aVal === 'string') {
                    return aVal.localeCompare(bVal) * this.currentSortDirection;
                }
                return (aVal - bVal) * this.currentSortDirection;
            }
            return 0;
        });

        
        const rows = this.tbody.selectAll('tr')
            .data(sortedData, d => d.country);

        
        rows.exit().remove();

        
        const rowsEnter = rows.enter()
            .append('tr')
            .on('click', (event, d) => {
                this.manager.handleCountrySelection(d.country);
            });

        
        const allRows = rows.merge(rowsEnter);

        allRows.each((d, i, nodes) => {
            const row = d3.select(nodes[i]);

            
            row.selectAll('td').remove();

            
            row.append('td').text(d.country);

            this.addMetricVisualization(row, d);
        });

        
        allRows.classed('selected', d => 
            this.manager.state.selectedCountries.has(d.country)
        );
    }

    addMetricVisualization(row, data) {
        const metrics = [
            'happiness_score',
            'gdp_per_capita',
            'social_support',
            'healthy_life_expectancy',
            'freedom_to_make_life_choices',
            'generosity',
            'perceptions_of_corruption'
        ];

        metrics.forEach(metric => {
            const cell = row.append('td').append('div').attr('class', 'chart-cell');

            
            const width = 200;
            const height = 100;

            
            const svg = cell.append('svg')
                .attr('width', width)
                .attr('height', height);

            const values = this.currentData.map(d => d[metric]);
            const xScale = d3.scaleLinear()
                .domain([0, this.currentData.length - 1])
                .range([0, width]);
            const yScale = d3.scaleLinear()
                .domain([d3.min(values), d3.max(values)])
                .range([height, 0]);

            const line = d3.line()
                .x((d, i) => xScale(i))
                .y(d => yScale(d));

            svg.append('path')
                .attr('d', line(values))
                .attr('fill', 'none')
                .attr('stroke', '#b0c4de')
                .attr('stroke-width', 2);

            
            const median = d3.median(values);
            svg.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', yScale(median))
                .attr('y2', yScale(median))
                .attr('stroke', '#b0c4de')
                .attr('stroke-width', 2);

       
            svg.append('line')
                .attr('x1', xScale(this.currentData.findIndex(d => d.country === data.country)))
                .attr('x2', xScale(this.currentData.findIndex(d => d.country === data.country)))
                .attr('y1', 0)
                .attr('y2', height)
                .attr('stroke', '#ff4500')
                .attr('stroke-width', 2);
        });
    }

    handleSync(selection) {
        if (!selection) return;

        this.tbody.selectAll('tr')
            .classed('selected', d => d && d.country && selection.includes(d.country));
    }
}

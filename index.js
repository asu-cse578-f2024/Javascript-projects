import { HappinessVisManager } from './HappinessVisManager.js';
import { MapView } from './MapView.js';
import { ProjectionView } from './ProjectionView.js';
import { ComparisonView } from './ComparisonView.js';
import { TabularView } from './TabularView.js';

document.addEventListener('DOMContentLoaded', () => {
    const manager = new HappinessVisManager();
    
    const views = {
        map: new MapView('#world-map', manager),
        projection: new ProjectionView('#projection-view', manager),
        comparison: new ComparisonView('#comparison-chart', manager),
        tabular: new TabularView('#tabular-view', manager)
    };

    window.handleDatasetChange = (value) => {
        if (typeof manager.handleDatasetChange === 'function') {
            manager.handleDatasetChange(value);
        } else {
            console.error('handleDatasetChange not defined in manager');
        }
    };

    window.handleYearChange = (value) => manager.handleYearChange(value);    

    manager.initialize(views);
});
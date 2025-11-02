# Aayushi-Anshika-Nithiyashree-Prasham-Raghav

## HappinessVis: Visual Analysis of Global Happiness Metrics

### Overview
HappinessVis is an interactive visualization tool designed to analyze and explore factors contributing to national well-being using the World Happiness Report dataset. Built on the SkyLens framework, HappinessVis uses skyline queries and advanced visualization techniques to help users identify top-performing countries, analyze clusters, and gain insights into the drivers of happiness across the globe.

### Features
- Dynamic Visualizations:
  -- Tabular views with diverging bar charts and attribute distribution plots.
  -- Projection views with skyline glyphs for comparative analysis.
  -- Comparison views using radar charts and parallel coordinate plots.
- Interactive Extensions:
  -- Year Slider (2015–2019): Analyze temporal trends in happiness metrics.
  -- Map-Based Visualization: Geographical representation of happiness scores.
- Multi-Dimensional Analysis: Understand relationships between attributes such as GDP per capita, social support, life expectancy, and perceptions of corruption.

### Use Cases
HappinessVis is a valuable tool for:

Policymakers analyzing the impact of economic and social policies.
Researchers studying global well-being trends.
Educators teaching data visualization and decision-making techniques.

### Dataset
The project uses the World Happiness Report (2015–2019) dataset sourced from Kaggle. The primary attributes include:

- Happiness Score: Overall well-being score (Range: 0–10)
- GDP per Capita: Economic performance (Range: 0–2)
- Social Support: Availability of social networks (Range: 0–2)
- Life Expectancy: Health metric (Range: 0–2)
- Freedom to Make Life Choices: Sense of freedom (Range: 0–1)
- Generosity: Community altruism (Range: -0.5–1)
- Perceptions of Corruption: Public trust (Range: 0–1)

### Installation
Clone the repository:
bash
Copy code
git clone https://github.com/yourusername/HappinessVis.git
Navigate to the project directory:
bash
Copy code
cd HappinessVis
Install dependencies:
bash
Copy code
pip install -r requirements.txt
Run the application:
bash
Copy code
python app.py
Usage
Launch the tool: Open the app in your browser (typically at http://localhost:5000).
Explore data:
Select a year using the slider to view year-specific happiness data.
Use the tabular view to analyze rankings and distributions.
Interact with the map to view regional happiness scores.
Compare countries:
Use comparison views to analyze performance across happiness dimensions.
Visualizations
Tabular View: Attribute-specific rankings and distributions.
Projection View: Skyline glyphs showcasing dominant countries.
Comparison View: Radar charts and parallel coordinate plots for multi-country analysis.
Map-Based View: Geographical patterns in happiness scores.
Extension Plan
Year Slider: Analyze happiness trends from 2015 to 2019.
Map-Based Visualization: Interactive world map to explore regional trends.

### Contributors
- Aayushi
- Anshika
- Nithiyashree
- Prasham
- Raghav

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments
- Based on the SkyLens framework for visual analysis.
- Data sourced from the World Happiness Report on Kaggle.

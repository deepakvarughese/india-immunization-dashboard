# India Immunization Dashboard (NFHS-4, NFHS-5 \& NFHS-6)



An interactive web-based geospatial visualization dashboard exploring state-level childhood immunization coverage and shifts across India using National Family Health Survey (NFHS) data.



\- \*\*Live Dashboard:\*\* \[https://indiaimmunizationdashboard.netlify.app/](https://indiaimmunizationdashboard.netlify.app/)

\- \*\*Permanent Archive (Zenodo):\*\* `https://doi.org/10.5281/zenodo.24461913` \*

### 

### Overview



This application accompanies public health and immunization research in India, providing an interactive interface to inspect state-wise coverage metrics and inter-survey percentage-point (`pp`) shifts across survey rounds (\*\*NFHS-4\*\*, \*\*NFHS-5\*\*, and \*\*NFHS-6\*\*).



### Key Features

\- **Categorized Vaccine \& Indicator Selector**: Organizes indicators into logical clinical and program groups (\*Summary measures\*, \*Birth doses\*, \*Primary series, 6–14 weeks\*, \*Measles and second year\*, \*Process indicators\*, and \*Other Vaccines\* where applicable).

\- **Ordered Reference Timeframes**: Displays survey rounds in chronological order followed by inter-survey change metrics (`NFHS-4 (2015–16)`, `NFHS-5 (2019–21)`, `NFHS-6 (2023–24)`, `Change, NFHS-4 to NFHS-5 (pp)`, and `Change, NFHS-5 to NFHS-6 (pp)`).

\- **Editorial Color Scales**:

&#x20; - *Sequential scale* (Muted Sand to Deep Teal) for absolute coverage percentages.

&#x20; - *Diverging scale* (Plum to Slate Gray to Deep Teal)\* for percentage-point changes.

\- **Transparent Fact-Sheet Gap Handling**: Disables `NFHS-6` and `Change, NFHS-5 to NFHS-6 (pp)` for indicators not yet reported in the NFHS-6 fact sheets and displays a clear notice (\*"Not reported in the NFHS-6 fact sheets"\*) so missing fact-sheet items are not misread as zero or omitted data.

\- **Clean Basemap \& Responsive Layout**: Built with React, Leaflet, and Esri World Gray Canvas tiles, with a collapsible sidebar on desktop and a compact colorbar legend on mobile.







### Data \& Repository Structure



```text

├── public/

│   ├── immunization\_data\_clean.csv   # Processed state-level immunization \& change dataset

│   └── india\_states.geojson          # State boundary polygons

├── src/

│   └── App.jsx                       # Main dashboard component, color scales, and map logic

├── package.json

└── README.md

Primary Dataset: public/immunization\_data\_clean.csv (columns: state, vaccine, survey, value).



Geographic Boundaries: public/india\_states.geojson.



Running Locally

Clone the repository and enter the project directory:



Bash

git clone \[https://github.com/deepakvarughese/india-immunization-dashboard.git](https://github.com/deepakvarughese/india-immunization-dashboard.git)

cd india-immunization-dashboard

Install dependencies:



Bash

npm install

Start the local development server:



Bash

npm run dev

Open the local URL shown in the terminal (typically http://localhost:5173) in your browser.



Citation \& Archiving

To prevent link rot and support reproducible research, releases of this repository are archived on Zenodo with persistent DOIs. Please cite the archived Zenodo record alongside the live dashboard URL when referencing this tool in manuscripts or reports:



Varughese D. deepakvarughese/india-immunization-dashboard: India Immunization Dashboard compating NFHS 4 and NFHS 5 data. Zenodo; 2026. Available from: https://doi.org/10.5281/zenodo.24461913


Author

Deepak Varughese


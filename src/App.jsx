import React, { useState, useEffect } from "react";
import { MapContainer, GeoJSON, TileLayer, ScaleControl } from "react-leaflet";
import Papa from "papaparse";
import { Layers, Calendar, ShieldCheck, Info } from "lucide-react";
import "leaflet/dist/leaflet.css";

// 10 distinct percentage group tiers mapping
const getViridisColor = (d) => {
  if (d === undefined || d === null) return "#e2e8f0"; // Gray for missing data
  return d > 95
    ? "#0f172a"
    : d > 90
      ? "#1e3a8a"
      : d > 85
        ? "#1d4ed8"
        : d > 80
          ? "#3b82f6"
          : d > 75
            ? "#60a5fa"
            : d > 70
              ? "#93c5fd"
              : d > 65
                ? "#fed7aa"
                : d > 60
                  ? "#f97316"
                  : d > 50
                    ? "#ea580c"
                    : d > 40
                      ? "#dc2626"
                      : "#991b1b";
};

export default function App() {
  const [geoData, setGeoData] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for selectors
  const [selectedVaccine, setSelectedVaccine] = useState("BCG");
  const [selectedSurvey, setSelectedSurvey] = useState("NFHS 5");
  const [hoveredState, setHoveredState] = useState(null);

  // Lists for UI dropdowns
  const [vaccines, setVaccines] = useState([]);
  const [surveys, setSurveys] = useState([]);

  // Fetch and parse data assets on initialization
  useEffect(() => {
    const loadAssets = async () => {
      try {
        // 1. Fetch GeoJSON
        const geoRes = await fetch("/india_states.geojson");
        const geoJson = await geoRes.json();
        setGeoData(geoJson);

        // 2. Fetch and Parse CSV
        const csvRes = await fetch("/immunization_data_clean.csv");
        const csvText = await csvRes.text();

        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            setCsvData(results.data);

            // Extract unique values dynamically for filters
            setVaccines(
              [...new Set(results.data.map((d) => d.vaccine))]
                .filter(Boolean)
                .sort(),
            );
            setSurveys(
              [...new Set(results.data.map((d) => d.survey))]
                .filter(Boolean)
                .sort(),
            );
            setLoading(false);
          },
        });
      } catch (error) {
        console.error("Error loading dashboard data assets:", error);
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  // Helper to find specific immunization data point
  const getDataValue = (stateName) => {
    const match = csvData.find(
      (row) =>
        row.state?.toLowerCase().trim() === stateName?.toLowerCase().trim(),
    );

    // Find row matching specific filters
    const filteredMatch = csvData.find(
      (row) =>
        row.state?.toLowerCase().trim() === stateName?.toLowerCase().trim() &&
        row.vaccine === selectedVaccine &&
        row.survey === selectedSurvey,
    );

    // Return both the value and the clean display name from your CSV
    return {
      value: filteredMatch ? filteredMatch.value : null,
      displayName: match ? match.state : stateName,
    };
  };

  // GeoJSON layer styling logic
  const featureStyle = (feature) => {
    const stateName =
      feature.properties.s_name ||
      feature.properties.state ||
      feature.properties.STATE ||
      feature.properties.ST_NM;
    const { value } = getDataValue(stateName);
    return {
      fillColor: getViridisColor(value),
      weight: 1,
      opacity: 1,
      color: "#ffffff",
      fillOpacity: 0.85,
    };
  };

  // Interactions per state layer
  const onEachFeature = (feature, layer) => {
    const stateName =
      feature.properties.s_name ||
      feature.properties.state ||
      feature.properties.STATE ||
      feature.properties.ST_NM;

    layer.on({
      mouseover: (e) => {
        const { value, displayName } = getDataValue(stateName);
        // Pass down the matching data payload to populate the display card overlay
        setHoveredState({ name: displayName, value });
        e.target.setStyle({ fillOpacity: 0.95, weight: 2, color: "#64748b" });
      },
      mouseout: (e) => {
        setHoveredState(null);
        e.target.setStyle({ fillOpacity: 0.85, weight: 1, color: "#ffffff" });
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">
            Loading Interactive Dashboard Map...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Interactive Sidebar Panel */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col justify-between shadow-xl z-10">
        <div className="p-6 overflow-y-auto">
          <div className="flex items-center space-x-2 mb-6">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              India Immunization
            </h1>
          </div>

          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Visualize national vaccination metrics derived from demographic and
            health survey analytics across individual states.
          </p>

          <div className="space-y-5">
            {/* Vaccine Dropdown */}
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                <Layers className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> Select
                Metric / Vaccine
              </label>
              <select
                value={selectedVaccine}
                onChange={(e) => setSelectedVaccine(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              >
                {vaccines.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Survey Dataset Dropdown */}
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />{" "}
                Survey Reference Timeframe
              </label>
              <select
                value={selectedSurvey}
                onChange={(e) => setSelectedSurvey(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              >
                {surveys.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic 10-Tier Map Legend Context Block */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 overflow-y-auto max-h-[40vh]">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Coverage Index
          </h3>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] font-semibold text-slate-700 mb-4">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#0f172a] shrink-0"></span>{" "}
              &gt; 95%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#1e3a8a] shrink-0"></span>{" "}
              91% - 95%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#1d4ed8] shrink-0"></span>{" "}
              86% - 90%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#3b82f6] shrink-0"></span>{" "}
              81% - 85%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#60a5fa] shrink-0"></span>{" "}
              76% - 80%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#93c5fd] shrink-0"></span>{" "}
              71% - 75%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#fed7aa] shrink-0"></span>{" "}
              66% - 70%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#f97316] shrink-0"></span>{" "}
              61% - 65%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#ea580c] shrink-0"></span>{" "}
              51% - 60%
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#dc2626] shrink-0"></span>{" "}
              41% - 50%
            </div>
            <div className="flex items-center col-span-2">
              <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#991b1b] shrink-0"></span>{" "}
              &le; 40%
            </div>
          </div>
          <div className="flex items-start space-x-2 text-slate-400 text-[10px] leading-snug">
            <Info className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
            <span>
              Hover cursor directly over an individual state boundary to display
              precise coverage percentages instantly.
            </span>
          </div>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="flex-1 relative bg-slate-50">
        {/* Original Dynamic Hover Tooltip Overlay */}
        {hoveredState && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/60 rounded-xl p-4 z-[1000] min-w-[200px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Region Context
            </p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {hoveredState.name}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-sm font-medium text-slate-500">
                {selectedVaccine}:
              </span>
              <span className="text-xl font-black text-indigo-600">
                {hoveredState.value !== null
                  ? `${Number(hoveredState.value).toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
          </div>
        )}

        {/* Leaflet Frame Container with Constraints */}
        <MapContainer
          center={[22.9734, 78.6569]}
          zoom={5}
          minZoom={4}
          maxZoom={7}
          maxBounds={[
            [6.0, 68.0],
            [36.0, 98.0],
          ]}
          zoomControl={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          <GeoJSON
            key={`${selectedVaccine}-${selectedSurvey}`}
            data={geoData}
            style={featureStyle}
            onEachFeature={onEachFeature}
          />
          <ScaleControl position="bottomright" />
        </MapContainer>
      </div>
    </div>
  );
}

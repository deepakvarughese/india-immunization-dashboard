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

  // Standardized exact data lookup routine
  const getDataValue = (stateName) => {
    const match = csvData.find(
      (row) =>
        row.state?.toLowerCase().trim() === stateName?.toLowerCase().trim() &&
        row.vaccine === selectedVaccine &&
        row.survey === selectedSurvey,
    );
    return match ? match.value : null;
  };

  // Extract proper name string across multiple shapefile variants
  const getStateDisplayName = (feature) => {
    return (
      feature.properties.s_name ||
      feature.properties.state ||
      feature.properties.STATE ||
      feature.properties.ST_NM
    );
  };

  // GeoJSON layer styling logic
  const featureStyle = (feature) => {
    const stateName = getStateDisplayName(feature);
    const value = getDataValue(stateName);
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
    const stateName = getStateDisplayName(feature);
    const value = getDataValue(stateName);

    // Bind native interactive tooltips structurally within Leaflet's vector panes
    layer.bindTooltip(
      `<div style="font-family: sans-serif; padding: 4px; line-height: 1.4;">
        <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 2px;">${stateName}</strong>
        <span style="color: #475569; font-size: 12px;">${selectedVaccine}:</span> 
        <strong style="color: #2563eb; font-size: 14px;">${value !== null ? value.toFixed(1) + "%" : "N/A"}</strong>
       </div>`,
      { sticky: true, direction: "auto", opacity: 0.98 },
    );

    layer.on({
      mouseover: (e) => {
        const targetLayer = e.target;
        targetLayer.setStyle({
          fillOpacity: 0.95,
          weight: 2.5,
          color: "#2563eb",
        });

        if (
          !window.L?.Browser.ie &&
          !window.L?.Browser.opera &&
          !window.L?.Browser.edge
        ) {
          targetLayer.bringToFront();
        }
      },
      mouseout: (e) => {
        e.target.setStyle({
          fillOpacity: 0.85,
          weight: 1,
          color: "#ffffff",
        });
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-700 font-medium">
            Loading Interactive Dashboard Map...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* Sidebar Control Panel - Desktop left panel / Mobile top banner */}
      <div className="w-full md:w-85 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shadow-md md:shadow-xl z-20 shrink-0 max-h-[45vh] md:max-h-full overflow-y-auto">
        <div className="p-5 md:p-6">
          {/* Header Title Section - Fixed High-Contrast Formatting */}
          <div className="flex items-center space-x-2 mb-4 md:mb-6">
            <ShieldCheck className="h-6 w-6 text-blue-600 shrink-0" />
            <h1
              style={{ color: "#0f172a" }}
              className="text-xl md:text-2xl font-black tracking-tight"
            >
              India Immunization
            </h1>
          </div>

          <p
            style={{ color: "#475569" }}
            className="hidden md:block text-xs font-semibold mb-6 leading-relaxed"
          >
            Visualize national vaccination metrics derived from NFHS analytics
            across individual states.
          </p>

          {/* Form Filter Layout - Rows on desktop / Grid columns on tablets & mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
            {/* Vaccine Dropdown */}
            <div>
              <label
                style={{ color: "#334155" }}
                className="flex items-center text-[11px] font-bold uppercase tracking-wider mb-1.5"
              >
                <Layers className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Select
                Metric / Vaccine
              </label>
              <select
                value={selectedVaccine}
                onChange={(e) => setSelectedVaccine(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
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
              <label
                style={{ color: "#334155" }}
                className="flex items-center text-[11px] font-bold uppercase tracking-wider mb-1.5"
              >
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-500" />{" "}
                Survey Reference Timeframe
              </label>
              <select
                value={selectedSurvey}
                onChange={(e) => setSelectedSurvey(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
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

        {/* Legend Panel - Hidden on small phone screens to maximize space, scrollable on desktop */}
        <div className="hidden sm:block p-5 bg-slate-50 border-t border-slate-200 overflow-y-auto">
          <h3
            style={{ color: "#334155" }}
            className="text-[11px] font-bold uppercase tracking-wider mb-3"
          >
            Coverage Index
          </h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] font-bold text-slate-800 mb-4">
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
          <div className="hidden md:flex items-start space-x-2 text-slate-500 text-[10px] leading-snug">
            <Info className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 mt-0.5" />
            <span>
              Hover cursor or tap an individual state boundary to display
              precise coverage percentages instantly.
            </span>
          </div>
        </div>
      </div>

      {/* Main Map Canvas Area - Dynamically fills remaining screen layout space */}
      <div className="flex-1 h-full w-full relative bg-slate-100 z-10">
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
            filter={(feature) => {
              const type = feature.geometry?.type;
              return type === "Polygon" || type === "MultiPolygon";
            }}
          />
          <ScaleControl position="bottomright" />
        </MapContainer>
      </div>
    </div>
  );
}

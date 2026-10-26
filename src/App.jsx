import React, { useState, useEffect } from "react";
import { MapContainer, GeoJSON, TileLayer, ScaleControl } from "react-leaflet";
import Papa from "papaparse";
import { Layers, Calendar, ShieldCheck, Info } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Dual-mode thematic map rendering color scale
const getFeatureColor = (value, isChangeMetric) => {
  if (value === undefined || value === null) return "#e2e8f0";

  // Mode A: Diverging Scale specifically for any "Change" calculation metric
  if (isChangeMetric) {
    return value > 15
      ? "#004d40"
      : value > 10
        ? "#00796b"
        : value > 5
          ? "#009688"
          : value > 1
            ? "#4db6ac"
            : value >= -1
              ? "#b4c2d0"
              : value > -5
                ? "#c2185b"
                : value > -10
                  ? "#ad1457"
                  : value > -15
                    ? "#880e4f"
                    : "#5c0632";
  }

  // Mode B: Polished Reuters/FT Style Sequential Tiering for Absolute Coverage Index
  return value > 95
    ? "#004d40" // Full Coverage (Midnight Teal)
    : value > 90
      ? "#00695c" // Excellent (Deep Teal)
      : value > 85
        ? "#00897b" // High (Dark Cyan/Teal)
        : value > 80
          ? "#26a69a" // Strong (Medium Teal)
          : value > 75
            ? "#4db6ac" // Good (Soft Teal)
            : value > 70
              ? "#80cbc4" // Moderate (Pale Teal)
              : value > 65
                ? "#b2dfdb" // Fair (Ice Blue/Teal)
                : value > 60
                  ? "#e0f2f1" // Transition Zone (Very Light Teal/Gray)
                  : value > 50
                    ? "#f5ebe0" // Low (Muted Sand)
                    : value > 40
                      ? "#f0d6c2" // Very Low (Soft Coral/Clay)
                      : "#e6b8a2"; // Critical Under-coverage (Muted Earthy Rose)
};

export default function App() {
  const [geoData, setGeoData] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedVaccine, setSelectedVaccine] = useState("BCG");
  const [selectedSurvey, setSelectedSurvey] = useState("NFHS 5");
  const [vaccines, setVaccines] = useState([]);
  const [surveys, setSurveys] = useState([]);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const geoRes = await fetch("/india_states.geojson");
        const geoJson = await geoRes.json();
        setGeoData(geoJson);

        const csvRes = await fetch("/immunization_data_clean.csv");
        const csvText = await csvRes.text();

        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            setCsvData(results.data);
            setVaccines(
              [...new Set(results.data.map((d) => d.vaccine))]
                .filter(Boolean)
                .sort(),
            );

            const extractedSurveys = [
              ...new Set(results.data.map((d) => d.survey)),
            ].filter(Boolean);
            const customOrder = {
              "NFHS 4": 1,
              "NFHS 5": 2,
              Change: 3,
              "NFHS 6": 4,
              "Change 2": 5,
            };
            extractedSurveys.sort(
              (a, b) => (customOrder[a] || 99) - (customOrder[b] || 99),
            );

            setSurveys(extractedSurveys);

            if (extractedSurveys.includes("NFHS 6")) {
              setSelectedSurvey("NFHS 6");
            } else if (extractedSurveys.includes("NFHS 5")) {
              setSelectedSurvey("NFHS 5");
            }

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

  const getDataValue = (stateName) => {
    const match = csvData.find(
      (row) =>
        row.state?.toLowerCase().trim() === stateName?.toLowerCase().trim() &&
        row.vaccine === selectedVaccine &&
        row.survey === selectedSurvey,
    );
    return match ? match.value : null;
  };

  const getStateDisplayName = (feature) => {
    return (
      feature.properties.s_name ||
      feature.properties.state ||
      feature.properties.STATE ||
      feature.properties.ST_NM
    );
  };

  const featureStyle = (feature) => {
    const stateName = getStateDisplayName(feature);
    const value = getDataValue(stateName);
    const isChange = selectedSurvey?.toLowerCase().includes("change");

    return {
      fillColor: getFeatureColor(value, isChange),
      weight: 1,
      opacity: 1,
      color: "#ffffff",
      fillOpacity: 0.85,
    };
  };

  const onEachFeature = (feature, layer) => {
    const stateName = getStateDisplayName(feature);
    const value = getDataValue(stateName);
    const isChange = selectedSurvey?.toLowerCase().includes("change");

    const valueString =
      value !== null
        ? isChange && value > 0
          ? `+${value.toFixed(1)}%`
          : `${value.toFixed(1)}%`
        : "N/A";

    layer.bindTooltip(
      `<div style="font-family: sans-serif; padding: 4px; line-height: 1.4;">
        <strong style="font-size: 13px; color: #0f172a; display: block;">${stateName}</strong>
        <span style="color: #475569; font-size: 11px;">${selectedVaccine}: <strong>${valueString}</strong></span> 
       </div>`,
      { sticky: true, direction: "auto", opacity: 0.98 },
    );

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ fillOpacity: 0.95, weight: 2, color: "#2563eb" });
      },
      mouseout: (e) => {
        e.target.setStyle({ fillOpacity: 0.85, weight: 1, color: "#ffffff" });
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-700 font-medium">
            Loading Interactive Dashboard Map...
          </p>
        </div>
      </div>
    );
  }

  const isChangeActive = selectedSurvey?.toLowerCase().includes("change");

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen fixed top-0 left-0 overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* Sidebar Control Panel */}
      <div className="w-full md:w-80 lg:w-96 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shadow-md z-20 shrink-0">
        <div className="p-4 md:p-6">
          {/* Header Title Section */}
          <div className="flex items-center space-x-2 mb-3 md:mb-6">
            <ShieldCheck className="h-5 w-5 md:h-6 md:w-6 text-blue-600 shrink-0" />
            <h1
              style={{ color: "#0f172a" }}
              className="text-lg md:text-2xl font-black tracking-tight"
            >
              India Immunization
            </h1>
          </div>

          {/* Subtitle Text Line */}
          <p
            style={{ color: "#475569" }}
            className="hidden md:block text-xs font-semibold mb-6 leading-relaxed"
          >
            Visualize national vaccination metrics derived from NFHS analytics
            across individual states.
          </p>

          {/* Form Filter Layout */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-4">
            {/* Vaccine Dropdown */}
            <div>
              <label
                style={{ color: "#334155" }}
                className="flex items-center text-[10px] md:text-[11px] font-bold uppercase tracking-wider mb-1"
              >
                <Layers className="h-3 w-3 mr-1 text-slate-500 hidden sm:inline" />
                Metric / Vaccine
              </label>
              <select
                value={selectedVaccine}
                onChange={(e) => setSelectedVaccine(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs md:text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
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
                className="flex items-center text-[10px] md:text-[11px] font-bold uppercase tracking-wider mb-1"
              >
                <Calendar className="h-3 w-3 mr-1 text-slate-500 hidden sm:inline" />
                Reference Timeframe
              </label>
              <select
                value={selectedSurvey}
                onChange={(e) => setSelectedSurvey(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs md:text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
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

        {/* Dynamic Legend Panel & Attribution Footer */}
        <div className="p-4 md:p-5 bg-slate-50 border-t border-slate-200">
          {/* Desktop Sidebar Legend Area */}
          <div className="hidden md:block">
            <h3
              style={{ color: "#334155" }}
              className="text-[11px] font-bold uppercase tracking-wider mb-3"
            >
              {isChangeActive ? "Percentage Point Shift" : "Coverage Index"}
            </h3>

            {isChangeActive ? (
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] font-bold text-slate-800 mb-4">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#004d40]"></span>
                  &gt; +15%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#00796b]"></span>
                  +11% to +15%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#009688]"></span>
                  +6% to +10%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#4db6ac]"></span>
                  +1% to +5%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#b4c2d0] border border-slate-200"></span>
                  Neutral (0%)
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#c2185b]"></span>
                  -1% to -4%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#ad1457]"></span>
                  -5% to -9%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#880e4f]"></span>
                  -10% to -15%
                </div>
                <div className="flex items-center col-span-2">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#5c0632]"></span>
                  &le; -15%
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] font-bold text-slate-800 mb-4">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#004d40]"></span>
                  &gt; 95%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#00695c]"></span>
                  91% - 95%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#00897b]"></span>
                  86% - 90%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#26a69a]"></span>
                  81% - 85%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#4db6ac]"></span>
                  76% - 80%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#80cbc4]"></span>
                  71% - 75%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#b2dfdb]"></span>
                  66% - 70%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#e0f2f1]"></span>
                  61% - 65%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#f5ebe0]"></span>
                  51% - 60%
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#f0d6c2]"></span>
                  41% - 50%
                </div>
                <div className="flex items-center col-span-2">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#e6b8a2]"></span>
                  &le; 40%
                </div>
              </div>
            )}

            <div className="flex items-start space-x-2 text-slate-500 text-[10px] leading-snug mb-4">
              <Info className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 mt-0.5" />
              <span>
                Hover cursor or tap an individual state boundary to display
                precise coverage percentages instantly.
              </span>
            </div>
          </div>

          {/* Clean Dashboard Personal Credit Footer Section */}
          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-mono border-t border-slate-200/60 md:border-t-0">
            <span>v1.3.0</span>
            <span className="tracking-wide">
              Dashboard :{" "}
              <strong className="text-slate-500 font-semibold font-sans">
                Deepak Varughese
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="flex-1 h-full w-full relative bg-slate-100 z-10">
        <MapContainer
          center={[22.9734, 78.6569]}
          zoom={4.5}
          minZoom={3.5}
          maxZoom={7}
          maxBounds={[
            [6.0, 68.0],
            [36.0, 98.0],
          ]}
          zoomControl={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          />

          {geoData && (
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
          )}
          <ScaleControl position="bottomright" />
        </MapContainer>

        {/* Mobile Horizontal Colorbar Legend Container */}
        <div
          key={selectedSurvey}
          className="absolute bottom-4 left-4 right-4 md:hidden bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200 z-[1000]"
        >
          <div className="flex justify-between items-center mb-1.5">
            <span
              style={{ color: "#0f172a" }}
              className="text-[10px] font-bold uppercase tracking-wider"
            >
              {isChangeActive ? "Performance Shift" : "Coverage Legend"}
            </span>
            <span className="text-[9px] font-medium text-slate-500">
              {isChangeActive
                ? "Plum (Decline) → Teal (Growth)"
                : "Sand (Low) → Deep Teal (High)"}
            </span>
          </div>

          {/* Compressed gradient visual tracking segment array */}
          {isChangeActive ? (
            <div className="w-full flex h-2 rounded-full overflow-hidden">
              <div className="flex-1 bg-[#5c0632]"></div>
              <div className="flex-1 bg-[#880e4f]"></div>
              <div className="flex-1 bg-[#ad1457]"></div>
              <div className="flex-1 bg-[#c2185b]"></div>
              <div className="flex-1 bg-[#b4c2d0]"></div>
              <div className="flex-1 bg-[#4db6ac]"></div>
              <div className="flex-1 bg-[#009688]"></div>
              <div className="flex-1 bg-[#00796b]"></div>
              <div className="flex-1 bg-[#004d40]"></div>
            </div>
          ) : (
            <div className="w-full flex h-2 rounded-full overflow-hidden">
              <div className="flex-1 bg-[#e6b8a2]"></div>
              <div className="flex-1 bg-[#f0d6c2]"></div>
              <div className="flex-1 bg-[#f5ebe0]"></div>
              <div className="flex-1 bg-[#e0f2f1]"></div>
              <div className="flex-1 bg-[#b2dfdb]"></div>
              <div className="flex-1 bg-[#80cbc4]"></div>
              <div className="flex-1 bg-[#4db6ac]"></div>
              <div className="flex-1 bg-[#26a69a]"></div>
              <div className="flex-1 bg-[#00897b]"></div>
              <div className="flex-1 bg-[#00695c]"></div>
              <div className="flex-1 bg-[#004d40]"></div>
            </div>
          )}

          <div className="flex justify-between text-[9px] font-black text-slate-700 mt-1 px-0.5">
            <span>{isChangeActive ? "≤ -15%" : "≤ 40%"}</span>
            <span>{isChangeActive ? "0%" : "71-75%"}</span>
            <span>{isChangeActive ? "> +15%" : "> 95%"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

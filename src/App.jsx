import React, { useState, useEffect } from "react";
import { MapContainer, GeoJSON, TileLayer, ScaleControl } from "react-leaflet";
import Papa from "papaparse";
import { Layers, Calendar, ShieldCheck, Info, AlertCircle } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Structured Metric / Vaccine Categories in exact display sequence
const VACCINE_GROUPS = [
  {
    label: "Summary measures",
    items: [
      "Fully Vaccinated",
      "Fully Vaccinated Card Only",
      "No Vaccination (zero-dose)",
    ],
  },
  {
    label: "Birth doses",
    items: ["BCG", "Hepatitis B 0 Dose", "Polio 0"],
  },
  {
    label: "Primary series, 6–14 weeks",
    items: [
      "Pentavalent and DPT 1",
      "Pentavalent and DPT 2",
      "Pentavalent and DPT 3",
      "Polio 1",
      "Polio 2",
      "Polio 3",
      "Hepatitis B 1st Dose",
      "Hepatitis B 2nd Dose",
      "Hepatitis B 3rd Dose",
      "Rotavirus 3 Doses",
    ],
  },
  {
    label: "Measles and second year",
    items: [
      "MCV Measles and MMR (first dose, 9–12 months)",
      "MCV 2nd Dose (16–24 months)",
    ],
  },
  {
    label: "Process indicators",
    items: ["All Age Appropriate Vaccines", "Vaccination Card Seen"],
  },
];

// Helper to match CSV vaccine strings against configured group items even if CSV omits parenthetical notes
const findMatchingCsvVaccine = (targetLabel, csvVaccineList) => {
  const normTarget = targetLabel.toLowerCase().trim();
  const baseTarget = normTarget.split("(")[0].trim();

  // 1. Exact case-insensitive match
  const exact = csvVaccineList.find(
    (v) => v.toLowerCase().trim() === normTarget,
  );
  if (exact) return exact;

  // 2. Base name match (e.g. "No Vaccination" matching "No Vaccination (zero-dose)")
  const baseMatch = csvVaccineList.find(
    (v) => v.toLowerCase().split("(")[0].trim() === baseTarget,
  );
  return baseMatch || null;
};

// Metrics not reported in NFHS-6 fact sheets (blank for NFHS 6 & Change 2)
const NFHS6_UNAVAILABLE_BASE_NAMES = new Set([
  "hepatitis b 1st dose",
  "hepatitis b 2nd dose",
  "hepatitis b 3rd dose",
  "pentavalent and dpt 1",
  "pentavalent and dpt 2",
  "polio 0",
  "polio 1",
  "polio 2",
  "all age appropriate vaccines",
  "vaccination card seen",
]);

const isMetricUnavailableInNfhs6 = (vaccineName) => {
  if (!vaccineName) return false;
  const base = vaccineName.toLowerCase().split("(")[0].trim();
  return NFHS6_UNAVAILABLE_BASE_NAMES.has(base);
};

// Reference Timeframe configuration: maps CSV 'survey' keys to display labels & sequence
const TIMEFRAME_CONFIG = [
  { key: "NFHS 4", label: "NFHS-4 (2015–16)", order: 1 },
  { key: "NFHS 5", label: "NFHS-5 (2019–21)", order: 2 },
  { key: "NFHS 6", label: "NFHS-6 (2023–24)", order: 3 },
  { key: "Change", label: "Change, NFHS-4 to NFHS-5 (pp)", order: 4 },
  { key: "Change 2", label: "Change, NFHS-5 to NFHS-6 (pp)", order: 5 },
];

// Dual-mode thematic map rendering color scale
const getFeatureColor = (value, isChangeMetric) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "#e2e8f0";
  }

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

  const [selectedVaccine, setSelectedVaccine] = useState("");
  const [selectedSurvey, setSelectedSurvey] = useState("NFHS 6");
  const [csvVaccines, setCsvVaccines] = useState([]);
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

            const uniqueVaccines = [
              ...new Set(
                results.data.map((d) => d.vaccine?.trim()).filter(Boolean),
              ),
            ];
            setCsvVaccines(uniqueVaccines);

            // Default to Fully Vaccinated (or first matched summary item)
            const defaultMatch =
              findMatchingCsvVaccine("Fully Vaccinated", uniqueVaccines) ||
              findMatchingCsvVaccine("BCG", uniqueVaccines) ||
              uniqueVaccines[0] ||
              "";
            setSelectedVaccine(defaultMatch);

            // Extract unique surveys and order: NFHS 4, NFHS 5, NFHS 6, Change, Change 2
            const extractedSurveys = [
              ...new Set(results.data.map((d) => d.survey?.trim())),
            ].filter(Boolean);

            const orderMap = Object.fromEntries(
              TIMEFRAME_CONFIG.map((t) => [t.key, t.order]),
            );
            extractedSurveys.sort(
              (a, b) => (orderMap[a] || 99) - (orderMap[b] || 99),
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

  // Automatically switch away from NFHS 6 / Change 2 if an unavailable metric is picked
  const handleVaccineChange = (newVaccine) => {
    setSelectedVaccine(newVaccine);
    if (
      isMetricUnavailableInNfhs6(newVaccine) &&
      (selectedSurvey === "NFHS 6" || selectedSurvey === "Change 2")
    ) {
      setSelectedSurvey("NFHS 5");
    }
  };

  const isTimeframeDisabled = (surveyKey) => {
    return (
      isMetricUnavailableInNfhs6(selectedVaccine) &&
      (surveyKey === "NFHS 6" || surveyKey === "Change 2")
    );
  };

  const getSurveyDisplayLabel = (surveyKey) => {
    const found = TIMEFRAME_CONFIG.find((t) => t.key === surveyKey);
    const baseLabel = found ? found.label : surveyKey;
    return isTimeframeDisabled(surveyKey)
      ? `${baseLabel} — Not in NFHS-6 fact sheets`
      : baseLabel;
  };

  const getDataValue = (stateName) => {
    const match = csvData.find(
      (row) =>
        row.state?.toLowerCase().trim() === stateName?.toLowerCase().trim() &&
        row.vaccine?.trim() === selectedVaccine &&
        row.survey?.trim() === selectedSurvey,
    );
    return match && match.value !== "" && match.value !== null
      ? Number(match.value)
      : null;
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
      value !== null && !Number.isNaN(value)
        ? isChange
          ? `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`
          : `${value.toFixed(1)}%`
        : isTimeframeDisabled(selectedSurvey)
          ? "Not reported in NFHS-6 fact sheets"
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
  const isCurrentSelectionMissingNfhs6 = isTimeframeDisabled(selectedSurvey);

  // Build grouped options and track which CSV vaccines were matched
  const matchedCsvVaccines = new Set();
  const groupedOptions = VACCINE_GROUPS.map((group) => {
    const options = group.items
      .map((displayLabel) => {
        const csvKey = findMatchingCsvVaccine(displayLabel, csvVaccines);
        if (csvKey) {
          matchedCsvVaccines.add(csvKey);
          return { value: csvKey, label: displayLabel };
        }
        return null;
      })
      .filter(Boolean);
    return { label: group.label, options };
  }).filter((group) => group.options.length > 0);

  const uncategorizedVaccines = csvVaccines
    .filter((v) => !matchedCsvVaccines.has(v))
    .sort();

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
            {/* Grouped Vaccine Dropdown */}
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
                onChange={(e) => handleVaccineChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs md:text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
              >
                {groupedOptions.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {uncategorizedVaccines.length > 0 && (
                  <optgroup label="Other Vaccines">
                    {uncategorizedVaccines.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </optgroup>
                )}
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
                {surveys.map((s) => {
                  const disabled = isTimeframeDisabled(s);
                  return (
                    <option
                      key={s}
                      value={s}
                      disabled={disabled}
                      className={disabled ? "text-slate-400" : "text-slate-900"}
                    >
                      {getSurveyDisplayLabel(s)}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Subtle contextual note when NFHS-6 fact sheet options are greyed out */}
          {isMetricUnavailableInNfhs6(selectedVaccine) && (
            <p className="mt-2.5 text-[11px] text-slate-500 leading-snug flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                NFHS-6 and NFHS-5 to 6 change are disabled because this metric
                is not reported in the NFHS-6 fact sheets.
              </span>
            </p>
          )}
        </div>

        {/* Dynamic Legend Panel & Attribution Footer */}
        <div className="p-4 md:p-5 bg-slate-50 border-t border-slate-200">
          {/* Desktop Sidebar Legend Area */}
          <div className="hidden md:block">
            <h3
              style={{ color: "#334155" }}
              className="text-[11px] font-bold uppercase tracking-wider mb-3"
            >
              {isChangeActive
                ? "Percentage Point Shift (pp)"
                : "Coverage Index"}
            </h3>

            {isChangeActive ? (
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] font-bold text-slate-800 mb-4">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#004d40]"></span>
                  &gt; +15 pp
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#00796b]"></span>
                  +11 to +15 pp
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#009688]"></span>
                  +6 to +10 pp
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#4db6ac]"></span>
                  +1 to +5 pp
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#b4c2d0] border border-slate-200"></span>
                  Neutral (0 pp)
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#c2185b]"></span>
                  -1 to -4 pp
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#ad1457]"></span>
                  -5 to -9 pp
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#880e4f]"></span>
                  -10 to -15 pp
                </div>
                <div className="flex items-center col-span-2">
                  <span className="w-3 h-3 rounded-sm mr-1.5 bg-[#5c0632]"></span>
                  &le; -15 pp
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
            <span>v1.4.0</span>
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
        {/* Map-level Notice Banner if NFHS-6 Fact Sheet Unreported Metric is Active */}
        {isCurrentSelectionMissingNfhs6 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-sm border border-amber-300 shadow-md rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-slate-800">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Not reported in the NFHS-6 fact sheets.</span>
          </div>
        )}

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
              {isChangeActive ? "Performance Shift (pp)" : "Coverage Legend"}
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
            <span>{isChangeActive ? "≤ -15 pp" : "≤ 40%"}</span>
            <span>{isChangeActive ? "0 pp" : "71-75%"}</span>
            <span>{isChangeActive ? "> +15 pp" : "> 95%"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

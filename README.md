# Aquatic — Flood Observatory

A working CesiumJS explorer for the East Fork Pigeon River near Cruso, North Carolina. This is the first MVP for the **grokathon** project.

## What works

- Real 3D terrain and satellite imagery, without requiring a Cesium ion token.
- Fred (2021) and Helene (2024) event switching, with recorded peak flow and gauge stage.
- Playback and scrubbing of **observed USGS instantaneous hydrographs**: 384 Fred samples and 1,093 Helene samples.
- 1,310 Microsoft building footprints, 119 waterway segments, roads, Cruso and gauge labels.
- Layer switches, 1× / 3× / 5× terrain exaggeration, overhead view, zoom, and a three-stop valley tour.
- Clickable building details and a live count of building centroids inside the **illustrative corridor**.
- Local JSON prediction import to compare a supplied model hydrograph with observations.
- A licensed, interactive Poly Haven rock-model preview under **Method & data → Explore the Poly Haven 3D asset**.
- Source provenance, limitations, and explicit pending states for Census income and population analysis.

## Run locally

Requires Python 3 for the static server. No package installation or build step is necessary.

```sh
python3 -m http.server 4173 --directory dist --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. Internet access is needed for the pinned CesiumJS CDN, fonts, terrain and imagery. Geographic vector data, observed hydrographs, and the Poly Haven model are bundled. If terrain fails, the interface labels the flat fallback; if WebGL/Cesium cannot initialize, it displays an error while retaining the event records.

With Node.js installed:

```sh
npm test
```

Tests verify recorded-peak alignment, timeline sample selection, metric distances, corridor behavior, prediction validation, and safe rendering of imported labels.

## Scientific status — read before presenting

**This MVP does not contain a calibrated flood-depth map.** The blue overlay is a nested buffer of the mapped main river whose total width in metres is:

```text
16 + 170 × sqrt(selected flow / observed event peak flow)
```

The visual width is rounded in 4 m increments for rendering performance; building-centroid overlap uses the unrounded width. The bands do not encode depth. Peak normalization means both historical events have the same peak preview width by design; it must not be used to compare their actual inundation extents.

Observed gauge stage is relative to a **local gauge datum**. It cannot be subtracted directly from HAND. Before adding physical depth, establish a calibrated relationship between stage at the gauge and water height above the local drainage reference for each reach.

The sidebar's “in preview corridor” count is a geometric illustration, not a count of buildings historically flooded. The display rectangle is not a delineated basin. Building footprints are not an event-date inventory. A 6 m extrusion is assumed wherever verified building height is unavailable. No households, incomes, population exposure, predictions, or validation scores are fabricated.

The playback selects the nearest actual timestamp; it does not interpolate missing measurements. The displayed time uses America/New_York. Original USGS qualifiers and timestamps remain in the bundled JSON.

## Data and licenses

| Layer | Source | Notes |
| --- | --- | --- |
| Flow and stage | [USGS gauge 03456500](https://waterdata.usgs.gov/monitoring-location/03456500/) | Observations; Fred 19,800 cfs / 16.03 ft; Helene 15,900 cfs / 14.10 ft. |
| Buildings | [Microsoft US Building Footprints via Esri](https://www.arcgis.com/home/item.html?id=bb69f10baf334d4c935a0fb23d758f38) | 1,310 polygons, ODbL. Geometry retained; height unavailable. |
| Rivers and roads | [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) | ODbL; study-window extract and East Fork relation. |
| Terrain and imagery | [Esri public terrain service](https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer) and World Imagery | Runtime services; provider credits remain visible in Cesium. These are not a bundled USGS 10 m DEM. |
| Rock model | [Rock 09, Jenelle van Heerden / Poly Haven](https://polyhaven.com/a/rock_09) | [CC0](https://polyhaven.com/license); isolated asset preview, not a surveyed object. |
| 3D engine | [CesiumJS](https://github.com/CesiumGS/cesium) | Apache-2.0; pinned version 1.138.0 via jsDelivr. |

See `dist/data/provenance.json` and `dist/assets/nature/provenance.json` for exact source URLs, extraction notes and model checksums. Third-party data retain their own licenses. No broad license is assigned to original project code yet.

Study rectangle: west −82.89, south 35.40, east −82.80, north 35.47. USGS gauge coordinates were reported in NAD83 and displayed as WGS84 for this prototype; this is not a survey-grade coordinate transformation.

## Bring in NeuralHydrology predictions

Select the matching event, choose **Model +**, and import JSON in this format:

```json
{
  "eventId": "fred",
  "label": "Your model and run identifier",
  "provenance": "Training window, excluded years, weather source and run details",
  "samples": [
    {"time": "2021-08-17T00:00:00-04:00", "flow_cfs": 100},
    {"time": "2021-08-18T00:00:00-04:00", "flow_cfs": 200}
  ]
}
```

**The numbers above are format examples, not predictions.** Accepted files are under 4 MB with 2–20,000 strictly ordered, unique, timezone-qualified samples. Flow must be finite and nonnegative in cfs; the series must overlap the selected observed event. Imports remain in browser memory. They are not saved to a server or labeled validated. The imported series has its own time range, and the preview corridor remains illustrative.

## Next steps toward the two-week plan

1. **Platform:** delineate the basin and retrieve a USGS 3DEP 10 m DEM. Condition it, derive drainage/HAND, and preserve CRS, vertical reference, resolution and no-data metadata. Add reach connectivity and bridge/debris limitations.
2. **Analysis:** obtain event-appropriate rating relationships; calibrate gauge-stage-to-HAND height for each reach. Confirm training coverage and hold out 2021 and 2024. Evaluate peak flow, timing, and NSE, explicitly accounting for subdaily flood peaks.
3. **Viz:** replace the schematic corridors with calibrated depth rasters or polygons. Extend time frames with a source identifier, UTC timestamp, units, vertical reference, method and validation status. Preserve the distinction between observed gauge flow and inferred inundation.
4. **Disparities:** join calibrated depths to footprints, then to a documented ACS block-group vintage. Treat population allocation as an estimate, retain margins of error, and avoid assigning group income to individual households.
5. **Validation:** compare to event-specific high-water marks or appropriately dated aerial imagery. Report limitations before describing any output as measured flood depth.

## Deployment

The app is static: serve `dist/` on a static host. No hosted preview or Cloud Run deployment has been performed.

For Cloud Run, the included `Dockerfile` serves `dist/` on port 8080 with nginx. Deploy to your selected Google Cloud project and service using your team's normal process. This MVP does not modify an existing Cloud Run service or configure cloud credentials.

```sh
docker build -t grokathon .
docker run --rm -p 8080:8080 grokathon
```

## Project structure

```text
dist/                 Static application and bundled assets
  app.js              Cesium scene, controls, playback, dialogs and import
  hydrology.js        Pure helpers; explicitly schematic corridor math
  data/               Real vector features, observed series and provenance
  assets/nature/      Poly Haven glTF and license/provenance
tests/                Data and integration-contract checks
Dockerfile            Optional Cloud Run-compatible static container
```

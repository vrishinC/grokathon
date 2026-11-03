# Aquatic — Flood Observatory

A cinematic research story and working CesiumJS explorer for the East Fork Pigeon River near Cruso, North Carolina. The original explorer is retained, with new interaction controls, real Census income context, and a rendered 3D short film.

## What works

- Real 3D terrain and satellite imagery, without requiring a Cesium ion token.
- A dark cinematic landing page with a video hero, interactive resolution illustration, research-pipeline tabs, a HAND cross-section, historical event comparisons, community context, and an embedded film.
- Fred (2021) and Helene (2024) event switching, with recorded peak flow and gauge stage.
- Playback and scrubbing of **observed USGS instantaneous hydrographs**: 384 Fred samples and 1,093 Helene samples. Added playback speed, jump-to-peak, a peak marker, and the selected gauge-stage reading.
- 1,310 Microsoft building footprints, 119 waterway segments, roads, Cruso and gauge labels.
- Layer switches, 1× / 3× / 5× terrain exaggeration, overhead view, zoom, and a three-stop valley tour.
- Clickable building details, a searchable building browser, previous/next inspection, and a live count of building centroids inside the **illustrative corridor**.
- Local JSON prediction import, overlapping observed/model charts, and explicitly scoped peak/timing/NSE comparisons over paired samples.
- Flood / Income / Combined map modes with three real Census block-group income estimates, margins of error, source links, and a community uncertainty chart.
- A licensed, interactive Poly Haven rock-model preview under **Method & data → Explore the Poly Haven 3D asset**.
- Responsive explorer controls, keyboard navigation, motion controls, reduced-motion support, and visible research limitations.
- A 34-second vertical 3D film with original synthesized ambient audio and a 10-second landscape hero loop. See [the video guide](video/README.md).

## Run locally

Requires Python 3 for the static server. The website has no npm runtime dependencies and does not require a compilation step.

```sh
python3 -m http.server 4173 --directory dist --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. `npm start` runs the same server. Internet access is needed for the pinned CesiumJS CDN, Google Fonts, terrain and imagery. Geographic vector data, observed hydrographs, Census estimates, videos, and the Poly Haven model are bundled. If terrain fails, the interface labels the flat fallback; if WebGL/Cesium cannot initialize, it displays an error while retaining the event records. No environment variables or API keys are required; Cesium ion is not used.

With Node.js installed:

```sh
npm test
npm run lint
npm run check
npm run build
```

Tests cover recorded-peak alignment, timeline sample selection, metric distances, corridor behavior, prediction validation, safe rendering of imported labels, and comparison pairing/coverage. `lint` uses ESLint (run `npm install` once for development tools); `check` checks application JavaScript syntax; `build` validates the deployable `dist/` files rather than compiling a separate app. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for delivered features and outstanding research inputs.

While the map canvas has keyboard focus: **Space** plays/pauses, **← / →** changes the selected time, and **P** jumps to the observed peak. **Inspect mapped buildings** provides a keyboard-accessible alternative to map picking.

## Scientific status — read before presenting

**This MVP does not contain a calibrated flood-depth map.** The blue overlay is a nested buffer of the mapped main river whose total width in metres is:

```text
16 + 170 × sqrt(selected flow / observed event peak flow)
```

The visual width is rounded in 4 m increments for rendering performance; building-centroid overlap uses the unrounded width. The bands do not encode depth. Peak normalization means both historical events have the same peak preview width by design; it must not be used to compare their actual inundation extents.

Observed gauge stage is relative to a **local gauge datum**. It cannot be subtracted directly from HAND. Before adding physical depth, establish a calibrated relationship between stage at the gauge and water height above the local drainage reference for each reach.

The sidebar's “in preview corridor” count is a geometric illustration, not a count of buildings historically flooded. The display rectangle is not a delineated basin. Building footprints are not an event-date inventory. A 6 m extrusion is assumed wherever verified building height is unavailable. Household counts, population exposure, building depths, and model predictions are not fabricated.

The income layer is **2019–2023 ACS 5-year table B19013**, in 2023 inflation-adjusted dollars, joined to Census block groups with a January 1, 2023 geography vintage. It includes 90% margins of error. A block-group median does not establish any individual household's income. Full block groups extend beyond the study rectangle, and their estimates are neither event-specific nor evidence of disproportionate flood exposure. See [Census sources, fields, and refresh instructions](docs/census-data.md).

The hero and film use an original procedural mountain valley. Those terrain, building, tree, water, and highlight geometries are illustrative; they are not surveyed geographic features. The “110 km → ~10 m” illustration and HAND cross-section explain the research ambition. **~10 m calibrated depth is a target, not a delivered model output.**

The playback selects the nearest actual timestamp; it does not interpolate missing measurements. The displayed time uses America/New_York. Original USGS qualifiers and timestamps remain in the bundled JSON.

## Data and licenses

| Layer | Source | Notes |
| --- | --- | --- |
| Flow and stage | [USGS gauge 03456500](https://waterdata.usgs.gov/monitoring-location/03456500/) | Observations; Fred 19,800 cfs / 16.03 ft; Helene 15,900 cfs / 14.10 ft. |
| Buildings | [Microsoft US Building Footprints via Esri](https://www.arcgis.com/home/item.html?id=bb69f10baf334d4c935a0fb23d758f38) | 1,310 polygons, ODbL. Geometry retained; height unavailable. |
| Rivers and roads | [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) | ODbL; study-window extract and East Fork relation. |
| Income and block groups | [Census B19013](https://data.census.gov/table/ACSDT5Y2023.B19013) and [TIGERweb ACS2023](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/10) | Three block groups; 2019–2023 estimates and 90% margins of error. Public Census data. |
| Terrain and imagery | [Esri public terrain service](https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer) and World Imagery | Runtime services; provider credits remain visible in Cesium. These are not a bundled USGS 10 m DEM. |
| Rock model | [Rock 09, Jenelle van Heerden / Poly Haven](https://polyhaven.com/a/rock_09) | [CC0](https://polyhaven.com/license); isolated asset preview, not a surveyed object. |
| 3D engine | [CesiumJS](https://github.com/CesiumGS/cesium) | Apache-2.0; pinned version 1.138.0 via jsDelivr. |

See [ASSET_CREDITS.md](ASSET_CREDITS.md) for all dataset, model, font, library, video, and audio credits. `dist/data/provenance.json`, `dist/data/census-provenance.json`, and `dist/assets/nature/provenance.json` retain exact source URLs, extraction notes and checksums. Third-party data retain their own licenses. No broad license is assigned to original project code or authored assets yet.

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

Comparison metrics use matched observations within half the typical observed sampling interval, with each observation paired at most once. Coverage is shown. No missing samples are interpolated or extrapolated. Peak and timing differences describe the paired subset; a partial import cannot validate the entire event. NSE is unavailable when there are too few matched values or constant observations. No trained NeuralHydrology model is bundled.

## Film and hero loop

Finished files are available in both `public/videos/` and `dist/videos/`:

| File | Output |
| --- | --- |
| `aquatic-sustainability-story.mp4` | 34 seconds; 1080 × 1920; 30 fps; H.264 with stereo AAC |
| `aquatic-hero-loop.mp4` | 10 seconds; 1920 × 1080; 30 fps; H.264; silent |
| `aquatic-story-poster.jpg`, `aquatic-hero-poster.jpg` | Matching still posters |

The film is a purpose-built Three.js animation with camera paths, animated water, rain, buildings, forests, captions, and original procedural sound. Historical peak captions come from the bundled USGS observations. Its other spatial scenes are marked illustrative.

To work on the video, install its separate dependencies once with `npm --prefix video ci`. The renderer additionally needs Python 3 with NumPy, FFmpeg, and Chrome/Chromium.

```sh
npm run video:preview
npm run video:render
```

Preview: `http://127.0.0.1:4174/video/scene.html?preview=1`; append `&mode=hero` for the landscape version. Set `CHROME_PATH` if Chrome is not at the default macOS location. Detailed commands, source structure, and scientific limitations are in [video/README.md](video/README.md).

## Next steps toward the two-week plan

1. **Platform:** delineate the basin and retrieve a USGS 3DEP 10 m DEM. Condition it, derive drainage/HAND, and preserve CRS, vertical reference, resolution and no-data metadata. Add reach connectivity and bridge/debris limitations.
2. **Analysis:** obtain event-appropriate rating relationships; calibrate gauge-stage-to-HAND height for each reach. Confirm training coverage and hold out 2021 and 2024. Evaluate peak flow, timing, and NSE, explicitly accounting for subdaily flood peaks.
3. **Viz:** replace the schematic corridors with calibrated depth rasters or polygons. Extend time frames with a source identifier, UTC timestamp, units, vertical reference, method and validation status. Preserve the distinction between observed gauge flow and inferred inundation.
4. **Disparities:** join calibrated depths to footprints and the bundled documented ACS block-group context. Add a defensible population allocation method, retain margins of error, and avoid assigning group income to individual households.
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
  experience.js       Landing story, diagrams, film controls and context charts
  experience.css      Cinematic design, responsive layout and motion
  hydrology.js        Pure helpers; explicitly schematic corridor math
  data/               Real vector features, observed series and provenance
  assets/nature/      Poly Haven glTF and license/provenance
  videos/             Deployable MP4 files, posters and captions
public/videos/        Requested video deliverable paths
video/                Deterministic Three.js film and audio/render pipeline
scripts/              Static validation and Census refresh
docs/                 Implementation status and Census data contract
tests/                Data and integration-contract checks
Dockerfile            Optional Cloud Run-compatible static container
```

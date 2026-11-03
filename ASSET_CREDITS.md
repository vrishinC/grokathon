# Asset credits

This inventory covers the existing explorer and the added landing story and film. Third-party assets retain their own licenses. The original project code, procedural visuals, and synthesized soundtrack do not yet have a blanket project license. Nothing here implies endorsement by a data provider.

## Geographic data and runtime services

| Asset | Creator / source | Source URL | License / terms | Where used |
| --- | --- | --- | --- | --- |
| Historical discharge, gauge stage, site metadata, annual peaks | U.S. Geological Survey, station 03456500 | [USGS station](https://waterdata.usgs.gov/monitoring-location/USGS-03456500/) · [exact extraction URLs](dist/data/provenance.json) | U.S. federal public data; retain USGS attribution | Explorer hydrographs, event cards, history section, recorded peak captions in film |
| U.S. building footprints | Microsoft Maps; hosted by Esri | [Source project](https://github.com/microsoft/USBuildingFootprints) · [Esri item](https://www.arcgis.com/home/item.html?id=bb69f10baf334d4c935a0fb23d758f38) | [Open Data Commons ODbL 1.0](https://github.com/microsoft/USBuildingFootprints/blob/master/LICENSE-DATA) | 1,310 bundled polygons; explorer, resolution illustration, community map. Buildings in the film are separate procedural geometry. |
| Rivers, roads, and place geometry | OpenStreetMap contributors | [OpenStreetMap copyright and license](https://www.openstreetmap.org/copyright) · [extraction details](dist/data/provenance.json) | Open Data Commons ODbL 1.0; © OpenStreetMap contributors | Explorer and story illustrations; extracted data are bundled |
| Median household income and margin of error | U.S. Census Bureau, 2019–2023 ACS 5-year detailed table B19013 | [Census table](https://data.census.gov/table/ACSDT5Y2023.B19013) · [download/provenance](dist/data/census-provenance.json) | U.S. federal public data; retain Census attribution | Three community estimates, income layer, uncertainty chart and inspection panel |
| Census block-group boundaries | U.S. Census Bureau, TIGERweb ACS2023 | [Census layer](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/10) | U.S. federal public data; retain Census attribution | Income and combined map layers; source geometry retained |
| World Imagery | Esri, Vantor, Earthstar Geographics, and the GIS User Community | [Service](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) | Esri and contributing-provider service terms; [Esri data attribution terms](https://www.esri.com/en-us/legal/terms/data-attributions). This is a streamed service, not a CC0 asset or redistributed tile archive. | Cesium explorer basemap; on-screen credit retained |
| World Elevation / Terrain3D | Esri and contributing elevation providers | [Service](https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer) | Esri service terms and provider attribution; [data attribution terms](https://www.esri.com/en-us/legal/terms/data-attributions) | Streamed 3D explorer terrain; service credits retained |

Bundled ODbL-derived files remain available as GeoJSON in `dist/data/`; the extraction and processing notes are in `dist/data/provenance.json`. No Esri tiles or terrain payloads are bundled with the site. Census uncertainty and geographic limitations are documented in [docs/census-data.md](docs/census-data.md).

## Models, fonts, and rendering libraries

| Asset | Creator / source | Source URL | License | Where used |
| --- | --- | --- | --- | --- |
| Rock 09, glTF with 1k textures | Jenelle van Heerden / Poly Haven | [Asset page](https://polyhaven.com/a/rock_09) · [local manifest/checksums](dist/assets/nature/provenance.json) | [CC0 1.0](https://polyhaven.com/license) | Existing optional rock-model viewer under Method & data. Not a surveyed rock or a film asset. |
| CesiumJS 1.138.0 | Cesium contributors | [CesiumJS](https://github.com/CesiumGS/cesium) | [Apache-2.0](https://github.com/CesiumGS/cesium/blob/1.138/LICENSE.md) | Interactive globe/terrain rendering; pinned CDN runtime and asset viewer |
| DM Sans | The DM Sans Project Authors | [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/dmsans) | [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt) | Website interface typography, loaded through Google Fonts; no local font binary bundled |
| Manrope | The Manrope Project Authors | [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/manrope) | [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt) | Website headings and story labels, loaded through Google Fonts; no local font binary bundled |
| Three.js 0.170.0 | Three.js authors | [Three.js](https://github.com/mrdoob/three.js) | [MIT](https://github.com/mrdoob/three.js/blob/r170/LICENSE) | Local video scene renderer; installed through `video/package-lock.json`, not loaded by the deployed website |
| Playwright Core 1.51.1 | Microsoft | [Playwright](https://github.com/microsoft/playwright) | [Apache-2.0](https://github.com/microsoft/playwright/blob/v1.51.1/LICENSE) | Local deterministic frame capture and browser verification; not shipped as a site runtime |
| Arial / Helvetica | Local operating-system font installation | System font fallback used by `video/scene.js` | Proprietary system fonts; no font software redistributed | Rasterized film captions and title typography |

## Original visual and audio work

| Asset | Creator / source | Source file | Status | Where used |
| --- | --- | --- | --- | --- |
| Procedural mountain valley, houses, trees, river surface, rain, light, and camera paths | Aquatic project implementation | [video/scene.js](video/scene.js) | Project-authored geometry, shaders, texture, and animation; no downloaded meshes, stock footage, or image-generation output | Vertical film and hero loop |
| Ambient score, bass impacts, noise textures, and transition sound | Aquatic project implementation | [video/make_audio.py](video/make_audio.py) | Original deterministic synthesis; no recordings, samples, or narration | Vertical film's stereo soundtrack |
| Contour decorations, conceptual HAND illustration, interface icons, and layout | Aquatic project implementation | `dist/index.html`, `dist/experience.js`, `dist/experience.css` | Project-authored SVG/CSS | Landing story and explorer interface |
| MP4 renders and poster images | Aquatic project implementation | [render pipeline](video/render.mjs) | Rendered from the original procedural scene; historical peak captions credited to USGS | `public/videos/` and identical deployment copies in `dist/videos/` |

FFmpeg, Python/NumPy, and a locally installed Chrome/Chromium browser are external rendering tools, not redistributed binaries. Their licenses depend on the installed distributions; the film contains their output rather than those tools. See [video/README.md](video/README.md) for the reproducible rendering workflow.

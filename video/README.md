# Aquatic cinematic video

This is a purpose-built, deterministic 3D film, not a recording of the website. It renders a procedural mountain valley in Three.js with animated river water, extruded houses, forest, storm rain, shadows, camera movement and mobile-safe typography. Every frame is evaluated at an explicit timestamp, then encoded with FFmpeg.

## Finished outputs

Both the requested source public folder and the static deployment folder contain:

- `public/videos/aquatic-sustainability-story.mp4` — 34 seconds, 1080 × 1920, 30 fps, H.264, stereo AAC.
- `public/videos/aquatic-hero-loop.mp4` — 10 seconds, 1920 × 1080, 30 fps, H.264, silent.
- `public/videos/aquatic-story-poster.jpg` — vertical poster.
- `public/videos/aquatic-hero-poster.jpg` — landscape poster.
- Matching copies in `dist/videos/` for the existing static deployment.

The hero camera and water level follow a periodic path. The surface shader keeps moving, so the loop is near-seamless rather than a frozen transition. The vertical film has an original ambient soundtrack synthesized from deterministic oscillators and filtered noise. It contains no narration or third-party audio samples.

## Re-render

Requirements: Node.js, Python 3 with NumPy, FFmpeg in `PATH`, and a locally installed Chrome/Chromium browser.

```sh
cd video
npm ci
npm run render
```

On macOS the renderer defaults to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Set `CHROME_PATH` to use another installation. `render.mjs` starts its own temporary loopback HTTP server and closes it and Chrome after rendering. It writes the MP4 to `public/videos/`, then copies the finished file and poster into `dist/videos/`.

For a browser preview:

```sh
cd video
npm run preview
```

Open `http://127.0.0.1:4174/video/scene.html?preview=1`, or add `&mode=hero` for the landscape loop. The preview executes the same time-dependent scene used for export. `npm run samples` exports representative JPEGs for composition review.

Individual commands from the repository root:

```sh
python3 video/make_audio.py
node video/render.mjs
node video/render.mjs --hero
node video/render.mjs --sample
```

## Scientific provenance

The displayed event peaks are read directly from `dist/data/observed-events.json`:

| Event | Recorded peak discharge | Recorded peak gauge stage |
| --- | ---: | ---: |
| Tropical Storm Fred, August 17, 2021 | 19,800 cfs | 16.03 ft |
| Hurricane Helene, September 27, 2024 | 15,900 cfs | 14.10 ft |

Source: USGS station 03456500, East Fork Pigeon River near Canton, North Carolina. See the existing `dist/data/provenance.json` for the source URLs and limitations.

**The spatial film is illustrative.** It is an original procedural environment inspired by a mountain river valley. Its terrain, homes, trees, inundation progression and community highlight rings do not represent surveyed locations, calibrated HAND output, observed building depths or Census results. The persistent footer marks the imagery as an illustrative 3D scene. Gauge stage is explicitly distinguished from building water depth. The ~10 m resolution is identified as a research target. The measured/predicted composition illustrates the proposed comparison workflow; the prediction layer is labeled a research target and no prediction score or accuracy claim is fabricated. No income, exposed-person or flooded-building statistics are invented.

This is a research demonstration, not an operational flood warning or decision product. The National Weather Service and local emergency management remain the sources for live warnings.

## Source structure

- `scene.js` — deterministic 3D environment, camera paths and caption composition.
- `scene.html` — preview/render entry point.
- `render.mjs` — browser renderer, FFmpeg encoder, posters and deployment copies.
- `make_audio.py` — original synthesized ambient score.
- `package.json`, `package-lock.json` — pinned rendering dependencies.

## Assets and licensing

No stock footage, generated still-image sequence, third-party meshes, downloaded textures or audio recordings are used. Terrain, geometry, water shader, terrain texture and audio are authored procedurally for this project. The font is the local Arial/Helvetica system font rendered into video pixels; no font file is redistributed.

| Dependency or source | Author / source | License | Use |
| --- | --- | --- | --- |
| Three.js 0.170.0 | [Three.js authors](https://github.com/mrdoob/three.js) | MIT | 3D rendering; installed under `video/node_modules`, not deployed to the site |
| Playwright Core 1.51.1 | [Microsoft](https://github.com/microsoft/playwright) | Apache-2.0 | Local deterministic browser automation |
| Recorded event peaks | [USGS](https://waterdata.usgs.gov/monitoring-location/USGS-03456500/) | US federal public-domain data | Historical peak-flow and gauge-stage captions |
| Arial / Helvetica | Local operating-system font installation | Proprietary font; no font file redistributed | Rasterized title/caption typography |
| Procedural scene and sound | Aquatic project implementation | Project-authored assets | All visual geometry, textures and ambient audio |

The website's other geographic datasets and existing natural assets have their own provenance. This film does not use those building footprints or the Poly Haven rock model.

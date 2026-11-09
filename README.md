# X-ray disc explorer

A static, interactive scientific visualization designed for GitHub Pages. No server, account, build process, or Python installation is needed by visitors. The public page is specific to the current observation; the code and export pipeline are reusable.

## Controls

Play/pause, restart, seek, compacted/with-gaps timelines, dark/light theme, movie duration, illustrative rotation, stochastic azimuthal structure, event markers and pulses, and optional sonification with volume control. Sound starts only after a user gesture. Changing movie length changes the speed of observation playback, not the 64× audio frequency shift. The default is 30 seconds.

The with-gaps view bins only within uninterrupted runs of clean 16-second records. During gaps, the disc texture and brightness hold the last measured spectrum, and the sound sustains that same spectrum. The blue launch pulses advance on the uninterrupted movie clock. Sound is muted when paused or the tab becomes hidden. All displayed times come from the FITS records.

## Scientific mapping

The identification is ν = 1/t_visc = α(H/R)² Ω_K. With t_g = GM/c³:

    r/r_g = [α(H/R)² / (ν t_g)]^(2/3)

No additional 2π enters this mapping; the Keplerian orbital frequency in cycles per second used for illustrative rotation is ν/[2π α(H/R)²]. Radius units are r_g = GM/c². The dotted circle is at 2 r_g. This simplified mapping is not a claim that the observed Fourier frequencies uniquely identify physical disc radii.

Disc brightness follows the existing movie's Gaussian frequency smoothing (σ = 4 bins), lower frequency cut (1 Hz), excess floor, fixed logarithmic scale, faint quiet-state glow, and EHT-inspired palette. Brightness is not normalized separately per frame. Texture uses a deterministic random field smoothed in radius and azimuth; rotation is 0.01% of local Keplerian rate. Canvas rendering is an interactive reconstruction, not a pixel-identical playback of the Python MP4.

Sonification uses the PDS before the disc-only smoothing/cut, with source frequencies below 0.3 Hz muted. For this observation that suppresses the first four bins (0.0625–0.25 Hz), which would otherwise become 4–16 Hz tones. The cutoff is set with `sonification.minimum_frequency_hz` in the dataset configuration; older exports default to 0.3 Hz. The fixed shared gain is retained after this cut. Frequencies are multiplied by 64 (4–8 Hz → 256–512 Hz). Amplitudes are proportional to sqrt(max(Leahy power − 2, 0)); this simple noise subtraction with clipping is not an unbiased estimator of intrinsic power at low signal. One dataset-wide gain is shared between both timelines; no per-frame gain or special QPO tone is used. Browser gain transitions are smoothed over 25 ms. Volume is a separate user control. The lowest retained tone for this observation is 20 Hz (0.3125 Hz × 64).

Blue ejection rings are visual annotations. Their expansion, size, brightness, and relative drama do not encode a measured jet velocity or extent. The second launch pulse is deliberately stronger, following the movie design. Published event-date uncertainty bands are shown on the elapsed timeline. Compacted dates are mapped through the clean FITS row indices.

## Run locally

From this directory:

    python3 -m http.server 8000 --directory web

Open http://localhost:8000. ES modules and the dataset fetch require HTTP; opening index.html as a file is not supported.

## Reuse for another dataset

1. Copy `configs/maxi-j1820.json` and edit title, FITS paths (relative to the configuration file), column names, time convention, binning, cleaning, model parameters, events, and citations.
2. `time_unit` accepts `mjd`, or `seconds` with an explicit `reference_mjd` representing zero of that table's time column. Convert mission-specific time standards/offsets before export if necessary; they are not inferred.
3. Remove `background_filter` if no filtering is needed. Omit `clean_rows` to use all clean rows. Set `end_compacted_seconds` and `frequency_bins` for the desired extent. The current adapter expects one PDS vector per row, uniform frequencies (i+1)/segment_seconds, and a common segment length; other formats need a new adapter.
4. Install the export dependencies and run:

       python3 -m pip install -r requirements.txt
       python3 tools/export_dataset.py configs/your-observation.json web/data/dataset.json

5. Preview locally and push to main. The page uses the new export automatically. There is deliberately no dataset picker on the public page.

`tools/export_dataset.py` is the FITS adapter and cleaning/binning layer. `web/data/dataset.json` is the versioned data contract. `web/model.js` contains reusable scientific/timeline functions. `web/app.js` handles playback, canvas rendering, controls, and Web Audio. Styling is in `web/style.css`; additional options can be added without changing the FITS reader. Raw FITS files and existing MP4s are not published.

## Dataset contract, version 1

Metadata: title, description, origin_mjd, bin_seconds, model, sources, audio_gain, sonification, frequencies, disc_frequencies, events.

Each entry in `modes.compacted` and `modes.elapsed` contains `times` (axis centers in seconds), `mjd`, `compact` (clean-data coordinate), `power` (time × full frequency), and `disc_power` (time × disc frequency, already smoothed). Arrays are finite; times increase. Events contain an MJD, elapsed/compacted positions, uncertainty in days, label, color, and optional pulse type. The app supports schema version 1 and reports load errors visibly.

## Publish

The included GitHub Actions workflow deploys only `web/` to GitHub Pages on pushes to `main`. Enable Pages with source **GitHub Actions** in repository settings. The repository needs no credentials in its files; the deployment uses GitHub's short-lived Actions token. Generated spectra are public on the site, while raw FITS paths in the example config describe local files that are not committed.

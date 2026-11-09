#!/usr/bin/env python3
"""Convert configured FITS PDS tables to the versioned, browser-only data contract."""
import argparse
import json
from pathlib import Path
import numpy as np
from astropy.io import fits
from scipy.ndimage import gaussian_filter1d


def export(config_path, output_path):
    config_path = Path(config_path).resolve()
    c = json.loads(config_path.read_text())
    cols = c['columns']
    powers, times, backgrounds = [], [], []
    for name in c['input_files']:
        with fits.open(config_path.parent / name, memmap=True) as hdus:
            table = hdus[1].data
            powers.append(np.asarray(table[cols['power']][:, :c['frequency_bins']], dtype=float))
            times.append(np.asarray(table[cols['time']], dtype=float))
            filt = c.get('background_filter')
            if filt:
                lo, hi = filt['channels']
                backgrounds.append(table[cols['spectrum']][:, lo:hi].sum(axis=1) /
                                   float(hdus[1].header[filt['timebin_header']]) / table[cols['detectors']])
    power, time = np.concatenate(powers), np.concatenate(times)
    if c['time_unit'] == 'seconds':
        time = c['reference_mjd'] + time / 86400
    elif c['time_unit'] != 'mjd':
        raise ValueError('time_unit must be mjd or seconds (with reference_mjd)')
    if c.get('background_filter'):
        clean = np.concatenate(backgrounds) < c['background_filter']['maximum']
        power, time = power[clean], time[clean]
    count = c.get('clean_rows', len(power))
    if len(power) < count:
        raise ValueError(f'Requested {count} clean rows, found {len(power)}')
    power, time = power[:count], time[:count]
    if not np.isfinite(power).all() or not np.isfinite(time).all() or np.any(np.diff(time) < 0):
        raise ValueError('Power/time values must be finite, and times ordered')
    rebin, segment = c['rebin'], c['segment_seconds']
    width = rebin * segment
    frequencies = (np.arange(power.shape[1]) + 1) / segment
    disc_mask = frequencies >= c['model']['minimum_disc_hz']
    if disc_mask.sum() < 2:
        raise ValueError('At least two disc frequency bins are required')
    modes = {}
    for mode in ['compacted', 'elapsed']:
        indices = np.arange(len(power))
        runs = [indices] if mode == 'compacted' else np.split(indices, np.flatnonzero(
            ~np.isclose(np.diff(time)*86400, segment, atol=0.02, rtol=0)) + 1)
        groups = [run[:len(run)//rebin*rebin].reshape(-1, rebin) for run in runs if len(run) >= rebin]
        rows = np.concatenate(groups)
        rows = rows[:int(np.ceil(c['end_compacted_seconds']/width))]
        values = power[rows].mean(axis=1)
        mjd = time[rows].mean(axis=1)
        compact = (rows.mean(axis=1) + 0.5) * segment
        axis = (np.arange(len(rows)) + 0.5)*width if mode == 'compacted' else (mjd-time[0])*86400
        smooth = gaussian_filter1d(values[:, disc_mask], sigma=c['model']['smoothing_bins'], axis=1, mode='nearest')
        modes[mode] = dict(times=np.round(axis, 6).tolist(), compact=np.round(compact, 6).tolist(),
                           mjd=mjd.tolist(), power=np.round(values, 5).tolist(), disc_power=np.round(smooth, 5).tolist())
    events = []
    for event in c.get('events', []):
        e = dict(event)
        e['compacted_seconds'] = int(np.searchsorted(time, e['mjd'])) // rebin * width
        e['elapsed_seconds'] = (e['mjd']-time[0])*86400
        events.append(e)
    # One shared gain for both timeline modes; no per-frame normalization.
    reference = max(np.percentile(np.sqrt(np.maximum(np.asarray(m['power'])-2, 0).sum(axis=1)/2), 99.5) for m in modes.values())
    payload = dict(schema_version=1, title=c['title'], description=c['description'], model=c['model'],
                   origin_mjd=float(time[0]), bin_seconds=width, frequencies=frequencies.tolist(),
                   disc_frequencies=frequencies[disc_mask].tolist(), modes=modes, events=events,
                   audio_gain=float(0.12/max(reference, 1e-12)),
                   sonification={**c.get('sonification', {'method': 'stochastic_psd', 'low_frequency_attenuation_db': 12, 'flat_extrapolation_bins': 4, 'noise_rejection_sigma': 3}), 'averaged_periodograms': rebin*c.get('periodograms_per_row', 1)}, sources=c.get('sources', []))
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, separators=(',', ':'), allow_nan=False))
    print(f'Exported {output_path}: ' + ', '.join(f'{k}={len(v["times"])} spectra' for k,v in modes.items()))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('config', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    export(args.config, args.output)

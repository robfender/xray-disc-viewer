// Preserve the existing 4:3 composition; these are actual encoded dimensions.
export const EXPORT_PRESETS = {
  standard: {width:1600,height:1200,bitrate:12_000_000,discPixels:640},
  high: {width:2560,height:1920,bitrate:24_000_000,discPixels:1024},
  '4k': {width:3840,height:2880,bitrate:45_000_000,discPixels:1536},
};
export function exportPreset(name='high') {return EXPORT_PRESETS[name]||EXPORT_PRESETS.high;}

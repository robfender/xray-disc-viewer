import {SpectrumNoise} from './noise-synthesis.js';
class PdsNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();this.noise=new SpectrumNoise(sampleRate);
    this.port.onmessage=({data})=>this.noise.setSpectrum(data.frequencies,data.power,data.options);
  }
  process(inputs,outputs) {
    this.noise.fill(outputs[0][0]);
    return true;
  }
}
registerProcessor('pds-noise',PdsNoiseProcessor);

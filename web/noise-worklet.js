import {SpectrumNoise} from './noise-synthesis.js';
class PdsNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();this.noise=new SpectrumNoise(sampleRate);
    this.port.postMessage({type:'ready',version:'audio-controls-v4'});
    this.port.onmessage=({data})=>{
      if(data.reset){this.noise.overlap.fill(0);this.noise.cursor=0;this.noise.remaining=0;}
      if(!data.power)return;
      this.noise.setSpectrum(data.frequencies,data.power,data.options);
      const energy=this.noise.density.reduce((sum,value)=>sum+value*value,0);
      this.port.postMessage({type:'applied',requestId:data.requestId,options:data.options,rmsDb:energy>0?10*Math.log10(energy):-Infinity,version:'audio-controls-v4'});
    };
  }
  process(inputs,outputs) {
    this.noise.fill(outputs[0][0]);
    return true;
  }
}
registerProcessor('pds-noise',PdsNoiseProcessor);

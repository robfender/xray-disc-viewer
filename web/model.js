// Dataset-independent scientific and timeline functions; no DOM or browser APIs.
export const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x));
export function upperBound(values, value) { let lo=0, hi=values.length; while(lo<hi){const mid=(lo+hi)>>1;if(values[mid]<=value)lo=mid+1;else hi=mid;}return lo; }
export function domain(data, mode) {const times=data.modes[mode].times;return mode==='compacted'?[0,times.length*data.bin_seconds]:[Math.max(0,times[0]-data.bin_seconds/2),times.at(-1)+data.bin_seconds/2];}
export function snapshot(data, mode, progress) {const m=data.modes[mode], [lo,hi]=domain(data,mode), time=lo+clamp(progress)*(hi-lo);const index=mode==='compacted'?clamp(Math.ceil(progress*m.times.length)-1,0,m.times.length-1):clamp(upperBound(m.times,time)-1,0,m.times.length-1);const gap=mode==='elapsed'&&!m.times.some(t=>Math.abs(t-time)<=data.bin_seconds/2);return {index,time,gap};}
export const gravitationalTime = mass => 6.67430e-11*mass*1.98847e30/299792458**3;
export function radiusForFrequency(f, model) {return (model.alpha*model.h_over_r**2/(f*gravitationalTime(model.mass_solar)))**(2/3);}
export function brightness(power, model) {const raw=Math.max(power-2,0), excess=Math.max(raw-model.excess_floor,0), scale=Math.max(8-2-model.excess_floor,model.log_scale);const signal=Math.max(clamp(Math.log1p(excess/model.log_scale)/Math.log1p(scale/model.log_scale)), Math.min(raw/8,.1));return model.quiet_glow+(1-model.quiet_glow)*signal;}
export function eventPosition(event, mode) {return mode==='elapsed'?event.elapsed_seconds:event.compacted_seconds;}
export function makeTexture(rows, columns=720, seed=20261015) {let state=seed>>>0;const random=()=>{state=(1664525*state+1013904223)>>>0;return (state+.5)/4294967296;};let raw=new Float32Array(rows*columns);for(let i=0;i<raw.length;i++)raw[i]=Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());const angular=new Float32Array(raw.length),out=new Float32Array(raw.length);for(let r=0;r<rows;r++)for(let a=0;a<columns;a++){let sum=0,weight=0;for(let k=-12;k<=12;k++){const w=Math.exp(-.5*(k/4)**2);sum+=w*raw[r*columns+(a+k+columns)%columns];weight+=w;}angular[r*columns+a]=sum/weight;}for(let r=0;r<rows;r++){let square=0;for(let a=0;a<columns;a++){let sum=0,weight=0;for(let k=-5;k<=5;k++){const w=Math.exp(-.5*(k/1.5)**2);sum+=w*angular[clamp(r+k,0,rows-1)*columns+a];weight+=w;}const value=sum/weight;out[r*columns+a]=value;square+=value*value;}const sigma=Math.sqrt(square/columns)||1;for(let a=0;a<columns;a++)out[r*columns+a]=clamp(out[r*columns+a]/sigma,-2,2);}return out;}

// Suppress low edge bins before the audible frequency shift. Keep the shared gain.
export function sonificationAmplitude(power, frequency, minimumFrequencyHz=0.3) {
  return frequency < minimumFrequencyHz ? 0 : Math.sqrt(Math.max(power - 2, 0));
}

import {clamp, domain, snapshot, radiusForFrequency, brightness, eventPosition, makeTexture} from './model.js';
import {drawEjecta,launchFootprintRadius} from './jets.js';
import {citationParts} from './citations.js';
import {VideoExport} from './video-export.js';
const $=id=>document.getElementById(id), ui=Object.fromEntries(['play','restart','timeline','theme','duration','rotation','structure','events','sound','volume','low-noise','noise-rejection','seek','clock','status','pds','disc','disc-state','audio-status','download','export-status'].map(id=>[id,$(id)]));
let data, playing=false, progress=0, lastTime=0, dirty=true, pdsCaches=new WeakMap(), texture, geometry, image, audio, noiseNode, audioKey="", master, recording, recordingState, recordingDestination, appliedAudio;
const N=320, A=720, raster=document.createElement('canvas');raster.width=raster.height=N;const rasterCtx=raster.getContext('2d');
const palette=[[0,5,3,7],[.16,23,7,17],[.34,100,18,27],[.55,196,59,18],[.76,242,141,22],[.92,255,211,91],[1,255,241,189]];
const colors=new Uint8Array(256*3);for(let i=0;i<256;i++){const x=i/255;let j=1;while(palette[j][0]<x)j++;const a=palette[j-1],b=palette[j],s=(x-a[0])/(b[0]-a[0]);for(let c=0;c<3;c++)colors[i*3+c]=Math.round(a[c+1]+s*(b[c+1]-a[c+1]));}
const style=()=>{const dark=ui.theme.value==='dark';return {fg:dark?'#e7ecf3':'#202936',muted:dark?'#aeb8c8':'#505e70',bg:dark?'#191f28':'#ffffff',gap:dark?'#2d3542':'#e4e8ed',dark};};
function setupCanvas(canvas){const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(box.width*dpr)||canvas.height!==Math.round(box.height*dpr)){canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:box.width,h:box.height};}
function buildGeometry(){const f=data.disc_frequencies,m=data.model,radii=f.map(v=>radiusForFrequency(v,m)),max=radiusForFrequency(f[0]/Math.sqrt(2),m),extent=max*1.06,min=radiusForFrequency(f.at(-1)*Math.sqrt(2),m);geometry={radial:new Float32Array(N*N),angle:new Float32Array(N*N),extent,max,min};for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,xx=(x+.5-N/2)/(N/2)*extent,yy=(N/2-y-.5)/(N/2)*extent,r=Math.hypot(xx,yy);if(r<2||r<min||r>max){geometry.radial[i]=-1;continue;}let lo=0,hi=radii.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(radii[mid]>r)lo=mid;else hi=mid;}geometry.radial[i]=clamp(lo+(radii[lo]-r)/(radii[lo]-radii[hi]),0,f.length-1);geometry.angle[i]=((Math.atan2(yy,xx)/(2*Math.PI)+1)%1)*A;}texture=makeTexture(f.length);image=rasterCtx.createImageData(N,N);}
function buildPds(target=ui.pds){const {w,h}=setupCanvas(target),s=style(),mode=ui.timeline.value,m=data.modes[mode],[lo,hi]=domain(data,mode);const left=58,top=18,right=70,bottom=52,pw=w-left-right,ph=h-top-bottom,maxF=data.frequencies.at(-1);const cache={canvas:document.createElement('canvas'),left,top,pw,ph,w,h,lo,hi,maxF};const c=cache.canvas;c.width=Math.max(1,Math.round(pw));c.height=Math.max(1,Math.round(ph));const ctx=c.getContext('2d');ctx.fillStyle=s.gap;ctx.fillRect(0,0,c.width,c.height);for(let t=0;t<m.times.length;t++){const x=(m.times[t]-data.bin_seconds/2-lo)/(hi-lo)*c.width,bw=data.bin_seconds/(hi-lo)*c.width;for(let f=0;f<data.frequencies.length;f++){const v=clamp((m.power[t][f]-1)/7),shade=Math.round((s.dark?v:1-v)*255);ctx.fillStyle=`rgb(${shade},${shade},${shade})`;ctx.fillRect(x,(1-(f+1)/m.power[t].length)*c.height,Math.max(bw,.5)+.2,c.height/m.power[t].length+.3);}}return cache;}
function drawPds(state,target=ui.pds){let cache=pdsCaches.get(target);const box=target.getBoundingClientRect();if(!cache||cache.w!==box.width||cache.h!==box.height){cache=buildPds(target);pdsCaches.set(target,cache);}const {ctx}=setupCanvas(target),s=style(),{canvas,left,top,pw,ph,w,h,lo,hi,maxF}=cache;ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);ctx.fillStyle=s.gap;ctx.fillRect(left,top,pw,ph);ctx.save();ctx.beginPath();ctx.rect(left,top,pw*progress,ph);ctx.clip();ctx.drawImage(canvas,left,top,pw,ph);ctx.restore();ctx.font='12px system-ui';ctx.fillStyle=s.fg;ctx.strokeStyle=s.muted;ctx.lineWidth=1;ctx.strokeRect(left,top,pw,ph);for(let f=0;f<=10;f+=2){const y=top+ph*(1-f/maxF);ctx.textAlign='right';ctx.fillText(f,left-9,y+4);}for(let i=0;i<=5;i++){const x=left+pw*i/5;ctx.textAlign='center';ctx.fillText(Math.round(lo+(hi-lo)*i/5).toLocaleString(),x,top+ph+21);}ctx.save();ctx.translate(16,top+ph/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('Frequency (Hz)',0,0);ctx.restore();ctx.textAlign='center';ctx.fillText(ui.timeline.value==='elapsed'?'Elapsed time (s; coverage gaps retained)':'Compacted time (s)',left+pw/2,h-6);
for(let k=0;k<100;k++){const shade=Math.round((s.dark?k/99:1-k/99)*255);ctx.fillStyle=`rgb(${shade},${shade},${shade})`;ctx.fillRect(w-48,top+ph*(1-(k+1)/100),13,ph/100+1);}ctx.fillStyle=s.fg;ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('8',w-31,top+5);ctx.fillText('1',w-31,top+ph);ctx.save();ctx.translate(w-8,top+ph/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('Leahy power',0,0);ctx.restore();
if(ui.events.checked){for(const e of data.events){const ex=eventPosition(e,ui.timeline.value);if(ex<lo||ex>hi)continue;const x=left+(ex-lo)/(hi-lo)*pw,unc=e.uncertainty_days*86400/(hi-lo)*pw;ctx.save();ctx.beginPath();ctx.rect(left,top,pw,ph);ctx.clip();ctx.globalAlpha=.1;ctx.fillStyle=e.color;if(ui.timeline.value==='elapsed')ctx.fillRect(x-unc,top,unc*2,ph);ctx.globalAlpha=.95;ctx.strokeStyle=e.color;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+ph);ctx.stroke();ctx.translate(x+12,top+7);ctx.rotate(Math.PI/2);ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText(e.label,0,0);ctx.restore();}}
ctx.strokeStyle='#ee6b72';ctx.beginPath();ctx.moveTo(left+pw*progress,top);ctx.lineTo(left+pw*progress,top+ph);ctx.stroke();}
function drawDisc(state,target=ui.disc){const mode=ui.timeline.value,m=data.modes[mode],model=data.model,f=data.disc_frequencies,power=m.disc_power[state.index],values=power.map(v=>brightness(v,model)),duration=+ui.duration.value;const time=mode==='elapsed'?state.index/Math.max(m.times.length-1,1)*duration:progress*duration,phases=f.map(v=>ui.rotation.checked?v/(2*Math.PI*model.alpha*model.h_over_r**2)*time*model.rotation_fraction*A:0);const pixels=image.data;for(let i=0;i<N*N;i++){const r=geometry.radial[i],offset=i*4;pixels[offset+3]=255;if(r<0){pixels[offset]=pixels[offset+1]=pixels[offset+2]=0;continue;}const a=Math.floor(r),b=Math.min(a+1,f.length-1),mix=r-a;let value=values[a]*(1-mix)+values[b]*mix;if(ui.structure.checked){const sample=row=>{const angle=((geometry.angle[i]-phases[row])%A+A)%A,k=Math.floor(angle),fract=angle-k;return texture[row*A+k]*(1-fract)+texture[row*A+(k+1)%A]*fract;};value*=clamp(1+model.azimuthal_variation*(sample(a)*(1-mix)+sample(b)*mix),0,2);}const ci=Math.round(clamp(value)*255)*3;pixels[offset]=colors[ci];pixels[offset+1]=colors[ci+1];pixels[offset+2]=colors[ci+2];}rasterCtx.putImageData(image,0,0);
const {ctx,w,h}=setupCanvas(target),s=style(),pad=50,size=Math.min(w-pad-12,h-pad-36),x=pad+(w-pad-12-size)/2,y=30,centreX=x+size/2,centreY=y+size/2,scale=size/(2*geometry.extent);
const inclination=30,orientation=55,angle=orientation*Math.PI/180,foreshortening=Math.cos(inclination*Math.PI/180);
ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);ctx.fillStyle='#000';ctx.fillRect(x,y,size,size);
ctx.save();ctx.beginPath();ctx.rect(x,y,size,size);ctx.clip();ctx.translate(centreX,centreY);ctx.rotate(angle);ctx.scale(1,foreshortening);ctx.drawImage(raster,-size/2,-size/2,size,size);ctx.restore();
ctx.strokeStyle=s.muted;ctx.lineWidth=1;ctx.strokeRect(x,y,size,size);ctx.font='12px system-ui';ctx.fillStyle=s.fg;
for(const tick of [-10,0,10]){if(Math.abs(tick)>geometry.extent)continue;ctx.textAlign='center';ctx.fillText(tick,centreX+tick*scale,y+size+20);ctx.textAlign='right';ctx.fillText(tick,x-8,centreY-tick*scale+4);}
ctx.textAlign='center';ctx.fillText('Projected x (r_g = GM/c²)',centreX,y+size+42);
ctx.save();ctx.translate(13,centreY);ctx.rotate(-Math.PI/2);ctx.fillText('Projected y (r_g)',0,0);ctx.restore();
ctx.font=`${w<400?10:12}px system-ui`;ctx.fillStyle=s.muted;ctx.fillText('30° oblique view · jet motion illustrative, not to radius scale',centreX,16);
ctx.strokeStyle='#fffdf8';ctx.lineWidth=1.5;ctx.setLineDash([2,3]);ctx.beginPath();ctx.ellipse(centreX,centreY,2*scale,2*scale*foreshortening,angle,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
if(ui.events.checked){const [lo,hi]=domain(data,mode);for(const event of data.events.filter(e=>e.pulse)){
  const launch=(eventPosition(event,mode)-lo)/(hi-lo)*duration;
  drawEjecta(ctx,{age:progress*duration-launch,type:event.pulse,inclinationDegrees:inclination,orientationDegrees:orientation,centreX,centreY,outerRadiusPixels:geometry.max*scale,footprintRadiusPixels:launchFootprintRadius(geometry.min)*scale,clip:{x,y,size}});
}}
ui['disc-state'].textContent=state.gap?'Coverage gap · holding last measured spectrum':`Measured spectrum · MJD ${m.mjd[state.index].toFixed(5)}`;}
async function ensureAudio(){
  if(audio)return;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)throw Error('Web Audio is unavailable in this browser');
  const context=new Context();
  try {
    await context.audioWorklet.addModule(new URL('./noise-worklet.js',import.meta.url));
    noiseNode=new AudioWorkletNode(context,'pds-noise',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});
    noiseNode.port.onmessage=({data:message})=>{if(message.type==='applied'&&message.requestId===audioKey){appliedAudio=message;showAudioStatus();}};
    master=context.createGain();master.gain.value=0;
    noiseNode.connect(master);master.connect(context.destination);audio=context;
  } catch(error) {await context.close();throw error;}
}
function updateAudio(state){
  showAudioStatus();
  if(!audio)return;
  const now=audio.currentTime,enabled=playing&&ui.sound.checked&&!document.hidden;
  master.gain.setTargetAtTime(enabled?+ui.volume.value:0,now,.025);
  showAudioStatus();
  const key=`${ui.timeline.value}:${state.index}:${ui['low-noise'].value}:${ui['noise-rejection'].value}`;
  if(key!==audioKey){
    noiseNode.port.postMessage({requestId:key,frequencies:data.frequencies,power:data.modes[ui.timeline.value].power[state.index],options:{shift:64,attenuationDb:+ui['low-noise'].value,gain:data.audio_gain,plateauBins:data.sonification?.flat_extrapolation_bins ?? 4,noiseRejectionSigma:+ui['noise-rejection'].value,averagedPeriodograms:data.sonification?.averaged_periodograms ?? 8}});
    audioKey=key;
  }
}
function showAudioStatus(){
  if(!ui.sound.checked){ui['audio-status'].textContent='Sound off';return;}
  if(!audio){ui['audio-status'].textContent='Sound enabled — press Play to listen.';return;}
  const prefix=playing?'Playing':'Paused';
  if(!appliedAudio||appliedAudio.requestId!==audioKey){ui['audio-status'].textContent=`${prefix} · updating audio settings…`;return;}
  const options=appliedAudio.options;
  ui['audio-status'].textContent=`${prefix} · applied: ${options.attenuationDb} dB bass reduction · noise rejection ${options.noiseRejectionSigma===0?'Off':options.noiseRejectionSigma+'σ'} · estimated level ${Number.isFinite(appliedAudio.rmsDb)?appliedAudio.rmsDb.toFixed(1)+' dBFS':'silent'} (before volume)`;
  ui['audio-status'].dataset.engine=appliedAudio.version;
}
function render(){if(!data)return;const state=snapshot(data,ui.timeline.value,progress);drawPds(state);drawDisc(state);updateAudio(state);if(recording){drawPds(state,recording.pds);drawDisc(state,recording.disc);recording.draw(progress,ui['disc-state'].textContent);ui['export-status'].textContent=`Recording ${(progress*+ui.duration.value).toFixed(1)} / ${ui.duration.value} s — keep this tab visible.`;}ui.seek.value=progress;ui.clock.value=`${(progress*+ui.duration.value).toFixed(1)} / ${ui.duration.value} s`;ui.status.textContent=ui.timeline.value==='elapsed'?`MJD ${(data.origin_mjd+state.time/86400).toFixed(5)}${state.gap?' · coverage gap':''}`:`${Math.round(state.time).toLocaleString()} compacted seconds`;dirty=false;}
function tick(now){if(playing){if(lastTime)progress=clamp(progress+(now-lastTime)/1000/+ui.duration.value);dirty=true;if(progress>=1){playing=false;ui.play.textContent='Play';}}lastTime=now;if(dirty)render();if(recording&&progress>=1)recording.finish();requestAnimationFrame(tick);}
ui.play.onclick=async()=>{try{if(ui.sound.checked){await ensureAudio();await audio.resume();}if(progress>=1)progress=0;playing=!playing;lastTime=0;ui.play.textContent=playing?'Pause':'Play';dirty=true;}catch(error){ui.status.textContent=error.message;}};
ui.restart.onclick=()=>{progress=0;dirty=true;};ui.seek.oninput=()=>{progress=+ui.seek.value;dirty=true;};ui.timeline.onchange=()=>{pdsCaches=new WeakMap();dirty=true;};ui.theme.onchange=()=>{document.documentElement.dataset.theme=ui.theme.value;pdsCaches=new WeakMap();dirty=true;};for(const id of ['duration','rotation','structure','events','volume','low-noise','noise-rejection']){const changed=()=>{dirty=true;if(data&&audio)updateAudio(snapshot(data,ui.timeline.value,progress));};ui[id].oninput=changed;ui[id].onchange=changed;}
ui.sound.onchange=async()=>{try{if(ui.sound.checked){await ensureAudio();await audio.resume();}dirty=true;}catch(error){ui.sound.checked=false;ui.status.textContent=error.message;}};
function exportSettings(){return [ui.timeline.value==='elapsed'?'With coverage gaps':'Compacted',ui.theme.value,'Inclination 30° · oblique orientation',ui.rotation.checked?'Rotation 0.01% Keplerian':'Rotation off',ui.structure.checked?'Azimuthal structure':'Axisymmetric',ui.events.checked?'Events on':'Events off',ui.sound.checked?`Sound · bass −${ui['low-noise'].value} dB · rejection ${ui['noise-rejection'].value}σ · volume ${Math.round(+ui.volume.value*100)}%`:'Silent'].join(' · ');}
function restoreAfterRecording(message){
  recording=null;playing=false;progress=recordingState?.progress ?? 0;lastTime=0;
  document.querySelectorAll('.toolbar input,.toolbar select,.toolbar button,#seek').forEach(control=>control.disabled=false);
  ui.download.textContent='Download video';ui.play.textContent='Play';ui['export-status'].textContent=message;
  dirty=true;render();
}
ui.download.onclick=async()=>{
  if(recording){recording.cancel('Recording cancelled.');return;}
  ui.download.disabled=true;
  try{
    if(ui.sound.checked){await ensureAudio();await audio.resume();if(!recordingDestination){recordingDestination=audio.createMediaStreamDestination();master.connect(recordingDestination);}}
    recordingState={progress};playing=false;progress=0;lastTime=0;dirty=true;
    if(audio){audioKey='';noiseNode.port.postMessage({reset:true});}
    const m=data.model;
    recording=new VideoExport({title:data.title,dark:ui.theme.value==='dark',settings:exportSettings(),duration:+ui.duration.value,audioStream:ui.sound.checked?recordingDestination.stream:null,onDone:restoreAfterRecording,
      paragraphs:[
        'Images derived from the X-ray power spectrum under the simplified assumption that frequencies correspond to viscous timescales.',
        'r(ν) = r_g [α(H/R)² / (ν t_g)]^(2/3),  t_g = GM/c³.',
        `M = ${m.mass_solar} M☉; α = ${m.alpha}; H/R = ${m.h_over_r}. The dotted ellipse marks 2 R_G in the disc plane.`,
        'The disc is tilted 30° from face-on at an oblique orientation. Ejecta launch from a region wider than the 2 R_G marker. Radio-map-inspired white/yellow/orange/red knots illustrate launch times; jet motion and brightness are not to the disc radius scale.',
        ui.sound.checked?'Audio: stochastic PSD-shaped noise, shifted 64×. Noise rejection may suppress weak real variability. One fixed gain; no separate QPO boost.':'Sound is disabled for this export.',
        data.sources.join(' · ')
      ]});
    document.querySelectorAll('.toolbar input,.toolbar select,.toolbar button,#seek').forEach(control=>control.disabled=true);
    ui.download.disabled=false;ui.download.textContent='Cancel recording';
    render();
    const slug=data.title.replace(/[^a-z0-9]+/gi,'_');
    recording.start(`${slug}_${ui.timeline.value}_${ui.theme.value}_${ui.duration.value}sec_${ui.sound.checked?'sound':'silent'}`);
    playing=true;lastTime=0;dirty=true;
  }catch(error){if(recording){recording.cancel(error.message);}else restoreAfterRecording('Unable to record: '+error.message);}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(recording)recording.cancel('Recording cancelled because the tab was hidden. Please keep it visible during export.');playing=false;ui.play.textContent='Play';}lastTime=0;dirty=true;if(data)updateAudio(snapshot(data,ui.timeline.value,progress));});window.addEventListener('resize',()=>{pdsCaches=new WeakMap();dirty=true;});
function citationNode(text,url){
  if(url&&new URL(url).protocol==='https:'){
    const anchor=document.createElement('a');anchor.textContent=text;anchor.href=url;
    anchor.target='_blank';anchor.rel='noopener noreferrer';return anchor;
  }
  return document.createTextNode(text);
}
function renderIntroduction(){
  const introduction=$('description');introduction.replaceChildren();
  for(const part of citationParts(data.description,data.source_links))introduction.append(citationNode(part.text,part.url));
}
function renderReferences(){
  const footer=$('sources');footer.replaceChildren();
  data.sources.forEach((label,index)=>{
    if(index)footer.append(document.createTextNode(' · '));
    const reference=data.source_links?.find(item=>item.label===label);
    footer.append(citationNode(label,reference?.url));
  });
  footer.append(document.createTextNode('. Created by Rob Fender and ChatGPT'));
}
try{const response=await fetch(new URL('./data/dataset.json',import.meta.url));if(!response.ok)throw Error(`Dataset loading failed (${response.status})`);data=await response.json();if(data.schema_version!==1)throw Error('Unsupported dataset format');ui['low-noise'].value=String(data.sonification?.low_frequency_attenuation_db ?? 12);ui['noise-rejection'].value=String(data.sonification?.noise_rejection_sigma ?? 3);$('title').textContent=data.title;document.title=`${data.title} · X-ray disc explorer`;renderIntroduction();$('model').textContent=`M = ${data.model.mass_solar} M☉ · α = ${data.model.alpha} · H/R = ${data.model.h_over_r}`;$('rotation-rate').textContent=`${data.model.rotation_fraction*100}%`;renderReferences();buildGeometry();ui.play.disabled=ui.restart.disabled=ui.download.disabled=false;render();requestAnimationFrame(tick);}catch(error){ui.status.textContent=`Unable to load visualization: ${error.message}`;console.error(error);}

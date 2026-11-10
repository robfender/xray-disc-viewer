// Illustrative projected ejecta; distances, speeds, and brightness are not fits.
export function launchFootprintRadius(innerRadiusRg) {
  return Math.max(2,innerRadiusRg)*1.15;
}
export function ejectaState(age, type='slow', inclinationDegrees=30) {
  const fast=type==='fast', lifetime=fast?4:2;
  if(age<0||age>lifetime)return null;
  const p=age/lifetime;
  const fade=Math.min(1,age/.1)*Math.min(1,(1-p)/.3);
  return {fast,lifetime,phase:p,fade,
    projectedDistance:(fast?2.08:1.4)*p*Math.sin(inclinationDegrees*Math.PI/180),
    flash:Math.exp(-age/(fast?.28:.18)),trailFraction:fast?.36:.26};
}

export function drawEjecta(ctx, {age,type,inclinationDegrees,orientationDegrees=55,centreX,centreY,outerRadiusPixels,footprintRadiusPixels,clip}) {
  const state=ejectaState(age,type,inclinationDegrees);
  if(!state)return;
  const {fast,fade,flash,trailFraction,phase}=state;
  const distance=state.projectedDistance*outerRadiusPixels;
  const footprint=Math.max(1,footprintRadiusPixels);
  const width=footprint*(1+(fast?.55:.25)*phase);
  const height=width*Math.cos(inclinationDegrees*Math.PI/180)*(1+phase*.5);
  ctx.save();ctx.beginPath();ctx.rect(clip.x,clip.y,clip.size,clip.size);ctx.clip();
  ctx.translate(centreX,centreY);ctx.rotate(orientationDegrees*Math.PI/180);
  // A broad source footprint and wide trails replace the pencil-thin jet.
  // Receding emission is dimmed solely as an illustrative depth cue.
  for(const direction of [1,-1]) {
    const opacity=fade*(direction===1?.52:1),endY=direction*distance;
    const trailLength=Math.min(distance,Math.max(footprint,distance*trailFraction));
    const startY=endY-direction*trailLength;
    ctx.save();
    const trail=ctx.createLinearGradient(0,startY,0,endY);
    trail.addColorStop(0,'rgba(65,0,0,0)');
    trail.addColorStop(.35,`rgba(125,7,0,${opacity*.2})`);
    trail.addColorStop(.75,`rgba(240,55,0,${opacity*.55})`);
    trail.addColorStop(1,`rgba(255,174,34,${opacity*.8})`);
    ctx.strokeStyle=trail;ctx.lineWidth=2*footprint;ctx.lineCap='round';
    ctx.shadowColor='#f43b00';ctx.shadowBlur=footprint*.55;
    ctx.beginPath();ctx.moveTo(0,startY);ctx.lineTo(0,endY);ctx.stroke();
    ctx.shadowBlur=0;
    // White-hot radio-map-inspired core, yellow/orange shoulders, deep-red halo.
    ctx.translate(0,endY);ctx.scale(width,height);
    const glow=ctx.createRadialGradient(0,0,0,0,0,1.25);
    glow.addColorStop(0,`rgba(255,255,255,${opacity})`);
    glow.addColorStop(.24,`rgba(255,255,242,${opacity})`);
    glow.addColorStop(.39,`rgba(255,223,87,${opacity*.98})`);
    glow.addColorStop(.55,`rgba(255,114,5,${opacity*.92})`);
    glow.addColorStop(.73,`rgba(228,27,0,${opacity*.75})`);
    glow.addColorStop(.94,`rgba(85,0,0,${opacity*.45})`);
    glow.addColorStop(1,'rgba(40,0,0,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,1.25,0,Math.PI*2);ctx.fill();
    // Faint contour echoes follow the supplied radio-map appearance.
    ctx.strokeStyle=`rgba(255,244,221,${opacity*.38})`;ctx.lineWidth=.8/width;
    for(const radius of [.68,.92,1.13]){ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  // The launch illumination covers the projected source disc, rather than a dot.
  ctx.save();ctx.scale(footprint,footprint*Math.cos(inclinationDegrees*Math.PI/180));
  const base=ctx.createRadialGradient(0,0,0,0,0,1.35);
  base.addColorStop(0,`rgba(255,247,207,${flash*.72})`);
  base.addColorStop(.55,`rgba(255,101,0,${flash*.58})`);
  base.addColorStop(.85,`rgba(173,14,0,${flash*.4})`);
  base.addColorStop(1,'rgba(80,0,0,0)');
  ctx.fillStyle=base;ctx.beginPath();ctx.arc(0,0,1.35,0,Math.PI*2);ctx.fill();ctx.restore();ctx.restore();
}

// Illustrative projected ejecta; distances, speeds, and brightness are not fits.
export function ejectaState(age, type='slow', inclinationDegrees=30) {
  const fast=type==='fast', lifetime=fast?4:2;
  if(age<0||age>lifetime)return null;
  const p=age/lifetime;
  const fade=Math.min(1,age/.1)*Math.min(1,(1-p)/.3);
  return {fast,lifetime,phase:p,fade,
    // Units here are an illustrative axial distance divided by outer disc radius.
    projectedDistance:(fast?2.08:1.4)*p*Math.sin(inclinationDegrees*Math.PI/180),
    flash:Math.exp(-age/(fast?.28:.18)),
    trailFraction:fast?.36:.26};
}

export function drawEjecta(ctx, {age,type,inclinationDegrees,centreX,centreY,outerRadiusPixels,clip}) {
  const state=ejectaState(age,type,inclinationDegrees);
  if(!state)return;
  const {fast,fade,flash,trailFraction}=state;
  const distance=state.projectedDistance*outerRadiusPixels;
  const coreRadius=Math.max(2,outerRadiusPixels*(fast?.019:.012));
  ctx.save();ctx.beginPath();ctx.rect(clip.x,clip.y,clip.size,clip.size);ctx.clip();
  // Receding knot is deliberately dimmer as a depth cue, not a Doppler model.
  for(const direction of [1,-1]) {
    const opacity=fade*(direction===1?.43:1);
    const endY=centreY+direction*distance;
    const trailLength=Math.min(distance,Math.max(coreRadius*2,distance*trailFraction));
    const startY=endY-direction*trailLength;
    ctx.save();ctx.globalCompositeOperation='screen';
    const trail=ctx.createLinearGradient(centreX,startY,centreX,endY);
    trail.addColorStop(0,'rgba(30,125,255,0)');trail.addColorStop(.7,`rgba(48,174,255,${opacity*.6})`);trail.addColorStop(1,`rgba(150,235,255,${opacity})`);
    ctx.strokeStyle=trail;ctx.lineWidth=coreRadius*(fast?2.7:2.1);ctx.lineCap='round';ctx.shadowColor='#2d9dff';ctx.shadowBlur=coreRadius*3;
    ctx.beginPath();ctx.moveTo(centreX,startY);ctx.lineTo(centreX,endY);ctx.stroke();
    // Expanding, soft knot around a compact bright core.
    const glowRadius=coreRadius*(3.4+state.phase*1.2);
    const glow=ctx.createRadialGradient(centreX,endY,0,centreX,endY,glowRadius);
    glow.addColorStop(0,`rgba(220,251,255,${opacity})`);glow.addColorStop(.22,`rgba(82,204,255,${opacity*.9})`);glow.addColorStop(.55,`rgba(27,118,255,${opacity*.35})`);glow.addColorStop(1,'rgba(10,80,255,0)');
    ctx.shadowBlur=0;ctx.fillStyle=glow;ctx.beginPath();ctx.arc(centreX,endY,glowRadius,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=`rgba(239,253,255,${opacity})`;ctx.beginPath();ctx.ellipse(centreX,endY,coreRadius*.65,coreRadius*(1+state.phase*.7),0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  // Brief base illumination, confined to the launch; no persistent central dot.
  const r=outerRadiusPixels*(fast?.11:.07),base=ctx.createRadialGradient(centreX,centreY,0,centreX,centreY,r);
  base.addColorStop(0,`rgba(171,235,255,${flash*.7})`);base.addColorStop(.4,`rgba(41,154,255,${flash*.35})`);base.addColorStop(1,'rgba(20,100,255,0)');
  ctx.fillStyle=base;ctx.beginPath();ctx.arc(centreX,centreY,r,0,Math.PI*2);ctx.fill();ctx.restore();
}

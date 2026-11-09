// Native browser recording: no server, upload, or external media library.
export class VideoExport {
  constructor({title,dark,settings,paragraphs,duration,audioStream,onDone}) {
    if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('Video recording is not supported in this browser. Please use a recent Chrome, Edge, or Safari.');
    this.onDone=onDone;this.duration=duration;this.title=title;this.dark=dark;this.settings=settings;this.paragraphs=paragraphs;this.chunks=[];this.cancelled=false;this.stopping=false;
    this.host=document.createElement('div');this.host.style.cssText='position:fixed;left:-10000px;top:0;pointer-events:none;';this.host.setAttribute('aria-hidden','true');document.body.append(this.host);
    const make=(w,h)=>{const c=document.createElement('canvas');c.style.width=w+'px';c.style.height=h+'px';this.host.append(c);return c;};
    this.pds=make(1500,350);this.disc=make(670,670);
    this.canvas=document.createElement('canvas');this.canvas.width=1600;this.canvas.height=1200;this.ctx=this.canvas.getContext('2d');
    const candidates=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'];
    this.mime=candidates.find(type=>MediaRecorder.isTypeSupported(type));
    if(!this.mime){this.host.remove();throw Error('No supported video recorder format found.');}
    this.extension=this.mime.startsWith('video/mp4')?'mp4':'webm';
    this.stream=this.canvas.captureStream(24);
    if(audioStream)for(const track of audioStream.getAudioTracks())this.stream.addTrack(track.clone());
    try {this.recorder=new MediaRecorder(this.stream,{mimeType:this.mime,videoBitsPerSecond:6000000,audioBitsPerSecond:192000});}
    catch(error){this.stream.getTracks().forEach(t=>t.stop());this.host.remove();throw error;}
    this.recorder.ondataavailable=event=>{if(event.data.size)this.chunks.push(event.data);};
    this.recorder.onerror=event=>this.cancel(event.error?.message||'Video recording failed.');
    this.recorder.onstop=()=>{
      let result;
      if(!this.cancelled){const blob=new Blob(this.chunks,{type:this.recorder.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=this.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);result=`Downloaded ${this.filename}`;}
      else result=this.reason||'Recording cancelled.';
      this.stream.getTracks().forEach(t=>t.stop());this.host.remove();this.onDone(result);
    };
  }
  start(filename) {this.filename=filename+'.'+this.extension;this.recorder.start(1000);}
  text(text,x,y,width,font=19,line=27){const ctx=this.ctx;ctx.font=`${font}px system-ui`;let row='';for(const word of text.split(/\s+/)){if(ctx.measureText(row+word).width>width&&row){ctx.fillText(row.trim(),x,y);y+=line;row='';}row+=word+' ';}if(row){ctx.fillText(row.trim(),x,y);y+=line;}return y;}
  draw(progress,state) {
    const ctx=this.ctx,fg=this.dark?'#e7ecf3':'#202936',muted=this.dark?'#bdc5d1':'#505e70',bg=this.dark?'#101319':'#f4f5f7',panel=this.dark?'#191f28':'#ffffff';
    ctx.fillStyle=bg;ctx.fillRect(0,0,1600,1200);ctx.fillStyle=fg;ctx.font='bold 32px system-ui';ctx.fillText(this.title+' — dynamical power spectrum',50,52);
    ctx.fillStyle=muted;ctx.font='16px system-ui';ctx.fillText(this.settings,50,85);
    ctx.drawImage(this.pds,50,110,1500,350);
    ctx.fillStyle=panel;ctx.fillRect(50,490,760,670);ctx.fillStyle=fg;ctx.font='bold 24px system-ui';ctx.fillText('From variability to radius',75,530);
    ctx.fillStyle=muted;let y=568;for(const p of this.paragraphs)y=this.text(p,75,y,710,19,27)+16;
    ctx.drawImage(this.disc,850,490,670,670);
    ctx.fillStyle=muted;ctx.font='16px system-ui';ctx.fillText(state,870,1180);ctx.textAlign='right';ctx.fillText(`${(progress*this.duration).toFixed(1)} / ${this.duration} s`,1540,1180);ctx.textAlign='left';
  }
  finish(){if(this.stopping)return;this.stopping=true;if(this.recorder.state!=='inactive')this.recorder.stop();}
  cancel(reason){if(this.stopping)return;this.cancelled=true;this.reason=reason;this.finish();}
}

// Continuous stochastic sonification. Each FFT block is new Gaussian noise;
// overlap-add avoids a periodic bank of coherent, equally spaced tones.
export class SpectrumNoise {
  constructor(sampleRate, size=16384, seed=42813) {
    this.rate=sampleRate; this.size=size; this.hop=size/4;
    this.real=new Float64Array(size); this.imag=new Float64Array(size);
    this.overlap=new Float64Array(size); this.window=new Float64Array(size);
    this.density=new Float64Array(size/2+1);
    this.cursor=0; this.remaining=0; this.seed=seed>>>0;
    for(let i=0;i<size;i++) this.window[i]=(0.5-0.5*Math.cos(2*Math.PI*i/size))/Math.sqrt(1.5);
  }
  random() {this.seed=(1664525*this.seed+1013904223)>>>0;return (this.seed+0.5)/4294967296;}
  setSpectrum(frequencies, powers, {shift=64, attenuationDb=12, gain=1, plateauBins=4}={}) {
    const excess=powers.map(p=>Math.max(p-2,0));
    const lowCount=Math.max(1,Math.min(Math.floor(plateauBins),excess.length));
    const plateau=excess.slice(0,lowCount).reduce((a,b)=>a+b,0)/lowCount;
    for(let i=0;i<lowCount;i++)excess[i]=plateau;
    const df=this.rate/this.size, binWidth=(frequencies[1]-frequencies[0])*shift;
    let index=0;
    for(let k=1;k<this.density.length;k++) {
      const source=k*df/shift;
      let power=0;
      if(source<=frequencies[lowCount-1]) power=plateau;
      else if(source<=frequencies.at(-1)) {
        while(index<frequencies.length-2&&frequencies[index+1]<source)index++;
        const fraction=(source-frequencies[index])/(frequencies[index+1]-frequencies[index]);
        power=excess[index]*(1-fraction)+excess[index+1]*fraction;
      } else if(source<frequencies.at(-1)+(frequencies[1]-frequencies[0])/2) {
        power=excess.at(-1)*(1-(source-frequencies.at(-1))/((frequencies[1]-frequencies[0])/2));
      }
      // Smooth low shelf: full attenuation below 0.5 source Hz,
      // easing to no attenuation at 2 Hz. QPOs at 4–8 Hz are untouched.
      const blend=Math.max(0,Math.min(1,Math.log2(Math.max(source,0.5)/0.5)/2));
      const lowWeight=(1+Math.cos(Math.PI*blend))/2;
      const amplitude=10**(-attenuationDb*lowWeight/20);
      this.density[k]=Math.sqrt(Math.max(power,0)*df/binWidth)*amplitude*gain/Math.sqrt(2);
    }
  }
  inverseFFT() {
    const n=this.size,r=this.real,im=this.imag;
    for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[r[i],r[j]]=[r[j],r[i]];[im[i],im[j]]=[im[j],im[i]];}}
    for(let length=2;length<=n;length*=2){const angle=2*Math.PI/length,wr=Math.cos(angle),wi=Math.sin(angle);for(let start=0;start<n;start+=length){let ar=1,ai=0;for(let j=0;j<length/2;j++){const a=start+j,b=a+length/2,br=r[b]*ar-im[b]*ai,bi=r[b]*ai+im[b]*ar;r[b]=r[a]-br;im[b]=im[a]-bi;r[a]+=br;im[a]+=bi;const next=ar*wr-ai*wi;ai=ar*wi+ai*wr;ar=next;}}}
    for(let i=0;i<n;i++)r[i]/=n;
  }
  addBlock() {
    const n=this.size;this.real.fill(0);this.imag.fill(0);
    for(let k=1;k<n/2;k++) {
      if(!this.density[k])continue;
      const radius=Math.sqrt(-2*Math.log(this.random())),angle=2*Math.PI*this.random();
      const scale=n*this.density[k]/2;
      const re=radius*Math.cos(angle)*scale,im=radius*Math.sin(angle)*scale;
      this.real[k]=this.real[n-k]=re;this.imag[k]=im;this.imag[n-k]=-im;
    }
    this.inverseFFT();
    for(let i=0;i<n;i++)this.overlap[(this.cursor+i)%n]+=this.real[i]*this.window[i];
  }
  fill(output) {
    for(let i=0;i<output.length;i++) {
      if(this.remaining===0){this.addBlock();this.remaining=this.hop;}
      output[i]=this.overlap[this.cursor];this.overlap[this.cursor]=0;
      this.cursor=(this.cursor+1)%this.size;this.remaining--;
    }
  }
}

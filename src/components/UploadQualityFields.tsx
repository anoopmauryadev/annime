'use client';
export default function UploadQualityFields({source,display,onSource,onDisplay}:{source:string;display:string;onSource:(value:string)=>void;onDisplay:(value:string)=>void}) {
  const style='w-full bg-[#1a1a2e] border border-slate-700 rounded-lg p-3 text-white';
  return <div className="grid gap-3 sm:grid-cols-2 my-4">
    <label className="text-sm text-slate-300">Source quality (processing only)
      <select className={style} value={source} onChange={event=>onSource(event.target.value)}>
        <option value="0">Auto / unknown</option>
        {[360,480,720,1080].map(value=><option key={value} value={value}>{value}p</option>)}
      </select>
      <span className="block text-xs text-slate-400 mt-1">Actual resolution is detected automatically; a wrong selection is corrected. Compatible video is copied; other codecs (including TS uploads) may need conversion. Auto-transcoding must be ON.</span>
    </label>
    <label className="text-sm text-slate-300">Display quality (shown to viewers)
      <select className={style} value={display} onChange={event=>onDisplay(event.target.value)}>
        <option value="">No label</option>
        {['360p','480p','720p','1080p','1440p','4K','HD','Full HD','CAM'].map(value=><option key={value}>{value}</option>)}
      </select>
      <span className="block text-xs text-slate-400 mt-1">Only a label. It does not change playback access or create that resolution.</span>
    </label>
  </div>;
}

export function uploadQuality(form: FormData) {
  const sourceQuality=Number(form.get('source_quality') || 0);
  const displayQuality=String(form.get('display_quality') || '');
  if(![0,360,480,720,1080].includes(sourceQuality) || !['','360p','480p','720p','1080p','1440p','4K','HD','Full HD','CAM'].includes(displayQuality)) return null;
  return {sourceQuality,displayQuality};
}

export interface Crop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function createCrop(): Crop {
  return { sx: 0, sy: 0, sw: 0, sh: 0 };
}

// the centered part of an iw x ih image that covers a box of the given
// aspect (width / height). writes into out so it can run every frame
export function coverCrop(iw: number, ih: number, aspect: number, out: Crop): Crop {
  if (!(iw > 0) || !(ih > 0) || !(aspect > 0)) {
    out.sx = out.sy = out.sw = out.sh = 0;
    return out;
  }
  if (iw / ih > aspect) {
    out.sh = ih;
    out.sw = ih * aspect;
    out.sx = (iw - out.sw) / 2;
    out.sy = 0;
  } else {
    out.sw = iw;
    out.sh = iw / aspect;
    out.sx = 0;
    out.sy = (ih - out.sh) / 2;
  }
  return out;
}

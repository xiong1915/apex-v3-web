// Adapted from the local glass prototype; bounded CPU map generation, no animation loop.
export type DisplacementOptions = {
  width: number;
  height: number;
  radius: number;
  bevelDepth: number;
  gain?: number;
  light?: { x: number; y: number };
  dpr?: number;
};

/** Signed distance to a rounded box centred at the origin. <0 inside. */
function sdRoundedBox(
  px: number,
  py: number,
  halfW: number,
  halfH: number,
  r: number,
) {
  const qx = Math.abs(px) - halfW + r;
  const qy = Math.abs(py) - halfH + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return inside + outside - r;
}

/** Squircle-dome slope → Snell's-law bend. `x` = 0 at the rim, 1 at centre. */
function bendFromDepth(x: number) {
  const u = 1 - Math.min(1, Math.max(0, x));
  const denom = (1 - u ** 4) ** 0.75;
  if (denom < 1e-6) return 0;
  const thetaI = Math.atan(Math.min(u ** 3 / denom, 8));
  const sinT = Math.sin(thetaI) / 1.5;
  if (sinT >= 1) return Math.sin(thetaI);
  return Math.sin(thetaI - Math.asin(sinT));
}

/** φ(d) = ∫ bend along the distance from the rim. */
function buildPhiTable(bevelPx: number) {
  const n = Math.max(1, Math.ceil(bevelPx));
  const phi = new Float32Array(n + 1);
  for (let d = 1; d <= n; d++) phi[d] = phi[d - 1] + bendFromDepth(d / n);
  return phi;
}

function samplePhi(phi: Float32Array, depth: number) {
  const max = phi.length - 1;
  if (depth <= 0) return phi[0];
  if (depth >= max) return phi[max];
  const i = Math.floor(depth);
  const f = depth - i;
  return phi[i] * (1 - f) + phi[i + 1] * f;
}

export function computeDisplacementData(opts: DisplacementOptions) {
  const dpr = opts.dpr ?? 1;
  const gain = opts.gain ?? 1.35;
  const light = opts.light ?? { x: -0.55, y: -0.85 };
  const lightLen = Math.hypot(light.x, light.y) || 1;
  const lx = light.x / lightLen;
  const ly = light.y / lightLen;

  const W = Math.max(1, Math.round(opts.width * dpr));
  const H = Math.max(1, Math.round(opts.height * dpr));
  const halfW = W / 2;
  const halfH = H / 2;
  const r = Math.min(opts.radius * dpr, halfW, halfH);
  const bevel = Math.max(1, opts.bevelDepth * dpr);
  const phi = buildPhiTable(bevel);

  // Height field over the shape, then displace along its gradient.
  const field = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const py = y - halfH + 0.5;
    for (let x = 0; x < W; x++) {
      const d = sdRoundedBox(x - halfW + 0.5, py, halfW, halfH, r);
      field[y * W + x] = d > 0 ? 0 : samplePhi(phi, Math.min(bevel, -d));
    }
  }

  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const py = y - halfH + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x - halfW + 0.5;
      const i = (y * W + x) << 2;
      const d = sdRoundedBox(px, py, halfW, halfH, r);

      if (d > 0) {
        data[i] = data[i + 1] = data[i + 2] = 128;
        data[i + 3] = 0;
        continue;
      }

      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(W - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(H - 1, y + 1);
      const dPhiX = (field[y * W + x1] - field[y * W + x0]) / (x1 - x0 || 1);
      const dPhiY = (field[y1 * W + x] - field[y0 * W + x]) / (y1 - y0 || 1);

      // Cap so the rim compresses but never folds over itself.
      const dx = Math.max(-1, Math.min(1, dPhiX * gain));
      const dy = Math.max(-1, Math.min(1, dPhiY * gain));

      let specular = 0;
      if (d >= -bevel) {
        const gx =
          sdRoundedBox(px + 1, py, halfW, halfH, r) -
          sdRoundedBox(px - 1, py, halfW, halfH, r);
        const gy =
          sdRoundedBox(px, py + 1, halfW, halfH, r) -
          sdRoundedBox(px, py - 1, halfW, halfH, r);
        const len = Math.hypot(gx, gy) || 1;
        const dot = (gx / len) * lx + (gy / len) * ly;
        const rim = 1 - Math.min(1, -d / bevel);
        specular = (Math.max(0, dot) + Math.max(0, -dot) * 0.35) * rim;
      }

      data[i] = 128 + dx * 127;
      data[i + 1] = 128 + dy * 127;
      data[i + 2] = Math.round(specular * 255);
      data[i + 3] = 255;
    }
  }

  return { data, width: W, height: H };
}


/** Large surfaces retain the shared frosted material; maps never exceed 64K pixels. */
export function getRefractionSize(width:number,height:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<2||height<2||width*height>200000)return null;
 const ratio=Math.min(1,Math.sqrt(65536/(width*height)));
 return {width:Math.max(2,Math.floor(width*ratio)),height:Math.max(2,Math.floor(height*ratio)),ratio};
}
export function supportsRefraction(ua:string,width:number,reduced:boolean,urlFilter:boolean){
 return width>1100&&!reduced&&urlFilter&&/Chrome\/|Chromium\/|Edg\//.test(ua)&&!/CriOS|FxiOS|iPhone|iPad/.test(ua);
}

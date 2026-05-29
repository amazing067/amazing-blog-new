// 듀오톤 변환 (런타임용). scripts/bake-recruit-duotone.mjs와 동일한 알고리즘.
// 스크립트는 .mjs(node 직접 실행)라 .ts를 import 못 하므로 로직을 여기에 한 벌 둔다.
// 입력 버퍼(임의 사진) → 1:1 리사이즈 → 흑백 → 대비 스트레치 → 슬롯 틴트로 듀오톤 → JPEG 버퍼.
import sharp from 'sharp';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// 틴트 → (그림자색, 하이라이트색). 그림자=틴트×0.32, 하이라이트=흰색쪽 82%.
function duotoneStops(tint: string) {
  const [r, g, b] = hexToRgb(tint);
  const shadow: [number, number, number] = [r * 0.32, g * 0.32, b * 0.32];
  const highlight: [number, number, number] = [
    r + (255 - r) * 0.82,
    g + (255 - g) * 0.82,
    b + (255 - b) * 0.82,
  ];
  return { shadow, highlight };
}

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** 사진 버퍼를 슬롯 틴트 듀오톤 JPEG 버퍼로 변환 (1:1, 기본 1080px). */
export async function applyDuotone(input: Buffer, tint: string, size = 1080): Promise<Buffer> {
  const { shadow, highlight } = duotoneStops(tint);
  const { data, info } = await sharp(input)
    .rotate() // EXIF 회전 보정
    .resize(size, size, { fit: 'cover', position: 'attention' })
    .grayscale()
    .normalise() // 대비 스트레치
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  const out = Buffer.allocUnsafe(n * 3);
  for (let i = 0; i < n; i++) {
    const l = data[i * info.channels] / 255; // luma
    out[i * 3] = clamp8(shadow[0] + (highlight[0] - shadow[0]) * l);
    out[i * 3 + 1] = clamp8(shadow[1] + (highlight[1] - shadow[1]) * l);
    out[i * 3 + 2] = clamp8(shadow[2] + (highlight[2] - shadow[2]) * l);
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

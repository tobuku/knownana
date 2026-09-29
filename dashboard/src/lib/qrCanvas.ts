/**
 * Minimal QR code generator - renders a QR code onto an HTML canvas.
 * Supports alphanumeric/byte mode, error correction level M, versions 1-10.
 * No external dependencies.
 */

// Galois field arithmetic for Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(data: number[], nsym: number): number[] {
  // Build generator polynomial
  let gen = [1];
  for (let i = 0; i < nsym; i++) {
    const ng: number[] = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      ng[j] ^= gen[j];
      ng[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = ng;
  }
  const msg = [...data, ...new Array(nsym).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// QR version parameters for EC level M (medium)
interface VersionInfo {
  totalCodewords: number;
  ecPerBlock: number;
  blocks: number;
  dataCodewords: number;
}

const VERSION_TABLE_M: VersionInfo[] = [
  /* v0 placeholder */ { totalCodewords: 0, ecPerBlock: 0, blocks: 0, dataCodewords: 0 },
  /* v1  */ { totalCodewords: 26,  ecPerBlock: 10, blocks: 1, dataCodewords: 16 },
  /* v2  */ { totalCodewords: 44,  ecPerBlock: 16, blocks: 1, dataCodewords: 28 },
  /* v3  */ { totalCodewords: 70,  ecPerBlock: 26, blocks: 1, dataCodewords: 44 },
  /* v4  */ { totalCodewords: 100, ecPerBlock: 18, blocks: 2, dataCodewords: 64 },
  /* v5  */ { totalCodewords: 134, ecPerBlock: 24, blocks: 2, dataCodewords: 86 },
  /* v6  */ { totalCodewords: 172, ecPerBlock: 16, blocks: 4, dataCodewords: 108 },
  /* v7  */ { totalCodewords: 196, ecPerBlock: 18, blocks: 4, dataCodewords: 124 },
  /* v8  */ { totalCodewords: 242, ecPerBlock: 22, blocks: 4, dataCodewords: 154 },
  /* v9  */ { totalCodewords: 292, ecPerBlock: 22, blocks: 5, dataCodewords: 182 },
  /* v10 */ { totalCodewords: 346, ecPerBlock: 26, blocks: 5, dataCodewords: 216 },
];

function chooseVersion(dataLen: number): number {
  // Byte mode: 4 mode bits + 8/16 char count bits + 8*dataLen + 4 terminator, round up to codewords
  for (let v = 1; v <= 10; v++) {
    const ccBits = v <= 9 ? 8 : 16;
    const totalBits = 4 + ccBits + dataLen * 8;
    const totalCodewords = Math.ceil(totalBits / 8);
    if (totalCodewords <= VERSION_TABLE_M[v].dataCodewords) return v;
  }
  return 10; // clamp
}

function encodeData(text: string, version: number): number[] {
  const info = VERSION_TABLE_M[version];
  const bytes = new TextEncoder().encode(text);
  const ccBits = version <= 9 ? 8 : 16;

  // Build bit stream
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4); // byte mode
  pushBits(bytes.length, ccBits);
  for (const b of bytes) pushBits(b, 8);
  pushBits(0, Math.min(4, info.dataCodewords * 8 - bits.length)); // terminator

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    codewords.push(byte);
  }

  // Pad codewords
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (codewords.length < info.dataCodewords) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  return codewords;
}

function addErrorCorrection(data: number[], version: number): number[] {
  const info = VERSION_TABLE_M[version];
  const blockSize = Math.floor(info.dataCodewords / info.blocks);
  const largeBlocks = info.dataCodewords % info.blocks;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;

  for (let b = 0; b < info.blocks; b++) {
    const size = blockSize + (b >= info.blocks - largeBlocks ? 1 : 0);
    const block = data.slice(offset, offset + size);
    offset += size;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, info.ecPerBlock));
  }

  // Interleave
  const result: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < info.ecPerBlock; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }

  return result;
}

// Alignment pattern positions per version
const ALIGN_POS: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

function createMatrix(version: number): { matrix: number[][]; reserved: boolean[][] } {
  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  // Finder patterns
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        matrix[rr][cc] = isBlack ? 1 : 0;
        reserved[rr][cc] = true;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    reserved[6][i] = true;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
    reserved[i][6] = true;
  }

  // Alignment patterns
  if (version >= 2) {
    const positions = ALIGN_POS[version];
    for (const row of positions) {
      for (const col of positions) {
        if (reserved[row][col]) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isBlack = Math.max(Math.abs(r), Math.abs(c)) !== 1;
            matrix[row + r][col + c] = isBlack ? 1 : 0;
            reserved[row + r][col + c] = true;
          }
        }
      }
    }
  }

  // Dark module
  matrix[size - 8][8] = 1;
  reserved[size - 8][8] = true;

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (i < size) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  return { matrix, reserved };
}

function placeData(matrix: number[][], reserved: boolean[][], codewords: number[]): void {
  const size = matrix.length;
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;

  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // skip timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (!reserved[row][c]) {
          matrix[row][c] = bitIdx < bits.length ? bits[bitIdx] : 0;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }
}

// Format info (EC level M = 00, mask patterns 0-7)
const FORMAT_BITS_M = [
  0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0,
];

function applyMask(matrix: number[][], reserved: boolean[][], maskIdx: number): number[][] {
  const size = matrix.length;
  const result = matrix.map(row => [...row]);

  const maskFn = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number, _c: number) => r % 2 === 0,
    (_r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ][maskIdx];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && maskFn(r, c)) {
        result[r][c] ^= 1;
      }
    }
  }

  // Write format info
  const fmt = FORMAT_BITS_M[maskIdx];
  // Horizontal (row 8)
  const hPositions = [0, 1, 2, 3, 4, 5, 7, 8, size - 8, size - 7, size - 6, size - 5, size - 4, size - 3, size - 2, size - 1];
  for (let i = 0; i < 15; i++) {
    result[8][hPositions[i]] = (fmt >> (14 - i)) & 1;
  }
  // Vertical (col 8)
  const vBits: [number, number][] = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, 8], [7, 8],
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    result[vBits[i][0]][vBits[i][1]] = (fmt >> (14 - i)) & 1;
  }

  return result;
}

function penalty(matrix: number[][]): number {
  const size = matrix.length;
  let score = 0;

  // Rule 1: runs of same color
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) { run++; }
      else { if (run >= 5) score += run - 2; run = 1; }
    }
    if (run >= 5) score += run - 2;
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) { run++; }
      else { if (run >= 5) score += run - 2; run = 1; }
    }
    if (run >= 5) score += run - 2;
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  return score;
}

function generateQR(text: string): number[][] {
  const version = chooseVersion(text.length);
  const data = encodeData(text, version);
  const codewords = addErrorCorrection(data, version);
  const { matrix, reserved } = createMatrix(version);
  placeData(matrix, reserved, codewords);

  // Try all 8 masks, pick lowest penalty
  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(matrix, reserved, m);
    const p = penalty(masked);
    if (p < bestPenalty) { bestPenalty = p; bestMask = m; }
  }

  return applyMask(matrix, reserved, bestMask);
}

/**
 * Render a QR code onto a canvas element.
 * @param canvas - Target canvas element
 * @param data - String to encode
 * @param size - Canvas pixel size (width and height)
 */
export function renderQR(canvas: HTMLCanvasElement, data: string, size: number): void {
  const modules = generateQR(data);
  const modCount = modules.length;
  const quiet = 4; // quiet zone modules
  const totalMods = modCount + quiet * 2;
  const scale = size / totalMods;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#000000';
  for (let r = 0; r < modCount; r++) {
    for (let c = 0; c < modCount; c++) {
      if (modules[r][c]) {
        ctx.fillRect(
          Math.floor((c + quiet) * scale),
          Math.floor((r + quiet) * scale),
          Math.ceil(scale),
          Math.ceil(scale)
        );
      }
    }
  }
}

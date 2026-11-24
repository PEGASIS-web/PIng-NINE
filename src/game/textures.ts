import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export interface CampusTextures {
  grass: THREE.CanvasTexture;
  cobble: THREE.CanvasTexture;
  brick: THREE.CanvasTexture;
  labFloor: THREE.CanvasTexture;
  woodFloor: THREE.CanvasTexture;
}

export function createCampusTextures(renderer: THREE.WebGLRenderer): CampusTextures {
  // 1. Twilight Campus Grass
  const [gCanvas, gCtx] = makeCanvas(256, 256);
  gCtx.fillStyle = '#2b3d38';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = Math.random() > 0.5 ? '#354b44' : '#23322e';
    gCtx.fillStyle = shade;
    gCtx.fillRect(x, y, 2, 4);
  }
  const grass = finalizeTexture(gCanvas, renderer, 18, 18);

  // 2. Cobblestone Walkway
  const [cCanvas, cCtx] = makeCanvas(256, 256);
  cCtx.fillStyle = '#3c3a47';
  cCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const offset = (row % 2) * 20;
      const x = (col * 44 + offset) % 256;
      const y = row * 32;
      cCtx.fillStyle = (row + col) % 2 === 0 ? '#4e4b5c' : '#464354';
      cCtx.fillRect(x + 2, y + 2, 39, 27);
      cCtx.strokeStyle = '#2d2b36';
      cCtx.strokeRect(x + 2, y + 2, 39, 27);
    }
  }
  const cobble = finalizeTexture(cCanvas, renderer, 10, 10);

  // 3. Old Campus Brick
  const [bCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#4a2f32';
  bCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const offset = (row % 2) * 21;
      const x = (col * 44 + offset) % 256;
      const y = row * 21.3;
      const tone = (row * 3 + col) % 3;
      bCtx.fillStyle = tone === 0 ? '#76413e' : tone === 1 ? '#6a3836' : '#804944';
      bCtx.fillRect(x + 1.5, y + 1.5, 40, 18);
    }
  }
  const brick = finalizeTexture(bCanvas, renderer, 3, 2);

  // 4. Robotics Lab Grid Tile
  const [lCanvas, lCtx] = makeCanvas(256, 256);
  lCtx.fillStyle = '#1b2432';
  lCtx.fillRect(0, 0, 256, 256);
  lCtx.strokeStyle = '#2e4158';
  lCtx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    lCtx.beginPath();
    lCtx.moveTo(i, 0);
    lCtx.lineTo(i, 256);
    lCtx.stroke();
    lCtx.beginPath();
    lCtx.moveTo(0, i);
    lCtx.lineTo(256, i);
    lCtx.stroke();
  }
  lCtx.fillStyle = '#243347';
  lCtx.fillRect(8, 8, 48, 48);
  const labFloor = finalizeTexture(lCanvas, renderer, 6, 6);

  // 5. Library Warm Wood Floor
  const [wCanvas, wCtx] = makeCanvas(256, 256);
  wCtx.fillStyle = '#4a3225';
  wCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    wCtx.fillStyle = i % 2 === 0 ? '#573a2b' : '#4d3426';
    wCtx.fillRect(0, i * 32, 256, 30);
    wCtx.fillStyle = '#332016';
    wCtx.fillRect(0, i * 32 + 30, 256, 2);
  }
  const woodFloor = finalizeTexture(wCanvas, renderer, 5, 5);

  return { grass, cobble, brick, labFloor, woodFloor };
}

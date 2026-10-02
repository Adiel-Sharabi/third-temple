/* 3D/Scene/materials.js — the Temple scene's materials and procedural textures.
 *
 * A classic script for three.js r147 used as the global THREE (no bundler). Defines the
 * global TempleMaterials. scene-core.js builds with these; a page may add its own
 * materials through `make`, so every material shares one factory and one environment list.
 *
 *   const M = TempleMaterials.create({ mm: L.MM, anisotropy: renderer.capabilities.getMaxAnisotropy() });
 *   M.MAT.stone, M.TEX.plaster, M.PALETTE.gold, M.make({ color: 0x262626 }, .4), M.envMats
 *
 * Colours are the model's palette, named by tone. Texture sizes are in cubits of the plan.
 * Claude Code, 2026-10-02, moved here from 3D/Planning/TTM-006/demo-template.html.
 */
(function (global) {
  "use strict";

  const PALETTE = {
    ivory: 0xeadfc6,   // walls, gates, colonnade
    bone: 0xe2d2b3,    // chambers, corner courts, small ramps
    white: 0xf6f4ee,   // the whitewashed altar, ramp, cornices, inner court floor
    sand: 0xcdb892,    // paving
    gold: 0xd8a63a,
    bronze: 0x9a6232,  // laver, columns
    brown: 0x4a3526,   // openings, windows, doors, firewood
    red: 0x9b2a1c,     // the scarlet line
    iron: 0x2e2f31,    // the slaughter rings
  };

  function rng(seed){ let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function noise(g, S, n, r, a){ for (let i = 0; i < n; i++){ const v = r() < .5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * r()})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); } }

  /* opts: mm (mm per cubit, the world scale), anisotropy (from the renderer; default 1) */
  function create(opts){
    const MM = opts.mm, C = c => c * MM, aniso = opts.anisotropy || 1;
    function canvasTex(size, draw, worldSize){
      const c = document.createElement("canvas"); c.width = c.height = size;
      draw(c.getContext("2d"), size);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
      t.anisotropy = aniso;
      t.repeat.set(1 / worldSize, 1 / worldSize);
      return t;
    }
    const TEX = {};
    // dressed ashlar with drafted margins, blocks of 3 x 1.5 cubits
    TEX.ashlar = canvasTex(512, (g, S) => {
      const r = rng(7), cols = 4, rows = 8, bw = S / cols, bh = S / rows;
      g.fillStyle = "#b9ab93"; g.fillRect(0, 0, S, S);
      for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++){
        const x = i * bw + (j % 2 ? bw / 2 : 0), y = j * bh, t = 214 + r() * 26 | 0, w = 239 - (r() * 14 | 0);
        g.fillStyle = `rgb(${t},${t - 8},${t - 22})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        g.fillStyle = `rgb(${w},${w - 6},${w - 18})`;
        g.fillRect(x + 2, y + 2, bw - 4, 5); g.fillRect(x + 2, y + bh - 7, bw - 4, 5); g.fillRect(x + 2, y + 2, 5, bh - 4); g.fillRect(x + bw - 7, y + 2, 5, bh - 4);
      }
      noise(g, S, 9000, r, .10);
    }, C(12));
    TEX.plaster = canvasTex(256, (g, S) => { const r = rng(3); g.fillStyle = "#ece3d2"; g.fillRect(0, 0, S, S); noise(g, S, 5000, r, .08); }, C(10));
    TEX.paving = canvasTex(512, (g, S) => {                 // square slabs, each with an eight-point star
      const r = rng(11), n = 4, s = S / n;
      g.fillStyle = "#b3a58c"; g.fillRect(0, 0, S, S);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){
        const t = 222 + r() * 16 | 0, cx = i * s + s / 2, cy = j * s + s / 2;
        g.fillStyle = `rgb(${t},${t - 6},${t - 18})`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
        g.fillStyle = "rgba(120,98,70,.30)";
        for (const rot of [0, Math.PI / 4]){ g.save(); g.translate(cx, cy); g.rotate(rot); g.fillRect(-s * .27, -s * .27, s * .54, s * .54); g.restore(); }
        g.fillStyle = `rgb(${t},${t - 6},${t - 18})`; g.beginPath(); g.arc(cx, cy, s * .13, 0, Math.PI * 2); g.fill();
      }
      noise(g, S, 9000, r, .07);
    }, C(16));
    TEX.marble = canvasTex(512, (g, S) => {
      const r = rng(19), n = 4, s = S / n;
      g.fillStyle = "#bdb4a4"; g.fillRect(0, 0, S, S);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){ const t = 236 + r() * 14 | 0; g.fillStyle = `rgb(${t},${t - 3},${t - 10})`; g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3); }
      g.strokeStyle = "rgba(150,140,125,.25)"; g.lineWidth = 1.2;
      for (let k = 0; k < 18; k++){ g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let q = 0; q < 6; q++){ x += (r() - .5) * 90; y += (r() - .3) * 60; g.lineTo(x, y); } g.stroke(); }
    }, C(16));

    // userData.env scales the environment light per material; a page dims envMats for night scenes
    const envMats = [];
    function make(o, e){
      const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .8, metalness: 0 }, o));
      m.color.convertSRGBToLinear(); m.emissive.convertSRGBToLinear();
      m.userData.env = e ?? .55; envMats.push(m); return m;
    }
    const P = PALETTE;
    // created in this order on purpose: three.js sorts opaque draws by material id
    const MAT = {
      stone: make({ map: TEX.ashlar, color: P.ivory }),
      bone: make({ map: TEX.ashlar, color: P.bone }),
      cap: make({ map: TEX.plaster, color: P.white }),
      roof: make({ map: TEX.plaster, color: P.bone }),
      pave: make({ map: TEX.paving, color: P.sand }),
      marble: make({ map: TEX.marble, color: P.white, roughness: .55 }),
      lime: make({ map: TEX.plaster, color: P.white, roughness: .7 }),
      dark: make({ color: P.brown, roughness: .9 }, .1),
      gold: make({ color: P.gold, metalness: .85, roughness: .28 }, 1),
      bronze: make({ color: P.bronze, metalness: .7, roughness: .35 }, .9),
      door: make({ color: P.gold, metalness: .7, roughness: .32 }, 1),
      red: make({ color: P.red, roughness: .7 }),
      iron: make({ color: P.iron, metalness: .6, roughness: .45 }, .6),
      ember: make({ color: 0x3a1d10, emissive: 0xff5a1f, emissiveIntensity: .9 }),
      flame: make({ color: 0xffa040, emissive: 0xff7a1a, emissiveIntensity: 1.6, transparent: true, opacity: .9 }),
      water: make({ color: 0x2f6f7c, roughness: .15, metalness: .1 }, 1),
      ash: make({ color: 0x6d655c, roughness: 1 }, .2),
      palm: make({ color: P.gold, metalness: .85, roughness: .25, emissive: 0xffc25a, emissiveIntensity: 0, side: THREE.DoubleSide }, 1),
    };
    // the hidden boxes that make a component clickable
    const PROXY = new THREE.MeshBasicMaterial({ visible: false });
    return { PALETTE, TEX, MAT, PROXY, envMats, make, canvasTex };
  }

  global.TempleMaterials = { PALETTE, create, rng, noise };
})(typeof window !== "undefined" ? window : this);

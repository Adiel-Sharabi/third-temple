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

  /* The vessels' materials (3D/Scene/vessels.js): polished gold, acacia wood, fine marble, the
   * showbread, frankincense, copper, and the faint "ghost" lines of the ark's outline. They are
   * added to a set from create() on first use, so a page that shows no vessel makes nothing more,
   * and the core's materials keep their ids and their draw order. Idempotent.
   *   TempleMaterials.vessels(M, mm)  ->  M (now with M.MAT.vgold, wood, vmarble, bread, incense,
   *                                       copper, rope, ghostFill and M.LINE.ghost, M.LINE.ghostDash)
   * Claude Code, 2026-10-02. */
  function vessels(M, mm){
    if (M.MAT.vgold) return M;
    const C = c => c * mm, make = M.make;
    // acacia: warm heartwood with long grain, one board a cubit wide
    M.TEX.wood = M.canvasTex(256, (g, S) => {
      const r = rng(23);
      g.fillStyle = "#7a4a28"; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 70; i++){
        const y = r() * S, a = .06 + r() * .14, w = .6 + r() * 1.8, dark = r() < .6;
        g.strokeStyle = dark ? `rgba(40,20,8,${a})` : `rgba(210,150,95,${a})`; g.lineWidth = w;
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x / S * Math.PI * 2 * (1 + r())) * 3);
        g.stroke();
      }
      noise(g, S, 3000, r, .06);
    }, C(1));
    // fine white marble with grey veins, a slab of two cubits
    M.TEX.vmarble = M.canvasTex(512, (g, S) => {
      const r = rng(31);
      g.fillStyle = "#f2efe8"; g.fillRect(0, 0, S, S);
      for (let k = 0; k < 40; k++){
        g.strokeStyle = `rgba(${70 + r() * 40 | 0},${68 + r() * 40 | 0},${66 + r() * 40 | 0},${.22 + r() * .4})`;
        g.lineWidth = .5 + r() * 2.2;
        g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
        for (let q = 0; q < 9; q++){ x += (r() - .35) * 70; y += (r() - .5) * 50; g.lineTo(x, y); }
        g.stroke();
      }
      noise(g, S, 4000, r, .04);
    }, C(2));
    // the baked loaf: a soft crust with flour specks
    M.TEX.bread = M.canvasTex(128, (g, S) => {
      const r = rng(41);
      g.fillStyle = "#b5753a"; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 400; i++){ g.fillStyle = `rgba(255,236,200,${r() * .25})`; g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 2); }
      noise(g, S, 1500, r, .08);
    }, C(.5));
    // these wrap each face of a vessel's own geometry once (its UVs run 0..1), not by world size
    [M.TEX.wood, M.TEX.vmarble, M.TEX.bread].forEach(t => t.repeat.set(1, 1));
    Object.assign(M.MAT, {
      vgold: make({ color: 0xe0ad45, metalness: 1, roughness: .2 }, 1.1),
      vgoldSoft: make({ color: 0xd9a43c, metalness: .95, roughness: .38 }, 1),
      wood: make({ map: M.TEX.wood, color: 0xd9c2a8, roughness: .7 }, .45),
      vmarble: make({ map: M.TEX.vmarble, color: 0xe6dfd2, roughness: .3 }, .6),
      vwater: make({ color: 0x23484c, roughness: .06, metalness: .35, transparent: true, opacity: .92 }, 1),
      bread: make({ map: M.TEX.bread, color: 0xffffff, roughness: .9 }, .45),
      incense: make({ color: 0xf1e7cf, roughness: .55 }, .6),
      copper: make({ color: 0xb4703e, metalness: .85, roughness: .3 }, 1),
      rope: make({ color: 0x9c8058, roughness: 1 }, .3),
      ghostFill: make({ color: 0xa9c4ff, transparent: true, opacity: .07, depthWrite: false, roughness: 1 }, 0),
    });
    // line materials: not lit, so outside envMats
    M.LINE = M.LINE || {};
    M.LINE.ghost = new THREE.LineBasicMaterial({ color: 0x9fbaf2, transparent: true, opacity: .75 });
    M.LINE.ghostDash = new THREE.LineDashedMaterial({ color: 0x9fbaf2, transparent: true, opacity: .8, dashSize: C(.12), gapSize: C(.08) });
    // for outlines below the floor (a pit, a hiding place): longer dashes; a page shows them in a section or x-ray view
    M.LINE.ghostXray = new THREE.LineDashedMaterial({ color: 0x9fbaf2, transparent: true, opacity: .7, dashSize: C(.2), gapSize: C(.12) });
    return M;
  }

  global.TempleMaterials = { PALETTE, create, rng, noise, vessels };
})(typeof window !== "undefined" ? window : this);

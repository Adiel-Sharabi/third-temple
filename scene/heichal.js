/* 3D/Scene/heichal.js — the architectural Heichal: the house as a building, outside and in.
 *
 * A classic script for three.js r147 used as the global THREE; load it after scene-core.js.
 * It extends TempleScene.build with one option:
 *
 *   const root = TempleScene.build(data, { house: "arch", hooks: { vessel(kind, group, at){...} } });
 *   TempleHeichal.setCut(root, "open");      // "none" | "open" | "section" | "plan" | "aliyah-plan"
 *
 * house: "block" (the default) is scene-core's own plain block, untouched: the print demo
 * (TTM-006/TTM-007) never loads this file and builds exactly what it always did. house: "arch"
 * replaces the block with the house built here, and needs data.X.heichal (scene_data(house="arch")).
 *
 * Every architectural number is read from data: the chains of Middot 4:6-7 (X.heichal.ew, .ns, .z,
 * the `sequences` of mikdash-dimensions.json) and the ids in X.dim. Each open question of the
 * house (the hk-* options of Web/site/methods.json) is built in every one of its readings, as
 * parts tagged userData.tags, so TempleScene.applyOptions switches between them. The project's
 * own finishing proportions, which no source gives and which are too small to be architecture,
 * are the ART table below, named once and shown as "עיצוב" in the click texts.
 *
 * The cutaway: every box of the house is split where a cut can pass, and the pieces sit in
 * groups marked userData.cut (flags s: south of the hall's south face, t: the ceilings and the
 * roof, a: above the hall's ceiling except the face, p0: above the plan cut, p1: above the upper
 * storey's plan cut, o: shown only when open). "open" hides s, t and a: a dollhouse view.
 * setCut shows or hides those groups; it never touches the option tags, which sit one level down.
 *
 * Vessels are not built or placed here. hooks.vessel(kind, group, {x, y, z, rotY, plan, frame}) is
 * called once per room a vessel stands in, with the origin of that room's frame (world mm, the
 * scene's frame; rotY 0 = the frame's +x points east): "heichal" (on the floor at the middle of the
 * Holy's west end), "ulam" (on the floor at the middle of the Heichal's doorway, on the ulam side) or
 * "kodesh-kodashim" (on the floor under the foundation stone's centre; the ark's outline is raised by
 * the stone's height in vessels.js). Where in the room, and how that depends on the
 * vessels' own options (kl-*), is 3D/Scene/vessels.js's TempleVessels.layout. The group carries
 * only the house's own tags; without a hook nothing is drawn.
 *
 * Claude Code (sub-agent), 2026-10-02. Claim: Coordination/Claims/claude-code--web-exhibit-build.md.
 */
(function (global) {
  "use strict";

  const TS = global.TempleScene;
  if (!TS) throw new Error("heichal.js: load scene-core.js first");
  const EPS = 1e-6;

  /* The project's finishing proportions, in cubits. None of them is in a source. */
  const ART = {
    stub: 1.5,            // what a cutaway leaves standing of a removed wall
    planCut: 3,           // a plan cuts the walls this far above its floor, below the doors' heads
    taSlab: 1,            // the floors between the storeys of the side chambers
    taPart: 1,            // the walls between the cells
    taDoor: [2, 5],       // a doorway between cells (width, height)
    wicket: [2, 4],       // the wickets (hk-wicket-size: not given)
    aliyahDoor: [4, 8],   // the door of the upper storey
    window: [1, 3.5],     // a narrow window on the side chambers
    facadeWindow: [1.2, 6],
    coping: 1,            // the side chambers' walls stand this far above their roofs
    parapet: 1,           // thickness of the roof parapet
    blade: [.7, .1],      // a kalah orev blade: base, thickness
    bladePitch: 1.25,
    pilaster: [2, .6],
    cornice: [.8, .6],    // height, projection
    frame: [.8, .25],     // the portal's gold frame: width, projection
    pedestal: 1,          // a pillar's pedestal: the shaft's diameter plus this
    doorLeaf: .5,         // thickness of a door leaf
    beams: 5,             // cedar beams over the great door (hk-cedar-beams: no number)
    beamSize: 1,
    chains: 4,
    bundle: 2,            // a gathered curtain at each side of the ulam's opening
    curtainGap: 1.5,      // the opened corner of a parochet
    shetiyaFromWall: 1,   // the small foundation stone stands this far from the west wall
    lulin: 1,             // the openings over the Holy of Holies, side
    hatch: 1.2,           // a cell's opening to the cell above it, side
    lesenePitch: 8,
    ledge: .25,           // how far a ledge (rovad) of the ulam's walls stands out (hk-ulam-ledge: not given)
  };

  /* The options this file builds, in the order of their choices in Web/site/methods.json. */
  const OPT = {
    "hk-plan": ["middot-70", "josephus-60"],
    "hk-ulam-opening": ["middot-20x40", "josephus-25x70", "ezekiel-14"],
    "hk-ulam-closure": ["curtain", "open"],
    "hk-malteraot": ["middot", "none"],
    "hk-ulam-pillars": ["free", "engaged", "none"],
    "hk-ulam-furnishings": ["second-temple", "none"],
    "hk-steps-plan": ["rambam", "middot", "middot-ryehuda", "model-1.5"],
    "hk-steps-shape": ["straight", "three-sides"],
    "hk-windows": ["ezekiel-places", "rows", "none"],
    "hk-doors": ["tk", "ryehuda"],
    "hk-wicket": ["ta", "wall"],
    "hk-walls": ["ezekiel-carved", "gold-plain"],
    "hk-kk-divider": ["two-curtains", "one-curtain", "ezekiel-wall"],
    "hk-parochet": ["four-colours", "cherubim"],
    "hk-even-shetiya": ["small-west", "m3-large"],
    "hk-taim-count": ["middot-38", "ezekiel-33"],
    "hk-taim-width": ["middot-5-6-7", "ezekiel-4"],
    "hk-taim-height": ["aliyah-level", "kings-5"],
    "hk-mesibah": ["stairs", "ramp"],
    "hk-roof-edge": ["iron", "gold", "ryehuda"],
    "hk-exterior": ["white", "gold"],
    "hk-ulam-ledge": ["rambam", "none"],
  };
  const combos = keys => keys.reduce((acc, k) => acc.flatMap(o => OPT[k].map(v => Object.assign({}, o, { [k]: v }))), [{}]);

  /* ---------- materials: added to the scene's own set once, through its factory ---------- */
  function ensureMaterials(MATS){
    const MAT = MATS.MAT;
    if (MAT.hkWhite || !MATS.make || !MATS.canvasTex) return;   // the inventory's stand-in answers every key
    const tex = (size, draw, world) => MATS.canvasTex(size, draw, world);
    const rng = global.TempleMaterials.rng, noise = global.TempleMaterials.noise;
    const C = c => c * MATS.mmPerCubit;
    // gold coffers, the ceiling (kiyur) seen from below: world uv, 4 cubits a coffer
    const coffer = tex(256, (g, S) => {
      g.fillStyle = "#b8872f"; g.fillRect(0, 0, S, S);
      g.fillStyle = "#e6bd5e"; g.fillRect(S * .12, S * .12, S * .76, S * .76);
      g.fillStyle = "#c9993d"; g.fillRect(S * .2, S * .2, S * .6, S * .6);
      g.strokeStyle = "#f6dc8c"; g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, S * .17, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + Math.cos(a) * S * .17, S / 2 + Math.sin(a) * S * .17); g.stroke(); }
      noise(g, S, 1500, rng(5), .06);
    }, C(4));
    // gold sheets in panels, the plain-gold walls: tile = 4 x 4 cubits (explicit uv)
    const panel = tex(256, (g, S) => {
      g.fillStyle = "#d9a948"; g.fillRect(0, 0, S, S);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++){
        const x = i * S / 2, y = j * S / 2, grd = g.createLinearGradient(x, y, x + S / 2, y + S / 2);
        grd.addColorStop(0, "#f0cb6c"); grd.addColorStop(1, "#c7953a");
        g.fillStyle = grd; g.fillRect(x + 5, y + 5, S / 2 - 10, S / 2 - 10);
        g.strokeStyle = "#8f6a26"; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, S / 2 - 10, S / 2 - 10);
      }
      noise(g, S, 1200, rng(9), .05);
    }, 1);
    // carved panels, palm and two-faced cherub in turn (Ezek 41:18-19): tile = 8 x 8 cubits.
    // The cherub is an abstract form on purpose: no verified reconstruction exists to copy.
    const carved = tex(512, (g, S) => {
      g.fillStyle = "#c8973f"; g.fillRect(0, 0, S, S);
      const frame = (x, y, w, h) => {
        const grd = g.createLinearGradient(x, y, x + w, y + h); grd.addColorStop(0, "#efc767"); grd.addColorStop(1, "#c58f35");
        g.fillStyle = grd; g.fillRect(x, y, w, h);
        g.strokeStyle = "#7d5a1e"; g.lineWidth = 5; g.strokeRect(x, y, w, h);
        g.strokeStyle = "#f8e19a"; g.lineWidth = 2; g.strokeRect(x + 6, y + 6, w - 12, h - 12);
      };
      const relief = (path, w) => {
        g.lineCap = "round"; g.lineJoin = "round";
        g.save(); g.translate(2, 2); g.strokeStyle = "#7a561c"; g.lineWidth = w; path(); g.stroke(); g.restore();
        g.strokeStyle = "#fbe39b"; g.lineWidth = w * .55; path(); g.stroke();
      };
      const half = S / 2, pad = 14;
      frame(pad, pad, half - 2 * pad, S - 2 * pad);                   // the palm
      frame(half + pad, pad, half - 2 * pad, S - 2 * pad);            // the cherub
      const px = half / 2, base = S - 40, top = 120;
      relief(() => { g.beginPath(); g.moveTo(px, base); g.lineTo(px, top + 30); }, 12);
      for (let y = base - 20; y > top + 40; y -= 26) relief(() => { g.beginPath(); g.moveTo(px - 12, y); g.lineTo(px, y - 12); g.lineTo(px + 12, y); }, 4);
      for (let i = 0; i < 7; i++){
        const a = -Math.PI / 2 + (i - 3) * .42, len = 95 - Math.abs(i - 3) * 8;
        relief(() => { g.beginPath(); g.moveTo(px, top + 30); g.quadraticCurveTo(px + Math.cos(a) * len * .6, top + 30 + Math.sin(a) * len * .9 - 20, px + Math.cos(a) * len, top + 30 + Math.sin(a) * len * .55 + 40); }, 7);
      }
      const cx = half + half / 2, fy = 120;
      relief(() => { g.beginPath(); g.moveTo(cx - 34, base); g.lineTo(cx - 26, fy + 60); g.lineTo(cx + 26, fy + 60); g.lineTo(cx + 34, base); g.closePath(); }, 7);
      relief(() => { g.beginPath(); g.arc(cx - 28, fy, 26, 0, Math.PI * 2); }, 6);    // one face to one side
      relief(() => { g.beginPath(); g.arc(cx + 28, fy, 26, 0, Math.PI * 2); }, 6);    // the other face to the other
      for (const s of [-1, 1]){
        relief(() => { g.beginPath(); g.moveTo(cx + s * 26, fy + 70); g.quadraticCurveTo(cx + s * 110, fy + 10, cx + s * 100, fy - 70); }, 8);
        relief(() => { g.beginPath(); g.moveTo(cx + s * 26, fy + 110); g.quadraticCurveTo(cx + s * 100, fy + 170, cx + s * 70, base - 30); }, 8);
      }
      noise(g, S, 4000, rng(13), .06);
    }, 1);
    // the parochet: shesh, techelet, argaman and tola'at shani twisted together, no forms (Rambam,
    // Klei HaMikdash 7:16). Tile = 2 x 2 cubits (explicit uv).
    const weave = (g, S, r) => {
      const cols = ["#efe8d8", "#2c4a8a", "#6b2a63", "#a3232b"];
      const n = 16, w = S / n;
      for (let i = 0; i < n; i++){ g.fillStyle = cols[i % 4]; g.fillRect(i * w, 0, w + 1, S); }
      for (let y = 0; y < S; y += 4){ g.fillStyle = `rgba(0,0,0,${.05 + r() * .06})`; g.fillRect(0, y, S, 1.5); }
      noise(g, S, 6000, r, .09);
    };
    const curtain4 = tex(256, (g, S) => weave(g, S, rng(21)), 1);
    const curtainCherub = tex(512, (g, S) => {             // tile = 5 x 5 cubits, one abstract woven cherub
      weave(g, S, rng(23));
      const cx = S / 2, cy = S / 2;
      g.strokeStyle = "rgba(246,226,160,.92)"; g.lineWidth = 9; g.lineCap = "round";
      g.beginPath(); g.arc(cx - 26, cy - 70, 24, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx + 26, cy - 70, 24, 0, Math.PI * 2); g.stroke();
      for (const s of [-1, 1]){
        g.beginPath(); g.moveTo(cx + s * 20, cy - 30); g.quadraticCurveTo(cx + s * 120, cy - 90, cx + s * 150, cy - 170); g.stroke();
        g.beginPath(); g.moveTo(cx + s * 20, cy + 10); g.quadraticCurveTo(cx + s * 110, cy + 60, cx + s * 90, cy + 150); g.stroke();
      }
      g.beginPath(); g.moveTo(cx - 24, cy + 150); g.lineTo(cx - 18, cy - 30); g.lineTo(cx + 18, cy - 30); g.lineTo(cx + 24, cy + 150); g.stroke();
    }, 1);
    const rock = tex(256, (g, S) => {
      const r = rng(31); g.fillStyle = "#8f8576"; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 260; i++){ const t = 110 + r() * 70 | 0; g.fillStyle = `rgba(${t},${t - 8},${t - 20},.35)`; g.beginPath(); g.arc(r() * S, r() * S, 4 + r() * 22, 0, Math.PI * 2); g.fill(); }
      noise(g, S, 9000, r, .15);
    }, C(3));
    const cedar = tex(256, (g, S) => {
      const r = rng(37); g.fillStyle = "#8a4f2c"; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 70; i++){ g.strokeStyle = `rgba(${60 + r() * 50 | 0},${30 + r() * 25 | 0},15,.35)`; g.lineWidth = 1 + r() * 3; g.beginPath(); const y = r() * S; g.moveTo(0, y); g.bezierCurveTo(S * .3, y + r() * 12 - 6, S * .6, y + r() * 12 - 6, S, y + r() * 8 - 4); g.stroke(); }
      noise(g, S, 4000, r, .07);
    }, C(4));
    const carvedW = carved.clone(); carvedW.needsUpdate = true; carvedW.repeat.set(1 / C(8), 1 / C(8));
    const make = MATS.make;
    Object.assign(MAT, {
      hkWhite: make({ map: MATS.TEX.ashlar, color: 0xf8f3e8 }),
      hkCoffer: make({ map: coffer, color: 0xffffff, metalness: .75, roughness: .34 }, 1),
      hkPanel: make({ map: panel, color: 0xffffff, metalness: .78, roughness: .3, side: THREE.DoubleSide }, 1),
      hkCarved: make({ map: carved, color: 0xffffff, metalness: .74, roughness: .34, side: THREE.DoubleSide }, 1),
      hkCarvedW: make({ map: carvedW, color: 0xffffff, metalness: .74, roughness: .34 }, 1),
      hkCurtain4: make({ map: curtain4, color: 0xffffff, roughness: .9, side: THREE.DoubleSide }, .4),
      hkCurtainCherub: make({ map: curtainCherub, color: 0xffffff, roughness: .9, side: THREE.DoubleSide }, .4),
      hkRock: make({ map: rock, color: 0xffffff, roughness: 1 }, .3),
      hkCedar: make({ map: cedar, color: 0xffffff, roughness: .75 }, .4),
    });
  }

  /* ============ the build ============ */
  function buildArch(root, data, opts){
    const U = root.userData, L = data.L, X = data.X, H = X.heichal;
    if (!H) throw new Error('heichal.js: data.X.heichal is missing (scene_data(house="arch"))');
    const DIM = X.dim || {}, DIMS = X.dims || {};
    const dim = id => { const v = DIM[id]; if (typeof v !== "number") throw new Error(`heichal.js: dimension "${id}" is missing from data.X.dim`); return v; };
    const MATS = U.materials, MAT = MATS.MAT;
    MATS.mmPerCubit = L.MM;
    ensureMaterials(MATS);
    const REAL = !!(global.THREE && THREE.REVISION) && !!MATS.make;   // false under the inventory's stand-in
    const Fr = TS.frame(L), C = Fr.C, PX = Fr.PX, PZ = Fr.PZ;
    const TT = opts.base || 0, LV = X.levels.inner, LIFT = X.levels.inner_mm;
    const hooks = opts.hooks || {};
    const S = TS.S, f1 = v => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
    const bat = new TS.Batcher(); bat.onBox = opts.onBox || null;
    const sum = a => a.reduce((s, v) => s + v, 0);

    /* ---- the chains of Middot 4:6-7 ---- */
    const [ewUW, ewU, ewHW, ewH, ewT, ewK, ewKW, ewTa, ewTaW] = H.ew;
    const [nsMW, nsM, nsTWn, nsTn, nsHWn, nsI, nsHWs, nsTs, nsTWs, nsR, nsRW] = H.ns;
    const Z = H.z, AX = H.axis, E = H.east;
    // east to west (plan y)
    const yU0 = E - ewUW;                // the ulam's east wall: yU0..E
    const yUi = yU0 - ewU;               // the ulam's west face, the heichal's east wall's east face
    const yH0 = yUi - ewHW;              // the heichal's east wall: yH0..yUi
    const yHi = yH0 - ewH;               // the heichal's west end: the outer parochet
    const yT0 = yHi - ewT;               // the amah traksin: yT0..yHi
    const yW = E - sum(H.ew);            // the house's west face
    const yTaW1 = yW + ewTaW;            // the west cells' outer wall: yW..yTaW1
    const zoneW = ewTa + ewKW;           // the west cells and the west wall of the Holy of Holies
    // north to south (plan x)
    const xN = AX + sum(H.ns) / 2, xS = AX - sum(H.ns) / 2;
    const xMW0 = xN - nsMW, xM0 = xMW0 - nsM;          // the mesibah's outer wall and the mesibah
    const xTWn0 = xM0 - nsTWn;                          // the north cells' outer wall: xTWn0..xM0
    const xIn = AX + nsI / 2, xIs = AX - nsI / 2;       // the hall: xIs..xIn
    const xTWs1 = xIs - nsHWs - nsTs, xR1 = xTWs1 - nsTWs, xRW1 = xR1 - nsR;
    const zoneN = xTWn0 - xIn, zoneS = xIs - xTWs1;     // cells + the hall's wall, each side
    // heights above the inner court (the plaza before the steps)
    const FL = Z[0], H1 = FL + Z[1], AF = H1 + Z[2] + Z[3] + Z[4] + Z[5], H2 = AF + Z[6];
    const RF = H2 + Z[7] + Z[8] + Z[9] + Z[10], PAR = Z[11], KO = Z[12], TOP = RF + PAR + KO;
    const slabLayers = h => [[h, h + Z[2], "hkCoffer"], [h + Z[2], h + Z[2] + Z[3], "dark"], [h + Z[2] + Z[3], h + Z[2] + Z[3] + Z[4], "hkCedar"],
      [h + Z[2] + Z[3] + Z[4], h + Z[2] + Z[3] + Z[4] + Z[5], { top: "roof", side: "cap" }]];
    // the front
    const FRONT = dim("heichal-ns-total"), xF0 = AX - FRONT / 2, xF1 = AX + FRONT / 2, WW = dim("hk-wing-wall-rambam");
    if (FRONT - sum(H.ns) !== 2 * dim("ulam-wing")) throw new Error("heichal.js: the front is not the body and two wings (Middot 4:7)");
    if (dim("hk-wing-wall-rambam") + dim("hk-wing-space-rambam") !== dim("ulam-wing")) throw new Error("heichal.js: Rambam's wing (4:5) is not 15");
    if (sum(H.ns) - dim("hrd-heichal-rear") !== nsMW + nsRW) throw new Error("heichal.js: the 60 reading takes the two outer walls off; they no longer make 10");
    const BODY = { "middot-70": [xS, xN], "josephus-60": [xRW1, xMW0] };
    // the cuts
    // s: south of the hall's south face (above a stub); a: above the hall's ceiling, behind the face;
    // p0 / p1: above the plan cuts of the floor and of the upper storey
    const XS = xIs, STUB = FL + ART.stub, P0 = FL + ART.planCut, P1 = AF + ART.planCut;
    // the side chambers
    const STOREYS = dim("hk-taim-storeys");
    const TA_W = { "middot-5-6-7": [dim("hk-ta-width-lower"), dim("hk-ta-width-middle"), dim("hk-ta-width-upper")],
      "ezekiel-4": [0, 1, 2].map(k => dim("ez-tzela") + k * dim("hk-ta-setback")) };
    const TA_H = { "aliyah-level": dim("md-hk-taim-storey-height"), "kings-5": dim("hk-bg-yatzia-height") };
    const TR = o => FL + STOREYS * TA_H[o["hk-taim-height"]];       // the cells' roofs
    // the Holy of Holies moves a cubit west behind Ezekiel's two-cubit wall (card 13)
    const kkShift = o => o["hk-kk-divider"] === "ezekiel-wall" ? dim("hke-kk-post") - ewT : 0;
    const yK0 = o => yT0 - ewK - kkShift(o);          // the Holy of Holies' west face
    const yKE = o => yT0 - kkShift(o);                // its east face
    const yCoreW = o => yK0(o) - ewKW;                 // the house's west wall, above the cells
    // the ulam's opening
    const OPEN = { "middot-20x40": [dim("ulam-opening-width"), dim("ulam-opening-height")],
      "josephus-25x70": [dim("hrd-ulam-opening-width"), dim("hrd-ulam-opening-height")],
      "ezekiel-14": [dim("hke-ulam-opening-14"), dim("ulam-opening-height")] };
    const DOOR = [dim("heichal-opening-width"), dim("heichal-opening-height")];

    /* ---- the house component: the block goes, the label rises ---- */
    const house = U.components.house;
    if (!house) throw new Error("heichal.js: scene-core built no house");
    const block = house.children.find(p => p.userData.role === "block");
    if (block){
      const gone = new Set(); block.traverse(o => gone.add(o));
      house.remove(block);
      for (let i = U.pick.length - 1; i >= 0; i--) if (gone.has(U.pick[i])) U.pick.splice(i, 1);
      for (let i = U.parts.length - 1; i >= 0; i--) if (gone.has(U.parts[i])) U.parts.splice(i, 1);
    }
    const Yw = h => TT + LIFT + C(h);
    const labelPart = house.children.find(p => p.userData.role === "label");
    if (labelPart && labelPart.children[0]) labelPart.children[0].position.y = Yw(TOP + 4);
    house.userData.arch = true;

    /* ---- components, parts and the cut groups ---- */
    function component(id, label_he){
      const g = new THREE.Group(); g.name = id;
      g.userData = { id, kind: "house", dims: DIMS[id] || [], label_he, rect: [xF0, xF1, yW, E], at: [AX, (yW + E) / 2] };
      house.add(g); U.components[id] = g; return g;
    }
    function part(comp, role, tags){
      const g = new THREE.Group();
      g.name = comp.userData.id + ":" + role + (tags ? Object.entries(tags).map(([k, v]) => `|${k}=${v}`).join("") : "");
      g.userData = { role }; if (tags && Object.keys(tags).length) g.userData.tags = Object.assign({}, tags);
      comp.add(g); U.parts.push(g);
      return { comp, role, g, cuts: {} };
    }
    function cutG(ph, flags){
      const key = flags.join("+");
      if (!ph.cuts[key]){
        const w = new THREE.Group(); w.name = ph.g.name + "~" + key; w.userData = { cut: flags.slice() };
        ph.comp.add(w);
        const g = new THREE.Group(); g.name = ph.g.name + "#" + key; g.userData = { role: ph.role };
        if (ph.g.userData.tags) g.userData.tags = Object.assign({}, ph.g.userData.tags);
        w.add(g); U.parts.push(g); ph.cuts[key] = g;
      }
      return ph.cuts[key];
    }
    // the flags of a piece: o.forceS, o.noS, o.noP, o.top, o.only
    function flagsOf(x1, h0, o){
      const f = [];
      if (o.only){ f.push(o.only); return f; }
      if (o.forceS || (!o.noS && x1 <= XS + EPS && h0 >= STUB - EPS)) f.push("s");
      if (o.top) f.push("t");
      if (o.forceA || (!o.noA && h0 >= H1 - EPS)) f.push("a");
      if (!o.noP && h0 >= P0 - EPS) f.push("p0");
      if (!o.noP && h0 >= P1 - EPS) f.push("p1");
      return f;
    }
    const target = (ph, f) => f.length ? cutG(ph, f) : ph.g;
    function rawBox(g, mat, x0, x1, y0, y1, h0, h1){
      if (x1 - x0 < EPS || y1 - y0 < EPS || h1 - h0 < EPS) return;
      bat.box(g, mat, PX(y0), PX(y1), Yw(h0), Yw(h1), PZ(x1), PZ(x0));
    }
    /* a box of the house (plan cubits; heights in cubits above the inner court), split where the cuts pass */
    function box(ph, mat, x0, x1, y0, y1, h0, h1, o){
      o = o || {};
      if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (h0 > h1) [h0, h1] = [h1, h0];
      const xs = !o.noS && !o.forceS && x0 < XS - EPS && x1 > XS + EPS ? [[x0, XS], [XS, x1]] : [[x0, x1]];
      xs.forEach(([a0, a1]) => {
        const at = [o.noP ? null : P0, o.noP ? null : P1, o.noA ? null : H1].concat(a1 <= XS + EPS && !o.noS ? [STUB] : []).filter(c => c != null && c > h0 + EPS && c < h1 - EPS).sort((a, b) => a - b);
        let a = h0;
        at.concat([h1]).forEach(c => { rawBox(target(ph, flagsOf(a1, a, o)), mat, a0, a1, y0, y1, a, c); a = c; });
      });
    }
    /* a wall with rectangular openings. along "y": the wall runs east-west, holes are [y0, y1, h0, h1];
       along "x": it runs north-south, holes are [x0, x1, h0, h1] */
    function holed(ph, mat, x0, x1, y0, y1, h0, h1, holes, along, o){
      const lo = along === "y" ? y0 : x0, hi = along === "y" ? y1 : x1;
      const cuts = [lo, hi]; holes.forEach(q => cuts.push(Math.max(lo, Math.min(hi, q[0])), Math.max(lo, Math.min(hi, q[1]))));
      const st = [...new Set(cuts)].sort((a, b) => a - b);
      for (let i = 0; i < st.length - 1; i++){
        const a = st[i], b = st[i + 1]; if (b - a < EPS) continue;
        const m = (a + b) / 2, hs = holes.filter(q => q[0] < m && m < q[1]).map(q => [Math.max(h0, q[2]), Math.min(h1, q[3])]).sort((p, q) => p[0] - q[0]);
        let c = h0;
        const put = (u, v) => { if (v - u < EPS) return; if (along === "y") box(ph, mat, x0, x1, a, b, u, v, o); else box(ph, mat, a, b, y0, y1, u, v, o); };
        hs.forEach(([u, v]) => { put(c, u); c = Math.max(c, v); });
        put(c, h1);
      }
    }

    /* a horizontal slab with rectangular holes [x0, x1, y0, y1] */
    function slabHoles(ph, mat, x0, x1, y0, y1, h0, h1, holes, o){
      const ys = [...new Set([y0, y1].concat(...holes.map(q => [Math.max(y0, Math.min(y1, q[2])), Math.max(y0, Math.min(y1, q[3]))])))].sort((a, b) => a - b);
      for (let i = 0; i < ys.length - 1; i++){
        const a = ys[i], b = ys[i + 1]; if (b - a < EPS) continue;
        const m = (a + b) / 2, hs = holes.filter(q => q[2] < m && m < q[3]).map(q => [Math.max(x0, q[0]), Math.min(x1, q[1])]).sort((p, q) => p[0] - q[0]);
        let c = x0; hs.forEach(([u, v]) => { if (u - c > EPS) box(ph, mat, c, u, a, b, h0, h1, o); c = Math.max(c, v); });
        if (x1 - c > EPS) box(ph, mat, c, x1, a, b, h0, h1, o);
      }
    }

    /* ---- meshes that are not boxes (REAL only): merged per group and material ---- */
    const orn = new Map();
    function addGeo(g, matKey, geo){
      const k = g.id + "|" + matKey;
      if (!orn.has(k)) orn.set(k, { g, matKey, list: [] });
      orn.get(k).list.push(geo);
    }
    function M4(x, y, h, ry, rx, rz, s){       // plan x, plan y, height (cubits); rotations; uniform scale (cubits -> mm)
      if (!REAL) return null;
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(PX(y), Yw(h), PZ(x)), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, "YXZ")),
        new THREE.Vector3(C(s || 1), C(s || 1), C(s || 1)));
      return m;
    }
    function mesh(ph, matKey, geo, m, x, h0, o){       // geo in cubits, local +X east, +Y up, +Z south
      if (!REAL) return;
      let g2 = geo.index ? geo.toNonIndexed() : geo.clone();
      g2.applyMatrix4(m);
      if (!g2.attributes.normal) g2.computeVertexNormals();
      if (!g2.attributes.uv) g2.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g2.attributes.position.count * 2), 2));
      addGeo(target(ph, flagsOf(x, h0, o || {})), matKey, g2);
    }
    function flushOrn(){
      orn.forEach(({ g, matKey, list }) => {
        let n = 0; list.forEach(q => { n += q.attributes.position.count; });
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
        let i = 0;
        list.forEach(q => { pos.set(q.attributes.position.array, i * 3); nor.set(q.attributes.normal.array, i * 3); uv.set(q.attributes.uv.array, i * 2); i += q.attributes.position.count; });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        const me = new THREE.Mesh(geo, MAT[matKey]); me.castShadow = me.receiveShadow = true; g.add(me);
      });
      orn.clear();
    }
    /* a flat panel with its own uv (tile units), on a wall face. face: {axis: "x"|"y", at, dir: +1|-1}
       (the panel stands in the plane axis = at and faces dir). a0..a1 runs along the other axis. */
    function panel(ph, matKey, face, a0, a1, h0, h1, tile, holes, o){
      if (!REAL) return;
      const cuts = [a0, a1]; (holes || []).forEach(q => cuts.push(Math.max(a0, Math.min(a1, q[0])), Math.max(a0, Math.min(a1, q[1]))));
      const st = [...new Set(cuts)].sort((a, b) => a - b), quads = [];
      for (let i = 0; i < st.length - 1; i++){
        const a = st[i], b = st[i + 1]; if (b - a < EPS) continue;
        const m = (a + b) / 2, hs = (holes || []).filter(q => q[0] < m && m < q[1]).map(q => [Math.max(h0, q[2]), Math.min(h1, q[3])]).sort((p, q) => p[0] - q[0]);
        let c = h0; hs.forEach(([u, v]) => { if (u - c > EPS) quads.push([a, b, c, u]); c = Math.max(c, v); }); if (h1 - c > EPS) quads.push([a, b, c, h1]);
      }
      const P = (a, h) => face.axis === "x" ? [PX(a), Yw(h), PZ(face.at)] : [PX(face.at), Yw(h), PZ(a)];
      const pos = [], nor = [], uv = [];
      // the normal, in world terms: plan +x is world -Z, plan +y is world +X
      const n = face.axis === "x" ? [0, 0, -face.dir] : [face.dir, 0, 0];
      // u runs to the viewer's right as they face the wall
      const uOf = a => (face.axis === "x" ? (face.dir < 0 ? a : -a) : (face.dir < 0 ? -a : a)) / tile[0];
      quads.forEach(([a, b, c, d]) => {
        const v = [[a, c], [b, c], [b, d], [a, d]].map(([s, h]) => ({ p: P(s, h), u: uOf(s), v: (h - FL) / tile[1] }));
        [[0, 1, 2], [0, 2, 3]].forEach(t => t.forEach(k => { pos.push(...v[k].p); nor.push(...n); uv.push(v[k].u, v[k].v); }));
      });
      if (!pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      addGeo(target(ph, flagsOf(face.axis === "x" ? face.at : a1, h0, o || {})), matKey, geo);
    }
    /* a hanging cloth with folds, in cubits: x along its width, y up, folds in z */
    function drape(w, h, amp, wave){
      const n = Math.max(4, Math.ceil(w / (wave / 6))), pos = [], uv = [];
      const z = x => amp * Math.sin(x / wave * Math.PI * 2);
      for (let i = 0; i < n; i++){
        const a = i / n * w, b = (i + 1) / n * w;
        const q = [[a, 0, z(a)], [b, 0, z(b)], [b, h, z(b)], [a, h, z(a)]];
        [[0, 1, 2], [0, 2, 3]].forEach(t => t.forEach(k => { pos.push(...q[k]); uv.push(q[k][0] / 2, q[k][1] / 2); }));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals(); return geo;
    }
    const pickPart = {};
    function proxy(comp, x0, x1, y0, y1, h0, h1, info, o, own){
      const ph = own || pickPart[comp.userData.id] || (pickPart[comp.userData.id] = part(comp, "pick"));
      const f = o ? flagsOf(o.forceS ? XS - 1 : x1, h0, Object.assign({ noP: true }, o)) : [];
      const a = PX(y0), b = PX(y1), c = PZ(x1), d = PZ(x0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, Yw(h1) - Yw(h0), d - c), MATS.PROXY);
      m.position.set((a + b) / 2, (Yw(h0) + Yw(h1)) / 2, (c + d) / 2);
      m.userData.info = info; m.userData.component = comp.userData.id;
      target(ph, f).add(m); U.pick.push(m); return m;
    }
    function label(ph, x, y, h, text, sub, o){
      const ob = new THREE.Object3D(); ob.position.set(PX(y), Yw(h), PZ(x));
      ob.userData.label = { text, sub: sub || "" }; ob.userData.plan = [x, y];
      target(ph, o && o.only ? [o.only] : []).add(ob); U.labels.push(ob); return ob;
    }
    const W = (x, y, h) => ({ x: PX(y), y: Yw(h), z: PZ(x) });
    // a vessel's room: its frame's origin (plan x, y; height h); TempleVessels.layout places it in there
    const vessel = (kind, ph, x, y, h, frame) => { if (hooks.vessel) hooks.vessel(kind, ph.g, Object.assign(W(x, y, h), { rotY: 0, plan: [x, y], frame })); };

    const ULAM = component("house-ulam", "האולם והחזית");
    const HALL = component("house-heichal", "ההיכל (הקודש)");
    const KK = component("house-kodesh", "קודש הקודשים");
    const TAIM = component("house-taim", "התאים, המסיבה ובית הורדת המים");
    const STEPS = component("house-steps", "מעלות האולם");
    const ROOF = component("house-roof", "העלייה והגג");

    /* ============ the atum: the house's solid base, 6 cubits under its floor (Middot 4:6) ============ */
    // it stands on the outer court where the house is, so it rises the inner court's height too
    function outline(bx0, bx1, yWest){                  // the T, as edges with their outward side
      return [
        { x0: xF0, x1: xF1, y: E, n: "+y" },
        { y0: yUi, y1: E, x: xF1, n: "+x" }, { y0: yUi, y1: E, x: xF0, n: "-x" },
        { x0: bx1, x1: xF1, y: yUi, n: "-y" }, { x0: xF0, x1: bx0, y: yUi, n: "-y" },
        { y0: yWest, y1: yUi, x: bx1, n: "+x" }, { y0: yWest, y1: yUi, x: bx0, n: "-x" },
        { x0: bx0, x1: bx1, y: yWest, n: "-y" },
      ];
    }
    function band(ph, mat, edges, h0, h1, p, o){      // a moulding p cubits proud of each edge
      edges.forEach(e => {
        if (e.n === "+y") box(ph, mat, e.x0 - p, e.x1 + p, e.y, e.y + p, h0, h1, o);
        else if (e.n === "-y") box(ph, mat, e.x0 - p, e.x1 + p, e.y - p, e.y, h0, h1, o);
        else if (e.n === "+x") box(ph, mat, e.x, e.x + p, e.y0 - p, e.y1 + p, h0, h1, o);
        else box(ph, mat, e.x - p, e.x, e.y0 - p, e.y1 + p, h0, h1, o);
      });
    }
    combos(["hk-plan"]).forEach(o => {
      const ph = part(house, "atum", o), [bx0, bx1] = BODY[o["hk-plan"]];
      const N = { noS: true, noP: true };
      box(ph, { top: "marble", side: "hkWhite" }, xF0, xF1, yUi, E, -LV, FL, N);
      box(ph, { top: "marble", side: "hkWhite" }, bx0, bx1, yW, yUi, -LV, FL, N);
      band(ph, "cap", outline(bx0, bx1, yW), FL - .7, FL - .1, .35, N);       // a moulding under the floor line
      band(ph, "hkWhite", outline(bx0, bx1, yW), -LV, -LV + .9, .3, N);      // and a base
    });

    /* ============ the ulam and its face ============ */
    const coreX0 = xIs - nsHWs, coreX1 = xIn + nsHWn;   // the hall's walls, outer faces, above the cells
    // the face: one wall, 100 wide, with the opening of each reading through it
    combos(["hk-ulam-opening", "hk-exterior"]).forEach(o => {
      const ph = part(ULAM, "face", o), [ow, oh] = OPEN[o["hk-ulam-opening"]];
      const mat = o["hk-exterior"] === "gold" ? { top: "roof", side: "gold" } : { top: "roof", side: "hkWhite" };
      holed(ph, mat, xF0, xF1, yU0, E, FL, RF, [[AX - ow / 2, AX + ow / 2, FL, FL + oh]], "x", { noA: true });
    });
    combos(["hk-ulam-opening"]).forEach(o => {
      const ph = part(ULAM, "portal", o), [ow, oh] = OPEN[o["hk-ulam-opening"]];
      const x0 = AX - ow / 2, x1 = AX + ow / 2, [fw, fp] = ART.frame, N = { noA: true };
      // gold lines the opening through the wall, and frames it on the face; a white frame stands outside the gold
      box(ph, "gold", x0, x0 + .12, yU0, E, FL, FL + oh, N); box(ph, "gold", x1 - .12, x1, yU0, E, FL, FL + oh, N);
      box(ph, "gold", x0, x1, yU0, E, FL + oh - .12, FL + oh, N);
      box(ph, "gold", x0 - fw, x0, E, E + fp, FL, FL + oh + fw, N); box(ph, "gold", x1, x1 + fw, E, E + fp, FL, FL + oh + fw, N);
      box(ph, "gold", x0 - fw, x1 + fw, E, E + fp, FL + oh, FL + oh + fw, N);
      // white side frames outside the gold, stopping at the lintel: the malteraot rest directly over it (Middot 3:7)
      box(ph, "hkWhite", x0 - fw - 1.4, x0 - fw, E, E + .45, FL, FL + oh + fw, N); box(ph, "hkWhite", x1 + fw, x1 + fw + 1.4, E, E + .45, FL, FL + oh + fw, N);
    });
    {
      // pilasters with gold capitals, and a string course at the upper storey's floor
      const ph = part(ULAM, "face-ornament"), [pw, pp] = ART.pilaster, [ch] = ART.cornice, N = { noA: true };
      [-49, -35, -21, 21, 35, 49].map(d => AX + d).forEach(x => {
        const a = Math.max(xF0, x - pw / 2), b = Math.min(xF1, x + pw / 2);
        box(ph, "cap", a - .2, b + .2, E, E + pp + .2, FL, FL + 1.2, N);                       // base
        box(ph, "cap", a, b, E, E + pp, FL + 1.2, RF - ch - 1.5, N);
        box(ph, "gold", a - .15, b + .15, E, E + pp + .15, RF - ch - 1.5, RF - ch - .9, N);    // capital
      });
      for (const [a, b] of [[xF0, AX - 17], [AX + 17, xF1]]) box(ph, "cap", a, b, E, E + .4, AF - .3, AF + .3, N);
    }
    // the wings (beit hachalifot): their outer walls and their back walls, the ulam's own depth (card 1)
    combos(["hk-plan"]).forEach(o => {
      const ph = part(ULAM, "wings", o), [bx0, bx1] = BODY[o["hk-plan"]];
      const mat = { top: "roof", side: "hkWhite" };
      box(ph, mat, xF0, xF0 + WW, yUi, yU0, FL, RF); box(ph, mat, xF1 - WW, xF1, yUi, yU0, FL, RF);
      box(ph, mat, xF0 + WW, bx0, yUi, yUi + WW, FL, RF); box(ph, mat, bx1, xF1 - WW, yUi, yUi + WW, FL, RF);
    });
    let LEDGES = null;
    /* the ledges round the ulam's walls (Rambam, Beit HaBechira 4:9): "one cubit smooth and a ledge
       of three, and a cubit smooth and a ledge of three, up to the top... and the upper ledge was four".
       Rambam gives Middot 3:6's numbers (1, 3, the upper 4) to these ledges; the ids are those. How far a
       ledge stands out, and which faces carry them, are not given: here schematic bands on the ulam's
       outer faces (east, the two ends, the backs of the wings), ART.ledge proud, from the floor up to the
       roof line. hk-ulam-ledge "none" shows nothing. */
    {
      const sm = dim("hk-ulam-step-tread-middot"), lb = dim("hk-ulam-landing"), lt = dim("hk-ulam-top-landing"), p = ART.ledge;
      const n = Math.floor((RF - FL - sm - lt) / (sm + lb) + EPS), bands = [];
      for (let k = 0; k < n; k++) bands.push([FL + k * (sm + lb) + sm, FL + (k + 1) * (sm + lb)]);
      bands.push([FL + n * (sm + lb) + sm, FL + n * (sm + lb) + sm + lt]);              // the upper ledge, four
      // a ledge is a course of masonry: the warmer ivory ashlar, so it reads against the white wall, with a plaster top
      const L = { "hk-ulam-ledge": "rambam" }, mat = { top: "cap", side: "stone" };
      combos(["hk-ulam-opening", "hk-exterior"]).forEach(o => {
        const ph = part(ULAM, "ledges-face", Object.assign({}, L, o)), [ow, oh] = OPEN[o["hk-ulam-opening"]];
        const m = o["hk-exterior"] === "gold" ? { top: "cap", side: "gold" } : mat;
        bands.forEach(([h0, h1]) => holed(ph, m, xF0, xF1, E, E + p, h0, h1, [[AX - ow / 2, AX + ow / 2, FL, FL + oh]], "x", { noA: true }));
      });
      {
        const ph = part(ULAM, "ledges-ends", L);
        bands.forEach(([h0, h1]) => { box(ph, mat, xF1, xF1 + p, yUi - p, E + p, h0, h1); box(ph, mat, xF0 - p, xF0, yUi - p, E + p, h0, h1); });
      }
      combos(["hk-plan"]).forEach(o => {
        const ph = part(ULAM, "ledges-wings", Object.assign({}, L, o)), [bx0, bx1] = BODY[o["hk-plan"]];
        bands.forEach(([h0, h1]) => { box(ph, mat, xF0, bx0, yUi - p, yUi, h0, h1); box(ph, mat, bx1, xF1, yUi - p, yUi, h0, h1); });
      });
      part(ULAM, "ledges", { "hk-ulam-ledge": "none" });
      LEDGES = { bands, smooth: sm, ledge: lb, top: lt, proud: p };     // root.userData.heichal.ledges, for a page's checks
    }
    // the ulam's ceiling: the upper storey's ceiling height (an assumption: the sources give none)
    {
      const ph = part(ULAM, "ceiling");
      slabLayers(H2).forEach(([a, b, m]) => box(ph, m, xF0 + WW, xF1 - WW, yUi, yU0, a, b, { top: true }));
    }
    // the five malteraot: only over the Mishnah's 20 x 40 opening (card 4)
    {
      const n = dim("ulam-malteraot-count"), ov = dim("ulam-malteraot-overhang"), bh = dim("md-hk-malteraot-beam-height"), ch = dim("md-hk-malteraot-course-height");
      const [ow, oh] = OPEN["middot-20x40"];
      if (ow + 2 * ov * n !== dim("ulam-malteraot-top")) throw new Error("heichal.js: the malteraot no longer reach 30 (Middot 3:7)");
      const ph = part(ULAM, "malteraot", { "hk-malteraot": "middot", "hk-ulam-opening": "middot-20x40" });
      for (let k = 0; k < n; k++){
        const w = ow + 2 * ov * (k + 1), h0 = FL + oh + ART.frame[0] + k * (bh + ch);
        box(ph, "gold", AX - w / 2, AX + w / 2, E, E + .7, h0, h0 + bh, { noA: true });
        box(ph, "hkCedar", AX - w / 2 + .1, AX + w / 2 - .1, E + .7, E + .8, h0 + .15, h0 + bh - .15, { noA: true });
      }
      part(ULAM, "malteraot", { "hk-malteraot": "none" });
    }
    // the two pillars, before the posts of the ulam (Ezek 40:49), on pedestals that rise to the floor
    const PILLAR = { h: dim("hk-bg-yachin-boaz-height"), d: dim("hk-bg-yachin-boaz-diameter"), cap: dim("hk-bg-yachin-boaz-capital") };
    const pillarX = ow => [AX - ow / 2 - dim("hke-ulam-posts") / 2, AX + ow / 2 + dim("hke-ulam-posts") / 2];
    const capital = REAL ? new THREE.LatheGeometry([[.5, 0], [.62, .3], [.74, 1.1], [.78, 2.1], [.7, 3], [.82, 3.7], [.86, 4.4], [.7, 4.7], [.72, 5]]
      .map(([r, y]) => new THREE.Vector2(r * PILLAR.d, y * PILLAR.cap / 5)), 28) : null;
    const shaft = REAL ? new THREE.CylinderGeometry(PILLAR.d / 2, PILLAR.d / 2, PILLAR.h - .8, 28) : null;
    const halfShaft = REAL ? new THREE.CylinderGeometry(PILLAR.d / 2, PILLAR.d / 2, PILLAR.h - .8, 20, 1, false, 0, Math.PI) : null;
    const halfCap = REAL ? new THREE.LatheGeometry([[.5, 0], [.66, .6], [.78, 2], [.86, 4.2], [.72, 5]].map(([r, y]) => new THREE.Vector2(r * PILLAR.d, y * PILLAR.cap / 5)), 16, 0, Math.PI) : null;
    const torus = REAL ? new THREE.TorusGeometry(PILLAR.d * .56, .22, 8, 28) : null;
    combos(["hk-ulam-pillars", "hk-ulam-opening"]).forEach(o => {
      if (o["hk-ulam-pillars"] === "none"){ if (o["hk-ulam-opening"] === "middot-20x40") part(ULAM, "pillars", { "hk-ulam-pillars": "none" }); return; }
      const ph = part(ULAM, "pillars", o), free = o["hk-ulam-pillars"] === "free", d = PILLAR.d;
      pillarX(OPEN[o["hk-ulam-opening"]][0]).forEach(x => {
        const side = d + ART.pedestal, depth = free ? side : d / 2 + ART.pedestal / 2, cy = free ? E + side / 2 : E;
        box(ph, { top: "marble", side: "hkWhite" }, x - side / 2, x + side / 2, E, E + depth, 0, FL, { noS: true, noP: true });
        box(ph, "cap", x - side / 2 - .2, x + side / 2 + .2, E, E + depth + .2, FL - .5, FL, { noS: true, noP: true });
        if (free){
          mesh(ph, "bronze", shaft, M4(x, cy, FL + .8 + (PILLAR.h - .8) / 2), x, FL, { noS: true, noP: true });
          mesh(ph, "gold", torus, M4(x, cy, FL + .5, 0, Math.PI / 2), x, FL, { noS: true, noP: true });
          mesh(ph, "gold", capital, M4(x, cy, FL + PILLAR.h), x, FL, { noS: true, noP: true });
          mesh(ph, "gold", torus, M4(x, cy, FL + PILLAR.h + PILLAR.cap * .55, 0, Math.PI / 2, 0, 1.45), x, FL, { noS: true, noP: true });
        } else {                                          // the round half faces east, the flat half lies on the wall
          mesh(ph, "bronze", halfShaft, M4(x, E, FL + .8 + (PILLAR.h - .8) / 2), x, FL, { noS: true, noP: true });
          mesh(ph, "gold", halfCap, M4(x, E, FL + PILLAR.h), x, FL, { noS: true, noP: true });
        }
        proxy(ULAM, x - d / 2, x + d / 2, E, E + (free ? side : d / 2), FL, FL + PILLAR.h + PILLAR.cap, INFO.pillar(free), { noS: true }, ph);
      });
    });
    // the curtain on the ulam's opening (Rambam, Klei HaMikdash 7:17), gathered to its sides so the inside shows
    combos(["hk-ulam-closure", "hk-ulam-opening"]).forEach(o => {
      if (o["hk-ulam-closure"] === "open"){ if (o["hk-ulam-opening"] === "middot-20x40") part(ULAM, "closure", { "hk-ulam-closure": "open" }); return; }
      const ph = part(ULAM, "closure", o), [ow, oh] = OPEN[o["hk-ulam-opening"]], bw = ART.bundle;
      const bundle = REAL ? drape(bw, oh - .8, .32, .55) : null;
      [AX - ow / 2, AX + ow / 2 - bw].forEach(x => {
        mesh(ph, "hkCurtain4", bundle, M4(x, yU0 - .5, FL, Math.PI / 2), x, FL, { noP: true });
        box(ph, "gold", x - .1, x + bw + .1, yU0 - .9, yU0 - .1, FL + oh * .42, FL + oh * .42 + .5, { noP: true });
      });
      box(ph, "gold", AX - ow / 2 - .3, AX + ow / 2 + .3, yU0 - .7, yU0 - .3, FL + oh - .8, FL + oh - .4, { noP: true });
    });
    // windows on the ulam's shoulders, palms on each side of them (Ezek 41:26), shut (41:16)
    const palmGeo = REAL ? (() => {
      const s = new THREE.Shape(); s.moveTo(-.08, 0); s.lineTo(.08, 0); s.lineTo(.06, 3.4); s.lineTo(-.06, 3.4); s.closePath();
      const geos = [new THREE.ExtrudeGeometry(s, { depth: .12, bevelEnabled: false })];
      for (let i = 0; i < 7; i++){
        const f = new THREE.Shape(); f.moveTo(0, 0); f.quadraticCurveTo(.45, .5, .9, .1); f.quadraticCurveTo(.45, .25, 0, 0);
        const g = new THREE.ExtrudeGeometry(f, { depth: .12, bevelEnabled: false });
        g.rotateZ(Math.PI / 2 + (i - 3) * .42); g.translate(0, 3.3, 0); geos.push(g);
      }
      return geos;
    })() : null;
    combos(["hk-windows"]).forEach(o => {
      const ph = part(ULAM, "windows", o);
      if (o["hk-windows"] === "none") return;
      const [w, h] = ART.facadeWindow, N = { noA: true };
      [AX - 29, AX + 29].forEach(x => [FL + 16, AF + 8, AF + 24].forEach(h0 => {
        box(ph, "hkWhite", x - w / 2 - .6, x + w / 2 + .6, E, E + .25, h0 - .6, h0 + h + .6, N);
        box(ph, "dark", x - w / 2, x + w / 2, E, E + .3, h0, h0 + h, N);
        box(ph, "cap", x - w / 2 - .8, x + w / 2 + .8, E, E + .45, h0 - 1, h0 - .6, N);
        if (palmGeo) [-1, 1].forEach(sd => palmGeo.forEach(g => mesh(ph, "gold", g, M4(x + sd * 2.2, E + .25, h0 + .4, Math.PI / 2, 0, 0, .95), x, h0, N)));
      }));
    });
    // the ulam inside, as in the Second Temple (Middot 3:8; Yoma 3:10)
    {
      const ph = part(ULAM, "furnishings", { "hk-ulam-furnishings": "second-temple" });
      part(ULAM, "furnishings", { "hk-ulam-furnishings": "none" });
      const n = ART.beams, bs = ART.beamSize, hb = FL + OPEN["middot-20x40"][1] + 2;
      for (let i = 0; i < n; i++){                       // cedar beams from the heichal's wall to the ulam's
        const x = AX - (n - 1) / 2 * 3 + i * 3;
        box(ph, "hkCedar", x - bs / 2, x + bs / 2, yUi, yU0, hb, hb + bs);
      }
      if (REAL){
        const r = global.TempleMaterials.rng(41), y = yUi + .45;
        const stem = new THREE.CylinderGeometry(.16, .2, 1, 6), leaf = new THREE.CircleGeometry(.55, 5), grape = new THREE.SphereGeometry(.17, 6, 4);
        const seg = (x0, h0, x1, h1, rad) => {             // a stem from (x0, h0) to (x1, h1) along the wall
          // the wall runs along plan x (world -Z): the stem tilts about the world X axis
          const len = Math.hypot(x1 - x0, h1 - h0), a = Math.atan2(-(x1 - x0), h1 - h0);
          const m = M4((x0 + x1) / 2, y, (h0 + h1) / 2, 0, a, 0); m.scale(new THREE.Vector3(rad, len, rad));
          mesh(ph, "gold", stem, m, AX, FL + 20);
        };
        // the vine stands over the great door and climbs to the beams (Middot 3:8)
        const top = FL + DOOR[1] + .6;
        const path = [[AX, top], [AX - 3, top + 4], [AX + 2, top + 9], [AX - 1, top + 14], [AX + 1, hb]];
        for (let i = 0; i < path.length - 1; i++) seg(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], 1.6);
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++){
          const h0 = top + 3 + k * 5.5, pts = [[AX, h0]];
          for (let j = 1; j <= 5; j++) pts.push([AX + s * j * 1.7, h0 + Math.sin(j * 1.3 + k) * 1.1 + j * .3]);
          for (let j = 0; j < pts.length - 1; j++) seg(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], .9);
          pts.slice(1).forEach(([px, ph0], j) => {
            // leaves lie on the wall, facing east into the ulam
            for (let q = 0; q < 2; q++) mesh(ph, "palm", leaf, M4(px + (r() - .5) * 1.2, y + .15 + r() * .3, ph0 + (r() - .3) * 1.4, Math.PI / 2 + (r() - .5) * .6, 0, r() * 6), px, FL + 20);
            if (j % 2 === 1) for (let q = 0; q < 9; q++){
              const row = q < 4 ? 0 : q < 7 ? 1 : q < 9 ? 2 : 3, col = q < 4 ? q - 1.5 : q < 7 ? q - 5 : q - 7.5;
              mesh(ph, "gold", grape, M4(px + col * .3, y + .35, ph0 - .6 - row * .3), px, FL + 20);
            }
          });
        }
        // the chandelier of Queen Helena, over the door (Yoma 3:10)
        const bowl = new THREE.SphereGeometry(1.1, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        mesh(ph, "gold", bowl, M4(AX, yUi + 1.5, top + .4, 0, 0, 0), AX, FL + 20);
        mesh(ph, "gold", new THREE.TorusGeometry(1.1, .09, 6, 24), M4(AX, yUi + 1.5, top + .4, 0, Math.PI / 2), AX, FL + 20);
        // golden chains from the ulam's ceiling, and crowns high on its walls (Middot 3:8)
        const chain = new THREE.CylinderGeometry(.12, .12, H2 - (FL + 30), 6);
        for (let i = 0; i < ART.chains; i++){
          const x = [xF0 + WW + 6, xF0 + WW + 14, xF1 - WW - 14, xF1 - WW - 6][i];
          mesh(ph, "gold", chain, M4(x, (yUi + yU0) / 2, (H2 + FL + 30) / 2), x, FL + 30, { forceA: true });
          mesh(ph, "gold", new THREE.TorusGeometry(.5, .1, 6, 16), M4(x, (yUi + yU0) / 2, FL + 30 - .4, 0, Math.PI / 2), x, FL + 30, { forceA: true });
        }
        const crown = new THREE.TorusGeometry(.9, .16, 6, 20), point = new THREE.ConeGeometry(.16, .6, 5);
        [xF0 + WW + 10, xF1 - WW - 10].forEach(x => {
          // a ring in the plane of the ulam's east wall, inside it, with points round it
          mesh(ph, "gold", crown, M4(x, yU0 - .4, H2 - 8, Math.PI / 2), x, H2 - 8);
          for (let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; mesh(ph, "gold", point, M4(x + Math.sin(a) * 1.15, yU0 - .4, H2 - 8 + Math.cos(a) * 1.15, 0, -a, 0), x, H2 - 8); }
        });
      }
      // the two tables inside the ulam, at the door of the house (Menachot 11:7): which side is the vessels' own option
      if (hooks.vessel){
        const tp = part(ULAM, "tables", { "hk-ulam-furnishings": "second-temple" });
        vessel("ulam-table-marble", tp, AX, yUi, FL, "ulam");
        vessel("ulam-table-gold", tp, AX, yUi, FL, "ulam");
      }
    }

    /* ============ the steps: twelve, half a cubit each, rising the atum (Middot 3:6) ============ */
    const RISE = dim("ulam-step-rise"), NSTEP = dim("ulam-steps-count"), SW = dim("md-hk-steps-width");
    const TREADS = {                                     // from the bottom; the last is the landing before the door
      "rambam": Array(NSTEP).fill(dim("hk-ulam-step-tread-rambam")),
      "middot": Array.from({ length: NSTEP }, (_, i) => i === NSTEP - 1 ? dim("hk-ulam-top-landing") : i % 2 ? dim("hk-ulam-landing") : dim("hk-ulam-step-tread-middot")),
      "middot-ryehuda": Array.from({ length: NSTEP }, (_, i) => i === NSTEP - 1 ? dim("hk-ulam-top-landing-ryehuda") : i % 2 ? dim("hk-ulam-landing") : dim("hk-ulam-step-tread-middot")),
      "model-1.5": Array(NSTEP).fill(dim("md-porch-step-tread")),
    };
    combos(["hk-steps-plan", "hk-steps-shape"]).forEach(o => {
      const ph = part(STEPS, "steps", o), t = TREADS[o["hk-steps-plan"]], three = o["hk-steps-shape"] === "three-sides";
      let front = E + sum(t);
      for (let i = 0; i < NSTEP; i++){
        const side = three ? (NSTEP - i) * RISE : 0;
        box(ph, { top: "marble", side: "hkWhite" }, AX - SW / 2 - side, AX + SW / 2 + side, E, front, 0, (i + 1) * RISE, { noS: true, noP: true });
        front -= t[i];
      }
      const D = sum(t), side0 = three ? NSTEP * RISE : 0;
      proxy(STEPS, AX - SW / 2 - side0, AX + SW / 2 + side0, E, E + D, 0, FL, INFO.steps, { noS: true }, ph);
    });

    /* ============ the side chambers, the mesibah and the water channel ============ */
    const doorH = o => Math.min(ART.taDoor[1], TA_H[o["hk-taim-height"]] - ART.taSlab - .5);
    // the outer walls of the body: the mesibah's (north) and the water channel's (south), and the west cells' wall
    combos(["hk-plan", "hk-taim-height"]).forEach(o => {
      const ph = part(TAIM, "outer-walls", o), [bx0, bx1] = BODY[o["hk-plan"]], top = TR(o) + ART.coping, m = { top: "cap", side: "hkWhite" };
      // between the west cells' wall and the hall's east wall, which own the corners
      if (o["hk-plan"] === "middot-70"){ box(ph, m, xMW0, xN, yTaW1, yH0, FL, top); box(ph, m, xS, xRW1, yTaW1, yH0, FL, top); }
      box(ph, m, bx0, bx1, yW, yTaW1, FL, top);
      // string courses at each storey, and a coping
      const SH = TA_H[o["hk-taim-height"]], faces = o["hk-plan"] === "middot-70" ? [{ y0: yW, y1: yUi, x: xN, n: "+x" }, { y0: yW, y1: yUi, x: xS, n: "-x" }] : [];
      faces.push({ x0: bx0, x1: bx1, y: yW, n: "-y" });
      for (let k = 1; k <= STOREYS; k++) band(ph, k === STOREYS ? "cap" : "hkWhite", faces, FL + k * SH - .5, FL + k * SH + (k === STOREYS ? ART.coping : 0), .3);
    });
    // the cells' own outer walls, north and south, with the doors of the corner cell and of Ezekiel's south door
    combos(["hk-taim-height"]).forEach(o => {
      const ph = part(TAIM, "cell-walls", o), top = TR(o), dh = doorH(o), m = { top: "roof", side: "hkWhite" };
      holed(ph, m, xTWn0, xM0, yTaW1, yH0, FL, top, [[yH0 - 4, yH0 - 2, FL, FL + dh]], "y");     // to the mesibah (Middot 4:3)
      holed(ph, m, xR1, xTWs1, yTaW1, yH0, FL, top, [[yH0 - 4, yH0 - 2, FL, FL + dh]], "y");     // to the south (Ezek 41:11)
    });
    // the cells: storeys, floors, the walls between them and their doors (Middot 4:3-4; Ezek 41:5-7)
    const cells = (o, side) => H.taim[o["hk-taim-count"]][side];
    function strip(ph, o, side){
      const w = TA_W[o["hk-taim-width"]], SH = TA_H[o["hk-taim-height"]], dh = doorH(o), dw = ART.taDoor[0], pt = ART.taPart / 2;
      const yWestCells = k => yTaW1 + w[k];               // the west cells take the corners
      for (let k = 0; k < STOREYS; k++){
        const h0 = FL + k * SH, h1 = h0 + SH, n = cells(o, side)[k], up = k < STOREYS - 1 ? w[k + 1] : w[k];
        // the floor above, with an opening over each cell to the cell above it (Middot 4:3); the roof has none
        const hatches = [], hs = ART.hatch / 2;
        const slab = (x0, x1, y0, y1) => slabHoles(ph, k === STOREYS - 1 ? { top: "roof", side: "cap" } : "cap", x0, x1, y0, y1, h1 - ART.taSlab, h1, k < STOREYS - 1 ? hatches : []);
        if (side === "w"){
          const xa = xTWs1, xb = xTWn0, y0 = yTaW1, y1 = yTaW1 + w[k];
          for (let i = 1; i < n; i++){ const x = xa + (xb - xa) * i / n; holed(ph, "hkWhite", x - pt, x + pt, y0, y1, h0, h1 - ART.taSlab, [[(y0 + y1) / 2 - dw / 2, (y0 + y1) / 2 + dw / 2, h0, h0 + dh]], "y"); }
          for (let i = 0; i < n; i++){ const x = xa + (xb - xa) * (i + .5) / n, y = (y0 + y1) / 2; hatches.push([x - hs, x + hs, y - hs, y + hs]); }
          slab(xa, xb, yTaW1, yTaW1 + up);
        } else {
          const n0 = side === "n", xo = n0 ? xTWn0 : xTWs1, xi = n0 ? xTWn0 - w[k] : xTWs1 + w[k];
          const x0 = Math.min(xo, xi), x1 = Math.max(xo, xi), ya = yWestCells(k), yb = yH0;
          for (let i = 0; i < n; i++){
            const y = ya + (yb - ya) * i / n;            // i = 0: the wall between this strip and the west cells
            holed(ph, "hkWhite", x0, x1, y - (i ? pt : 0), y + pt, h0, h1 - ART.taSlab, [[(x0 + x1) / 2 - dw / 2, (x0 + x1) / 2 + dw / 2, h0, h0 + dh]], "x");
            const yc = ya + (yb - ya) * (i + .5) / n, xc = (x0 + x1) / 2; hatches.push([xc - hs, xc + hs, yc - hs, yc + hs]);
          }
          const xu = n0 ? xTWn0 - up : xTWs1 + up;
          slab(Math.min(xo, xu), Math.max(xo, xu), yTaW1 + (k < STOREYS - 1 ? w[k + 1] : w[k]), yb);
        }
      }
    }
    combos(["hk-taim-count", "hk-taim-width", "hk-taim-height"]).forEach(o => {
      strip(part(TAIM, "cells-n", o), o, "n");
      strip(part(TAIM, "cells-s", o), o, "s");
      combos(["hk-kk-divider"]).forEach(d => strip(part(TAIM, "cells-w", Object.assign({}, o, d)), o, "w"));
    });
    // the mesibah: from the north-east corner up to the cells' roofs, facing west (Middot 4:5)
    combos(["hk-mesibah", "hk-taim-height"]).forEach(o => {
      const ph = part(TAIM, "mesibah", o), top = TR(o), y0 = yTaW1, y1 = yH0 - 5;   // a landing at the corner cell's door
      const m = { top: "marble", side: "hkWhite" };
      if (o["hk-mesibah"] === "stairs"){
        const n = Math.round((top - FL) / RISE), t = (y1 - y0) / n;
        for (let i = 1; i <= n; i++) box(ph, m, xM0, xMW0, y1 - i * t, y1 - (i - 1) * t, FL, FL + i * RISE);
        box(ph, m, xM0, xMW0, yTaW1 - .01, y0, FL, top);
      } else {
        // a wedge, its faces laid both ways round so that each shows from either side
        const T = target(ph, []), P = (x, y, h) => [PX(y), Yw(h), PZ(x)];
        const q = (mat, ...v) => { bat.quad(T, mat, v[0], v[1], v[2], v[3]); bat.quad(T, mat, v[3], v[2], v[1], v[0]); };
        q("marble", P(xM0, y1, FL), P(xMW0, y1, FL), P(xMW0, y0, top), P(xM0, y0, top));
        q("hkWhite", P(xMW0, y1, FL), P(xMW0, y0, FL), P(xMW0, y0, top), P(xMW0, y0, top));
        q("hkWhite", P(xM0, y1, FL), P(xM0, y0, FL), P(xM0, y0, top), P(xM0, y0, top));
        q("hkWhite", P(xM0, y0, FL), P(xMW0, y0, FL), P(xMW0, y0, top), P(xM0, y0, top));
      }
    });
    {
      // the water channel to the south (Middot 4:7): a gutter in its floor
      const ph = part(TAIM, "channel");
      box(ph, "water", xRW1 + 1, xR1 - 1, yTaW1, yH0, FL, FL + .08);
    }
    // windows on the outside of the cells: one row at the top (Ezekiel's places), or one in every storey
    combos(["hk-windows", "hk-plan", "hk-taim-count", "hk-taim-height"]).forEach(o => {
      const ph = part(TAIM, "windows", o);
      if (o["hk-windows"] === "none") return;
      const [w, h] = ART.window, SH = TA_H[o["hk-taim-height"]], hw = Math.min(h, SH * .45);
      const ks = o["hk-windows"] === "rows" ? [...Array(STOREYS).keys()] : [STOREYS - 1];
      const nOut = o["hk-plan"] === "middot-70" ? xN : xM0, sOut = o["hk-plan"] === "middot-70" ? xS : xR1, [bx0, bx1] = BODY[o["hk-plan"]];
      ks.forEach(k => {
        const h0 = FL + k * SH + (SH - hw) * .55, n = cells({ "hk-taim-count": o["hk-taim-count"] }, "n")[k], nw = cells({ "hk-taim-count": o["hk-taim-count"] }, "w")[k];
        const ya = yTaW1 + 5, yb = yH0;
        for (let i = 0; i < n; i++){
          const y = ya + (yb - ya) * (i + .5) / n;
          box(ph, "hkWhite", nOut, nOut + .2, y - w / 2 - .4, y + w / 2 + .4, h0 - .4, h0 + hw + .4); box(ph, "dark", nOut, nOut + .26, y - w / 2, y + w / 2, h0, h0 + hw);
          box(ph, "hkWhite", sOut - .2, sOut, y - w / 2 - .4, y + w / 2 + .4, h0 - .4, h0 + hw + .4); box(ph, "dark", sOut - .26, sOut, y - w / 2, y + w / 2, h0, h0 + hw);
        }
        for (let i = 0; i < nw; i++){
          const x = bx0 + 3 + (bx1 - bx0 - 6) * (i + .5) / nw;
          box(ph, "hkWhite", x - w / 2 - .4, x + w / 2 + .4, yW - .2, yW, h0 - .4, h0 + hw + .4); box(ph, "dark", x - w / 2, x + w / 2, yW - .26, yW, h0, h0 + hw);
        }
      });
    });

    /* ============ the hall's walls, the doors, the wickets ============ */
    // the east wall: the ulam's back wall. The great door; the north wicket, into the corner cell
    // ("ta") or through the wall to between the doors ("wall"); the south wicket, shut (Middot 4:2)
    const WK = ART.wicket, wkX = [xTWn0 - Math.min(...TA_W["middot-5-6-7"].concat(TA_W["ezekiel-4"])) / 2 - WK[0] / 2];
    wkX.push(wkX[0] + WK[0]);
    combos(["hk-plan", "hk-wicket"]).forEach(o => {
      const ph = part(HALL, "east-wall", o), [bx0, bx1] = BODY[o["hk-plan"]], m = { top: "roof", side: "hkWhite" };
      const door = [AX - DOOR[0] / 2, AX + DOOR[0] / 2, FL, FL + DOOR[1]];
      if (o["hk-wicket"] === "ta") holed(ph, m, bx0, bx1, yH0, yUi, FL, RF, [door, [wkX[0], wkX[1], FL, FL + WK[1]]], "x");
      else {
        const t = (yUi - yH0) / 3;
        holed(ph, m, bx0, bx1, yH0, yH0 + t, FL, RF, [door], "x");
        holed(ph, m, bx0, bx1, yH0 + t, yUi - t, FL, RF, [door, [door[1], wkX[1], FL, FL + WK[1]]], "x");
        holed(ph, m, bx0, bx1, yUi - t, yUi, FL, RF, [door, [wkX[0], wkX[1], FL, FL + WK[1]]], "x");
      }
      const sx = 2 * AX - wkX[1];                         // the south wicket, mirrored: a shut gold door on the ulam's side
      box(ph, "door", sx, sx + WK[0], yUi, yUi + .15, FL, FL + WK[1]);
    });
    // the hall's side walls, set back a cubit at each storey of the cells; above them, the house's walls
    function sideWall(ph, o, n0){
      const w = TA_W[o["hk-taim-width"]], SH = TA_H[o["hk-taim-height"]], top = TR(o), m = { top: "roof", side: "hkWhite" };
      const face = n0 ? xIn : xIs, out = k => n0 ? xTWn0 - w[k] : xTWs1 + w[k];
      const holes = k => {
        const q = [];
        if (n0 && o["hk-wicket"] === "ta" && k === 0) q.push([yH0 - 4, yH0 - 2, FL, FL + doorH(o)]);       // corner cell -> the hall
        return q;
      };
      for (let k = 0; k < STOREYS; k++){
        const h0 = FL + k * SH, h1 = h0 + SH;
        holed(ph, m, Math.min(face, out(k)), Math.max(face, out(k)), yK0({}), yH0, h0, h1, holes(k), "y");
      }
      const t = n0 ? nsHWn : nsHWs, x0 = n0 ? face : face - t, x1 = n0 ? face + t : face;
      const up = n0 ? [] : [[yH0 - 14, yH0 - 14 + ART.aliyahDoor[0], AF, AF + ART.aliyahDoor[1]]];        // the upper storey's door, south (Middot 4:5)
      holed(ph, m, x0, x1, yK0({}), yH0, top, RF, up, "y");
    }
    combos(["hk-taim-width", "hk-taim-height", "hk-wicket"]).forEach(o => sideWall(part(HALL, "north-wall", o), o, true));
    combos(["hk-taim-width", "hk-taim-height"]).forEach(o => sideWall(part(HALL, "south-wall", o), o, false));
    // the west wall of the house, behind the Holy of Holies, set back with the west cells
    combos(["hk-taim-width", "hk-taim-height", "hk-kk-divider"]).forEach(o => {
      const ph = part(KK, "west-wall", o), w = TA_W[o["hk-taim-width"]], SH = TA_H[o["hk-taim-height"]], top = TR(o), m = { top: "roof", side: "hkWhite" };
      // the west wall runs the house's full width, its corners included; the side walls begin where it ends.
      // Behind Ezekiel's wall the Holy of Holies moves a cubit west, so the sides are filled up to the old line.
      const fill = yK0({}) - yK0(o);
      for (let k = 0; k < STOREYS; k++){
        const h0 = FL + k * SH;
        box(ph, m, xTWs1 + w[k], xTWn0 - w[k], yTaW1 + w[k], yK0(o), h0, h0 + SH);
        if (fill > 0){ box(ph, m, xTWs1 + w[k], xIs, yK0(o), yK0({}), h0, h0 + SH); box(ph, m, xIn, xTWn0 - w[k], yK0(o), yK0({}), h0, h0 + SH); }
      }
      box(ph, m, coreX0, coreX1, yCoreW(o), yK0(o), top, RF);
      if (fill > 0){ box(ph, m, coreX0, xIs, yK0(o), yK0({}), top, RF); box(ph, m, xIn, coreX1, yK0(o), yK0({}), top, RF); }
    });
    // the house above the cells: pilasters on its long sides
    combos(["hk-taim-height"]).forEach(o => {
      const ph = part(ROOF, "house-ornament", o), top = TR(o), [ch] = ART.cornice;
      for (let y = yK0({}) + 2; y < yH0 - 2; y += ART.lesenePitch){
        box(ph, "hkWhite", coreX1, coreX1 + .35, y - .8, y + .8, top + ART.coping, RF - ch - .4);
        box(ph, "hkWhite", coreX0 - .35, coreX0, y - .8, y + .8, top + ART.coping, RF - ch - .4);
      }
    });
    // the poles of cedar at the upper storey's door, to climb to its roof (Middot 4:5)
    {
      const ph = part(ROOF, "poles"), y = yH0 - 14 + ART.aliyahDoor[0] / 2;
      [y - 1.2, y + 1.2].forEach(py => box(ph, "hkCedar", coreX0 - .55, coreX0 - .15, py - .2, py + .2, AF, RF + 1.5));
    }
    // the four doors of the great gate, open (Middot 4:1)
    combos(["hk-doors", "hk-walls"]).forEach(o => {
      const ph = part(HALL, "doors", o), t = ART.doorLeaf, mat = o["hk-walls"] === "ezekiel-carved" ? "hkCarvedW" : "door";
      const x0 = AX - DOOR[0] / 2, x1 = AX + DOOR[0] / 2, h1 = FL + DOOR[1];
      if (o["hk-doors"] === "tk"){
        const lw = dim("hk-door-leaf-width-tk");
        // the outer pair opens into the doorway and covers its depth; the inner pair opens into the house
        box(ph, mat, x0, x0 + t, yUi - lw, yUi, FL, h1); box(ph, mat, x1 - t, x1, yUi - lw, yUi, FL, h1);
        box(ph, mat, x0 - lw, x0, yH0 - t, yH0, FL, h1); box(ph, mat, x1, x1 + lw, yH0 - t, yH0, FL, h1);
      } else {
        // Rabbi Yehuda: inside the doorway, folding back on themselves; a jamb of half a cubit at each end
        const lw = dim("hk-door-leaf-ryehuda"), j = dim("hk-door-jamb-ryehuda");
        for (const [xa, s] of [[x0, 1], [x1, -1]]){
          const xi = xa + s * t, xj = xa + s * 2 * t;
          box(ph, "gold", Math.min(xa, xi), Math.max(xa, xi), yUi - j, yUi, FL, h1); box(ph, "gold", Math.min(xa, xi), Math.max(xa, xi), yH0, yH0 + j, FL, h1);
          box(ph, mat, Math.min(xa, xi), Math.max(xa, xi), yUi - j - lw, yUi - j, FL, h1);
          box(ph, mat, Math.min(xi, xj), Math.max(xi, xj), yUi - j - 2 * lw, yUi - j - lw, FL, h1);
        }
      }
    });
    // the walls inside: carved gilded wood, or gold, the gold "except behind the doors" (Middot 4:1)
    const TILE_C = [8, 8], TILE_P = [4, 4], CARVE_TOP = FL + 3 * TILE_C[1];
    function lining(ph, matTop, carved, face, a0, a1, holes, o){
      if (carved){ panel(ph, "hkCarved", face, a0, a1, FL, Math.min(H1, CARVE_TOP), TILE_C, holes, o); panel(ph, "hkPanel", face, a0, a1, Math.min(H1, CARVE_TOP), H1, TILE_P, holes, o); }
      else panel(ph, "hkPanel", face, a0, a1, FL, H1, TILE_P, holes, o);
    }
    const IN = .04;
    combos(["hk-walls", "hk-wicket", "hk-doors"]).forEach(o => {
      const ph = part(HALL, "lining", o), carved = o["hk-walls"] === "ezekiel-carved";
      const doorHole = [AX - DOOR[0] / 2, AX + DOOR[0] / 2, FL, FL + DOOR[1]];
      const behind = o["hk-doors"] === "tk" ? [AX - DOOR[0] / 2 - dim("hk-door-leaf-width-tk"), AX + DOOR[0] / 2 + dim("hk-door-leaf-width-tk"), FL, FL + DOOR[1]] : doorHole;
      lining(ph, null, carved, { axis: "x", at: xIn - IN, dir: -1 }, yHi, yH0, o["hk-wicket"] === "ta" ? [[yH0 - 4, yH0 - 2, FL, FL + 5]] : []);
      lining(ph, null, carved, { axis: "x", at: xIs + IN, dir: 1 }, yHi, yH0, [], { forceS: true });
      lining(ph, null, carved, { axis: "y", at: yH0 - IN, dir: -1 }, xIs, xIn, [behind]);
      // the doorway's sides, gold
      panel(ph, "hkPanel", { axis: "x", at: AX - DOOR[0] / 2 + .02, dir: 1 }, yH0, yUi, FL, FL + DOOR[1], TILE_P, []);
      panel(ph, "hkPanel", { axis: "x", at: AX + DOOR[0] / 2 - .02, dir: -1 }, yH0, yUi, FL, FL + DOOR[1], TILE_P, []);
    });
    combos(["hk-walls", "hk-kk-divider"]).forEach(o => {
      const ph = part(KK, "lining", o), carved = o["hk-walls"] === "ezekiel-carved";
      const yEnd = o["hk-kk-divider"] === "ezekiel-wall" ? yKE(o) : yHi;      // with curtains, the gold runs on through the amah traksin
      lining(ph, null, carved, { axis: "x", at: xIn - IN, dir: -1 }, yK0(o), yEnd, []);
      lining(ph, null, carved, { axis: "x", at: xIs + IN, dir: 1 }, yK0(o), yEnd, [], { forceS: true });
      lining(ph, null, carved, { axis: "y", at: yK0(o) + IN, dir: 1 }, xIs, xIn, []);
      if (o["hk-kk-divider"] === "ezekiel-wall"){
        const hole = [[AX - dim("hke-kk-opening-6") / 2, AX + dim("hke-kk-opening-6") / 2, FL, FL + DOOR[1]]];
        lining(ph, null, carved, { axis: "y", at: yHi + IN, dir: 1 }, xIs, xIn, hole);
        lining(ph, null, carved, { axis: "y", at: yKE(o) - IN, dir: -1 }, xIs, xIn, hole);
      }
    });

    /* ============ between the Holy and the Holy of Holies ============ */
    const PAROCHET = { h: dim("parochet-length"), w: dim("parochet-width"), t: dim("parochet-thickness") / 6 };
    if (PAROCHET.h !== Z[1] || PAROCHET.w !== nsI) throw new Error("heichal.js: the parochet no longer fills the hall (40 x 20)");
    combos(["hk-kk-divider", "hk-parochet"]).forEach(o => {
      const div = o["hk-kk-divider"];
      if (div === "ezekiel-wall"){
        if (o["hk-parochet"] !== "four-colours") return;
        // Ezekiel 41:3: a post of two cubits and an opening; the opening's height is not given (20, borrowed)
        const ph = part(KK, "divider", { "hk-kk-divider": div }), ow = dim("hke-kk-opening-6");
        holed(ph, { top: "roof", side: "hkWhite" }, xIs, xIn, yKE(o), yHi, FL, H1, [[AX - ow / 2, AX + ow / 2, FL, FL + DOOR[1]]], "x");
        return;
      }
      const ph = part(KK, "divider", o), mat = o["hk-parochet"] === "cherubim" ? "hkCurtainCherub" : "hkCurtain4", T = PAROCHET.t, g = ART.curtainGap;
      const curtain = (x0, x1, y) => {
        mesh(ph, mat, REAL ? drape(x1 - x0, PAROCHET.h - .3, .1, 1.3) : null, M4(x0, y, FL + .02, -Math.PI / 2 * 0 + Math.PI / 2), x1, FL, { noP: true });
        box(ph, "gold", x0, x1, y - .15, y + .15, FL + PAROCHET.h - .3, FL + PAROCHET.h, { noP: true });     // the rod it hangs from
      };
      if (div === "two-curtains"){
        // the outer one is pinned back at the south, the inner one at the north (Yoma 5:1)
        // a cubit clear between them: the outer hangs on the Holy's side of the amah traksin, the inner on the other
        curtain(xIs + g, xIn, yHi + T / 2); box(ph, "gold", xIs + g - .3, xIs + g, yHi - .05, yHi + .3, FL + 6, FL + 7, { noP: true });
        curtain(xIs, xIn - g, yT0 - T / 2); box(ph, "gold", xIn - g, xIn - g + .3, yT0 - .3, yT0 + .05, FL + 6, FL + 7, { noP: true });
      } else curtain(xIs, xIn, (yT0 + yHi) / 2);
    });
    // the foundation stone, three fingers high (Yoma 5:2), in the west (Rambam 4:1) or large in the middle (Mikdash3, p. 197)
    const ES_H = dim("even-shetiya-height") / 24;            // fingers: 24 to the cubit
    const stoneAt = o => {
      if (o["hk-even-shetiya"] === "small-west"){ const [ns, ew] = H.even_small; return [AX - ns / 2, AX + ns / 2, yK0(o) + ART.shetiyaFromWall, yK0(o) + ART.shetiyaFromWall + ew]; }
      const s = dim("m3h-even-shetiya-size"), cy = (yK0(o) + yKE(o)) / 2; return [AX - s / 2, AX + s / 2, cy - s / 2, cy + s / 2];
    };
    combos(["hk-even-shetiya", "hk-kk-divider"]).forEach(o => {
      const ph = part(KK, "even-shetiya", o), [x0, x1, y0, y1] = stoneAt(o);
      box(ph, "hkRock", x0, x1, y0, y1, FL, FL + ES_H * .6, { noP: true });
      box(ph, "hkRock", x0 + .25, x1 - .25, y0 + .2, y1 - .2, FL, FL + ES_H, { noP: true });
      // the ark's place, on the stone: what shows there (nothing, the outline, the hiding places) is kl-ark and kl-ark-hiding
      // the frame's origin is the floor under the stone's centre: vessels.js raises the ark by the stone's own height
      if (hooks.vessel) vessel("ark-outline", part(KK, "ark", o), (x0 + x1) / 2, (y0 + y1) / 2, FL, "kodesh-kodashim");
    });
    // the ceilings: over the Holy and the Holy of Holies, with the lulin over the latter only (Middot 4:5)
    combos(["hk-kk-divider"]).forEach(o => {
      const ph = part(ROOF, "ceilings", o), yk = yK0(o), cy = (yk + yKE(o)) / 2, l = ART.lulin / 2;
      const holes = [AX - 5, AX, AX + 5].map(x => [x - l, x + l]);
      slabLayers(H1).forEach(([a, b, m]) => {
        box(ph, m, xIs, xIn, yKE(o), yH0, a, b, { top: true });
        box(ph, m, xIs, xIn, yk, cy - l, a, b, { top: true }); box(ph, m, xIs, xIn, cy + l, yKE(o), a, b, { top: true });
        let x = xIs; holes.forEach(([h0, h1]) => { box(ph, m, x, h0, cy - l, cy + l, a, b, { top: true }); x = h1; }); box(ph, m, x, xIn, cy - l, cy + l, a, b, { top: true });
      });
      slabLayers(H2).forEach(([a, b, m]) => box(ph, m, xIs, xIn, yk, yH0, a, b, { top: true }));
      // the partition in the upper storey, over the one below: heads of posts (Middot 4:5)
      const yl = o["hk-kk-divider"] === "ezekiel-wall" ? [yKE(o), yHi] : [yT0, yHi];
      for (let x = xIs + .5; x < xIn - .2; x += 1) box(ph, "hkCedar", x - .2, x + .2, yl[0] + .3, yl[1] - .3, AF, AF + 2.2, { top: true });
      box(ph, "gold", xIs, xIn, yl[0] + .2, yl[1] - .2, AF + 2.2, AF + 2.5, { top: true });
    });

    // in the upper storey, curtains over the line of the ones below: two, or Rabbi Yosi's one (Rambam, Klei HaMikdash 7:17)
    combos(["hk-kk-divider", "hk-parochet"]).forEach(o => {
      const div = o["hk-kk-divider"];
      if (div === "ezekiel-wall") return;
      const ph = part(ROOF, "aliyah-curtains", o), mat = o["hk-parochet"] === "cherubim" ? "hkCurtainCherub" : "hkCurtain4", T = PAROCHET.t;
      const hang = y => {
        mesh(ph, mat, REAL ? drape(nsI, Z[6] - 3, .1, 1.3) : null, M4(xIs, y, AF + 2.6, Math.PI / 2), xIn, AF + 2.6, { top: true, noP: true });
        box(ph, "gold", xIs, xIn, y - .15, y + .15, H2 - .4, H2, { top: true, noP: true });
      };
      if (div === "two-curtains"){ hang(yHi + T / 2); hang(yT0 - T / 2); } else hang((yT0 + yHi) / 2);
    });

    /* ============ the roof's edge: cornice, parapet and kalah orev around the whole T (Middot 4:6) ============ */
    // the roof's outline. The ulam's back wall, the heichal's east wall, is 6 thick and stands to the roof
    // across the body, so behind the wings the roof steps back to it.
    const FACE_EDGE = [{ x0: xF0, x1: xF1, y: E, n: "+y" }];
    const pt = ART.parapet;
    const frontEdges = (bx0, bx1) => [
      { y0: yUi, y1: E, x: xF1, n: "+x" }, { y0: yUi, y1: E, x: xF0, n: "-x" },
      { x0: bx1, x1: xF1, y: yUi, n: "-y" }, { x0: xF0, x1: bx0, y: yUi, n: "-y" },
      { y0: yH0, y1: yUi + pt, x: bx1, n: "+x" }, { y0: yH0, y1: yUi + pt, x: bx0, n: "-x" },
      { x0: coreX1, x1: bx1, y: yH0, n: "-y" }, { x0: bx0, x1: coreX0, y: yH0, n: "-y" }];
    const houseEdges = o => [{ y0: yCoreW(o), y1: yH0 + pt, x: coreX1, n: "+x" }, { y0: yCoreW(o), y1: yH0 + pt, x: coreX0, n: "-x" },
      { x0: coreX0, x1: coreX1, y: yCoreW(o), n: "-y" }];
    const blade = REAL ? (() => { const s = new THREE.Shape(); s.moveTo(-ART.blade[0] / 2, 0); s.lineTo(ART.blade[0] / 2, 0); s.lineTo(0, KO); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: ART.blade[1], bevelEnabled: false }); g.translate(0, 0, -ART.blade[1] / 2); return g; })() : null;
    function edgeDetail(ph, edges, o, fl){
      const [ch, cp] = ART.cornice, ry = o["hk-roof-edge"] === "ryehuda", par = ry ? dim("hk-parapet-ryehuda") : PAR;
      if (par + (ry ? 0 : KO) !== PAR + KO) throw new Error("heichal.js: the roof's edge no longer ends at 100 (Middot 4:6)");
      band(ph, "cap", edges, RF - ch, RF, cp, fl);                 // the cornice, outside
      band(ph, "gold", edges, RF - ch - .35, RF - ch, .2, fl);     // a gold fillet under it
      const bm = o["hk-roof-edge"] === "gold" ? "gold" : "iron";
      edges.forEach(e => {
        const along = e.n === "+y" || e.n === "-y";
        const a0 = along ? e.x0 : e.y0, a1 = along ? e.x1 : e.y1;
        const c0 = along ? (e.n === "+y" ? e.y - pt : e.y) : (e.n === "+x" ? e.x - pt : e.x), c1 = c0 + pt;
        if (along) box(ph, { top: "cap", side: "hkWhite" }, a0, a1, c0, c1, RF, RF + par, fl);
        else box(ph, { top: "cap", side: "hkWhite" }, c0, c1, a0, a1, RF, RF + par, fl);
        if (ry) return;                                 // Rabbi Yehuda: a parapet of four, no kalah orev counted
        const n = Math.max(1, Math.round((a1 - a0) / ART.bladePitch)), step = (a1 - a0) / n;
        for (let i = 0; i < n; i++){
          const a = a0 + (i + .5) * step, c = (c0 + c1) / 2;
          // along an east-west edge a = plan x and the blade turns to face north-south; else a = plan y
          mesh(ph, bm, blade, along ? M4(a, c, RF + par, Math.PI / 2) : M4(c, a, RF + par), along ? a : c, RF + par, fl);
        }
      });
    }
    combos(["hk-roof-edge"]).forEach(o => edgeDetail(part(ROOF, "edge-face", o), FACE_EDGE, o, { noA: true }));      // the face keeps its crown when the roof is off
    combos(["hk-roof-edge", "hk-plan"]).forEach(o => { const [bx0, bx1] = BODY[o["hk-plan"]]; edgeDetail(part(ROOF, "edge-front", o), frontEdges(bx0, bx1), o, { top: true }); });
    combos(["hk-roof-edge", "hk-kk-divider"]).forEach(o => edgeDetail(part(ROOF, "edge-house", o), houseEdges(o), o, { top: true }));

    /* ============ the vessels' places (the hooks) ============ */
    // the menorah, the table and the golden altar stand in the Holy; the frame is the middle of its west end
    if (hooks.vessel){
      const ph = part(HALL, "vessels");
      ["menorah", "table", "incense-altar"].forEach(k => vessel(k, ph, AX, yHi, FL, "heichal"));
    }

    /* ============ labels, click targets ============ */
    const lab = part(house, "labels-open");
    label(lab, AX, (yUi + yU0) / 2, FL + 30, "האולם", "", { only: "o" });
    label(lab, AX, (yHi + yH0) / 2, FL + 30, "ההיכל", "הקודש", { only: "o" });
    label(lab, AX, (yT0 - ewK / 2), FL + 30, "קודש הקודשים", "", { only: "o" });

    proxy(ULAM, XS, xF1, yU0, E, FL, TOP, INFO.ulam);
    proxy(ULAM, xF0, XS, yU0, E, FL, TOP, INFO.ulam, { forceS: true });
    proxy(ULAM, xF1 - WW, xF1, yUi, yU0, FL, RF, INFO.ulam);
    proxy(ULAM, xF0, xF0 + WW, yUi, yU0, FL, RF, INFO.ulam, { forceS: true });
    proxy(ULAM, xF0 + WW, xF1 - WW, yUi, yU0, FL - .2, FL, INFO.ulam);
    proxy(HALL, xIs, xIn, yHi, yH0, FL - .2, FL, INFO.heichal);
    proxy(HALL, xIn, coreX1, yK0({}), yH0, FL, AF, INFO.heichal);
    proxy(HALL, coreX0, xIs, yK0({}), yH0, FL, AF, INFO.heichal, { forceS: true });
    proxy(HALL, coreX0, coreX1, yH0, yUi, FL, AF, INFO.heichal);
    proxy(KK, xIs, xIn, yK0({}) - 1, yHi, FL - .2, FL + .2, INFO.kodesh);
    proxy(KK, coreX0, coreX1, yK0({}) - ewKW, yK0({}), FL, AF, INFO.kodesh);
    proxy(TAIM, xTWn0 - 4, xN, yW, yH0, FL, FL + 46, INFO.taim);
    proxy(TAIM, xS, xTWs1 + 4, yW, yH0, FL, FL + 46, INFO.taim, { forceS: true });
    proxy(TAIM, xS, xN, yW, yTaW1 + 4, FL, FL + 46, INFO.taim);
    proxy(ROOF, coreX0, coreX1, yCoreW({}), yH0, AF, TOP, INFO.roof, { top: true });
    proxy(ROOF, xF0, xF1, yUi, yU0, RF - 1, TOP, INFO.roof, { top: true });

    bat.flush(MAT);
    flushOrn();

    const hall = [AX, (yHi + yH0) / 2];
    U.heichal = {
      cut: "none", setCut: mode => setCut(root, mode), ART,
      lamp: W(hall[0] - nsI / 4, yHi + ewH / 6, FL + 4),
      // the interior, from the south-east and above: what "פנים ההיכל" frames
      views: { interior: { center: W(AX, (yK0({}) + E) / 2, FL + 10), radius: C((E - yK0({})) / 2 + 8), dir: [.55, 1.1, .8] },
               facade: { center: W(AX, E - 20, 45), radius: C(70), dir: [.95, .42, .52] } },
      plan: { x: [xF0, xF1], y: [yW, E], axis: AX, east: E, floor: FL, top: TOP, roof: RF, aliyah: AF },
      // the rooms' frames, plan cubits: where hooks.vessel places each room's vessels from
      frames: { heichal: [AX, yHi], ulam: [AX, yUi] },
      ledges: LEDGES,
      yWorld: Yw,
    };
    return root;
  }

  /* the click texts */
  const SS = (t, x) => ({ tag: t, text: x });
  const INFO = {
    ulam: { kind: "אולם", name: "האולם והחזית",
      rows: [["חזית", "100 אמות: גוף של 70 וכנף של 15 לכל צד"], ["עומק", "כותל 5 ואולם 11 אמות"], ["פתח האולם", "20 × 40 במשנה; 25 × 70 אצל יוסף; 14 ביחזקאל"], ["גובה", "100 אמות, כגובה הבית"]],
      src: [SS("src", "״וההיכל צר מאחריו ורחב מלפניו, ודומה לארי״ (מידות ד ז)"), SS("src", "פתחו של אולם גבהו ארבעים אמה ורחבו עשרים, וחמש מלתראות של מילת על גביו (מידות ג ז)"),
        SS("src", "״ועמדים אל האילים אחד מפה ואחד מפה״ (יחזקאל מ מט); מידתם מיכין ובועז, מלכים א ז טו–טז"),
        SS("src", "גפן של זהב על פתחו של היכל, כלונסות של ארז ושרשרות של זהב באולם (מידות ג ח); נברשת על פתחו של היכל (יומא ג י)"),
        SS("dec", "תקרת האולם בגובה תקרת העלייה, והכנפיים בגובה הבית: אין לכך מקור"),
        SS("src", "״וכן סביב לכתלי האולם מלמטה עד למעלה... אמה אחת חלק ורבד שלש אמות... ורבד העליון היה רחבו ארבע אמות״ (רמב״ם ד ט)"),
        SS("dec", "הרבדים כרצועות סכמטיות על פני האולם החיצוניים, כשהאפשרות ״רבדי כותלי האולם״ מציגה אותם: צורתם אינה נמסרת"),
        SS("art", "פילסטרים, כרכובים, מסגרת הזהב של הפתח, מקום החלונות והתמרים, מספר הכלונסות והשרשרות, בליטת הרבדים")] },
    heichal: { kind: "היכל", name: "ההיכל (הקודש)",
      rows: [["חלל", "40 × 20, גובה 40 אמות"], ["פתח", "10 × 20, ארבע דלתות"], ["כתלים", "6 אמות"], ["רצפה", "6 אמות מעל העזרה, על האוטם"]],
      src: [SS("src", "״פתחו של היכל גבהו עשרים אמה ורחבו עשר אמות, וארבע דלתות היו לו״ (מידות ד א)"),
        SS("src", "שני פשפשין לשער הגדול, בצפון ובדרום; שבדרום לא נכנס בו אדם מעולם (מידות ד ב)"),
        SS("src", "״שכל הבית טוח בזהב, חוץ מאחר הדלתות״ (מידות ד א); כרובים ותמרים מן הארץ עד מעל הפתח (יחזקאל מא יח–כ)"),
        SS("dec", "הכרוב מוצג כצורה מופשטת בעלת שני פנים, כי אין שחזור מאומת שאפשר להעתיק ממנו"),
        SS("art", "מידת הפשפשים, עובי הדלתות ותבנית לוחות הזהב")] },
    kodesh: { kind: "קודש הקודשים", name: "קודש הקודשים",
      rows: [["חלל", "20 × 20, גובה 40 אמות"], ["אמה טרקסין", "אמה בין הקודש לקודש הקודשים"], ["אבן השתייה", "שלוש אצבעות מעל הרצפה"]],
      src: [SS("src", "שתי פרוכות וביניהן אמה; החיצונה פרופה מן הדרום והפנימית מן הצפון (יומא ה א)"),
        SS("src", "״אבן היתה שם מימות נביאים ראשונים... גבוהה מן הארץ שלש אצבעות״ (יומא ה ב); במערבו (רמב״ם ד א)"),
        SS("src", "״וימד איל הפתח שתים אמות, והפתח שש אמות״ (יחזקאל מא ג)"),
        SS("rec", "אבן גדולה במרכז, כשתים עשרה על שתים עשרה: הצעת לשכנו תדרשו, עמ׳ 197"),
        SS("dec", "האבן הקטנה 3 על 2, אמה מן הכותל המערבי; גובה הפתח בקיר של יחזקאל, 20, מושאל"),
        SS("art", "קפלי הפרוכת ואריגתה")] },
    taim: { kind: "תאים", name: "התאים, המסיבה ובית הורדת המים",
      rows: [["מניין", "38 במשנה, 33 ביחזקאל"], ["קומות", "3"], ["רוחב", "5, 6, 7 במשנה; 4 ומתרחב ביחזקאל"], ["המסיבה", "3 אמות בצפון, בין כתלים של 5"], ["בית הורדת המים", "3 אמות בדרום"]],
      src: [SS("src", "חמשה על גבי חמשה וחמשה על גביהם בצפון ובדרום, ושלשה על גבי שלשה ושנים על גביהם במערב (מידות ד ג)"),
        SS("src", "״והצלעות צלע אל צלע שלוש ושלשים פעמים״ (יחזקאל מא ו)"),
        SS("src", "התחתונה חמש, והתיכונה שש, והעליונה שבע: הכותל נסוג אמה בכל קומה (מידות ד ד; מלכים א ו ו)"),
        SS("src", "מסבה עולה מקרן מזרחית צפונית לקרן צפונית מערבית, שבה עולים לגגות התאים (מידות ד ה)"),
        SS("dec", "גגות התאים במפלס העלייה: שלוש קומות של 15; או חמש אמות לקומה, כבית ראשון"),
        SS("art", "עובי התקרות והמחיצות שבין התאים, מידת הפתחים והחלונות")] },
    steps: { kind: "מעלות", name: "שתים עשרה מעלות האולם",
      rows: [["מניין", "12"], ["רום", "חצי אמה כל אחת, 6 בסך הכול, כגובה האוטם"], ["רוחב הגרם", "30 אמות, הנחת עבודה"]],
      src: [SS("src", "ושתים עשרה מעלות היו שם, רום מעלה חצי אמה, ושלחה אמה, ורבדים (מידות ג ו)"),
        SS("src", "רום כל מעלה חצי אמה ושלחה חצי אמה (רמב״ם בית הבחירה ו ד)"),
        SS("rec", "במה מדורגת העולה משלושה צדדים, כמו בדגם מקדש יחזקאל של הרב מקובר"),
        SS("dec", "רוחב הגרם ומידת החזרות שבצדדים"), SS("art", "בסיסי העמודים שעל המעלות")] },
    roof: { kind: "גג", name: "העלייה והגג",
      rows: [["גובה", "100 אמות מן הרחבה שלפני המעלות"], ["העלייה", "40 אמות, מעל תקרה של 5"], ["מעקה", "3 אמות (רבי יהודה: 4)"], ["כלה עורב", "אמה, על המעקה סביב כל הגג"]],
      src: [SS("src", "האוטם 6, הבית 40, כיור, בית דלפה, תקרה ומעזיבה, העלייה 40, וכן, מעקה 3 וכלה עורב אמה (מידות ד ו)"),
        SS("src", "״טס של ברזל כמו סיף, גבהו אמה, על גבי המעקה סביב, כדי שלא ינוחו עליו העופות״ (רמב״ם ד ג)"),
        SS("src", "פתח העלייה בדרום, ושני כלונסות של ארז; ראשי פספסין מבדילים בעלייה, ולולין פתוחים לקודש הקודשים (מידות ד ה)"),
        SS("rec", "שלושת השחזורים שנבדקו מציגים שיניים מוזהבות על שפת הגג"),
        SS("art", "מספר השיניים, הכרכוב, עובי המעקה ומידת פתח העלייה")] },
    pillar: free => ({ kind: "עמוד", name: free ? "עמוד לפני אילי האולם" : "עמוד צמוד לחזית",
      rows: [["קומה", "18 אמות"], ["קוטר", "3.82 אמות, מחוט של 12"], ["כותרת", "5 אמות"]],
      src: [SS("src", "״ועמדים אל האילים אחד מפה ואחד מפה״ (יחזקאל מ מט): מניין בלי צורה ובלי מידה"),
        SS("rec", "המידות מיכין ובועז, מלכים א ז טו–טז, כהשאלה מבית ראשון"),
        SS("dec", free ? "עומדים על בסיסים שעולים עד רצפת האולם" : "חצי עמוד צמוד לכותל"), SS("art", "צורת הכותרת והטבעות")] }),
  };

  /* ---------- the cuts ---------- */
  // open: a dollhouse, the south side and everything above the hall's ceiling taken off behind the face;
  // section: only the south side, every height kept; plan, aliyah-plan: horizontal cuts
  const HIDE = { none: [], open: ["s", "t", "a"], section: ["s"], plan: ["p0"], "aliyah-plan": ["p1"] };
  function setCut(root, mode){
    if (!HIDE[mode]) throw new Error(`heichal.js: no cut "${mode}"`);
    const hide = new Set(HIDE[mode]), open = mode === "open";
    root.traverse(o => { const c = o.userData.cut; if (!c) return; o.visible = c.includes("o") ? open : !c.some(f => hide.has(f)); });
    if (root.userData.heichal) root.userData.heichal.cut = mode;
  }

  /* ---------- TempleScene.build learns the option house ---------- */
  const coreBuild = TS.build;
  TS.build = function (data, options){
    const opts = options || {};
    const root = coreBuild(data, opts);
    if (opts.house === "arch") buildArch(root, data, opts);
    else if (opts.house && opts.house !== "block") throw new Error(`TempleScene.build: house must be "block" or "arch", not "${opts.house}"`);
    if (root.userData.heichal) setCut(root, "none");
    return root;
  };
  global.TempleHeichal = { version: "2026-10-02", setCut, cuts: Object.keys(HIDE), options: OPT, ART };
})(typeof window !== "undefined" ? window : this);

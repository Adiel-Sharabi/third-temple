/* 3D/Scene/vessels.js — the Temple's vessels (כלי המקדש), one source for every page that shows them.
 *
 * A classic script for three.js r147 used as the global THREE (no bundler); load materials.js
 * first. Defines the global TempleVessels:
 *
 *   const g = TempleVessels.build(kind, opts, dimFn, mm [, materials]);   // a THREE.Group
 *   TempleVessels.applyOptions(g, opts);                                    // no rebuild
 *   const vs = TempleVessels.inScene(data, { materials });                 // in a TempleScene (the site):
 *   TempleScene.build(data, { house: "arch", hooks: vs.hooks }); vs.attach(root);   // see inScene below
 *
 * kind     one of TempleVessels.KINDS: menorah, table, incense-altar, ulam-table-marble,
 *          ulam-table-gold, ark-outline, laver, and ark-hiding-marker (the Shekalim marker).
 * opts     the current option values, the kl-* keys of vessels-options.json. A missing key
 *          takes its default (TempleVessels.DEFAULTS, which a test holds equal to the JSON).
 * dimFn    dimFn(id) -> the numeric value of a mikdash-dimensions.json id; it throws if the id is
 *          missing. Every size is read through it. The unit of each id (cubit, handbreadth, finger,
 *          count) is TempleVessels.UNITS[id], held equal to the JSON's "unit" by a test.
 * mm       millimetres per cubit. The handbreadth is a sixth of the cubit (Rambam, Beit
 *          HaBechira 2:6), the finger a quarter of the handbreadth.
 * materials  optional: a TempleMaterials.create() set; the vessels' own materials are added to
 *          it with TempleMaterials.vessels(). Without it one set per mm is made and cached.
 *
 * The local origin is the centre of the vessel's floor footprint (the menorah: its shaft), Y up,
 * +X east, +Z south, as in scene-core.js. A vessel is built facing the way it stands in the
 * house: the table's length runs east-west ("כל הכלים שהיו במקדש ארכן לארכו של בית", Menachot
 * 11:6), the ark's across (Rambam 3:12). Place it with TempleVessels.layout().
 *
 * Every variant of an open question is built, and its parts carry userData.tags, e.g.
 * {"kl-menorah-branches": "arcs"}. applyOptions shows one set; TempleScene.applyOptions does the
 * same if it is given every kl-* key. A value with no geometry of its own (e.g. kl-ark
 * "stone-only") still has an empty tagged group, so a scene inventory lists every value.
 *
 * g.userData = {id, kind, dims, label_he, pick, labels}: dims are the ids read while building
 * plus the descriptive ids that govern the vessel; pick holds the invisible click box(es) with
 * userData.info = {kind, name, rows, src}; labels are anchors with userData.label = {text, sub}.
 *
 * Shapes the sources leave open follow no confirmed reconstruction (none was found, see
 * Vault/02-Research/01-מקורות/כלי המקדש - מידות, מקומות ומקורות.md); each is an option, labelled
 * as what it follows or as the project's visual choice. Claude Code, 2026-10-02.
 */
(function (global) {
  "use strict";

  const KINDS = ["menorah", "table", "incense-altar", "ulam-table-marble", "ulam-table-gold", "ark-outline", "laver", "ark-hiding-marker"];

  // What shows first. Equal to the "default" of every entry in vessels-options.json (tested).
  const DEFAULTS = {
    "kl-menorah-lamps": "ns", "kl-menorah-branches": "arcs", "kl-menorah-base": "legs", "kl-material": "metal",
    "kl-table-size": "rmeir", "kl-showbread-gap": "rambam", "kl-showbread-shape": "rambam", "kl-table-frame": "below",
    "kl-vessels-place": "inner-third", "kl-incense-altar": "torah", "kl-ark": "stone-only", "kl-ark-hiding": "none",
    "kl-ulam-tables": "marble-north", "kl-rings": "6x4", "kl-mukhni": "pit",
  };

  // The unit of every id this file reads (the JSON's "unit": none = cubit, טפח, אצבע, מניין).
  const UNITS = {
    "menorah-height": "tefach", "menorah-branch-tops": "tefach", "menorah-branches": "count", "menorah-lamps": "count",
    "menorah-cups": "count", "menorah-knobs": "count", "menorah-flowers": "count", "menorah-legs": "count",
    "menorah-step-stone": "count", "menorah-zone-base": "tefach", "menorah-zone-ornament": "tefach",
    "menorah-ornament-low-z": "tefach", "menorah-branch-knob-1-z": "tefach", "menorah-branch-knob-2-z": "tefach",
    "menorah-branch-knob-3-z": "tefach", "menorah-zone-top-z": "tefach", "menorah-zone-top": "tefach",
    "md-kl-menorah-branch-pitch": "tefach", "md-kl-menorah-stem": "tefach", "md-kl-menorah-foot": "tefach",
    "md-kl-menorah-lamp": "tefach", "md-kl-menorah-step-rise": "tefach", "md-kl-menorah-step-tread": "tefach",
    "md-kl-menorah-step-width": "tefach", "md-kl-menorah-step-gap": "tefach",
    "shulchan-length-torah": "cubit", "shulchan-width-torah": "cubit", "shulchan-height-torah": "cubit",
    "shulchan-length-rmeir": "tefach", "shulchan-width-rmeir": "tefach", "shulchan-length-ryehuda": "tefach",
    "shulchan-width-ryehuda": "tefach", "shulchan-misgeret": "tefach",
    "lechem-count": "count", "lechem-per-seder": "count", "lechem-length": "tefach", "lechem-width": "tefach",
    "lechem-keranot": "etzba", "lechem-fold-rmeir": "tefach", "lechem-fold-ryehuda": "tefach", "lechem-gap-rmeir": "tefach",
    "lechem-kanim": "count", "lechem-snifin": "count", "lechem-bezichin": "count",
    "md-kl-table-top": "tefach", "md-kl-table-leg": "tefach", "md-kl-table-frame-drop": "tefach", "md-kl-table-zer": "tefach",
    "md-kl-lechem-sheet": "etzba", "md-kl-kaneh": "tefach", "md-kl-bezich": "tefach", "md-kl-bezich-height": "tefach",
    "mizbach-zahav-plan": "cubit", "mizbach-zahav-height": "cubit", "mizbach-zahav-horns": "count",
    "md-kl-incense-horn": "tefach", "md-kl-incense-zer": "tefach", "ez-wood-altar-height": "cubit", "ez-wood-altar-length": "cubit",
    "md-kl-ulam-table-length": "cubit", "md-kl-ulam-table-width": "cubit", "md-kl-ulam-table-height": "cubit",
    "ulam-tables": "count",
    "aron-length": "cubit", "aron-width": "cubit", "aron-height": "cubit", "aron-bayit-sheni": "count",
    "even-shetiya-height": "etzba", "md-kl-kaporet-thickness": "tefach", "md-kl-hiding-depth": "cubit",
    "md-laver-radius": "cubit", "kiyor-spouts": "count", "kiyor-spouts-before": "count",
    "md-kl-laver-stand": "cubit", "md-kl-laver-basin": "cubit", "md-kl-mukhni-wheel": "cubit", "md-kl-mukhni-pit": "cubit",
    "hk-kodesh-length": "cubit", "hk-kodesh-width": "cubit", "heichal-kelim-third": "cubit", "heichal-opening-width": "cubit",
    "md-kl-wall-offset": "cubit", "md-kl-altar-outward": "cubit", "md-kl-ulam-table-wall-gap": "cubit",
    "md-kl-ulam-table-door-gap": "cubit",
  };
  const PER_CUBIT = { cubit: 1, tefach: 6, etzba: 24 };

  // Descriptive (non-numeric) ids that govern each vessel, listed in userData.dims for the site.
  const DESCRIPTIVE = {
    "menorah": ["menorah-material", "menorah-position", "menorah-orientation-rambam", "menorah-orientation-ew",
      "menorah-branch-knobs-z", "menorah-span", "menorah-branch-shape", "menorah-weight", "menorah-other-metal", "kelim-metal-only"],
    "table": ["shulchan-position", "shulchan-orientation", "lechem-shape-rambam", "kelim-metal-only", "kelim-poor-rich"],
    "incense-altar": ["mizbach-zahav-material", "mizbach-zahav-position", "kelim-metal-only", "heichal-kelim-third"],
    "ulam-table-marble": ["ulam-tables-position", "tables-total"],
    "ulam-table-gold": ["ulam-tables-position", "tables-total"],
    "ark-outline": ["kaporet-plan", "even-shetiya-position"],
    "laver": ["kiyor-material", "kiyor-size", "kiyor-mukhni", "kiyor-position"],
    "ark-hiding-marker": [],
  };

  const S = (tag, text) => ({ tag, text });   // a source line, as in scene-core: src | rec | dec | art

  /* ---------------- shared ---------------- */
  const matCache = {};
  function materialsFor(mm, given){
    const M = given || matCache[mm] || (matCache[mm] = TempleMaterials.create({ mm }));
    return TempleMaterials.vessels(M, mm);
  }

  function applyOptions(object3d, opts){
    const opt = Object.assign({}, DEFAULTS, opts || {});
    object3d.traverse(o => { const t = o.userData.tags; if (t) o.visible = Object.entries(t).every(([k, v]) => opt[k] === v); });
  }

  // The tool set for one build: unit-aware dimension reads, and mesh helpers in mm.
  function kit(dimFn, mm, M){
    const used = new Set();
    const raw = id => {
      if (!(id in UNITS)) throw new Error(`vessels: "${id}" has no unit in TempleVessels.UNITS`);
      used.add(id);
      const v = dimFn(id);
      if (typeof v !== "number" || !isFinite(v)) throw new Error(`vessels: dimension "${id}" is not a number`);
      return v;
    };
    const cu = id => raw(id) / (PER_CUBIT[UNITS[id]] || NaN);          // cubits (a count has no length)
    const n = id => { if (UNITS[id] !== "count") throw new Error(`vessels: "${id}" is not a count`); return raw(id); };
    const C = c => c * mm, TF = t => t * mm / 6;                         // cubits, handbreadths -> mm
    const MAT = M.MAT;
    function mesh(geo, mat, parent, x, y, z){
      const m = new THREE.Mesh(geo, typeof mat === "string" ? MAT[mat] : mat);
      m.position.set(x || 0, y || 0, z || 0); m.castShadow = m.receiveShadow = true;
      if (parent) parent.add(m); return m;
    }
    // an axis-aligned box from its extents, mm
    function box(parent, mat, x0, x1, y0, y1, z0, z1){
      return mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), mat, parent, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    }
    // a turned profile: pts = [[radius, height], ...] in mm
    function lathe(pts, segs){ return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), segs || 32); }
    function tube(points, radius, segs){
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
      return new THREE.TubeGeometry(curve, segs || 64, radius, 14, false);
    }
    function part(parent, name, tags){
      const g = new THREE.Group(); g.name = name + (tags ? Object.entries(tags).map(([k, v]) => `|${k}=${v}`).join("") : "");
      if (tags) g.userData.tags = Object.assign({}, tags);
      parent.add(g); return g;
    }
    function label(parent, x, y, z, text, sub){
      const o = new THREE.Object3D(); o.position.set(x, y, z); o.userData.label = { text, sub: sub || "" }; parent.add(o); return o;
    }
    // a dashed outline of a box, mm (the ark, the hiding places)
    function ghostBox(parent, w, h, d, x, y, z){
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), M.LINE.ghostDash);
      e.computeLineDistances(); e.position.set(x, y, z); parent.add(e);
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.ghostFill); f.position.set(x, y, z); f.renderOrder = 2; parent.add(f);
      return e;
    }
    function ghostLine(parent, pts, dashed, below){        // below: under the floor, drawn through it
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), below ? M.LINE.ghostXray : dashed ? M.LINE.ghostDash : M.LINE.ghost);
      if (dashed || below){ l.computeLineDistances(); l.renderOrder = 3; } parent.add(l); return l;
    }
    /* A box whose face at +X (or +Z) has a recessed window showing a wood core under a thin gold
       skin: the visible difference between kl-material "metal" and "wood-gilded". Builds both
       variants, tagged. Extents in mm; win = [a0, a1, y0, y1] on that face (a = z for +X, x for +Z). */
    function gildedBox(parent, x0, x1, y0, y1, z0, z1, face, win, skin){
      const s = skin;
      if (face === "+x"){
        box(parent, "vgold", x0, x1 - s, y0, y1, z0, z1);
        const metal = part(parent, "skin", { "kl-material": "metal" });
        box(metal, "vgold", x1 - s, x1, y0, y1, z0, z1);
        const wood = part(parent, "cut", { "kl-material": "wood-gilded" });
        const [a0, a1, w0, w1] = win;
        box(wood, "vgold", x1 - s, x1, y0, w0, z0, z1); box(wood, "vgold", x1 - s, x1, w1, y1, z0, z1);
        box(wood, "vgold", x1 - s, x1, w0, w1, z0, a0); box(wood, "vgold", x1 - s, x1, w0, w1, a1, z1);
        box(wood, "wood", x1 - s * 1.5, x1 - s * .55, w0, w1, a0, a1);
      } else {
        box(parent, "vgold", x0, x1, y0, y1, z0, z1 - s);
        const metal = part(parent, "skin", { "kl-material": "metal" });
        box(metal, "vgold", x0, x1, y0, y1, z1 - s, z1);
        const wood = part(parent, "cut", { "kl-material": "wood-gilded" });
        const [a0, a1, w0, w1] = win;
        box(wood, "vgold", x0, x1, y0, w0, z1 - s, z1); box(wood, "vgold", x0, x1, w1, y1, z1 - s, z1);
        box(wood, "vgold", x0, a0, w0, w1, z1 - s, z1); box(wood, "vgold", a1, x1, w0, w1, z1 - s, z1);
        box(wood, "wood", a0, a1, w0, w1, z1 - s * 1.5, z1 - s * .55);
      }
    }
    /* The invisible click box. Round what shows by default; or, with `within` (an option's part),
       round that part, and put the box inside it so it shows and hides with it. */
    function pickBox(g, info, within){
      const b = new THREE.Box3(), sz = new THREE.Vector3(), c = new THREE.Vector3(), host = within || g;
      host.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(host.matrixWorld).invert();
      const shown = o => { if (within) return true; for (let p = o; p && p !== g.parent; p = p.parent) if (!p.visible) return false; return true; };
      host.traverse(o => { if (o.isMesh && o.material !== M.PROXY && shown(o)){
        o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))); } });
      if (b.isEmpty()) b.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
      b.getSize(sz); b.getCenter(c);
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sz.x, 1e-3), Math.max(sz.y, 1e-3), Math.max(sz.z, 1e-3)), M.PROXY);
      m.position.copy(c); m.userData.info = info; m.userData.component = g.userData.id; m.userData.pickOnly = true;
      host.add(m); return m;
    }
    return { raw, cu, n, C, TF, MAT, M, mesh, box, lathe, tube, part, label, ghostBox, ghostLine, gildedBox, pickBox, used, mm };
  }

  /* ---------------- the menorah ---------------- */
  // The three ornaments, after Rambam 3:9 (profiles in mm, base at y = 0).
  function cupGeo(K, h, R){   // "כוסות אלכסנדריאה שפיהן רחב ושוליהן קצר": a wide mouth, a narrow foot
    return K.lathe([[R * .22, 0], [R * .26, h * .08], [R * .42, h * .35], [R * .7, h * .7], [R * .93, h * .93], [R, h],
                    [R * .9, h * .99], [R * .7, h * .86], [R * .45, h * .7], [0, h * .66]], 28);
  }
  function knobGeo(K, h, R){  // "כמין תפוחים כרותיים... כביצה": an egg, fuller below
    const pts = [];
    for (let i = 0; i <= 16; i++){ const t = i / 16 * Math.PI, y = h / 2 - Math.cos(t) * h / 2; pts.push([Math.sin(t) * R * (1 + .12 * Math.cos(t)), y]); }
    return K.lathe(pts, 28);
  }
  function flowerGeo(K, h, R){ // "כמין קערה ושפתה כפולה לחוץ": a bowl whose lip is folded outward
    return K.lathe([[R * .2, 0], [R * .32, h * .15], [R * .62, h * .5], [R * .8, h * .78], [R * .9, h * .95], [R * 1.08, h],
                    [R * 1.2, h * .9], [R * 1.12, h * .8], [R * .95, h * .88], [R * .74, h * .82], [0, h * .76]], 28);
  }

  function buildMenorah(K, root){
    const { cu, n, TF, C } = K;
    const H = cu("menorah-height"), T = H * 6;                               // 18 handbreadths
    if (cu("menorah-branch-tops") !== H) throw new Error("vessels: the branches must rise to the menorah's height (Rambam 3:10)");
    const nb = n("menorah-branches"), nl = n("menorah-lamps");
    if (nb !== 6 || nl !== nb + 1) throw new Error("vessels: the menorah has six branches and seven lamps");
    const t = id => cu(id) * 6;                                               // handbreadths
    const zBase = t("menorah-zone-base"), zOne = t("menorah-zone-ornament"), zLow = t("menorah-ornament-low-z");
    const zKnobs = [t("menorah-branch-knob-1-z"), t("menorah-branch-knob-2-z"), t("menorah-branch-knob-3-z")];
    const zTop = t("menorah-zone-top-z"), topZone = t("menorah-zone-top");
    if (Math.abs(zTop + topZone - T) > 1e-9) throw new Error("vessels: the height breakdown of Rambam 3:10 must add up to the menorah's height");
    const pitch = t("md-kl-menorah-branch-pitch"), stem = t("md-kl-menorah-stem"), foot = t("md-kl-menorah-foot"), lampL = t("md-kl-menorah-lamp");
    const zTurn = zKnobs[2] + zOne / 2 + pitch;                              // where every branch turns upward
    const counts = { cup: 0, knob: 0, flower: 0 };
    const orn = (g, kind, geo, x, y, z) => { const m = K.mesh(geo, "vgold", g, x, y, z); m.userData.ornament = kind; counts[kind]++; return m; };

    // Ornament sizes, handbreadths. The top zone holds three cups, a knob and a flower, in that order.
    const rStem = stem / 2, rBr = stem * .35;
    const cupH = topZone * .2, knobH = topZone * .2, flH = topZone * .2 - .02;
    const G = { cupT: cupGeo(K, TF(cupH), TF(stem * .95)), knobT: knobGeo(K, TF(knobH), TF(stem * .78)), flT: flowerGeo(K, TF(flH), TF(stem * .9)),
                cupB: cupGeo(K, TF(cupH), TF(stem * .8)), knobB: knobGeo(K, TF(knobH), TF(stem * .66)), flB: flowerGeo(K, TF(flH), TF(stem * .76)) };
    // the head of a shaft or branch: three cups, a knob, a flower, from zTop up to the top
    function head(g, x, big){
      let y = zTop;
      for (let i = 0; i < 3; i++){ orn(g, "cup", big ? G.cupT : G.cupB, TF(x), TF(y), 0); y += cupH; }
      orn(g, "knob", big ? G.knobT : G.knobB, TF(x), TF(y), 0); y += knobH;
      orn(g, "flower", big ? G.flT : G.flB, TF(x), TF(y + (T - y - flH)), 0);
    }

    // one menorah in its own plane (branches along local X, front toward local +Z)
    const body = new THREE.Group(); body.name = "menorah-body";
    const fixed = K.part(body, "shaft");
    // the shaft, from the base up to the top flower
    K.mesh(new THREE.CylinderGeometry(TF(rStem), TF(rStem * 1.08), TF(T - zBase + .6), 20), "vgold", fixed, 0, TF((T + zBase - .6) / 2), 0);
    // the base zone: legs or a stepped base, and the flower by the thigh (the ninth flower, Rambam 3:3)
    orn(fixed, "flower", flowerGeo(K, TF(zBase * .2), TF(stem * .95)), 0, TF(zBase * .8), 0);
    const legs = K.part(body, "base-legs", { "kl-menorah-base": "legs" });
    const nLegs = n("menorah-legs");
    for (let i = 0; i < nLegs; i++){
      const a = Math.PI / 2 + Math.PI * 2 * i / nLegs + Math.PI;            // one leg behind, two toward the front
      const ca = Math.cos(a), sa = Math.sin(a), P = [];
      for (let k = 0; k <= 10; k++){
        const s = k / 10, r = foot * (.06 + .94 * Math.pow(s, .85)), y = zBase * .82 * (1 - s) * (1 - s * .15) + .18 * Math.sin(Math.PI * s) * zBase * .3;
        P.push(new THREE.Vector3(TF(r * ca), TF(y + .12), TF(r * sa)));
      }
      K.mesh(K.tube(P, TF(stem * .4), 40), "vgold", legs);
      K.mesh(new THREE.SphereGeometry(TF(stem * .62), 16, 10), "vgold", legs, TF(foot * ca), TF(.2), TF(foot * sa)).scale.set(1.2, .55, 1.2);
    }
    K.mesh(new THREE.SphereGeometry(TF(stem * .9), 20, 14), "vgold", legs, 0, TF(zBase * .74), 0).scale.set(1, .7, 1);   // where the legs meet
    const based = K.part(body, "base-stepped", { "kl-menorah-base": "stepped-base" });
    const hexa = (r0, r1, h) => new THREE.CylinderGeometry(TF(r1), TF(r0), TF(h), 6);
    const tiers = [[foot, foot * .96, zBase * .3], [foot * .74, foot * .7, zBase * .26], [foot * .42, foot * .3, zBase * .22]];
    let yb = 0;
    tiers.forEach(([r0, r1, h], i) => {
      K.mesh(hexa(r0, r1, h), i === 1 ? "vgoldSoft" : "vgold", based, 0, TF(yb + h / 2), 0).rotation.y = Math.PI / 6;
      K.mesh(hexa(r0 * 1.02, r0 * 1.02, h * .12), "vgold", based, 0, TF(yb + h * .06), 0).rotation.y = Math.PI / 6;   // a plinth band
      yb += h;
    });
    // the lower ornament zone (5 to 6 handbreadths): a cup, a knob and a flower
    {
      const g = fixed; let y = zLow; const h = zOne / 3;
      orn(g, "cup", cupGeo(K, TF(h), TF(stem * .95)), 0, TF(y), 0); y += h;
      orn(g, "knob", knobGeo(K, TF(h), TF(stem * .8)), 0, TF(y), 0); y += h;
      orn(g, "flower", flowerGeo(K, TF(h), TF(stem * .9)), 0, TF(y), 0);
    }
    // the three knobs the branches come out of
    const knobBig = knobGeo(K, TF(zOne * .8), TF(stem * .95));
    zKnobs.forEach(z => orn(fixed, "knob", knobBig, 0, TF(z + zOne * .1), 0));
    // the shaft's own head
    head(fixed, 0, true);
    // the six branches: pair i (1 inner .. 3 outer) leaves the knob zKnobs[3 - i] and rises to x = i * pitch
    const arcs = K.part(body, "branches-arcs", { "kl-menorah-branches": "arcs" });
    const straight = K.part(body, "branches-straight", { "kl-menorah-branches": "straight" });
    const tops = K.part(body, "branch-tops");
    for (let i = 1; i <= 3; i++){
      const zk = zKnobs[3 - i] + zOne / 2, r = i * pitch, dz = zTurn - zk;
      for (const side of [-1, 1]){
        const A = [], B = [];
        for (let k = 0; k <= 24; k++){                                       // a quarter ellipse: out from the shaft, then up
          const th = k / 24 * Math.PI / 2;
          A.push(new THREE.Vector3(TF(side * r * Math.sin(th)), TF(zTurn - dz * Math.cos(th)), 0));
        }
        A.push(new THREE.Vector3(TF(side * r), TF(zTurn + .25), 0));
        K.mesh(K.tube(A, TF(rBr), 56), "vgold", arcs);
        for (let k = 0; k <= 6; k++) B.push(new THREE.Vector3(TF(side * r * k / 6), TF(zk + dz * k / 6), 0));
        B.push(new THREE.Vector3(TF(side * r), TF(zTurn + .02), 0));
        K.mesh(new THREE.TubeGeometry(new THREE.LineCurve3(B[0], B[6]), 4, TF(rBr), 14, false), "vgold", straight);
        K.mesh(new THREE.SphereGeometry(TF(rBr), 14, 10), "vgold", straight, TF(side * r), TF(zTurn), 0);   // the elbow
        // the upright: from the turn up to the head, then the head itself
        K.mesh(new THREE.CylinderGeometry(TF(rBr), TF(rBr), TF(T - zTurn - .3), 14), "vgold", tops, TF(side * r), TF((T + zTurn - .3) / 2), 0);
        head(tops, side * r, false);
      }
    }
    // the seven lamps: the six face the middle one, the middle one faces west (Rambam 3:8)
    const lamps = K.part(body, "lamps");
    const lampGeo = new THREE.SphereGeometry(TF(lampL * .32), 20, 12), nozGeo = new THREE.CylinderGeometry(TF(lampL * .07), TF(lampL * .13), TF(lampL * .42), 12);
    const flameGeo = new THREE.SphereGeometry(TF(lampL * .075), 12, 10); flameGeo.translate(0, TF(lampL * .075), 0);
    const lampsAt = [];
    for (let i = -3; i <= 3; i++){
      const L = new THREE.Group(); L.position.set(TF(i * pitch), TF(T + .02), 0); L.userData.lamp = i; lamps.add(L);
      K.mesh(lampGeo, "vgold", L, 0, TF(lampL * .1), 0).scale.set(1.25, .45, 1);
      const nz = K.mesh(nozGeo, "vgold", L, TF(lampL * .42), TF(lampL * .14), 0); nz.rotation.z = -Math.PI / 2 + .22;
      const fl = K.mesh(flameGeo, "flame", L, TF(lampL * .6), TF(lampL * .3), 0); fl.scale.set(.8, 2.2, .8); fl.castShadow = false;
      lampsAt.push(L);
    }
    // the stone with three steps in front of the menorah (Tamid 3:9; Rambam 3:11)
    const steps = K.part(body, "step-stone");
    const ns = n("menorah-step-stone"), rise = t("md-kl-menorah-step-rise"), tread = t("md-kl-menorah-step-tread"), sw = t("md-kl-menorah-step-width");
    const z0 = foot + t("md-kl-menorah-step-gap");
    for (let k = 0; k < ns; k++)                                             // the top step nearest the menorah
      K.box(steps, "vmarble", TF(-sw / 2), TF(sw / 2), 0, TF(rise * (ns - k)), TF(z0 + k * tread), TF(z0 + (k + 1) * tread));
    return { body, counts, lampsAt, H, T, pitch, foot, zTurn };
  }

  function menorah(K, g){
    const B = buildMenorah(K, g);
    for (const [k, id] of [["cup", "menorah-cups"], ["knob", "menorah-knobs"], ["flower", "menorah-flowers"]])
      if (B.counts[k] !== K.n(id)) throw new Error(`vessels: ${B.counts[k]} ${k}s on the menorah, the sources give ${K.n(id)} (Rambam 3:3)`);
    // two orientations of the row of lamps; the front (and the stone) faces east, or north
    const ROT = { ns: Math.PI / 2, ew: Math.PI };
    for (const [val, phi] of Object.entries(ROT)){
      const o = K.part(g, "orientation", { "kl-menorah-lamps": val });
      const b = val === "ns" ? B.body : B.body.clone();
      // set all three angles: a clone copies the quaternion, and its Euler angles come back as (pi, y, pi)
      b.rotation.set(0, phi, 0); o.add(b);
      b.traverse(x => { if (x.userData.lamp !== undefined) x.rotation.set(0, x.userData.lamp === 0 ? Math.PI - phi : (x.userData.lamp > 0 ? Math.PI : 0), 0); });
    }
    K.label(g, 0, K.TF(B.T + 2.2), 0, "המנורה", "18 טפחים");
    const c = B.counts;
    return {
      label_he: "המנורה",
      info: { kind: "כלי", name: "המנורה", rows: [["גובה", "18 טפחים (3 אמות)"], ["קנים ונרות", "6 קנים מצדיה, 7 נרות"],
        ["גביעים · כפתורים · פרחים", `${c.cup} · ${c.knob} · ${c.flower}`], ["רוחב", `${B.pitch * 6} טפחים בין הנרות הקיצוניים — בחירת הדמיה`]],
        src: [S("src", "רמב״ם בית הבחירה ג,א–יא; שמות כה,לא–מ"), S("src", "פירוט הגובה: רמב״ם בית הבחירה ג,י"),
              S("dec", "צורת הקנים, הבסיס, הנרות והמרווח: בחירת הדמיה של הפרויקט, ראו האפשרויות"), S("rec", "האבן ושלוש מעלותיה: תמיד ג,ט")] },
      counts: c,
    };
  }

  /* ---------------- the table of showbread ---------------- */
  function table(K, g){
    const { cu, n, TF } = K;
    const t = id => cu(id) * 6;                                               // handbreadths (the fixed handbreadth)
    const torahL = cu("shulchan-length-torah"), torahW = cu("shulchan-width-torah"), torahH = cu("shulchan-height-torah");
    const SIZES = { rmeir: [t("shulchan-length-rmeir"), t("shulchan-width-rmeir"), t("lechem-fold-rmeir")],
                    ryehuda: [t("shulchan-length-ryehuda"), t("shulchan-width-ryehuda"), t("lechem-fold-ryehuda")] };
    const lL = t("lechem-length"), lW = t("lechem-width"), keranot = cu("lechem-keranot") * 6;
    const nLoaves = n("lechem-count"), perSeder = n("lechem-per-seder"), nKanim = n("lechem-kanim"), nSnifin = n("lechem-snifin"), nBez = n("lechem-bezichin");
    if (nLoaves !== 2 * perSeder) throw new Error("vessels: twelve loaves in two rows of six");
    const top = t("md-kl-table-top"), leg = t("md-kl-table-leg"), drop = t("md-kl-table-frame-drop"), zer = t("md-kl-table-zer");
    const frame = t("shulchan-misgeret"), sheet = cu("md-kl-lechem-sheet") * 6, rod = t("md-kl-kaneh");
    const bezD = t("md-kl-bezich"), bezH = t("md-kl-bezich-height"), gapRmeir = t("lechem-gap-rmeir");
    const info = {};
    for (const [size, [TL, TW, fold]] of Object.entries(SIZES)){
      const tpc = TL / torahL;                                               // handbreadths in this tanna's cubit: 6 or 5
      if (Math.abs(TW / torahW - tpc) > 1e-9) throw new Error("vessels: the table's length and width must use one cubit");
      const H = torahH * tpc;                                                // the Torah's 1.5 cubits, in handbreadths
      if (Math.abs((lL - TW) / 2 - fold) > 1e-9) throw new Error(`vessels: the loaf's fold (${size}) must be (loaf length - table width) / 2 (Menachot 11:5)`);
      const gap = TL - 2 * lW;
      if (size === "rmeir" && Math.abs(gap - gapRmeir) > 1e-9) throw new Error("vessels: Rabbi Meir's gap must be the table length less two loaves");
      const S_ = K.part(g, "size", { "kl-table-size": size });
      const x0 = -TL / 2, x1 = TL / 2, z0 = -TW / 2, z1 = TW / 2, yTop = H - top;
      // the top, with its gold crown (zer) round the edge
      K.box(S_, "vgold", TF(x0), TF(x1), TF(yTop), TF(H), TF(z0), TF(z1));
      const zz = .14;
      [[x0 - zz, x1 + zz, z0 - zz, z0], [x0 - zz, x1 + zz, z1, z1 + zz], [x0 - zz, x0, z0, z1], [x1, x1 + zz, z0, z1]].forEach(([a, b, c, d]) =>
        K.box(S_, "vgold", TF(a), TF(b), TF(H - zer), TF(H), TF(c), TF(d)));
      // the legs; the south-east one shows the material (kl-material) in a cut-away window
      [[x0, z0], [x1 - leg, z0], [x0, z1 - leg], [x1 - leg, z1 - leg]].forEach(([lx, lz], i) => {
        const L = K.part(S_, "leg");
        if (i === 3) K.gildedBox(L, TF(lx), TF(lx + leg), 0, TF(yTop), TF(lz), TF(lz + leg), "+z", [TF(lx + leg * .22), TF(lx + leg * .78), TF(yTop * .3), TF(yTop * .62)], TF(.09));
        else K.box(L, "vgold", TF(lx), TF(lx + leg), 0, TF(yTop), TF(lz), TF(lz + leg));
        K.box(L, "vgoldSoft", TF(lx - .08), TF(lx + leg + .08), 0, TF(.35), TF(lz - .08), TF(lz + leg + .08));   // a foot
      });
      // the frame of a handbreadth: below the top between the legs, or above it as a rim
      const below = K.part(S_, "frame-below", { "kl-table-frame": "below" });
      const fy1 = yTop - drop, fy0 = fy1 - frame, ft = .25;
      [[x0 + leg, x1 - leg, z0 + leg * .5 - ft / 2, z0 + leg * .5 + ft / 2], [x0 + leg, x1 - leg, z1 - leg * .5 - ft / 2, z1 - leg * .5 + ft / 2],
       [x0 + leg * .5 - ft / 2, x0 + leg * .5 + ft / 2, z0 + leg, z1 - leg], [x1 - leg * .5 - ft / 2, x1 - leg * .5 + ft / 2, z0 + leg, z1 - leg]].forEach(([a, b, c, d]) =>
        K.box(below, "vgold", TF(a), TF(b), TF(fy0), TF(fy1), TF(c), TF(d)));
      [[x0 + leg, x1 - leg, z0 + leg * .5 - ft, z0 + leg * .5 + ft], [x0 + leg, x1 - leg, z1 - leg * .5 - ft, z1 - leg * .5 + ft]].forEach(([a, b, c, d]) =>
        K.box(below, "vgoldSoft", TF(a), TF(b), TF(fy1 - .12), TF(fy1), TF(c), TF(d)));                 // its crown
      const above = K.part(S_, "frame-above", { "kl-table-frame": "above" });
      const rt = .22;
      [[x0 - zz - rt, x1 + zz + rt, z0 - zz - rt, z0 - zz], [x0 - zz - rt, x1 + zz + rt, z1 + zz, z1 + zz + rt],
       [x0 - zz - rt, x0 - zz, z0 - zz, z1 + zz], [x1 + zz, x1 + zz + rt, z0 - zz, z1 + zz]].forEach(([a, b, c, d]) => {
        K.box(above, "vgold", TF(a), TF(b), TF(H - zer), TF(H + frame), TF(c), TF(d));
        K.box(above, "vgoldSoft", TF(a - .05), TF(b + .05), TF(H + frame - .14), TF(H + frame), TF(c - .05), TF(d + .05));
      });

      // the bread: two rows of six, each loaf laid across the table (Menachot 11:5)
      const stacks = [x0 + lW / 2, x1 - lW / 2];                             // row centres along the length
      // Rambam's loaf: an open box, a flat bottom with its ends folded up. The fold stands its full
      // length (2 handbreadths, so the dough is 6 + 2 + 2 = 10), and with a sheet one finger thick
      // the inside is seven fingers high, his reading of the Mishnah's "seven fingers" (Temidin 5:9)
      const loafRambam = (() => {
        const s = new THREE.Shape(), hw = TW / 2, f = fold, sh = sheet, rr = .25;
        s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, f - rr); s.quadraticCurveTo(hw, f, hw - rr * .6, f);
        s.lineTo(hw - sh + rr * .2, f); s.quadraticCurveTo(hw - sh, f, hw - sh, f - rr * .4); s.lineTo(hw - sh, sh);
        s.lineTo(-hw + sh, sh); s.lineTo(-hw + sh, f - rr * .4); s.quadraticCurveTo(-hw + sh, f, -hw + sh - rr * .2, f);
        s.lineTo(-hw + rr * .6, f); s.quadraticCurveTo(-hw, f, -hw, f - rr); s.lineTo(-hw, 0);
        const geo = new THREE.ExtrudeGeometry(s, { depth: lW - .16, bevelEnabled: true, bevelThickness: .08, bevelSize: .06, bevelSegments: 3, curveSegments: 8 });
        geo.translate(0, 0, -(lW - .16) / 2); geo.rotateY(Math.PI / 2); geo.scale(TF(1), TF(1), TF(1));
        return { geo, h: f };
      })();
      const loafKeranot = (() => {                                           // a slab whose four corners rise as horns
        const g2 = new THREE.Group(), hw = TW / 2, slab = .55;
        K.box(g2, "bread", TF(-lW / 2 + .05), TF(lW / 2 - .05), 0, TF(slab), TF(-hw), TF(hw));
        [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
          const h = K.mesh(new THREE.ConeGeometry(TF(.5), TF(keranot - slab * .3), 14), "bread", g2, TF(sx * (lW / 2 - .55)), TF(slab * .7 + (keranot - slab * .3) / 2), TF(sz * (hw - .55)));
          h.rotation.set(-sz * .22, 0, sx * .18);
        }));
        [-1, 1].forEach(sz => K.box(g2, "bread", TF(-lW / 2 + .4), TF(lW / 2 - .4), TF(slab * .8), TF(slab * 1.7), TF(sz * hw - (sz > 0 ? .45 : 0)), TF(sz * hw + (sz < 0 ? .45 : 0))));
        return { g: g2, h: keranot };
      })();
      for (const shape of ["rambam", "keranot"]){
        const SH = K.part(S_, "bread", { "kl-showbread-shape": shape });
        const lh = shape === "rambam" ? loafRambam.h : loafKeranot.h;
        const pitchY = lh + rod;
        let kanim = 0;
        stacks.forEach((sx, si) => {
          for (let k = 0; k < perSeder; k++){
            const y = H + k * pitchY;
            if (shape === "rambam"){ const m = K.mesh(loafRambam.geo, "bread", SH, TF(sx), TF(y), 0); m.userData.loaf = true; }
            else { const c = loafKeranot.g.clone(); c.position.set(TF(sx), TF(y), 0); c.userData.loaf = true; SH.add(c); }
            if (k === perSeder - 1) continue;
            // the rods between this loaf and the next: three, and two under the sixth (Rambam 3:15)
            const nr = k === perSeder - 2 ? 2 : 3, span = TW + 2 * 1.2;
            for (let r = 0; r < nr; r++){
              const rx = sx + (nr === 3 ? (r - 1) * lW * .3 : (r - .5) * lW * .4);
              const m = K.mesh(new THREE.CylinderGeometry(TF(rod / 2), TF(rod / 2), TF(span), 10), "vgold", SH, TF(rx), TF(y + lh + rod / 2), 0);
              m.rotation.x = Math.PI / 2; m.userData.kaneh = true; kanim++;
            }
          }
          // the forked posts, two to a row, standing on the floor north and south of the table
          for (const sz of [-1, 1]){
            const pz = sz * (TW / 2 + 1.0 + .2), yTopStack = H + (perSeder - 1) * pitchY + lh;
            const post = K.mesh(new THREE.CylinderGeometry(TF(.2), TF(.24), TF(yTopStack + .4), 12), "vgold", SH, TF(sx), TF((yTopStack + .4) / 2), TF(pz));
            post.userData.snif = true;
            K.mesh(new THREE.CylinderGeometry(TF(.45), TF(.55), TF(.25), 16), "vgoldSoft", SH, TF(sx), TF(.12), TF(pz));
            for (let k = 0; k < perSeder - 1; k++){                          // a branch at each rod level: the forks
              const yr = H + k * pitchY + lh;
              K.box(SH, "vgold", TF(sx - lW * .4), TF(sx + lW * .4), TF(yr - .16), TF(yr), TF(pz - .18), TF(pz + .18));
            }
            [-1, 1].forEach(fx => {                                         // the split head
              const p = K.mesh(new THREE.CylinderGeometry(TF(.08), TF(.14), TF(.8), 8), "vgold", SH, TF(sx + fx * .25), TF(yTopStack + .7), TF(pz));
              p.rotation.z = -fx * .5;
            });
          }
        });
        if (kanim !== nKanim) throw new Error(`vessels: ${kanim} rods, the sources give ${nKanim}`);
        // the two bowls of frankincense: on each row, or in the gap between the rows (Abba Shaul)
        const bezGeo = K.lathe([[0, 0], [bezD * .28, 0], [bezD * .36, bezH * .12], [bezD * .48, bezH * .6], [bezD * .52, bezH], [bezD * .46, bezH * .96], [bezD * .4, bezH * .5], [0, bezH * .4]].map(([r, y]) => [TF(r), TF(y)]), 28);
        const mound = new THREE.SphereGeometry(TF(bezD * .4), 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const yStack = H + (perSeder - 1) * pitchY + (shape === "rambam" ? sheet : .55);
        const bowl = (G, x, y, z) => { K.mesh(bezGeo, "vgold", G, TF(x), TF(y), TF(z)); K.mesh(mound, "incense", G, TF(x), TF(y + bezH * .45), TF(z)).scale.set(1, .5, 1); };
        const side = K.part(SH, "bezichin", { "kl-showbread-gap": "rambam" });
        stacks.forEach(sx => bowl(side, sx + Math.sign(sx) * lW * .18, yStack, 0));
        const mid = K.part(SH, "bezichin", { "kl-showbread-gap": "abba-shaul" });
        if (gap >= bezD) [-1, 1].forEach(sz => bowl(mid, 0, H, sz * TW / 4));
        else [-1, 1].forEach(sz => bowl(mid, 0, yStack, sz * TW / 4));        // no gap (Rabbi Yehuda): on the seam
        if (2 !== nBez) throw new Error("vessels: two bowls of frankincense");
      }
      info[size] = { TL, TW, H, fold, gap, tpc };
    }
    if (nSnifin !== 4) throw new Error("vessels: four forked posts");
    K.label(g, 0, K.TF(info.rmeir.H + 16), 0, "שולחן לחם הפנים", "");
    const r = info.rmeir, y = info.ryehuda;
    return {
      label_he: "שולחן לחם הפנים",
      info: { kind: "כלי", name: "שולחן לחם הפנים", rows: [["אורך × רוחב", `${r.TL} × ${r.TW} טפחים (רבי מאיר) · ${y.TL} × ${y.TW} (רבי יהודה)`],
        ["גובה", "אמה וחצי"], ["חלות", "12, שני סדרים של 6; קנים 28; סניפים 4; בזיכים 2"]],
        src: [S("src", "שמות כה,כג–ל; מנחות יא,ד–ז"), S("src", "רמב״ם בית הבחירה ג,יב–טו; רמב״ם תמידין ומוספין ה,ב–ט"),
              S("dec", "צורת הרגליים, הקנים, הסניפים והבזיכים: בחירת הדמיה של הפרויקט")] },
      sizes: info,
    };
  }

  /* ---------------- the golden (incense) altar ---------------- */
  function incenseAltar(K, g){
    const { cu, n, TF, C } = K;
    const torah = K.part(g, "torah", { "kl-incense-altar": "torah" });
    const W = cu("mizbach-zahav-plan") * 6, H = cu("mizbach-zahav-height") * 6, horn = cu("md-kl-incense-horn") * 6, zer = cu("md-kl-incense-zer") * 6;
    const nh = n("mizbach-zahav-horns");
    const w = W / 2, yRoof = H - horn;                                       // the horns rise to the full two cubits
    K.gildedBox(torah, TF(-w), TF(w), 0, TF(yRoof), TF(-w), TF(w), "+x", [TF(-w * .55), TF(w * .55), TF(H * .22), TF(H * .6)], TF(.1));
    const zo = .16;
    [[-w - zo, w + zo, -w - zo, -w], [-w - zo, w + zo, w, w + zo], [-w - zo, -w, -w, w], [w, w + zo, -w, w]].forEach(([a, b, c, d]) => {
      K.box(torah, "vgold", TF(a), TF(b), TF(yRoof - zer), TF(yRoof - zer * .25), TF(c), TF(d));             // the crown (zer)
      K.box(torah, "vgoldSoft", TF(a - .05), TF(b + .05), TF(yRoof - zer * .62), TF(yRoof - zer * .42), TF(c - .05), TF(d + .05));
    });
    K.box(torah, "vgoldSoft", TF(-w - .1), TF(w + .1), 0, TF(.3), TF(-w - .1), TF(w + .1));                   // a footing
    const hornGeo = new THREE.CylinderGeometry(TF(horn * .55 / Math.SQRT2), TF(horn / Math.SQRT2), TF(horn), 4, 1);   // a square horn, a handbreadth wide
    let horns = 0;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, nh).forEach(([sx, sz]) => {
      const m = K.mesh(hornGeo, "vgold", torah, TF(sx * (w - horn / 2)), TF(yRoof + horn / 2), TF(sz * (w - horn / 2)));
      m.rotation.y = Math.PI / 4; m.userData.horn = true; horns++;
    });
    // Ezekiel's "altar of wood", 3 high and 2 long; its width is not written and is shown equal to its length
    const ez = K.part(g, "ezekiel", { "kl-incense-altar": "ezekiel" });
    const eh = cu("ez-wood-altar-height") * 6, el = cu("ez-wood-altar-length") * 6, e2 = el / 2, cp = .7;
    K.box(ez, "wood", TF(-e2 + .25), TF(e2 - .25), TF(.5), TF(eh - .9), TF(-e2 + .25), TF(e2 - .25));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>                  // its corners ("ומקצעותיו לו")
      K.box(ez, "wood", TF(sx > 0 ? e2 - cp : -e2), TF(sx > 0 ? e2 : -e2 + cp), 0, TF(eh - .9), TF(sz > 0 ? e2 - cp : -e2), TF(sz > 0 ? e2 : -e2 + cp)));
    K.box(ez, "wood", TF(-e2 - .2), TF(e2 + .2), TF(eh - .9), TF(eh - .45), TF(-e2 - .2), TF(e2 + .2));
    K.box(ez, "wood", TF(-e2 - .05), TF(e2 + .05), TF(eh - .45), TF(eh), TF(-e2 - .05), TF(e2 + .05));
    K.box(ez, "wood", TF(-e2 - .12), TF(e2 + .12), 0, TF(.5), TF(-e2 - .12), TF(e2 + .12));
    K.label(g, 0, K.TF(Math.max(H, eh) + 2), 0, "מזבח הזהב", "מזבח הקטורת");
    return {
      label_he: "מזבח הזהב",
      info: { kind: "כלי", name: "מזבח הזהב (מזבח הקטורת)", rows: [["אורך × רוחב × גובה", "1 × 1 × 2 אמות, וקרנותיו ממנו"],
        ["מזבח העץ ביחזקאל", "3 גובה, 2 אורך"]],
        src: [S("src", "שמות ל,א–י; רמב״ם בית הבחירה ג,יז"), S("src", "יחזקאל מא,כב"),
              S("dec", "מידת הקרנות, הזר והרוחב של מזבח העץ: בחירת הדמיה של הפרויקט")] },
      horns,
    };
  }

  /* ---------------- the two tables of the Ulam ---------------- */
  function ulamTable(K, g, kind){
    const { cu, TF } = K;
    const L = cu("md-kl-ulam-table-length") * 6, W = cu("md-kl-ulam-table-width") * 6, H = cu("md-kl-ulam-table-height") * 6;
    const marble = kind === "ulam-table-marble", m = marble ? "vmarble" : "vgold";
    const top = marble ? .7 : cu("md-kl-table-top") * 6, leg = cu("md-kl-table-leg") * 6 * (marble ? 1.15 : .9);
    const x0 = -L / 2, x1 = L / 2, z0 = -W / 2, z1 = W / 2, yA = H - top;
    // the top: a slab with a moulded edge, and an apron set back under it
    K.box(g, m, TF(x0), TF(x1), TF(yA), TF(H), TF(z0), TF(z1));
    K.box(g, marble ? m : "vgoldSoft", TF(x0 + .12), TF(x1 - .12), TF(yA - .14), TF(yA), TF(z0 + .12), TF(z1 - .12));
    K.box(g, m, TF(x0 + .35), TF(x1 - .35), TF(yA - .9), TF(yA - .14), TF(z0 + .35), TF(z1 - .35));
    // four tapered square legs on small plinths
    const lg = new THREE.CylinderGeometry(TF(leg * .52), TF(leg * .38), TF(yA - .5), 4, 1);
    const lx = x1 - .35 - leg * .4, lz = z1 - .35 - leg * .4;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      K.mesh(lg, m, g, TF(sx * lx), TF(.5 + (yA - .5) / 2), TF(sz * lz)).rotation.y = Math.PI / 4;
      K.box(g, marble ? m : "vgoldSoft", TF(sx * lx - leg * .45), TF(sx * lx + leg * .45), 0, TF(.5), TF(sz * lz - leg * .45), TF(sz * lz + leg * .45));
    });
    if (marble){                                                              // an H-shaped stretcher
      [-1, 1].forEach(sx => K.box(g, m, TF(sx * lx - .22), TF(sx * lx + .22), TF(1.6), TF(2.1), TF(-lz), TF(lz)));
      K.box(g, m, TF(-lx), TF(lx), TF(1.65), TF(2.05), TF(-.2), TF(.2));
    } else [[x0 - .12, x1 + .12, z0 - .12, z0], [x0 - .12, x1 + .12, z1, z1 + .12], [x0 - .12, x0, z0, z1], [x1, x1 + .12, z0, z1]].forEach(([a, b, c, d]) =>
      K.box(g, "vgold", TF(a), TF(b), TF(H - .45), TF(H), TF(c), TF(d)));            // its gold crown
    const name = marble ? "שולחן השיש שבאולם" : "שולחן הזהב שבאולם";
    K.label(g, 0, K.TF(H + 3), 0, name, "");
    return {
      label_he: name,
      info: { kind: "כלי", name, rows: [["תפקיד", marble ? "עליו נותנים את לחם הפנים בכניסתו" : "עליו נותנים את הלחם ביציאתו"],
        ["מידות", "אינן נמסרות; מוצג כמידות השולחן שבפנים — בחירת הדמיה"]],
        src: [S("src", "מנחות יא,ז; שקלים ו,ד; רמב״ם בית הבחירה ג,טז"), S("dec", "הצד, המידות והצורה: בחירת הדמיה של הפרויקט")] },
    };
  }

  /* ---------------- the ark, as background only ---------------- */
  function arkOutline(K, g){
    const { cu, n, C } = K;
    if (n("aron-bayit-sheni") !== 0) throw new Error("vessels: the ark is background only (Yoma 5:2)");
    const L = C(cu("aron-length")), W = C(cu("aron-width")), H = C(cu("aron-height")), kt = C(cu("md-kl-kaporet-thickness"));
    const lift = C(cu("even-shetiya-height"));                              // it stood on the foundation stone (Rambam 4:1)
    const ghost = K.part(g, "ark", { "kl-ark": "ark-ghost" });
    // its length lies across the house, north-south (Rambam 3:12): along Z
    K.ghostBox(ghost, W, H, L, 0, lift + H / 2, 0);
    K.ghostBox(ghost, W, kt, L, 0, lift + H + kt / 2, 0);                   // the kaporet
    K.label(ghost, 0, lift + H + C(1), 0, "מקום הארון — רקע", "לא היה בבית שני");
    K.part(g, "stone-only", { "kl-ark": "stone-only" });                    // nothing to draw: the stone is the house's
    // where it was hidden: Rambam's deep and winding vaults below the house (schematic)
    const hide = K.part(g, "hiding", { "kl-ark-hiding": "rambam" });
    const d = C(cu("md-kl-hiding-depth")), P = [];
    for (let k = 0; k <= 8; k++) P.push(new THREE.Vector3((k % 2 ? 1 : -1) * W * .6 * (k ? 1 : 0), -d * k / 8, (k % 4 < 2 ? -1 : 1) * L * .2 * (k ? 1 : 0)));
    K.ghostLine(hide, P, true, true);
    const vault = K.ghostBox(hide, W * 1.2, d * .14, L * 1.1, P[8].x, -d - d * .07, P[8].z); vault.material = K.M.LINE.ghostXray; vault.renderOrder = 3;
    K.label(hide, 0, -d * .5, 0, "מטמוניות — סימון סכמטי", "רמב״ם בית הבחירה ד,א");
    K.part(g, "no-marker", { "kl-ark-hiding": "none" });
    K.part(g, "shekalim-elsewhere", { "kl-ark-hiding": "shekalim" });       // that marker is placed by the scene
    return {
      label_he: "מקום הארון (רקע)", pickIn: [ghost, hide],
      info: { kind: "רקע", name: "הארון — לא היה בבית שני", rows: [["אורך × רוחב × גובה", "2.5 × 1.5 × 1.5 אמות"], ["כיוון", "ארכו לרוחב הבית"]],
        src: [S("src", "שמות כה,י–כב"), S("src", "יומא ה,ב; רמב״ם בית הבחירה ד,א — וכל אלו לא חזרו בבית שני"),
              S("dec", "קו מתאר בלבד, בלי כרובים: אין להם מידה ואין שחזור מאומת")] },
    };
  }

  function hidingMarker(K, g){
    const { cu, C } = K;
    // read first, as the ark's outline does: its note (both traditions of the hiding) leads the click text
    if (K.n("aron-bayit-sheni") !== 0) throw new Error("vessels: the ark is background only (Yoma 5:2)");
    const m = K.part(g, "shekalim", { "kl-ark-hiding": "shekalim" });
    const d = C(cu("md-kl-hiding-depth")), r = C(1.2), P = [];
    for (let k = 0; k <= 48; k++){ const a = k / 48 * Math.PI * 2; P.push(new THREE.Vector3(Math.cos(a) * r, C(.05), Math.sin(a) * r)); }
    K.ghostLine(m, P, false);
    const shaft = K.ghostBox(m, r * 1.6, d, r * 1.6, 0, -d / 2, 0); shaft.material = K.M.LINE.ghostXray; shaft.renderOrder = 3;
    K.label(m, 0, C(2.5), 0, "כנגד דיר העצים", "שקלים ו,א–ב — סימון סכמטי");
    return {
      label_he: "מקום הגניזה לפי שקלים", pickIn: [m],
      info: { kind: "רקע", name: "היכן נגנז הארון — כמסורת משנה שקלים", rows: [["סימון", "סכמטי בלבד"]],
        src: [S("src", "שקלים ו,א–ב"), S("dec", "המקום בדגם והצורה: בחירת הדמיה של הפרויקט")] },
    };
  }

  /* ---------------- the laver (kiyor), with its spouts and the mukhni ---------------- */
  function laver(K, g){
    const { cu, n, C } = K;
    const lr = cu("md-laver-radius"), stand = cu("md-kl-laver-stand"), basin = cu("md-kl-laver-basin"), ns = n("kiyor-spouts");
    const main = K.part(g, "main");
    // the stand (kan): a turned pedestal, as wide as scene-core's (2.2 at the floor, 1.8 at the top)
    K.mesh(K.lathe([[0, 0], [2.45, 0], [2.45, .18], [2.2, .3], [2.2, .42], [1.9, .6], [1.62, 1.1], [1.5, 1.6], [1.56, 2.1], [1.72, 2.5], [1.8, 2.72], [2.02, 2.82], [2.02, stand], [0, stand]]
      .map(([r, y]) => [C(r), C(y)]), 48), "copper", main);
    // the basin: flared, with a rolled lip
    const b0 = stand, b1 = stand + basin;
    K.mesh(K.lathe([[0, b0], [lr * .8, b0], [lr * .84, b0 + basin * .2], [lr * .93, b0 + basin * .62], [lr, b1 - .14], [lr + .16, b1 - .05], [lr + .12, b1 + .06],
      [lr - .08, b1 + .02], [lr - .14, b1 - .2], [lr * .88, b0 + basin * .45], [0, b0 + basin * .35]].map(([r, y]) => [C(r), C(y)]), 64), "copper", main);
    K.mesh(new THREE.CylinderGeometry(C(lr - .2), C(lr - .2), C(.04), 64), "vwater", main, 0, C(b1 - .2), 0);
    // the twelve spouts (Yoma 3:10), round the lower basin
    const yS = b0 + basin * .3, rS = lr * .86;
    const pipe = new THREE.CylinderGeometry(C(.11), C(.13), C(.75), 12), nozzle = new THREE.CylinderGeometry(C(.06), C(.1), C(.4), 12);
    const tap = new THREE.SphereGeometry(C(.12), 12, 8);
    for (let i = 0; i < ns; i++){
      const a = Math.PI * 2 * i / ns, s = new THREE.Group(); s.position.set(Math.cos(a) * C(rS), C(yS), Math.sin(a) * C(rS)); s.rotation.y = -a; main.add(s);
      const p = K.mesh(pipe, "copper", s, C(.36), 0, 0); p.rotation.z = Math.PI / 2;
      K.mesh(nozzle, "vgoldSoft", s, C(.74), C(-.16), 0);
      K.mesh(tap, "vgold", s, C(.52), C(.12), 0);
      s.userData.spout = true;
    }
    // the mukhni: how it worked is not given; a pit it sank into, or a wheel that lowered it
    const pit = K.part(g, "mukhni-pit", { "kl-mukhni": "pit" });
    const pd = C(cu("md-kl-mukhni-pit")), pr = C(lr + .4), ring = [];
    for (let k = 0; k <= 64; k++){ const a = k / 64 * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a) * pr, 0, Math.sin(a) * pr)); }
    K.ghostLine(pit, ring.map(v => v.clone().setY(C(.03))), false);
    K.ghostLine(pit, ring.map(v => v.clone().setY(-pd)), true, true);
    for (let k = 0; k < 8; k++){ const a = k / 8 * Math.PI * 2; K.ghostLine(pit, [new THREE.Vector3(Math.cos(a) * pr, 0, Math.sin(a) * pr), new THREE.Vector3(Math.cos(a) * pr, -pd, Math.sin(a) * pr)], true, true); }
    K.mesh(new THREE.RingGeometry(C(lr + .1), C(lr + .45), 64), "wood", pit, 0, C(.02), 0).rotation.x = -Math.PI / 2;
    const wheel = K.part(g, "mukhni-wheel", { "kl-mukhni": "wheel" });
    const wr = C(cu("md-kl-mukhni-wheel")), post = C(.35), pz = C(lr + .9), beamY = C(b1 + 5.5);
    [-1, 1].forEach(sz => {
      K.box(wheel, "wood", -post, post, 0, beamY + post, sz * pz - post, sz * pz + post);
      K.box(wheel, "wood", -post * 2.2, post * 2.2, 0, C(.3), sz * pz - post * 2.2, sz * pz + post * 2.2);
    });
    K.box(wheel, "wood", -post * .8, post * .8, beamY - post * .6, beamY + post, -pz - post, pz + post);
    const hubY = beamY - post * .6 - wr - C(.15);
    const rim = K.mesh(new THREE.TorusGeometry(wr, C(.12), 10, 48), "wood", wheel, 0, hubY, 0);
    for (let k = 0; k < 8; k++){ const sp = K.mesh(new THREE.CylinderGeometry(C(.06), C(.06), wr * 2, 8), "wood", wheel, 0, hubY, 0); sp.rotation.z = k / 8 * Math.PI; }
    K.mesh(new THREE.CylinderGeometry(C(.09), C(.09), pz * 2, 10), "iron", wheel, 0, hubY, 0).rotation.x = Math.PI / 2;
    K.box(wheel, "wood", -post * .5, post * .5, hubY, beamY - post * .6, -post * .5, post * .5);
    const yoke = C(b1 + 1.2);
    K.mesh(new THREE.CylinderGeometry(C(.035), C(.035), hubY - wr - yoke, 6), "rope", wheel, 0, (hubY - wr + yoke) / 2, 0);
    K.mesh(new THREE.TorusGeometry(C(.35), C(.06), 8, 24), "iron", wheel, 0, yoke, 0).rotation.x = Math.PI / 2;
    for (let k = 0; k < 4; k++){
      const a = Math.PI / 4 + k * Math.PI / 2, A = new THREE.Vector3(Math.cos(a) * C(.35), yoke, Math.sin(a) * C(.35)), B = new THREE.Vector3(Math.cos(a) * C(lr), C(b1 + .05), Math.sin(a) * C(lr));
      K.mesh(new THREE.TubeGeometry(new THREE.LineCurve3(A, B), 2, C(.03), 6, false), "iron", wheel);
    }
    K.label(g, 0, C(b1 + 1.8), 0, "הכיור", "12 דדים ומוכני");
    return {
      label_he: "הכיור",
      info: { kind: "כלי", name: "הכיור והמוכני", rows: [["דדים", String(ns)], ["חומר", "נחושת, וכנו נחושת"], ["מידות", "אינן נמסרות — בחירת הדמיה"]],
        src: [S("src", "שמות ל,יח; יומא ג,י; תמיד ג,ח"), S("src", "רמב״ם בית הבחירה ג,יח"),
              S("dec", "צורת הכן, האגן, הדדים ואופן פעולת המוכני: בחירת הדמיה של הפרויקט")] },
      spouts: ns,
    };
  }

  const BUILD = { "menorah": menorah, "table": table, "incense-altar": incenseAltar,
    "ulam-table-marble": (K, g) => ulamTable(K, g, "ulam-table-marble"), "ulam-table-gold": (K, g) => ulamTable(K, g, "ulam-table-gold"),
    "ark-outline": arkOutline, "laver": laver, "ark-hiding-marker": hidingMarker };

  function build(kind, opts, dimFn, mm, materials){
    if (!BUILD[kind]) throw new Error(`vessels: unknown kind "${kind}" (one of ${KINDS.join(", ")})`);
    if (!(mm > 0)) throw new Error("vessels: mm (millimetres per cubit) must be a positive number");
    const M = materialsFor(mm, materials);
    const K = kit(dimFn, mm, M);
    const g = new THREE.Group(); g.name = "vessel-" + kind;
    g.userData = { id: "vessel-" + kind, kind };
    const out = BUILD[kind](K, g);
    const labels = []; g.traverse(o => { if (o.userData.label) labels.push(o); });
    g.userData = { id: "vessel-" + kind, kind, label_he: out.label_he, dims: [...K.used, ...DESCRIPTIVE[kind]], labels, pick: [], report: out };
    applyOptions(g, DEFAULTS);
    if (out.pickIn) out.pickIn.forEach(p => g.userData.pick.push(K.pickBox(g, out.info, p)));
    else g.userData.pick.push(K.pickBox(g, out.info));
    applyOptions(g, opts);
    return g;
  }

  /* ---------------- where the vessels stand ----------------
   * TempleVessels.layout(dimFn) -> a list of placements, cubits, one per option variant:
   *   {kind, frame, tags, x, z, note_he}
   * frame "heichal": origin on the floor at the middle of the Holy's west end (the face of the
   *   parochet, or of the amah traksin), x east, z south.
   * frame "ulam": origin on the floor at the middle of the Heichal's doorway, on the Ulam side
   *   (the Ulam's west wall), x east, z south.
   * frame "kodesh-kodashim": on the floor under the foundation stone's centre, wherever hk-even-shetiya
   *   puts it; the ark's outline raises itself by the stone's height (even-shetiya-height).
   * frame "court": plan cubits, `plan: [x from the south, y from the west]`. The laver replaces
   *   scene-core's at X.laver (plan null: the scene's own X.laver). The Shekalim marker: the wood
   *   store is not in the Mikdash3 plan, so it stands at SHEKALIM_PLAN, the project's choice.
   * A wrapper group per placement, carrying `tags`, makes placement rebuild-free too (inScene). */
  // The Shekalim marker's place (plan cubits): "opposite the wood store" (Shekalim 6:1-2), a chamber
  // the Mikdash3 plan does not have. In open paving of the outer court, north-east of the inner court,
  // clear of the chambers and the colonnade. A visual choice only, and its click text says so. It is
  // not a dimension: mikdash-dimensions.json's numbers are embedded in the print demo, which has no marker.
  const SHEKALIM_PLAN = [222, 296];
  function layout(dimFn){
    const K = { used: new Set() };
    const cu = id => { K.used.add(id); const v = dimFn(id); if (typeof v !== "number") throw new Error(`vessels: "${id}" is not a number`); return v / PER_CUBIT[UNITS[id]]; };
    const halfW = cu("hk-kodesh-width") / 2, third = cu("heichal-kelim-third"), len = cu("hk-kodesh-length");
    if (Math.abs(third * 3 - len) > .01) throw new Error("vessels: heichal-kelim-third must be a third of the Holy");
    const off = cu("md-kl-wall-offset"), out = cu("md-kl-altar-outward");
    const span = (3 * cu("md-kl-menorah-branch-pitch") + cu("md-kl-menorah-lamp") / 2);      // half the menorah's width
    const P = [];
    // the zone the three vessels stand in, measured from the parochet: within the inner third, or
    // from the end of the outer third to the parochet; the table and menorah at its middle
    const ZONES = { "inner-third": third, "from-outer-third": len - third };
    for (const [place, zone] of Object.entries(ZONES)){
      const x = zone / 2, t = { "kl-vessels-place": place };
      P.push({ kind: "menorah", frame: "heichal", tags: t, x, z: halfW - off - span, note_he: "בדרום, משמאל הנכנס" });
      for (const size of ["rmeir", "ryehuda"]){
        const w = cu(size === "rmeir" ? "shulchan-width-rmeir" : "shulchan-width-ryehuda");
        P.push({ kind: "table", frame: "heichal", tags: Object.assign({ "kl-table-size": size }, t), x, z: -(halfW - off - w / 2), note_he: "בצפון, מימין הנכנס" });
      }
      P.push({ kind: "incense-altar", frame: "heichal", tags: t, x: x + out, z: 0, note_he: "באמצע, משוך מבין השולחן והמנורה לחוץ" });
    }
    const door = cu("heichal-opening-width") / 2, gapW = cu("md-kl-ulam-table-wall-gap"), gapD = cu("md-kl-ulam-table-door-gap");
    const uL = cu("md-kl-ulam-table-length"), uW = cu("md-kl-ulam-table-width"), uz = door + gapD + uW / 2;
    P.push({ kind: "ulam-table-marble", frame: "ulam", tags: { "kl-ulam-tables": "marble-north" }, x: gapW + uL / 2, z: -uz });
    P.push({ kind: "ulam-table-gold", frame: "ulam", tags: { "kl-ulam-tables": "marble-north" }, x: gapW + uL / 2, z: uz });
    P.push({ kind: "ulam-table-marble", frame: "ulam", tags: { "kl-ulam-tables": "marble-south" }, x: gapW + uL / 2, z: uz });
    P.push({ kind: "ulam-table-gold", frame: "ulam", tags: { "kl-ulam-tables": "marble-south" }, x: gapW + uL / 2, z: -uz });
    P.push({ kind: "ark-outline", frame: "kodesh-kodashim", tags: null, x: 0, z: 0, note_he: "על אבן השתייה" });
    P.push({ kind: "laver", frame: "court", tags: null, x: null, z: null, plan: null, note_he: "במקום הכיור של scene-core (X.laver), כתחליף מפורט" });
    P.push({ kind: "ark-hiding-marker", frame: "court", tags: null, x: null, z: null, plan: SHEKALIM_PLAN.slice(),
             note_he: "כנגד דיר העצים: לשכה שאינה בתוכנית הנוכחית; הסימון בחצר החיצונה, צפונית־מזרחית לעזרה — בחירת הדמיה" });
    P.dims = [...K.used];
    return P;
  }

  /* ---------------- in a TempleScene: how the site shows the vessels ----------------
   *   const vs = TempleVessels.inScene(data, { materials, opts });
   *   const root = TempleScene.build(data, { materials, house: "arch", hooks: vs.hooks });
   *   vs.attach(root);
   * data: scene_data(house="arch", rings_layouts=True), Web/build_site.py's site_scene(). The site
   * (Web/site/app.js) and the build's gate (Web/tools/scene_inventory.js) both run exactly this, so
   * the gate sees the tags the site switches.
   * - hooks.vessel: heichal.js calls it once per room with the origin of the room's frame. Every
   *   placement layout() gives for that kind in that frame is built there, in a wrapper group tagged
   *   with the placement's own kl-* tags (those the house's group does not already carry), so
   *   TempleScene.applyOptions moves a vessel without a rebuild.
   * - hooks["rings.ring"]: scene-core's slaughter rings are left to attach(), which draws both
   *   readings of Middot 3:5 (X.rings_layouts) as two parts of the rings component, tagged kl-rings,
   *   each with its own click box and text. The print demo does not load this file and keeps
   *   scene-core's own rings.
   * - attach(root): the laver at X.laver, in place of scene-core's simple one (hidden, with its click
   *   box and label dropped); the Shekalim marker in the outer court; the rings. Then every vessel is
   *   listed: root.userData.vessels = {"vessel-<kind>": [instances]} (one instance per placement; the
   *   options show at most one), root.userData.components["vessel-<kind>"] = the first, the click
   *   boxes in root.userData.pick, the labels in root.userData.labels (each with userData.vessel = kind),
   *   and each instance's userData.place = {frame, plan: [x, y] in plan cubits, tags}. */
  function inScene(data, o){
    o = o || {};
    const TS = global.TempleScene;
    if (!TS) throw new Error("vessels: inScene needs scene-core.js (TempleScene) loaded first");
    const L = data.L, X = data.X, mm = L.MM, F = TS.frame(L), C = F.C;
    const dimFn = id => { const v = (X.dim || {})[id]; if (typeof v !== "number") throw new Error(`vessels: dimension "${id}" is missing from data.X.dim`); return v; };
    const M = materialsFor(mm, o.materials), opts = o.opts || {};
    const P = layout(dimFn);
    const made = [], parts = [], rings = [];
    const tagName = t => Object.entries(t || {}).map(([k, v]) => `|${k}=${v}`).join("");
    function group(parent, name, tags){
      const g = new THREE.Group(); g.name = name + tagName(tags);
      g.userData = tags ? { role: "vessel-place", tags: Object.assign({}, tags) } : { role: "vessel-place" };
      parent.add(g); parts.push(g); return g;
    }
    function put(kind, parent, x, y, z, rotY, plan, frame, tags){
      const g = build(kind, opts, dimFn, mm, M);
      g.position.set(x, y, z); g.rotation.y = rotY || 0;
      g.userData.place = { frame, plan, tags };
      parent.add(g); made.push(g); return g;
    }
    const drop = (list, gone) => { for (let i = list.length - 1; i >= 0; i--) if (gone.has(list[i])) list.splice(i, 1); };

    const hooks = {
      vessel(kind, grp, at){
        const gt = grp.userData.tags || {};
        const fits = P.filter(p => p.kind === kind && p.frame === at.frame &&
          Object.entries(p.tags || {}).every(([k, v]) => !(k in gt) || gt[k] === v));
        if (!fits.length) throw new Error(`vessels: layout() has no place for "${kind}" in the frame "${at.frame}"`);
        const cs = Math.cos(at.rotY || 0), sn = Math.sin(at.rotY || 0);
        fits.forEach(p => {
          const own = {}; Object.entries(p.tags || {}).forEach(([k, v]) => { if (!(k in gt)) own[k] = v; });
          const parent = Object.keys(own).length ? group(grp, "vessel-place:" + kind, own) : grp;
          const dx = p.x || 0, dz = p.z || 0;                                // cubits east and south of the origin
          const wx = dx * cs + dz * sn, wz = -dx * sn + dz * cs;
          put(kind, parent, at.x + C(wx), at.y, at.z + C(wz), at.rotY, [at.plan[0] - wz, at.plan[1] + wx], at.frame, Object.assign({}, gt, own));
        });
      },
      "rings.ring"(c){ if (!X.rings_layouts) return false; rings.push(c); return true; },
    };

    function attach(root){
      const U = root.userData, base = o.base || 0;
      // the laver, at X.laver, in place of scene-core's simple laver
      const lc = U.components.laver;
      if (lc){
        const gone = new Set();
        lc.children.filter(p => p.userData.role === "main").forEach(p => { p.visible = false; p.traverse(x => gone.add(x)); });
        drop(U.pick, gone); drop(U.labels, gone);
        const [lx, ly] = X.laver;
        const g = put("laver", group(lc, "laver:vessel"), F.PX(ly), base + X.levels.inner_mm, F.PZ(lx), 0, [lx, ly], "court", {});
        g.userData.dims = [...new Set(g.userData.dims.concat(lc.userData.dims || []))];
        g.userData.report.info.src.push(S("rec", "בין האולם ולמזבח, ומשוך לדרום (מידות ג,ו)"),
          S("dec", "המקום המדויק בדגם נבחר כך שלא ייגע במעלות האולם (md-laver-x, md-laver-y)"));
      }
      // the Shekalim marker, in the outer court
      const mk = P.find(p => p.kind === "ark-hiding-marker"), oc = U.components["outer-court"];
      if (mk && mk.plan && oc){
        const [px, py] = mk.plan;
        put("ark-hiding-marker", group(oc, "outer-court:vessel"), F.PX(py), base, F.PZ(px), 0, [px, py], "court", {});
      }
      // the slaughter rings, in both readings of Middot 3:5
      const rc = U.components.rings;
      if (rc && rings.length){
        const proxy = U.pick.find(m => m.userData.component === "rings"), b = rings[0].base;
        const rp = dimFn("md-ring-plate") / 2, rd = dimFn("md-ring-diameter");
        const plate = new THREE.BoxGeometry(C(2 * rp), .18, C(2 * rp)), ring = new THREE.TorusGeometry(C(rd / 2), C(.09), 8, 20, Math.PI);
        const ROWS = { "6x4": "שש שורות של ארבע", "4x6": "ארבע שורות של שש" };
        Object.entries(X.rings_layouts).forEach(([v, list]) => {
          if (!ROWS[v]) throw new Error(`vessels: no text for the rings' reading "${v}"`);
          const ph = group(rc, "rings:main", { "kl-rings": v });
          list.forEach(([x, y]) => {
            const a = new THREE.Mesh(plate, M.MAT.iron); a.position.set(F.PX(y), b + .21, F.PZ(x)); a.receiveShadow = true; ph.add(a);
            const r = new THREE.Mesh(ring, M.MAT.iron); r.position.set(F.PX(y), b + .3, F.PZ(x)); r.castShadow = true; ph.add(r);
          });
          if (proxy){                          // the core's click box, once per reading, with the reading's count
            const m = new THREE.Mesh(proxy.geometry, proxy.material); m.position.copy(proxy.position);
            const info = JSON.parse(JSON.stringify(proxy.userData.info));
            info.rows = info.rows.map(r => r[0] === "מספר" ? [r[0], `${list.length}, ${ROWS[v]}`] : r);
            m.userData = { info, component: "rings" }; ph.add(m); U.pick.push(m);
          }
        });
        if (proxy){ proxy.parent.remove(proxy); drop(U.pick, new Set([proxy])); }
      }
      // list every vessel
      U.vessels = {};
      made.forEach(g => {
        const id = g.userData.id;
        (U.vessels[id] = U.vessels[id] || []).push(g);
        if (!U.components[id]) U.components[id] = g;
        g.userData.pick.forEach(m => U.pick.push(m));
        g.userData.labels.forEach(l => { l.userData.vessel = g.userData.kind; U.labels.push(l); });
        g.traverse(x => { if (x !== g && x.userData.tags) parts.push(x); });
      });
      parts.forEach(p => U.parts.push(p));
      return root;
    }
    return { hooks, attach, layout: P };
  }

  global.TempleVessels = { build, applyOptions, layout, inScene, KINDS, DEFAULTS, UNITS, DESCRIPTIVE, SHEKALIM_PLAN };
})(typeof window !== "undefined" ? window : this);

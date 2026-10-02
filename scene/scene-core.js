/* 3D/Scene/scene-core.js — the Temple's built architecture, one source for every page that shows it.
 *
 * A classic script for three.js r147 used as the global THREE (no bundler); load materials.js
 * first. Defines the global TempleScene:
 *
 *   const root = TempleScene.build(data, options);   // a THREE.Group
 *
 * The group holds two levels, "outer-court" and "inner-court", and under them one named child
 * group per architectural component (walls, gatehouses, colonnade, pavement chambers, chambers,
 * corner kitchens, altar, ramp, laver, rings, house). Each component's userData is
 * {id, kind, dims, label_he, ...}: `dims` are the ids in mikdash-dimensions.json that govern it.
 * Geometry sits in sub-groups ("parts") of a component; a part that belongs to one design option
 * carries userData.tags, e.g. {h: "j"} or {h: "j", palm: "post"}. See README.md for the data
 * contract, the options and the hooks.
 *
 * Nothing in here knows about printing: no tiles, seams, plinth, LED, channels or plates.
 * Claude Code, 2026-10-02, split out of 3D/Planning/TTM-006/demo-template.html.
 */
(function (global) {
  "use strict";

  /* Plan: x cubits from the south, y cubits from the west. World, mm: X east, Y up, Z south,
     the outer court's centre at the origin. */
  function frame(L){
    const MM = L.MM, CX = L.OUT_EW * MM / 2, CZ = -L.OUT_NS * MM / 2;
    const C = c => c * MM;
    return { MM, CX, CZ, C, PX: y => C(y) - CX, PZ: x => -C(x) - CZ };
  }

  /* ---- boxes merged into one mesh per (group, material) ---- */
  function Batcher(){ this.batches = new Map(); this.onBox = null; }
  Batcher.prototype.get = function (group, mat){
    const k = group.id + "|" + mat;
    let b = this.batches.get(k);
    if (!b){ b = { group, mat, pos: [], nor: [], uv: [] }; this.batches.set(k, b); }
    return b;
  };
  function tri(b, a, c, d){
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; n = n.map(q => q / l);
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    for (const p of [a, c, d]){
      b.pos.push(...p); b.nor.push(...n);
      if (ay >= ax && ay >= az) b.uv.push(p[0], p[2]); else if (ax >= az) b.uv.push(p[2], p[1]); else b.uv.push(p[0], p[1]);
    }
  }
  function quad(b, a, c, d, e){ tri(b, a, c, d); tri(b, a, d, e); }
  Batcher.prototype.quad = function (group, mat, a, c, d, e){ quad(this.get(group, mat), a, c, d, e); };
  /* a world box, mm; mat is a material key or {top, side} */
  Batcher.prototype.box = function (group, mat, X0, X1, Y0, Y1, Z0, Z1){
    const top = typeof mat === "string" ? mat : mat.top, side = typeof mat === "string" ? mat : mat.side;
    if (this.onBox) this.onBox(group, top, side, X0, X1, Y0, Y1, Z0, Z1);
    const bt = this.get(group, top), bs = this.get(group, side);
    const p = (x, y, z) => [x ? X1 : X0, y ? Y1 : Y0, z ? Z1 : Z0];
    quad(bt, p(0,1,1), p(1,1,1), p(1,1,0), p(0,1,0));
    quad(bs, p(0,0,0), p(1,0,0), p(1,0,1), p(0,0,1));
    quad(bs, p(0,0,1), p(1,0,1), p(1,1,1), p(0,1,1));
    quad(bs, p(1,0,0), p(0,0,0), p(0,1,0), p(1,1,0));
    quad(bs, p(1,0,1), p(1,0,0), p(1,1,0), p(1,1,1));
    quad(bs, p(0,0,0), p(0,0,1), p(0,1,1), p(0,1,0));
  };
  /* one mesh per batch, added to its group, in the order the batches were first used */
  Batcher.prototype.flush = function (MAT){
    this.batches.forEach(b => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
      const m = new THREE.Mesh(geo, MAT[b.mat]); m.castShadow = m.receiveShadow = true;
      b.group.add(m);
    });
    this.batches.clear();
  };

  const S = (tag, text) => ({ tag, text });   // a source line: src | rec | dec | art
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);

  /* the inner court as a level: what a click on its floor shows */
  function innerCourtInfo(data){
    const LV = data.X.levels;
    return { kind: "מפלס", name: "העזרה הפנימית", rows: [["גובה מעל החצר החיצונה", `${LV.inner} אמות · ${f1(LV.inner_mm)} מ״מ`], ["מעלות", `${LV.inner_steps}, חצי אמה כל אחת`]],
      src: [S("src", "ומעלות שמונה מעלו, בשערי החצר הפנימית (יחזקאל מ לא, לד, לז)"), S("rec", "רום מעלה חצי אמה, כמעלות המקדש (מידות ב ה)"),
            S("src", "ובמעלות שבע יעלו בו, בשערי החצר החיצונה (יחזקאל מ כב, כו)")] };
  }

  /* show the parts of one design option and hide the others: opt = {h: "j", ch: "roof", palm: "post"} */
  function applyOptions(object3d, opt){
    object3d.traverse(o => { const t = o.userData.tags; if (t) o.visible = Object.entries(t).every(([k, v]) => opt[k] === v); });
  }

  function build(data, options){
    const opts = options || {};
    const L = data.L, G = data.G, X = data.X;
    const DIM = X.dim || {}, DIMS = X.dims || {};
    const dim = id => { const v = DIM[id]; if (typeof v !== "number") throw new Error(`scene-core: dimension "${id}" is missing from data.X.dim`); return v; };
    const MATS = opts.materials || TempleMaterials.create({ mm: L.MM, anisotropy: opts.anisotropy });
    const MAT = MATS.MAT;                            // a page may add its own keys to it (see hook "material")
    const F = frame(L), MM = F.MM, C = F.C, PX = F.PX, PZ = F.PZ;
    const TT = opts.base || 0;                       // world height of the outer court, mm
    const mins = opts.mins || null;                  // smallest feature sizes, mm, by key
    const atLeast = (c, key) => mins && mins[key] != null ? Math.max(c, mins[key] / MM) : c;   // cubits
    const atLeastMM = (mm, key) => mins && mins[key] != null ? Math.max(mm, mins[key]) : mm;
    const hooks = opts.hooks || {};
    const hook = (name, ctx) => !!(hooks[name] && hooks[name](ctx));
    // hook "material" (componentId, key) -> key: a page may give a component its own material
    const remat = hooks.material ? (g, m) => {
      const id = g.parent.userData.id;
      return typeof m === "string" ? hooks.material(id, m) : { top: hooks.material(id, m.top), side: hooks.material(id, m.side) };
    } : (g, m) => m;
    const omit = new Set(opts.omit || []);
    const bat = new Batcher(); bat.onBox = opts.onBox || null;
    const LV = X.levels, OD = LV.outer_mm, LIFT_IN = LV.inner_mm, RISE = LV.rise_mm, TREAD = LV.tread_c;
    const HOPT = X.height_options;                   // { j: {wall, gate, name, source}, e: {...} }
    const pick = [], labels = [], parts = [], components = {};
    let HOFF = 0;                                    // mm, added while building on the raised inner court

    /* ---- components and their parts ---- */
    const dimsOf = keys => [].concat(keys).reduce((a, k) => a.concat(DIMS[k] || []), []);
    const root = new THREE.Group(); root.name = "temple";
    function component(parent, id, kind, label_he, dimsKey, extra){
      const g = new THREE.Group(); g.name = id;
      g.userData = Object.assign({ id, kind, dims: dimsOf(dimsKey), label_he }, extra || {});
      parent.add(g); components[id] = g; return g;
    }
    function part(comp, role, tags){
      const g = new THREE.Group();
      g.name = comp.userData.id + ":" + role + (tags ? Object.entries(tags).map(([k, v]) => `|${k}=${v}`).join("") : "");
      g.userData = { role }; if (tags) g.userData.tags = Object.assign({}, tags);
      comp.add(g); parts.push(g); return g;
    }
    const OUTER = component(root, "outer-court", "level", "החצר החיצונה", "level-outer");
    const INNER = component(root, "inner-court", "level", "החצר הפנימית", "level-inner");

    /* ---- primitives: plan box, pick proxy, label anchor ---- */
    function pbox(g, mat, x0, x1, y0, y1, h0, h1){    // cubit rect, heights in mm above the outer court
      bat.box(g, remat(g, mat), PX(Math.min(y0, y1)), PX(Math.max(y0, y1)), TT + HOFF + h0, TT + HOFF + h1, PZ(Math.max(x0, x1)), PZ(Math.min(x0, x1)));
    }
    function proxy(g, x0, x1, y0, y1, h0, h1, info){
      const a = PX(Math.min(y0, y1)), b = PX(Math.max(y0, y1)), c = PZ(Math.max(x0, x1)), d = PZ(Math.min(x0, x1));
      const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, h1 - h0, d - c), MATS.PROXY);
      m.position.set((a + b) / 2, TT + HOFF + (h0 + h1) / 2, (c + d) / 2);
      m.userData.info = info; m.userData.component = g.parent.userData.id;
      g.add(m); pick.push(m); return m;
    }
    function label(g, x, y, h, text, sub){
      const o = new THREE.Object3D(); o.position.set(PX(y), TT + HOFF + h, PZ(x));
      o.userData.label = { text, sub }; o.userData.plan = [x, y];
      g.add(o); labels.push(o); return o;
    }

    /* ---- shared sizes, cubits unless noted (ids in mikdash-dimensions.json) ---- */
    const CAP = C(dim("md-cornice-height")), OV = dim("md-cornice-overhang");
    const DOOR = C(dim("gate-height"));              // every gateway, 20 cubits (Middot 2:3)
    const PALM_H = dim("md-palm-height"), CAP_H = dim("md-palm-capital-height");
    let HK, HW, HG, SPLIT;                           // the height option being built, its wall and gate heights (mm)

    /* ============ the levels ============ */
    const IC = L.inner_court;
    if (!omit.has("outer-floor")) pbox(part(OUTER, "floor"), { top: "pave", side: "stone" }, 0, L.OUT_NS, 0, L.OUT_EW, -OD, 0);
    if (!omit.has("inner-floor")){
      const g = part(INNER, "floor");
      pbox(g, { top: "marble", side: "stone" }, IC[0], IC[1], IC[2], IC[3], 0, LIFT_IN);
      proxy(g, IC[0], IC[1], IC[2], IC[3], 0, LIFT_IN, innerCourtInfo(data));
    }

    /* ============ the laver ============ */
    function laver(){
      const [lx, ly, lr] = X.laver;
      const comp = component(INNER, "laver", "laver", "הכיור", "laver", { rect: [lx - lr, lx + lr, ly - lr, ly + lr], at: [lx, ly] });
      const g = part(comp, "main");
      const add = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.set(PX(ly), TT + HOFF + y, PZ(lx)); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
      add(new THREE.CylinderGeometry(C(1.8), C(2.2), C(3), 32), MAT.bronze, C(1.5));
      add(new THREE.CylinderGeometry(C(lr), C(lr * .8), C(2), 48), MAT.bronze, C(4));
      add(new THREE.CylinderGeometry(C(lr * .85), C(lr * .85), C(.1), 48), MAT.water, C(5));
      const n = dim("kiyor-spouts");
      if (!hook("laver.spouts", { group: g, n })) for (let i = 0; i < n; i++){
        const a = Math.PI * 2 * i / n, o = add(new THREE.CylinderGeometry(C(.16), C(.16), C(1.2), 8), MAT.gold, C(3.55));
        o.position.x += Math.cos(a) * C(lr * .95); o.position.z += Math.sin(a) * C(lr * .95); o.rotation.set(0, -a, Math.PI / 2);
      }
      label(g, lx, ly, C(7), "הכיור", "");
      proxy(g, lx - lr, lx + lr, ly - lr, ly + lr, 0, C(6), { kind: "כיור", name: "הכיור", rows: [["קוטר", `${2 * lr} אמות`], ["דדים", String(n)]],
        src: [S("rec", "בין האולם ולמזבח, ומשוך לדרום (מידות ג ו)"), S("rec", "שנים עשר דדים (יומא ג י)"), S("dec", "המיקום המדויק נבחר כך שלא ייגע במעלות")] });
    }
    HOFF = LIFT_IN; laver();

    /* ============ the rings north of the altar ============ */
    // iron rings set in the floor, half-circles hinged on one side (Temple Institute)
    {
      const [zx0, zx1, zy0, zy1] = X.rings_zone;
      const comp = component(INNER, "rings", "rings", "הטבעות", "rings", { rect: [zx0, zx1, zy0, zy1], at: [(zx0 + zx1) / 2, (zy0 + zy1) / 2] });
      const g = part(comp, "main");
      const rd = dim("md-ring-diameter"), rp = dim("md-ring-plate") / 2;
      let RING = null;
      X.rings.forEach(([x, y]) => {
        if (hook("rings.ring", { group: g, x, y, base: TT + HOFF })) return;
        pbox(g, "iron", x - rp, x + rp, y - rp, y + rp, .12, .3);           // the plate set in the floor
        RING = RING || new THREE.TorusGeometry(C(rd / 2), C(.09), 8, 20, Math.PI);
        const m = new THREE.Mesh(RING, MAT.iron); m.position.set(PX(y), TT + HOFF + .3, PZ(x)); m.castShadow = true; g.add(m);
      });
      label(g, (zx0 + zx1) / 2, (zy0 + zy1) / 2, C(3), "הטבעות", "");
      proxy(g, zx0, zx1, zy0, zy1, 0, C(1), { kind: "טבעות", name: "מקום הטבעות, מצפון למזבח",
        rows: [["מספר", "24, שש שורות של ארבע"], ["שטח", `${zx1 - zx0} × ${zy1 - zy0} אמות`], ["מרחק מהמזבח", `${dim("rings-gap")} אמות`]],
        src: [S("rec", "ומצפונו של מזבח טבעות, שש סדרים של ארבע ארבע, ויש אומרים ארבע של שש שש (מידות ג ה)"),
              S("rec", "מן המזבח לטבעות 8 אמות, מקום הטבעות 24 (מידות ה ב)"),
              S("rec", "כמו בשחזור מכון המקדש: טבעות ברזל בצורת חצי עיגול, על ציר, שש שורות מצפון לדרום"),
              S("dec", "השולחנות והננסין שאחרי הטבעות לא נכנסים בעזרה של 100 אמות, ולא צוירו")] });
    }
    HOFF = 0;

    /* ============ chambers: three storeys, the upper ones set back ============ */
    function chamber(c){
      const r = c.rects[0];
      const comp = component(OUTER, c.id, "chamber", c.name, "chamber", { rect: r.slice(), at: [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2] });
      const g = part(comp, "main");
      const along = (r[1] - r[0]) > (r[3] - r[2]);          // long side runs north-south
      const n = dim("ez-chamber-storeys"), Hc = C(c.h), st = Hc / n, set = dim("md-chamber-setback");
      for (let k = 0; k < n; k++){
        const i = k * set;
        const q = along ? [r[0], r[1], r[2] + i, r[3] - i] : [r[0] + i, r[1] - i, r[2], r[3]];
        const h0 = k * st, h1 = (k + 1) * st - CAP * .8;
        pbox(g, "bone", q[0], q[1], q[2], q[3], h0, h1);
        pbox(g, k === n - 1 ? "cap" : { top: "roof", side: "cap" }, q[0] - .25, q[1] + .25, q[2] - .25, q[3] + .25, h1, (k + 1) * st);
        pbox(g, "gold", q[0] - .27, q[1] + .27, q[2] - .27, q[3] + .27, h1 + CAP * .3, h1 + CAP * .5);
        const wy = h0 + st * .38, wh = st * .3;
        for (let a = q[0] + 3; a <= q[1] - 3; a += 5){ pbox(g, "dark", a - .7, a + .7, q[2] - .06, q[2], wy, wy + wh); pbox(g, "dark", a - .7, a + .7, q[3], q[3] + .06, wy, wy + wh); }
        for (let a = q[2] + 3; a <= q[3] - 3; a += 5){ pbox(g, "dark", q[0] - .06, q[0], a - .7, a + .7, wy, wy + wh); pbox(g, "dark", q[1], q[1] + .06, a - .7, a + .7, wy, wy + wh); }
        if (k > 0){                                         // parapet on the gallery the setback leaves
          const p = (k - 1) * set, b = along ? [r[0], r[1], r[2] + p, r[3] - p] : [r[0] + p, r[1] - p, r[2], r[3]];
          if (along){ pbox(g, "cap", b[0], b[1], b[2], b[2] + .4, h0, h0 + C(1)); pbox(g, "cap", b[0], b[1], b[3] - .4, b[3], h0, h0 + C(1)); }
          else { pbox(g, "cap", b[0], b[0] + .4, b[2], b[3], h0, h0 + C(1)); pbox(g, "cap", b[1] - .4, b[1], b[2], b[3], h0, h0 + C(1)); }
        }
      }
      const mx = (r[0] + r[1]) / 2, my = (r[2] + r[3]) / 2;
      if (along){ pbox(g, "dark", mx - 1.5, mx + 1.5, r[2] - .06, r[2], 0, st * .55); pbox(g, "dark", mx - 1.5, mx + 1.5, r[3], r[3] + .06, 0, st * .55); }
      else { pbox(g, "dark", r[0] - .06, r[0], my - 1.5, my + 1.5, 0, st * .55); pbox(g, "dark", r[1], r[1] + .06, my - 1.5, my + 1.5, 0, st * .55); }
      label(g, mx, my, Hc + C(2), c.name, "");
      proxy(g, r[0], r[1], r[2], r[3], 0, Hc, { kind: "לשכה", name: c.name,
        rows: [["טביעה", `${r[1] - r[0]} × ${r[3] - r[2]} אמות · ${f1(C(r[1] - r[0]))} × ${f1(C(r[3] - r[2]))} מ״מ`], ["גובה", `${c.h} אמות · ${f1(Hc)} מ״מ`]],
        src: [S("src", "מקום ומידות לפי התוכנית בנתיב Mikdash3"), S("rec", "שלוש קומות, העליונות קצרות מהתחתונות כי האתיקים אוכלים מהן (יחזקאל מב ה–ו)"),
              S("dec", `גובה ${c.h} אמות`), S("art", "חלונות, כרכובים ומעקות")] });
    }

    /* ============ the corner courts, where the offerings were cooked ============ */
    function court(c){
      const r = c.rects[0];
      const comp = component(OUTER, c.id, "kitchen", c.name, "kitchen", { rect: r.slice(), at: [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2] });
      const g = part(comp, "main");
      const h = C(c.h), w = dim("md-kitchen-wall");
      [[r[0], r[1], r[2], r[2] + w], [r[0], r[1], r[3] - w, r[3]], [r[0], r[0] + w, r[2] + w, r[3] - w], [r[1] - w, r[1], r[2] + w, r[3] - w]]
        .forEach(q => { pbox(g, "stone", q[0], q[1], q[2], q[3], 0, h - CAP * .6); pbox(g, "cap", q[0] - .15, q[1] + .15, q[2] - .15, q[3] + .15, h - CAP * .6, h); });
      pbox(g, "marble", r[0] + w, r[1] - w, r[2] + w, r[3] - w, 0, .12);
      const i0 = [r[0] + w, r[1] - w, r[2] + w, r[3] - w], d = dim("md-kitchen-cooker-depth"), hh = C(dim("md-kitchen-cooker-height"));
      [[i0[0], i0[1], i0[2], i0[2] + d, 1], [i0[0], i0[1], i0[3] - d, i0[3], -1]].forEach(q => {
        pbox(g, "stone", q[0], q[1], q[2], q[3], 0, hh);
        for (let a = q[0] + 3; a < q[1] - 2; a += 5){
          const f = q[4] > 0 ? [q[3], q[3] + .06] : [q[2] - .06, q[2]];
          pbox(g, "ember", a - .8, a + .8, f[0], f[1], C(.3), C(1.3));
        }
      });
      label(g, (r[0] + r[1]) / 2, (r[2] + r[3]) / 2, h + C(2), c.name, "");
      proxy(g, r[0], r[1], r[2], r[3], 0, h, { kind: "חצר פינתית", name: c.name,
        rows: [["מידות", `${r[1] - r[0]} × ${r[3] - r[2]} אמות`], ["גובה הקירות", `${c.h} אמות`]],
        src: [S("src", "ארבע חצרות קטורות בארבע פינות החצר, 40 × 30 (יחזקאל מו כא–כב)"), S("src", "טור מבשלות סביב, תחת הטירות (מו כג)"),
              S("dec", `גובה הקירות ${c.h} אמות`), S("art", "צורת המבשלות והגחלים")] });
    }

    /* ============ altar and ramp ============ */
    function altar(c){
      const r = c.rects[0];
      const comp = component(INNER, c.id, "altar", "מזבח העולה", "altar", { rect: r.slice(), at: [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2] });
      const g = part(comp, "main");
      const [x0, x1, y0, y1] = r, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, A = X.altar;
      const iy = (A.base - A.above_yesod) / 2, is = (A.base - A.above_sovev) / 2;    // recess of the yesod and of the sovev
      // the yesod runs the whole north side and the whole west side, and one cubit into the south and the east (Middot 3:1)
      pbox(g, "lime", x1 - iy, x1, y0, y1, 0, C(A.h_yesod));                    // north, full length
      pbox(g, "lime", x0, x1 - iy, y0, y0 + iy, 0, C(A.h_yesod));               // west, full length
      pbox(g, "lime", x0, x0 + iy, y0 + iy, y0 + iy + 1, 0, C(A.h_yesod));      // one cubit into the south, from the south-west corner
      pbox(g, "lime", x1 - iy - 1, x1 - iy, y1 - iy, y1, 0, C(A.h_yesod));      // one cubit into the east, from the north-east corner
      // the body above the yesod and the sovev ledge are the same on all four sides
      pbox(g, "lime", x0 + iy, x1 - iy, y0 + iy, y1 - iy, 0, C(A.h_sovev));
      pbox(g, "red", x0 + iy - .05, x1 - iy + .05, y0 + iy - .05, y1 - iy + .05, C(A.h_line) - C(.08), C(A.h_line) + C(.08));
      pbox(g, "lime", x0 + is, x1 - is, y0 + is, y1 - is, C(A.h_sovev), C(A.h_top));
      const hz = atLeast(dim("md-altar-horn-size"), "horn"), hh = atLeastMM(C(A.h_horn), "horn_h");
      [[x0 + is, y0 + is], [x0 + is, y1 - is - hz], [x1 - is - hz, y0 + is], [x1 - is - hz, y1 - is - hz]]
        .forEach(([a, b]) => pbox(g, "lime", a, a + hz, b, b + hz, C(A.h_top), C(A.h_top) + hh));
      // the tapuach (ash heap) in the middle and three separate fires, as in the accepted v9 render
      const hr = C(dim("md-altar-heap-radius"));
      const heap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.ash);
      heap.scale.set(hr, C(dim("md-altar-heap-height")), hr); heap.position.set(PX(cy), TT + HOFF + C(A.h_top), PZ(cx)); g.add(heap);
      const fire = (fx, fy, n, len, big) => {
        const t = A.h_top;
        // logs run east-west; on the great fire their inner ends touch the ash heap (Tamid 2:4)
        for (let i = 0; i < n; i++){ const o = (i - (n - 1) / 2) * .8; pbox(g, "dark", fx + o - .3, fx + o + .3, fy - len / 2, fy + len / 2, C(t), C(t + .5)); }
        pbox(g, "ember", fx - n * .4, fx + n * .4, fy - len / 2 + .5, fy + len / 2 - .5, C(t + .45), C(t + .6));
        if (hook("altar.flame", { group: g })) return;
        const f = new THREE.Mesh(new THREE.ConeGeometry(C(big ? 1 : .55), C(big ? 3.2 : 1.9), 16), MAT.flame);
        f.position.set(PX(fy), TT + HOFF + C(t + .6) + C(big ? 1.6 : .95), PZ(fx)); g.add(f);
      };
      fire(cx, cy + 9, 6, 10, true);            // the great fire, east
      fire(cx - 12, cy - 10.5, 3, 3.4, false);  // incense coals, near the south-west corner
      fire(cx + 9, cy - 5, 4, 4.2, true);       // the fire that keeps the flame going
      label(g, cx, cy, C(A.h_top + A.h_horn) + C(4), "המזבח", "");
      proxy(g, x0, x1, y0, y1, 0, C(A.h_top + A.h_horn), { kind: "מזבח", name: "מזבח העולה",
        rows: [["בסיס", `${A.base} × ${A.base} אמות`], ["מעל היסוד", `${A.above_yesod} אמות`], ["מעל הסובב", `${A.above_sovev} אמות`],
               ["גובה עד המערכה", `${f1(A.h_top)} אמות · ${f1(C(A.h_top))} מ״מ`]],
        src: [S("rec", "יסוד, סובב וקרנות לפי מידות ג א, במידות המדויקות של הרמב״ם בטפחים (בית הבחירה ב ו–ט)"),
              S("rec", "הסובב שווה מארבע הרוחות. היסוד מהלך כל הצפון וכל המערב, ואוכל בדרום אמה ובמזרח אמה (מידות ג א)"),
              S("rec", "חוט הסיקרא ששה טפחים מתחת לסובב (רמב״ם ב ט)"),
              S("rec", "מסיידין אותו פעמיים בשנה, ולכן לבן ולא אבן חשופה (מידות ג ד)"),
              S("rec", "תפוח באמצע ושלוש מערכות נפרדות, כמו בהדמיה v9")] });
    }
    function ramp(c){
      const r = c.rects[0];
      const comp = component(INNER, c.id, "ramp", "כבש המזבח", "ramp", { rect: r.slice(), at: [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2] });
      const g = part(comp, "main"), A = X.altar;
      const top = C(A.h_top), gap = dim("md-ramp-gap"), xn = r[1] - gap;     // rises northwards to the altar, a small gap before it
      // a wedge whose top slopes along x (south to north) or along y (east to west)
      const slab = (x0, x1, y0, y1, h00, h10, h01, h11, mat) => {  // corner heights at (x0,y0) (x1,y0) (x0,y1) (x1,y1)
        const T = TT + HOFF, q = (a, b, c_, d) => bat.quad(g, remat(g, mat), a, b, c_, d);
        const P = (x, y, h) => [PX(y), T + h, PZ(x)];
        q(P(x0, y0, h00), P(x0, y1, h01), P(x1, y1, h11), P(x1, y0, h10));            // top
        q(P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, h01), P(x0, y0, h00));                // south end
        q(P(x1, y1, 0), P(x1, y0, 0), P(x1, y0, h10), P(x1, y1, h11));                // north end
        q(P(x1, y0, 0), P(x0, y0, 0), P(x0, y0, h00), P(x1, y0, h10));                // west side
        q(P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h11), P(x0, y1, h01));                // east side
      };
      slab(r[0], xn, r[2], r[3], 0, top, 0, top, "lime");                                    // the great ramp
      // two small ramps, one on each side, running alongside the great ramp up to the sovev:
      // east for going up, west for coming down (Temple Institute, "Illustrated Tour: The Mizbeach")
      const sw = atLeast(dim("md-small-ramp-width"), "small_ramp"), run = (xn - r[0]) * A.h_sovev / A.h_top;
      slab(xn - run, xn, r[3], r[3] + sw, 0, C(A.h_sovev), 0, C(A.h_sovev), "bone");
      slab(xn - run, xn, r[2] - sw, r[2], 0, C(A.h_sovev), 0, C(A.h_sovev), "bone");
      label(g, (r[0] + r[1]) / 2, (r[2] + r[3]) / 2, top * .6 + C(3), "הכבש", "");
      proxy(g, r[0], r[1], r[2] - 1, r[3] + 1, 0, top, { kind: "כבש", name: "כבש המזבח ושני הכבשים הקטנים",
        rows: [["רוחב", `${r[3] - r[2]} אמות`], ["אורך בתוכנית", `${r[1] - r[0]} אמות`], ["גובה בראשו", `${f1(A.h_top)} אמות, כמקום המערכה`],
               ["כבשים קטנים", `אחד מכל צד, רוחב אמה, עד הסובב (${f1(A.h_sovev)} אמות)`]],
        src: [S("rec", "מדרום למזבח, רוחבו 16 אמות, בלי מדרגות (מידות ג ג; רמב״ם ב יג)"),
              S("rec", "שני כבשים קטנים יוצאים ממנו ומובדלים מהמזבח כמלוא נימא (זבחים סב ב; רמב״ם ב יד)"),
              S("rec", "כמו בשחזור מכון המקדש: אחד במזרח לעלייה ואחד במערב לירידה, רוחב אמה, שניהם עד גובה הסובב. כך גם באיור של חב״ד"),
              S("dec", "סימטריים ומקבילים לכבש הגדול, בהחלטתך (28.9.2026)")] });
    }

    /* ============ walls: a body and a crown (coping, cornice, battlements) ============ */
    function wall(comp, tags, mat, r, inner, id){
      const body = part(comp, "body", tags), crown = part(comp, "crown", tags);
      const along = (r[1] - r[0]) > (r[3] - r[2]);
      const len0 = along ? r[0] : r[2], len1 = along ? r[1] : r[3], t0 = along ? r[2] : r[0], t1 = along ? r[3] : r[1];
      const P = (g, a0, a1, b0, b1, h0, h1, m) => along ? pbox(g, m || mat, a0, a1, b0, b1, h0, h1) : pbox(g, m || mat, b0, b1, a0, a1, h0, h1);
      const cen = along ? L.OUT_EW / 2 : L.OUT_NS / 2;
      const inFace = Math.abs(t0 - cen) < Math.abs(t1 - cen) ? -1 : 1;
      // the body, up to the crown; a page may build it differently (hook "wall.body")
      const ctx = { id, inner, along, len0, len1, t0, t1, split: SPLIT, height: HW, box: (a0, a1, b0, b1, h0, h1, m) => P(body, a0, a1, b0, b1, h0, h1, m) };
      if (!hook("wall.body", ctx)) P(body, len0, len1, t0, t1, 0, SPLIT);
      const ov = OV;
      P(crown, len0, len1, t0, t1, SPLIT, HW - CAP);                                            // the coping
      P(crown, len0, len1, inner || inFace < 0 ? t0 - ov : t0, inner || inFace > 0 ? t1 + ov : t1, HW - CAP, HW, "cap");
      if (inner) P(crown, len0, len1, t0 - ov - .02, t1 + ov + .02, HW - CAP * .55, HW - CAP * .35, "gold");   // gold band
      // battlements along the outer edge, as on the Israel Museum model's walls
      const MW = atLeast(dim("md-wall-merlon-width"), "merlon"), MG = atLeast(dim("md-wall-merlon-gap"), "merlon_gap");
      const MD = atLeast(dim("md-wall-merlon-depth"), "width"), MH = atLeastMM(C(dim("md-wall-merlon-height")), "merlon_h");
      const o0 = inFace < 0 ? t1 - MD : t0, o1 = inFace < 0 ? t1 : t0 + MD;
      for (let a = len0 + .5; a + MW <= len1 - .3; a += MW + MG) P(crown, a, a + MW, o0, o1, HW, HW + MH, "cap");
      const pitch = dim("md-wall-pilaster-pitch"), pw = dim("md-wall-pilaster-width") / 2;
      for (let a = len0 + pitch / 2; a < len1 - pitch / 4; a += pitch){                     // pilasters
        if (hook("wall.pilaster", { id, along, len0, len1, t0, t1, a })) continue;
        if (inner || inFace < 0) P(body, a - pw, a + pw, t0 - ov, t0, 0, SPLIT);
        if (inner || inFace > 0) P(body, a - pw, a + pw, t1, t1 + ov, 0, SPLIT);
      }
      return { body, crown };
    }
    function buildWalls(){
      L.walls.forEach(w => {
        const inner = w.inner || w.id[0] === "I";
        const r = w.r, id = "wall-" + w.id;
        const comp = components[id] || component(inner ? INNER : OUTER, id, "wall", w.name, inner ? "wall-inner" : "wall-outer",
          { wall: w.id, inner, rect: r.slice(), at: [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2] });
        const { body } = wall(comp, { h: HK }, "stone", r, inner, w.id);
        proxy(body, r[0], r[1], r[2], r[3], 0, HW, { kind: inner ? "חומת העזרה הפנימית" : "החומה החיצונה", name: w.name,
          rows: [["אורך", `${f1(w.len_mm || C(Math.max(r[1] - r[0], r[3] - r[2])))} מ״מ`], ["עובי", `${L.WALL} אמות · ${f1(C(L.WALL))} מ״מ`], ["גובה", `${HOPT[HK].wall} אמות · ${f1(HW)} מ״מ`]],
          src: (inner ? [S("rec", "חומה סביב העזרה הפנימית, בעובי 6 אמות, לפי התוכנית")]
                      : [S("src", "עובי קנה אחד, 6 אמות (יחזקאל מ ה)")])
            .concat([S("dec", `גובה ${HOPT[HK].wall} אמות: ${HOPT[HK].source}`), S("rec", "שיניים לאורך השפה החיצונה, כמו בדגם בית שני במוזיאון ישראל. אין לכך מקור בכתוב"),
                     S("art", "אבני גזית, פילסטרים, כרכוב ורצועת זהב")]) });
      });
    }

    /* ============ the thirty chambers: on a colonnade roof, or on the ground along the wall ============ */
    const PAVX = v => Math.round(v * 10) / 10;
    const pavSide = ([x0, x1]) => x0 < 20 ? "S" : x1 > L.OUT_NS - 20 ? "N" : "E";
    const pavComp = k => {
      const [x0, x1, y0, y1] = X.pavilions[k], id = `pavement-chamber-${k + 1}`;
      return components[id] || component(OUTER, id, "pavement-chamber", `לשכה ${k + 1} מתוך 30`, "pavement-chamber",
        { side: pavSide(X.pavilions[k]), rect: [x0, x1, y0, y1], at: [(x0 + x1) / 2, (y0 + y1) / 2] });
    };
    function buildStoa(){                                // option "roof", one set per height option
      const rt = C(dim("md-colonnade-roof")), pitch = dim("md-colonnade-column-pitch"), col = dim("md-colonnade-column");
      const segs = X.stoa.map(([side, x0, x1, y0, y1], i) => {
        const id = `colonnade-${side}-${i}`;
        const comp = components[id] || component(OUTER, id, "colonnade", "אכסדרת עמודים לאורך החומה", "colonnade",
          { side, rect: [x0, x1, y0, y1], at: [(x0 + x1) / 2, (y0 + y1) / 2] });
        const g = part(comp, "main", { h: HK, ch: "roof" });
        pbox(g, "marble", x0, x1, y0, y1, 0, .12);
        pbox(g, "cap", x0, x1, y0, y1, HW - rt, HW);
        const ctx = { group: g, side, x0, x1, y0, y1, height: HW, roof: rt, column: col, pbox: (...a) => pbox(g, ...a) };
        if (hook("colonnade.columns", ctx)){ /* built by the page */ }
        else if (side === "S" || side === "N"){
          const face = side === "S" ? x1 : x0, dir = side === "S" ? 1 : -1;
          pbox(g, "gold", Math.min(face, face + dir * .06), Math.max(face, face + dir * .06), y0, y1, HW - rt * .9, HW - rt * .3);
          for (let y = y0 + pitch / 2; y <= y1 - 1.5; y += pitch){
            const a = side === "S" ? x1 - 1 : x0, b = a + 1;
            const cw = atLeast(col, "column") / 2; pbox(g, "bronze", a, b, y - cw, y + cw, 0, HW - rt);
            pbox(g, "gold", a - .15, b + .15, y - .6, y + .6, HW - rt - C(.6), HW - rt);
          }
        } else {
          pbox(g, "gold", x0, x1, y0 - .06, y0, HW - rt * .9, HW - rt * .3);
          for (let x = x0 + pitch / 2; x <= x1 - 1.5; x += pitch){
            const cw = atLeast(col, "column") / 2; pbox(g, "bronze", x - cw, x + cw, y0, y0 + 1, 0, HW - rt);
            pbox(g, "gold", x - .6, x + .6, y0 - .15, y0 + 1.15, HW - rt - C(.6), HW - rt);
          }
        }
        proxy(g, x0, x1, y0, y1, 0, HW, { kind: "אכסדרה", name: "אכסדרת עמודים לאורך החומה",
          rows: [["עומק", `${X.stoa_depth} אמות`], ["עמודים", `כל ${pitch} אמות`]],
          src: [S("rec", "סטיו לאורך החומה החיצונה, מושאל מתיאור הבית השני (יוסף בן מתתיהו) ומהסרטון"), S("art", "עמודי ברונזה, כותרות ורצועת זהב")] });
        return g;
      });
      const pH = dim("md-pavilion-height");
      X.pavilions.forEach(([x0, x1, y0, y1], k) => {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const g = part(pavComp(k), "roof", { h: HK, ch: "roof" });
        const h0 = HW, h1 = HW + C(pH);
        pbox(g, "stone", x0 + .3, x1 - .3, y0 + .3, y1 - .3, h0, h1 - CAP);
        pbox(g, "cap", x0, x1, y0, y1, h1 - CAP, h1);
        pbox(g, "gold", x0 + .25, x1 - .25, y0 + .25, y1 - .25, h1 - CAP - C(.35), h1 - CAP);
        const lx = x1 - x0 > y1 - y0;
        for (let t = -3; t <= 3; t += 1.5){
          if (lx){ pbox(g, "dark", mx + t - .4, mx + t + .4, y0 + .24, y0 + .3, h0 + C(1.2), h0 + C(3)); pbox(g, "dark", mx + t - .4, mx + t + .4, y1 - .3, y1 - .24, h0 + C(1.2), h0 + C(3)); }
          else { pbox(g, "dark", x0 + .24, x0 + .3, my + t - .4, my + t + .4, h0 + C(1.2), h0 + C(3)); pbox(g, "dark", x1 - .3, x1 - .24, my + t - .4, my + t + .4, h0 + C(1.2), h0 + C(3)); }
        }
        proxy(g, x0, x1, y0, y1, h0, h1, { kind: "לשכה על הרצפה", name: `לשכה ${k + 1} מתוך 30`,
          rows: [["מידות", `${PAVX(x1 - x0)} × ${PAVX(y1 - y0)} אמות`], ["גובה", `${pH} אמות מעל גג האכסדרה`]],
          src: [S("src", "שלושים לשכות אל הרצפה (יחזקאל מ יז)"), S("rec", "על גג האכסדרה, כמו בסרטון. זו פרשנות אחת מכמה (סוגיה 24)"), S("art", "מידות, חלונות ורצועת זהב")] });
      });
      const qi = X.stoa.findIndex(v => v[0] === "S"), q = X.stoa[qi];
      label(segs[qi], (q[1] + q[2]) / 2, (q[3] + q[4]) / 2, HW + C(7), "אכסדרה ולשכות הרצפה", "30 לשכות, יחזקאל מ יז");
    }
    function buildGroundChambers(){                      // option "ground": a row of rooms along the wall, as in the book
      const RH = C(X.ground_chamber_h), gs = [];
      X.pavilions.forEach(([x0, x1, y0, y1], k) => {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, comp = pavComp(k), side = comp.userData.side;
        const g = part(comp, "ground", { ch: "ground" }); gs.push(g);
        pbox(g, "bone", x0 + .2, x1 - .2, y0, y1, 0, RH - CAP);
        pbox(g, "cap", x0, x1, y0 - (side === "E" ? .25 : 0), y1 + (side === "E" ? 0 : 0), RH - CAP, RH);
        // the door faces the court
        if (side === "S") pbox(g, "dark", x1, x1 + .06, my - 1, my + 1, 0, RH * .6);
        else if (side === "N") pbox(g, "dark", x0 - .06, x0, my - 1, my + 1, 0, RH * .6);
        else pbox(g, "dark", mx - 1, mx + 1, y0 - .06, y0, 0, RH * .6);
        proxy(g, x0, x1, y0, y1, 0, RH, { kind: "לשכה על הרצפה", name: `לשכה ${k + 1} מתוך 30`,
          rows: [["מידות", `${PAVX(x1 - x0)} × ${PAVX(y1 - y0)} אמות`], ["גובה", `${X.ground_chamber_h} אמות`]],
          src: [S("src", "שלושים לשכות אל הרצפה (יחזקאל מ יז)"), S("rec", "שורת חדרים בגובה הקרקע לאורך החומה, כמו בתוכנית הספר, עמ׳ 15 (סוגיה 24)"),
                S("art", `גובה ${X.ground_chamber_h} אמות ורוחב החדר אינם מפורשים`)] });
      });
      const q = X.pavilions[0];
      label(gs[0], (q[0] + q[1]) / 2, (q[2] + q[3]) / 2, C(X.ground_chamber_h) + C(3), "לשכות הרצפה", "30 לשכות, יחזקאל מ יז");
    }

    /* ============ gatehouses (Ezekiel 40) ============ */
    const palmCrowns = [];
    function gatehouse(c){
      const r = c.rects[0], along = (r[1] - r[0]) > (r[3] - r[2]);
      const mid = along ? (r[2] + r[3]) / 2 : (r[0] + r[1]) / 2;
      const lo = along ? r[0] : r[2], hi = along ? r[1] : r[3];
      const cen = along ? L.OUT_NS / 2 : L.OUT_EW / 2;
      const inner = c.id.includes("inner");
      // the porch faces the outer court: inwards on an outer gate (Ezek 40:9), outwards on an inner gate (40:31)
      const hiNearer = Math.abs(hi - cen) < Math.abs(lo - cen);
      const ulamHigh = inner ? !hiNearer : hiNearer;
      const gx = (r[0] + r[1]) / 2, gy = (r[2] + r[3]) / 2;
      const comp = components[c.id] || component(inner ? INNER : OUTER, c.id, "gate", c.name, c.id === "gate-outer-e" ? ["gate", "gate-outer-e"] : "gate",
        { inner, rect: r.slice(), at: [gx, gy] });
      const main = part(comp, "main", { h: HK });
      const Lg = G["m3g-gate-length"], half = G["m3g-gate-outer-width"] / 2, ph = G["m3g-gate-passage"] / 2, op = G["m3g-gate-opening"] / 2;
      const th = G["m3g-threshold"], cell = G["m3g-cell"], gap = G["m3g-cell-gap"], ulam = G["m3g-ulam"], ayil = G["m3g-ayil"];
      const partIn = g => (u0, u1, v0, v1, h0, h1, m) => {
        const a = ulamHigh ? lo + u0 : hi - u1, b = ulamHigh ? lo + u1 : hi - u0;
        if (along) pbox(g, m, a, b, mid + v0, mid + v1, h0, h1); else pbox(g, m, mid + v0, mid + v1, a, b, h0, h1);
      };
      const P = partIn(main);
      const Wp = (u, v, h) => { const a = ulamHigh ? lo + u : hi - u, x = along ? a : mid + v, y = along ? mid + v : a; return new THREE.Vector3(PX(y), TT + h, PZ(x)); };
      const du = Wp(1, 0, 0).sub(Wp(0, 0, 0)), rotU = Math.atan2(du.x, du.z);   // turns a piece's +Z towards +u
      const cells = [th, th + cell + gap, th + 2 * (cell + gap)];
      const u4 = th + 3 * cell + 2 * gap;                 // inner threshold
      const uU = u4 + th;                                 // porch
      const top = HG - CAP;
      const proj = L.gate[3];                             // how far an outer gate stands outside the wall
      const bar = dim("m3g-barrier"), sill = C(dim("md-gate-window-sill")), winH = C(dim("md-gate-window-height")), winW = dim("md-gate-window-width");
      const pwall = dim("md-gate-porch-wall"), jamb = dim("md-gate-jamb"), ov = OV;
      if (inner){
        // the passage is at the inner court's level, reached by eight steps before the porch (Ezek 40:31)
        P(0, Lg, -ph, ph, 0, LIFT_IN, "stone"); P(0, Lg, -ph, ph, LIFT_IN, LIFT_IN + .15, "marble");
        for (let k = 0; k < LV.inner_steps; k++) P(Lg, Lg + (LV.inner_steps - k) * TREAD, -op, op, 0, (k + 1) * RISE, "marble");
      } else {
        // the part outside the wall stands on the ground outside; seven steps rise through it to the outer court (Ezek 40:22)
        const n = LV.outer_steps, t = proj / n;
        for (let j = 0; j < n; j++) P(j * t, proj, -ph, ph, -OD, -OD + (j + 1) * OD / n, "marble");
        for (const s of [-1, 1]) P(0, proj, ...(s > 0 ? [ph, half] : [-half, -ph]), -OD, 0, "stone");
        P(proj, Lg, -ph, ph, 0, .15, "marble");
      }
      const carved = part(comp, "palm-carved", { h: HK, palm: "carved" });
      const po = dim("md-palm-carved-offset"), pcw = dim("md-palm-carved-width"), pcb = dim("md-palm-carved-base");
      for (const s of [-1, 1]){
        const V = (a, b) => s > 0 ? [a, b] : [-b, -a];
        [[0, th], [cells[0] + cell, cells[1]], [cells[1] + cell, cells[2]], [u4, uU]].forEach(([a, b]) => P(a, b, ...V(ph, half), 0, top, "stone"));
        cells.forEach(u => {
          P(u, u + cell, ...V(ph + cell, half), 0, top, "stone");                          // back wall of the guard chamber
          P(u, u + cell, ...V(ph, ph + bar), inner ? LIFT_IN : 0, (inner ? LIFT_IN : 0) + C(bar), "cap");   // the barrier (Ezek 40:12)
          for (const wy of [sill, HG * .6]) P(u + cell / 2 - winW / 2, u + cell / 2 + winW / 2, ...V(half, half + .06), wy, wy + winH, "dark");
        });
        P(uU, uU + ulam, ...V(half - pwall, half), 0, top, "stone");                       // porch side wall
        P(uU + ulam, Lg, ...V(op, half), 0, top, "stone");                                 // the pillars (ayil)
        // palms on the pillar: only in the "carved" option, so a post never hides one
        if (!hook("gate.palm.carved", { comp: c, group: carved, side: s, inner, Wp, rotU, Lg, op, half, pick: m => pick.push(m) }))
          partIn(carved)(Lg, Lg + .08, ...V(op + po, op + (po + pcw)), C(pcb), C(PALM_H), "gold");
        for (const wy of [sill, HG * .6]) P(uU + 2, uU + (2 + winW), ...V(half, half + .06), wy, wy + winH, "dark");
        P(-ov, Lg + ov, ...V(ph, half + ov), top, HG, "cap");                              // roof and cornice over each side
        P(0, jamb, ...V(op, ph), 0, top, "stone");                                         // door jambs
      }
      P(0, th, -ph, ph, DOOR, HG, "stone");                                                // above the 20-cubit gateway
      if (c.id === "gate-outer-e"){
        // "This gate shall be shut, it shall not be opened" (Ezek 44:1-2): two closed leaves in the
        // gateway, gilded like every gate's doors (Middot 2:3), standing on the lowest step
        const dt = atLeast(dim("md-gate-door-thickness"), "door"), u0 = .3, h0 = -OD + OD / LV.outer_steps;
        P(u0, u0 + dt, -op, op, h0, DOOR, "door");
        P(u0 - .06, u0, -.08, .08, h0, DOOR, "dark");                                    // the meeting of the two leaves
        const a0 = ulamHigh ? lo + u0 : hi - u0 - dt, a1 = a0 + dt;
        proxy(main, along ? a0 : mid - op, along ? a1 : mid + op, along ? mid - op : a0, along ? mid + op : a1, h0, DOOR,
          { kind: "שער", name: "דלתות השער המזרחי, סגורות", rows: [["רוחב", `${2 * op} אמות`], ["גובה", `${dim("gate-height")} אמות`], ["עובי", `${f1(C(dt))} מ״מ`]],
            src: [S("src", "״השער הזה סגור יהיה, לא יפתח, ואיש לא יבא בו״ (יחזקאל מד א–ב)"), S("src", "כל השערים נשתנו להיות של זהב (מידות ב ג)"),
                  S("art", "שתי כנפיים שטוחות")] }).userData.doors = true;
      }
      const gmw = atLeast(dim("md-gate-merlon-width"), "merlon"), gmg = atLeast(dim("md-gate-merlon-gap"), "merlon_gap");
      const gmh = atLeastMM(C(dim("md-gate-merlon-height")), "merlon_h");
      for (const s of [-1, 1]) for (let u = .6; u + gmw < Lg - .3; u += gmw + gmg){       // merlons along the roof edge
        const v = s > 0 ? [half - .9, half + .3] : [-half - .3, -half + .9];
        P(u, u + gmw, ...v, HG, HG + gmh, "cap");
      }
      P(u4, Lg, -half + pwall, half - pwall, top, HG, "roof");                            // roofed inner threshold and porch
      // palm posts, one on each side of the gateway, standing before the pillars (option "post")
      const post = part(comp, "palm-post", { h: HK, palm: "post" }), posts = [];
      const pd = dim("md-palm-post-distance"), pof = dim("md-palm-post-offset"), pb = dim("md-palm-post-base") / 2, pbh = C(dim("md-palm-post-base-height"));
      const pcap = dim("md-palm-capital-width") / 2;
      for (const s of [-1, 1]){
        if (hook("gate.palm.post", { comp: c, group: post, side: s, inner, Wp, rotU, pick: m => pick.push(m) })) continue;
        const u = Lg + pd, v = s * (op + pof);
        const px = along ? (ulamHigh ? lo + u : hi - u) : mid + v, py = along ? mid + v : (ulamHigh ? lo + u : hi - u);
        pbox(post, "stone", px - pb, px + pb, py - pb, py + pb, 0, pbh);
        const pw = atLeast(dim("md-palm-post-width"), "post") / 2; pbox(post, "bronze", px - pw, px + pw, py - pw, py + pw, pbh, C(PALM_H));
        pbox(post, "gold", px - pcap, px + pcap, py - pcap, py + pcap, C(PALM_H), C(PALM_H + CAP_H));
        posts.push([px, py]);
      }
      palmCrowns.push({ group: post, pts: posts });
      const cu = ulamHigh ? lo + Lg / 2 : hi - Lg / 2;
      label(main, along ? cu : gx, along ? gy : cu, HG + C(2), c.name, inner ? "מוביל אל העזרה" : "מוביל אל החצר החיצונה");
      proxy(main, r[0], r[1], r[2], r[3], 0, HG, { kind: "שער", name: c.name,
        rows: [["אורך", `${Lg} אמות · ${f1(C(Lg))} מ״מ`], ["רוחב", `${2 * half} אמות · ${f1(C(2 * half))} מ״מ`], ["פתח השער", `${2 * op} אמות`],
               ["גובה", `${HOPT[HK].gate} אמות · ${f1(HG)} מ״מ`], ["גובה הפתח", `${dim("gate-height")} אמות`], ["מעלות", inner ? `${LV.inner_steps} לפני האולם` : `${LV.outer_steps} בבליטה שמחוץ לחומה`]],
        src: [S("src", `שלושה תאים ${cell} × ${cell} מכל צד, ${gap} אמות ביניהם, סף ${th}, אולם ${ulam} ואיל ${ayil} (יחזקאל מ ו–יב)`),
              S("src", "גבול של אמה לפני התאים (מ יב), חלונות אטומות ותמרים על האילים (מ טז)"),
              S("src", inner ? "אולם השער הפנימי פונה אל החצר החיצונה, ושמונה מעלות לפניו (מ לא)" : "אולם השער פונה פנימה, אל החצר (מ ט); שבע מעלות (מ כב)"),
              S("dec", `גובה ${HOPT[HK].gate} אמות: ${HOPT[HK].source}. הפתח 20 אמות (מידות ב ג)`),
              S("art", "הגג פתוח מעל המעבר כדי שיראו את התאים. שיני החומה, הכרכוב ומקום החלונות")] });
    }

    /* ============ build every component ============ */
    L.comps.forEach(c => {
      if (c.kind === "chamber") chamber(c);
      else if (c.kind === "court") court(c);
      else if (c.id === "altar" || c.id === "ramp"){ HOFF = LIFT_IN; (c.id === "altar" ? altar : ramp)(c); HOFF = 0; }
    });
    const setHeights = hk => { HK = hk; HW = C(HOPT[hk].wall); HG = C(HOPT[hk].gate); SPLIT = C(HOPT[hk].wall - X.wall_cap); };
    for (const hk of Object.keys(HOPT)){
      setHeights(hk);
      buildWalls(); buildStoa();
      L.comps.filter(c => c.kind === "gate").forEach(gatehouse);
    }
    setHeights("j");
    buildGroundChambers();

    /* ============ the house: a plain block until the architectural Heichal is built ============ */
    const HOUSE = L.comps.find(q => q.id === "house");
    const HR = [Math.min(...HOUSE.rects.map(r => r[0])), Math.max(...HOUSE.rects.map(r => r[1])), Math.min(...HOUSE.rects.map(r => r[2])), Math.max(...HOUSE.rects.map(r => r[3]))];
    const house = component(INNER, "house", "house", "ההיכל", "house", { rect: HR.slice(), at: [(HR[0] + HR[1]) / 2, (HR[2] + HR[3]) / 2] });
    const block = part(house, "block");
    HOUSE.rects.forEach(r => {
      pbox(block, "stone", r[0], r[1], r[2], r[3], 0, C(HOUSE.h) - C(2));
      pbox(block, "gold", r[0] - .3, r[1] + .3, r[2] - .3, r[3] + .3, C(HOUSE.h) - C(2), C(HOUSE.h));
    });
    proxy(block, HR[0], HR[1], HR[2], HR[3], 0, C(HOUSE.h), { kind: "הבית", name: "ההיכל, גוש אבן",
      rows: [["טביעה", "T: 100 × 70, אולם 100 × 11 אמות"], ["גובה", `100 אמות · ${f1(C(100))} מ״מ`]],
      src: [S("src", "אורך, רוחב וגובה הבית לפי התוכנית"), S("art", "גוש פשוט")] });
    label(part(house, "label"), (HR[0] + HR[1]) / 2, (HR[2] + HR[3]) / 2, C(HOUSE.h) + C(4), "ההיכל", "");

    /* ============ palm crowns on the gate posts ============ */
    // a gold vase with seven fronds curving out, as in the video; they glow at dusk
    if (palmCrowns.some(q => q.pts.length)){
      const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(.55, .9, .12, 2.4); s.quadraticCurveTo(-.25, 1.2, 0, 0);
      const FROND = new THREE.ExtrudeGeometry(s, { depth: .08, bevelEnabled: false, curveSegments: 10 }); FROND.translate(0, 0, -.04);
      const size = C(dim("md-palm-crown-size")), at = C(PALM_H + CAP_H);
      palmCrowns.forEach(({ group, pts }) => pts.forEach(([px, py]) => {
        const rt = new THREE.Group(); rt.position.set(PX(py), TT + at, PZ(px)); rt.scale.setScalar(size);
        const vase = new THREE.Mesh(new THREE.CylinderGeometry(.45, .22, .7, 16), MAT.gold); vase.position.y = .35; rt.add(vase);
        for (let i = 0; i < 7; i++){
          const f = new THREE.Mesh(FROND, MAT.palm); f.position.y = .55;
          f.rotation.set(0, i / 7 * Math.PI * 2, -.18 - (i % 2) * .12); rt.add(f);
        }
        rt.traverse(o => { if (o.isMesh) o.castShadow = true; });
        group.add(rt);
      }));
    }

    /* ============ the courts' names ============ */
    label(part(INNER, "label"), 130, 195, C(3), "העזרה", "החצר הפנימית");
    label(part(OUTER, "label"), 160, 272, C(3), "החצר החיצונה", "");

    bat.flush(MAT);
    root.userData = { id: "temple", kind: "temple", dims: [], label_he: "המקדש", components, parts, pick, labels, materials: MATS, frame: F };
    return root;
  }

  global.TempleScene = { version: "2026-10-02", build, frame, Batcher, applyOptions, S, info: { innerCourt: innerCourtInfo } };
})(typeof window !== "undefined" ? window : this);

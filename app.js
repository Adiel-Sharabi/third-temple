/* Web/site/app.js: the learning site's page. Draws the Temple with the shared 3D/Scene/scene-core.js
 * (copied into dist/scene/ at build time) from data/scene.json, and explains each component from
 * data/dimensions.json, data/sources.json and data/bibliography.json. Everything is static; the
 * only network calls are this site's own files and the three.js CDN.
 *
 * Not the print demo: no tiles, LED, cable, filament or fit checks.
 * Claude Code, 2026-10-02. Design: the Claude Design canvas "Unified" (three themes) and "Mobile".
 */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const BUILD = (document.querySelector('meta[name="build"]') || {}).content || "dev";
  const v = path => path + "?v=" + encodeURIComponent(BUILD);
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, val){ try { localStorage.setItem(k, val); } catch (e) { /* private mode: not remembered */ } },
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  /* the layout modes; the same media queries as styles.css */
  const dockQ = window.matchMedia("(min-width: 1280px) and (min-height: 600px)");        // layers docked on the right
  const sheetQ = window.matchMedia("(orientation: portrait) and (max-width: 1199.98px)"); // info as a bottom sheet
  const smallQ = window.matchMedia("(max-width: 899.98px), (max-height: 520px)");         // phones: a smaller shadow map
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- words ---------- */
  const KIND_HE = { wall: "חומה", gate: "שער", colonnade: "אכסדרה", "pavement-chamber": "לשכה על הרצפה", chamber: "לשכה",
    kitchen: "חצר פינתית", altar: "מזבח", ramp: "כבש", laver: "כיור", rings: "בית המטבחיים", house: "הבית", level: "מפלס" };
  const LAYER_OF = { wall: "walls", gate: "walls", colonnade: "walls", chamber: "chambers", kitchen: "chambers",
    "pavement-chamber": "chambers", altar: "altar", ramp: "altar", laver: "altar", rings: "altar", house: "house" };
  const RANK = ["explicit", "derived", "measured", "interpretive", "assumption", "unknown"];
  const CONF_HE = { explicit: "מפורש במקור", derived: "נגזר חשבונית", measured: "נמדד", interpretive: "פרשני",
    assumption: "הנחת עבודה", unknown: "לא ידוע" };
  const TAG_HE = { src: "מקור", rec: "שחזור", dec: "החלטה", art: "עיצוב" };
  const WORK_HE = { middot: "משנה מידות", tamid: "משנה תמיד", yoma: "משנה יומא", sukkah: "משנה סוכה", bikkurim: "משנה ביכורים",
    menachot: "משנה מנחות", shekalim: "משנה שקלים", "rambam-bh": "רמב״ם, בית הבחירה", "rambam-klei": "רמב״ם, כלי המקדש",
    "rambam-temidin": "רמב״ם, תמידין ומוספין", "rambam-yom-kippur": "רמב״ם, עבודת יום הכפורים",
    "rambam-korbanot": "רמב״ם, מעשה הקרבנות", exodus: "שמות", ezekiel: "יחזקאל", kings1: "מלכים א", chronicles2: "דברי הימים ב",
    "josephus-war": "יוסף בן מתתיהו, מלחמות היהודים", "josephus-ant": "יוסף בן מתתיהו, קדמוניות היהודים" };

  /* Hebrew numerals for references: 3 -> ג, 15 -> טו, 16 -> טז */
  function heb(n){
    if (typeof n !== "number" || n < 1) return String(n);
    const H = [[400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"], [90, "צ"], [80, "פ"], [70, "ע"], [60, "ס"], [50, "נ"], [40, "מ"], [30, "ל"], [20, "כ"], [10, "י"],
      [9, "ט"], [8, "ח"], [7, "ז"], [6, "ו"], [5, "ה"], [4, "ד"], [3, "ג"], [2, "ב"], [1, "א"]];
    let s = "", r = n;
    for (const [val, ch] of H) while (r >= val){ s += ch; r -= val; }
    return s.replace("יה", "טו").replace("יו", "טז");
  }

  /* ---------- state ---------- */
  const state = {
    theme: document.documentElement.getAttribute("data-theme") || "night",
    opts: {},                    // the open options shown: {h, ch, palm}; defaults from data/methods.json
    tab: "short", reading: false, labels: true, conf: false,
    layers: { walls: true, chambers: true, altar: true, house: true },
    cubit: null, sel: null,
  };
  let D = null;                  // loaded data
  let G3 = null;                 // three.js objects

  /* ---------- load ---------- */
  const getJSON = p => fetch(v(p)).then(r => { if (!r.ok) throw new Error(p + ": " + r.status); return r.json(); });
  Promise.all([getJSON("data/scene.json"), getJSON("data/dimensions.json"), getJSON("data/sources.json"),
    getJSON("data/bibliography.json"), getJSON("data/methods.json"), fetch("data/build.json?t=" + Date.now()).then(r => r.json())])
    .then(([scene, dims, sources, bib, methods, build]) => {
      D = { scene, dims, sources, bib, methods, build, DIM: {}, BIB: {} };
      dims.groups.forEach(g => g.entries.forEach(e => { D.DIM[e.id] = Object.assign({ group: g.id }, e); }));
      bib.works.forEach(w => { D.BIB[w.id] = w; });
      methods.options.forEach(o => { state.opts[o.key] = o.default; });
      initChrome();
      initScene();
      $("status").textContent = "";
      renderPanel();
    })
    .catch(err => {
      console.error(err);
      $("status").textContent = "לא ניתן לטעון את הדגם. " + (window.THREE ? "" : "ספריית התלת־ממד לא נטענה.");
    });

  /* ---------- chrome: header, layers, footer ---------- */
  function initChrome(){
    // theme
    document.querySelectorAll("[data-theme-pick]").forEach(b => b.addEventListener("click", () => {
      applyTheme(b.dataset.themePick); store.set("mikdash-theme", b.dataset.themePick);
    }));
    pressThemes();
    // the method: one is built (Mikdash3); the others are listed, disabled, "בקרוב"
    renderMethodList();
    $("b-method").addEventListener("click", () => setMethodList(!$("method").classList.contains("open")));
    $("method-list").addEventListener("click", e => {
      const b = e.target.closest("[data-method]"); if (!b) return;
      if (b.getAttribute("aria-disabled") === "true"){ $("live").textContent = b.textContent.trim().replace(/בקרוב$/, "") + ": בקרוב"; return; }
      setMethodList(false);
    });
    document.addEventListener("pointerdown", e => {
      if (!$("method").contains(e.target)) setMethodList(false);
      if (!$("hdr-tools").contains(e.target) && !$("b-menu").contains(e.target)) setMenu(false);
    });
    // methods and open options: every option the scene supports, as a toggle
    renderMethods();
    $("methods-body").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.k) setOption(b.dataset.k, b.dataset.v);
      else if (b.dataset.reset !== undefined){
        D.methods.options.forEach(o => { state.opts[o.key] = o.default; });
        optionsChanged(); $("methods-title").focus();
      }
    });
    $("tab-body").addEventListener("click", e => {
      const b = e.target.closest("[data-open-opt]"); if (!b) return;
      openDrawer("methods");
      const sec = $("methods-body").querySelector(`[data-opt="${b.dataset.openOpt}"]`);
      if (sec) sec.scrollIntoView({ block: "start" });
    });
    // layers
    document.querySelectorAll("[data-layer]").forEach(cb => cb.addEventListener("change", () => {
      state.layers[cb.dataset.layer] = cb.checked; syncLayers();
    }));
    $("l-labels").addEventListener("change", e => { state.labels = e.target.checked; $("labels").hidden = !state.labels; requestRender(); });
    $("l-conf").addEventListener("change", e => { state.conf = e.target.checked; syncConfidence(); });
    // the cubit
    const cubits = (D.dims.cubit_options || []).filter(c => typeof c.cm === "number").sort((a, b) => a.cm - b.cm);
    const saved = parseFloat(store.get("mikdash-cubit"));
    state.cubit = cubits.find(c => c.cm === saved) || cubits[0] || { cm: 48, name_he: "" };
    $("cubits").innerHTML = `<span class="seg-label" aria-hidden="true" style="display:flex;align-items:center;padding:0 8px;font-size:14px;color:var(--muted)">אמה =</span>` +
      cubits.map(c => `<button type="button" data-cm="${c.cm}" title="${esc(c.name_he)}" aria-pressed="${c === state.cubit}">${c.cm} ס״מ</button>`).join("");
    $("cubits").addEventListener("click", e => {
      const b = e.target.closest("button[data-cm]"); if (!b) return;
      state.cubit = cubits.find(c => String(c.cm) === b.dataset.cm); store.set("mikdash-cubit", state.cubit.cm);
      $("cubits").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      renderPanel();
    });
    // the cubit choice lives in the footer when the layers are docked, else in the layers drawer
    const placeCubits = () => {
      const home = dockQ.matches ? $("foot") : $("layers");
      if ($("cubits").parentNode !== home) home.insertBefore($("cubits"), dockQ.matches ? home.firstChild : $("layers").querySelector(".legend"));
    };
    placeCubits();
    if (dockQ.addEventListener) dockQ.addEventListener("change", placeCubits);
    // build stamp
    const t = new Date(D.build.built);
    const stamp = isNaN(t) ? D.build.built : `נבנה ${t.getDate()}.${t.getMonth() + 1}.${t.getFullYear()} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    $("stamp").textContent = stamp; $("m-stamp").textContent = stamp; $("stamp").title = D.build.built;
    // reading view
    $("b-read").addEventListener("click", () => setReading(!state.reading));
    // tabs (arrow keys move between them; in RTL the left arrow goes forward)
    const tabs = ["short", "src", "dims"];
    tabs.forEach(k => $("t-" + k).addEventListener("click", () => setTab(k)));
    document.querySelector(".tabs").addEventListener("keydown", e => {
      const i = tabs.indexOf(state.tab); let j = null;
      if (e.key === "ArrowLeft") j = (i + 1) % 3; else if (e.key === "ArrowRight") j = (i + 2) % 3;
      else if (e.key === "Home") j = 0; else if (e.key === "End") j = 2;
      if (j != null){ e.preventDefault(); setTab(tabs[j]); $("t-" + tabs[j]).focus(); }
    });
    // the drawers (methods; layers when not docked) open in the info panel's place; the menu on phones
    Object.keys(DRAWERS).forEach(id => $(DRAWERS[id]).addEventListener("click", () => {
      const open = !$(id).classList.contains("open") || (id === "layers" && dockQ.matches);
      openDrawer(open ? id : null);
      if (!open) $(DRAWERS[id]).focus();
    }));
    document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.close; openDrawer(null); $(DRAWERS[id]).focus();
    }));
    $("b-menu").addEventListener("click", () => setMenu(!$("hdr-tools").classList.contains("open")));
    $("sheet-handle").addEventListener("click", () => {
      const open = !document.body.classList.contains("sheet-open");
      document.body.classList.toggle("sheet-open", open); $("sheet-handle").setAttribute("aria-expanded", String(open));
      reframeSoon();
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if ($("method").classList.contains("open")){ setMethodList(false); $("b-method").focus(); return; }
      if ($("hdr-tools").classList.contains("open")){ setMenu(false); $("b-menu").focus(); return; }
      const open = Object.keys(DRAWERS).find(id => $(id).classList.contains("open"));
      if (open){ openDrawer(null); $(DRAWERS[open]).focus(); return; }
      if (state.reading) setReading(false);
    });
    // keyboard: choose a component from a list
    $("pick-list").addEventListener("change", e => { if (e.target.value) selectComponent(e.target.value); else clearSelection(); });
    // the system theme, when the viewer has not chosen one
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => { if (!store.get("mikdash-theme")) applyTheme(dark.matches ? "night" : "gallery"); };
    if (dark.addEventListener) dark.addEventListener("change", follow);
  }

  function pressThemes(){
    document.querySelectorAll("[data-theme-pick]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themePick === state.theme)));
  }
  function setReading(on){
    state.reading = on; document.body.classList.toggle("reading", on);
    $("b-read").setAttribute("aria-pressed", String(on)); $("b-read").textContent = on ? "תצוגה רגילה" : "תצוגת קריאה";
    reframeSoon();
  }

  /* ---------- drawers, the menu and the method list ---------- */
  const DRAWERS = { methods: "b-methods", layers: "b-layers" };   // drawer id -> its header button
  function openDrawer(id){
    Object.keys(DRAWERS).forEach(k => {
      const on = k === id;
      $(k).classList.toggle("open", on); $(DRAWERS[k]).setAttribute("aria-expanded", String(on));
    });
    document.body.classList.toggle("drawer-open", !!id && !(id === "layers" && dockQ.matches));
    setMenu(false); setMethodList(false);
    if (id){ const h = $(id).querySelector("h2"); if (h) h.focus({ preventScroll: true }); }
    reframeSoon();
  }
  function setMenu(on){
    $("hdr-tools").classList.toggle("open", on); $("b-menu").setAttribute("aria-expanded", String(on));
  }
  function setMethodList(on){
    $("method").classList.toggle("open", on); $("b-method").setAttribute("aria-expanded", String(on));
  }
  function setTab(k){
    state.tab = k;
    ["short", "src", "dims"].forEach(t => {
      const b = $("t-" + t); b.setAttribute("aria-selected", String(t === k)); b.tabIndex = t === k ? 0 : -1;
    });
    $("tab-body").setAttribute("aria-labelledby", "t-" + k);
    renderPanel();
  }

  /* ---------- theme: CSS tokens are the one source; the scene reads them ---------- */
  const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function applyTheme(t){
    state.theme = t; document.documentElement.setAttribute("data-theme", t); pressThemes();
    if (G3){ setLighting(); syncConfidence(); }
  }

  /* ---------- the 3D stage ---------- */
  function initScene(){
    const data = D.scene, L = data.L, X = data.X;
    const cv = $("cv");
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;              // the model is static: shadows are redrawn only when it changes
    const scene = new THREE.Scene();
    if (THREE.RoomEnvironment){
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    }
    const camera = new THREE.PerspectiveCamera(30, 1, 5, 8000);
    const controls = new THREE.OrbitControls(camera, cv);
    controls.enableDamping = !reduceMotion.matches;
    controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 40; controls.maxDistance = 2600;

    const hemi = new THREE.HemisphereLight(0xfff6e8, 0x6b5a45, 0.4); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe9c9, 1.55);
    sun.position.set(-300, 560, 330); sun.castShadow = true;
    const sm = smallQ.matches ? 1024 : 2048;            // at most 2048; 1024 on phones
    sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.25;
    Object.assign(sun.shadow.camera, { left: -400, right: 400, top: 400, bottom: -400, near: 50, far: 1600 });
    scene.add(sun);
    const fire = new THREE.PointLight(0xffb066, 0, 420, 1.6); scene.add(fire);   // the altar's fire, at dusk
    const OD = X.levels.outer_mm;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), new THREE.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -OD - 0.05; ground.receiveShadow = true; scene.add(ground);

    const MATS = TempleMaterials.create({ mm: L.MM, anisotropy: renderer.capabilities.getMaxAnisotropy() });
    const root = TempleScene.build(data, { materials: MATS });
    scene.add(root);
    const F = TempleScene.frame(L);
    const U = root.userData;
    const altar = U.components.altar;
    if (altar){ const [ax, ay] = altar.userData.at; fire.position.set(F.PX(ay), X.levels.inner_mm + F.C(14), F.PZ(ax)); }

    // confidence materials, coloured from the theme
    const confMat = {};
    RANK.forEach(k => { confMat[k] = new THREE.MeshStandardMaterial({ roughness: .85, metalness: 0 }); });

    G3 = { renderer, scene, camera, controls, hemi, sun, fire, MATS, root, U, F, confMat, cv, labelEls: [] };

    // labels: the core's anchors, as DOM names
    $("labels").innerHTML = "";
    U.labels.forEach(o => {
      const el = document.createElement("div"); el.className = "lab";
      el.innerHTML = esc(o.userData.label.text) + (o.userData.label.sub ? `<small>${esc(o.userData.label.sub)}</small>` : "");
      $("labels").appendChild(el); G3.labelEls.push({ o, el });
    });
    // the keyboard list of components
    const groups = {};
    Object.values(U.components).forEach(c => {
      const u = c.userData; if (!isPickable(u.id)) return;
      (groups[u.kind] = groups[u.kind] || []).push(u);
    });
    $("pick-list").innerHTML = `<option value="">—</option>` + Object.keys(groups).map(k =>
      `<optgroup label="${esc(KIND_HE[k] || k)}">${groups[k].map(u => `<option value="${esc(u.id)}">${esc(u.label_he)}</option>`).join("")}</optgroup>`).join("");

    applyOptions();
    setLighting();
    syncLayers();
    frameAll();
    initPicking();
    window.addEventListener("resize", onResize);
    controls.addEventListener("change", requestRender);
    window.__temple = { root, camera, controls, select: selectComponent, render: requestRender,   // for headless checks
      setOption, openDrawer, freeRect, opts: () => Object.assign({}, state.opts) };
    requestRender();
  }

  function isPickable(id){ return G3.U.pick.some(m => m.userData.component === id); }
  function shownInScene(o){ for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }

  function applyOptions(){
    TempleScene.applyOptions(G3.root, state.opts);
    G3.renderer.shadowMap.needsUpdate = true;
  }
  function setOption(k, val){
    if (state.opts[k] === val) return;
    state.opts[k] = val;
    optionsChanged();
    const o = D.methods.options.find(x => x.key === k), c = o && o.choices.find(x => x.value === val);
    if (c) $("live").textContent = `${o.question_he}: מוצג ${c.name_he}`;
    const b = $("methods-body").querySelector(`[data-k="${k}"][data-v="${val}"]`); if (b) b.focus({ preventScroll: true });
  }
  function optionsChanged(){
    const top = $("methods-body").scrollTop;
    renderMethods(); $("methods-body").scrollTop = top;
    if (!G3) return;
    applyOptions();
    if (state.sel) selectComponent(state.sel.id);     // the click text belongs to the option shown
    else renderPanel();
    requestRender();
  }
  function syncLayers(){
    Object.values(G3.U.components).forEach(c => {
      const layer = LAYER_OF[c.userData.kind]; if (layer) c.visible = state.layers[layer];
    });
    if (state.sel && !shownInScene(G3.U.components[state.sel.id])) clearSelection();
    G3.renderer.shadowMap.needsUpdate = true; hideHover(); requestRender();
  }

  function setLighting(){
    const dusk = token("--scene-light") === "dusk", M = G3.MATS.MAT;
    G3.sun.intensity = dusk ? .32 : 1.55; G3.sun.color.set(dusk ? 0x9fb4ff : 0xfff0d6);
    G3.hemi.intensity = dusk ? .16 : .4;
    G3.MATS.envMats.forEach(m => { m.envMapIntensity = m.userData.env * (dusk ? .2 : .7); });
    G3.fire.intensity = dusk ? 3.2 : 0;
    if (M.ember) M.ember.emissiveIntensity = dusk ? 2.2 : .9;
    if (M.flame) M.flame.emissiveIntensity = dusk ? 3 : 1.6;
    if (M.palm) M.palm.emissiveIntensity = dusk ? .9 : 0;
    syncConfidence(true);
    requestRender();
  }

  /* recolour each component by the weakest confidence among the dims that govern its form.
     The project's own finishing details (group "model-design": ornament, window spacing…) are
     left out, or every component would read "assumption"; they count only when a component has
     nothing else. The floors stay as they are. */
  const FINISHING = "model-design";
  function weakest(dims){
    const all = (dims || []).map(id => D.DIM[id]);
    const form = all.filter(e => e && e.group !== FINISHING);
    let r = -1;
    (form.length ? form : all).forEach(e => { const k = e ? RANK.indexOf(e.confidence) : RANK.length - 1; if (k > r) r = k; });
    return RANK[Math.max(0, r)];
  }
  function syncConfidence(coloursOnly){
    const col = { explicit: "--c-explicit", derived: "--c-derived", measured: "--c-derived", interpretive: "--c-interp", assumption: "--c-assume", unknown: "--c-assume" };
    RANK.forEach(k => { const hex = token(col[k]) || "#888888"; G3.confMat[k].color.set(hex).convertSRGBToLinear(); G3.confMat[k].opacity = 1; });
    if (coloursOnly !== true){
      Object.values(G3.U.components).forEach(c => {
        if (c.userData.kind === "level") return;
        const m = G3.confMat[weakest(c.userData.dims)];
        c.traverse(o => {
          if (!o.isMesh || o.material === G3.MATS.PROXY) return;
          if (!o.userData.mat0) o.userData.mat0 = o.material;
          o.material = state.conf ? m : o.userData.mat0;
        });
      });
    }
    requestRender();
  }

  /* ---------- camera: the whole court, centred in the space the panels leave free ---------- */
  const shown = el => { if (!el) return false; const cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden"; };
  function freeRect(){
    const s = $("stage").getBoundingClientRect(), w = s.width, h = s.height, pad = 8;
    const docked = dockQ.matches;
    // the info panel's slot: the panel itself, or a drawer open over it
    const slot = ["panel", "methods", "layers"].map($).filter(el => shown(el) && !(el.id === "layers" && docked)).map(el => el.getBoundingClientRect());
    const f = shown($("foot")) ? $("foot").getBoundingClientRect() : null, foot = f && f.height ? f : null;
    if (sheetQ.matches){
      let top = Math.min(s.bottom, ...slot.map(r => r.top));
      if (foot) top = Math.min(top, foot.top);
      return { x0: pad, x1: w - pad, y0: pad, y1: Math.max(120, top - s.top - pad), w, h };
    }
    const x0 = Math.max(s.left, ...slot.map(r => r.right)) - s.left + pad;
    const x1 = docked && shown($("layers")) ? $("layers").getBoundingClientRect().left - s.left - pad : w - pad;
    const y1 = foot ? foot.top - s.top - pad : h - pad;
    return { x0, x1: Math.max(x0 + 120, x1), y0: pad, y1: Math.max(pad + 120, y1), w, h };
  }
  function viewOffset(){
    const r = freeRect(), cam = G3.camera;
    const fx = (r.x0 + r.x1) / 2, fy = (r.y0 + r.y1) / 2;
    cam.aspect = r.w / r.h;
    cam.setViewOffset(r.w, r.h, r.w / 2 - fx, r.h / 2 - fy, r.w, r.h);
    cam.updateProjectionMatrix();
    return r;
  }
  /* Fit the court's plan circle (radius R) across the free width, and its foreshortened depth
     (R seen from the camera's elevation, plus the height) across the free height. keepDir keeps
     the viewer's direction; the target always returns to the court's centre. */
  let lastRect = "";
  function frameAll(keepDir){
    const r = viewOffset(), cam = G3.camera;
    lastRect = JSON.stringify(r);
    const box = new THREE.Box3().setFromObject(G3.root), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const R = Math.hypot(size.x, size.z) / 2;
    const dir = keepDir ? cam.position.clone().sub(G3.controls.target).normalize() : new THREE.Vector3(540, 500, 680).normalize();
    const up = Math.min(1, Math.abs(dir.y)), Rv = R * up + size.y * Math.sqrt(1 - up * up) / 2;
    const fx = (r.x1 - r.x0) / 2, fy = (r.y1 - r.y0) / 2;
    const d = 1.06 * (r.h / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.max(R / fx, Rv / fy);
    const at = new THREE.Vector3(c.x, box.min.y + size.y * .15, c.z);
    cam.position.copy(at).addScaledVector(dir, Math.min(G3.controls.maxDistance, Math.max(G3.controls.minDistance, d)));
    G3.controls.target.copy(at); G3.controls.update();
  }
  /* after a layout change (drawer, sheet, reading view, resize or rotation): reframe once the
     panels have finished moving, and only if the free space actually changed */
  let reframeT = null;
  function reframeSoon(force){
    clearTimeout(reframeT);
    reframeT = setTimeout(() => {
      if (!G3) return;
      resize(true);
      if (force || JSON.stringify(freeRect()) !== lastRect) frameAll(true);
      requestRender();
    }, reduceMotion.matches ? 30 : 290);
  }
  function onResize(){ if (!G3) return; resize(true); requestRender(); reframeSoon(); }
  function resize(force){
    const cv = G3.cv, w = cv.clientWidth, h = cv.clientHeight, pr = G3.renderer.getPixelRatio();
    if (force || cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)){ G3.renderer.setSize(w, h, false); viewOffset(); }
  }

  /* ---------- render on demand ---------- */
  let pending = false;
  function requestRender(){ if (G3 && !pending){ pending = true; requestAnimationFrame(frame); } }
  function frame(){
    pending = false;
    resize(false);
    const moved = G3.controls.update();
    G3.renderer.render(G3.scene, G3.camera);
    placeLabels(); placeMarker();
    if (moved) requestRender();
  }
  const v3 = () => new THREE.Vector3();
  function project(p){
    const q = p.clone().project(G3.camera), r = G3.cv.getBoundingClientRect();
    return { x: (q.x + 1) / 2 * r.width, y: (1 - q.y) / 2 * r.height, z: q.z };
  }
  function placeLabels(){
    if (!state.labels) return;
    const w = G3.cv.clientWidth, h = G3.cv.clientHeight, placed = [], p = v3();
    G3.labelEls.map(l => { l.o.getWorldPosition(p); return Object.assign({ l }, project(p)); })
      .sort((a, b) => a.z - b.z)
      .forEach(({ l, x, y, z }) => {
        if (!shownInScene(l.o)){ l.el.style.display = "none"; return; }
        y -= 9;
        l.el.style.display = "";                        // measured while shown: a hidden label has no width
        const bw = l.el.offsetWidth || 90, bh = l.el.offsetHeight || 22;
        const r = [x - bw / 2 - 3, y - bh - 3, x + bw / 2 + 3, y + 3];
        const vis = z < 1 && r[0] >= 0 && r[2] <= w && y > bh && y < h && !placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
        l.el.style.display = vis ? "" : "none";
        if (vis){ l.el.style.left = x + "px"; l.el.style.top = y + "px"; placed.push(r); }
      });
  }
  function placeMarker(){
    const m = $("marker");
    if (!state.sel || !state.sel.top){ m.hidden = true; return; }
    const s = project(state.sel.top);
    m.hidden = s.z >= 1; m.style.left = s.x + "px"; m.style.top = s.y + "px";
  }

  /* ---------- hover and click ---------- */
  function initPicking(){
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), cv = G3.cv;
    const hit = (cx, cy) => {
      const r = cv.getBoundingClientRect();
      ptr.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, G3.camera);
      const live = G3.U.pick.filter(shownInScene);
      return ray.intersectObjects(live, false)[0] || null;
    };
    let down = null, hoverReq = null;
    cv.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
    cv.addEventListener("pointerup", e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const h = hit(e.clientX, e.clientY);
      if (h) selectComponent(h.object.userData.component, h.object); else clearSelection();
    });
    cv.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse" || e.buttons){ hideHover(); return; }
      hoverReq = [e.clientX, e.clientY];
      requestAnimationFrame(() => {
        if (!hoverReq) return;
        const [x, y] = hoverReq; hoverReq = null;
        const h = hit(x, y);
        if (!h){ hideHover(); cv.style.cursor = ""; return; }
        showHover(h.object.userData.component, x, y); cv.style.cursor = "pointer";
      });
    });
    cv.addEventListener("pointerleave", hideHover);
  }
  function keyDim(u){ return (u.dims || []).map(id => D.DIM[id]).find(Boolean) || null; }
  function showHover(id, x, y){
    const c = G3.U.components[id]; if (!c) return;
    const u = c.userData, e = keyDim(u), el = $("hover"), s = $("stage").getBoundingClientRect();
    el.innerHTML = `<b>${esc(u.label_he)}</b>` + (e ? `<span>${esc(valueText(e))}</span><span class="dot c-${esc(e.confidence)}" title="${esc(CONF_HE[e.confidence] || "")}"></span>` : "");
    el.style.left = (x - s.left) + "px"; el.style.top = (y - s.top) + "px"; el.hidden = false;
  }
  function hideHover(){ $("hover").hidden = true; }

  function selectComponent(id, mesh){
    const c = G3.U.components[id]; if (!c) return;
    if (!mesh || !shownInScene(mesh)) mesh = G3.U.pick.find(m => m.userData.component === id && shownInScene(m)) || G3.U.pick.find(m => m.userData.component === id);
    const box = new THREE.Box3();
    c.traverse(o => { if (o.isMesh && o.material !== G3.MATS.PROXY && shownInScene(o)) box.expandByObject(o); });
    if (box.isEmpty() && mesh) box.setFromObject(mesh);
    const top = box.isEmpty() ? null : new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    state.sel = { id, info: mesh ? mesh.userData.info : null, top };
    $("pick-list").value = id;
    hideHover(); renderPanel(); requestRender();
    $("live").textContent = "נבחר: " + c.userData.label_he;
  }
  function clearSelection(){ state.sel = null; $("pick-list").value = ""; renderPanel(); requestRender(); }

  /* ---------- numbers ---------- */
  const fmt = n => typeof n === "number" ? (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)) : String(n);
  function unitText(e){ const u = e.unit || "אמה"; return u === "מניין" ? "" : u; }
  function valueText(e){                                  // a described value ("על אילי השער…") takes no unit
    const u = typeof e.value === "number" ? unitText(e) : "";
    return u ? `${fmt(e.value)} ${u}` : fmt(e.value);
  }
  function metres(e){
    if (typeof e.value !== "number" || e.axis === "count" || !state.cubit) return null;
    if (!e.unit || e.unit === "אמה") return e.value * state.cubit.cm / 100;
    if (e.unit === "טפח") return e.value * state.cubit.cm / 600;
    return null;
  }
  const metresText = m => (m >= 10 ? m.toFixed(1) : m.toFixed(2)).replace(/\.0+$/, "") + " מ׳";

  /* ---------- citations of a component ---------- */
  function refText(c){
    if (!Array.isArray(c.ref) || !c.ref.length || typeof c.ref[0] !== "number") return null;
    let s = c.ref.map(heb).join(",");
    if (c.range_end) s += "–" + heb(c.range_end);
    return s;
  }
  function citeLabel(c){
    const w = WORK_HE[c.work], r = refText(c);
    if (w && r) return `${w} ${r}`;
    return c.label;
  }
  function citationsOf(u){
    const prim = new Map(), sec = new Map(), dec = new Map();
    (u.dims || []).forEach(id => {
      const e = D.DIM[id]; if (!e) return;
      e.citations.forEach(c0 => {
        const list = c0.embedded ? [c0.embedded, { kind: "decision", label: c0.label }] : [c0];
        list.forEach(c => {
          if (c.kind === "primary") prim.set(c.work + "|" + (c.ref || []).join(".") + "|" + (c.range_end || ""), c);
          else if (c.kind === "secondary") sec.set(c.work + "|" + c.label, c);
          else if (c.kind === "decision") dec.set(c.label, c);
        });
      });
    });
    return { prim: [...prim.values()], sec: [...sec.values()], dec: [...dec.values()] };
  }
  function quoteOf(c){
    if (!Array.isArray(c.ref) || c.ref.length !== 2) return null;
    const q = D.sources.quotes[c.work]; return q ? q[c.ref[0] + ":" + c.ref[1]] || null : null;
  }

  /* ---------- the info panel ---------- */
  function renderPanel(){
    if (!D) return;
    const body = $("tab-body");
    if (!state.sel){
      $("crumb").textContent = "מבט־על"; $("p-title").textContent = "המבנה"; $("p-sub").textContent = "לחצו על רכיב בדגם, או בחרו אותו מהרשימה";
      const nComp = G3 ? Object.values(G3.U.components).filter(c => isPickable(c.userData.id)).length : 0;
      const nQ = Object.values(D.sources.quotes).reduce((a, q) => a + Object.keys(q).length, 0);
      const nDim = Object.keys(D.DIM).length;
      body.innerHTML = state.tab === "short" ? `
        <p>הדגם בנוי מן המידות שאסף הפרויקט. לכל מידה יש מקור ורמת ודאות: מה מפורש במשנה ובמקרא, מה נגזר מהם בחשבון, מה הכריעו המפרשים, ומה הוא הנחת עבודה של הפרויקט.</p>
        <div class="stats">
          <div><b>${nComp}</b><span>רכיבים שאפשר ללחוץ עליהם</span></div>
          <div><b>${nDim}</b><span>מידות, לכל אחת מקור ותגית ודאות</span></div>
          <div><b>${nQ}</b><span>ציטוטים קצרים ממקורות חופשיים</span></div>
        </div>
        <p class="note">גררו כדי לסובב, גלגלו כדי לקרב. ריחוף מעל רכיב מראה את שמו ואת המידה העיקרית שלו; לחיצה פותחת כאן את המידות והמקורות.</p>`
        : `<p class="note">בחרו רכיב בדגם כדי לראות ${state.tab === "src" ? "את המקורות שעליהם הוא בנוי" : "את טבלת המידות שלו"}.</p>`;
      return;
    }
    const c = G3.U.components[state.sel.id], u = c.userData, info = state.sel.info || {};
    const court = c.parent && c.parent.userData && c.parent.userData.label_he;
    $("crumb").textContent = ["מבט־על", court && court !== u.label_he ? court : null, u.label_he].filter(Boolean).join(" / ");
    $("p-title").textContent = u.label_he;
    $("p-sub").textContent = info.name && info.name !== u.label_he ? info.name : (KIND_HE[u.kind] || "");
    if (state.tab === "short") body.innerHTML = tabShort(u, info);
    else if (state.tab === "src") body.innerHTML = tabSources(u);
    else body.innerHTML = tabDims(u);
  }

  function tabShort(u, info){
    const e = keyDim(u), dims = (u.dims || []).map(id => D.DIM[id]).filter(Boolean);
    const stats = [];
    if (e) stats.push([fmt(e.value), `${unitText(e) || "מניין"}, ${e.name_he}`]);
    const hgt = dims.find(d => d.axis === "z" && d !== e && typeof d.value === "number");
    if (hgt) stats.push([fmt(hgt.value), `${unitText(hgt)}, ${hgt.name_he}`]);
    const m = e && metres(e);
    if (m != null) stats.push([metresText(m).replace(" מ׳", ""), `מטר, באמה של ${state.cubit.cm} ס״מ`]);
    const noted = dims.find(d => d.note_he), note = noted && noted.note_he;
    const basis = (info.src || []).map(s => `<li><span class="tag ${esc(s.tag)}">${esc(TAG_HE[s.tag] || s.tag)}</span><span>${esc(s.text)}</span></li>`).join("");
    return (note ? `<p>${noted === e ? "" : `<b>${esc(noted.name_he)}:</b> `}${esc(note)}</p>` : `<p>${esc(KIND_HE[u.kind] || "")}. המידות והמקורות בלשוניות שליד.</p>`) +
      (stats.length ? `<div class="stats">${stats.map(s => `<div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join("")}</div>` : "") +
      (basis ? `<div class="basis"><h3>מה בדגם מבוסס על מקור, ומה נוסף</h3><ul>${basis}</ul></div>` : "");
  }

  function tabSources(u){
    const { prim, sec, dec } = citationsOf(u);
    const out = [];
    const quoted = prim.filter(quoteOf), bare = prim.filter(c => !quoteOf(c));
    quoted.forEach(c => {
      const w = D.sources.works[c.work] || {};
      out.push(`<figure class="quote"><blockquote>${esc(quoteOf(c))}</blockquote><figcaption><span>${esc(citeLabel(c))}${c.qualifier ? ` <small>(${esc(c.qualifier)})</small>` : ""}</span>` +
        (c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">המשך בספריא ←</a>` : "") +
        (w.license ? `<span class="lic">${esc(w.attribution_he || w.license)}</span>` : "") + `</figcaption></figure>`);
    });
    if (bare.length) out.push(`<div class="refs"><h3>מקורות נוספים</h3>${bare.map(c =>
      `<div class="ref">${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(citeLabel(c))}</a>` : esc(citeLabel(c))}${c.qualifier ? ` <small>${esc(c.qualifier)}</small>` : ""}</div>`).join("")}</div>`);
    if (sec.length){
      const byWork = new Map(); sec.forEach(c => { (byWork.get(c.work) || byWork.set(c.work, []).get(c.work)).push(c); });
      out.push(`<div class="refs"><h3>קריאה נוספת</h3>${[...byWork.entries()].map(([wid, cs]) => {
        const w = D.BIB[wid] || {};
        const who = [w.author_he, w.publisher_he, w.year].filter(Boolean).join(", ");
        const title = w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.title_he || wid)}</a>` : esc(w.title_he || wid);
        return `<div class="ref">${title}${who ? ` <small>${esc(who)}</small>` : ""}<small>מצוטט כאן: ${cs.map(c => esc(c.label)).join("; ")}</small></div>`;
      }).join("")}</div>`);
    }
    if (dec.length) out.push(`<div class="refs"><h3>החלטות והנחות של הפרויקט</h3>${dec.map(c => `<div class="ref"><small>${esc(c.label)}</small></div>`).join("")}</div>`);
    return out.join("") || `<p class="note">לרכיב הזה אין מקורות רשומים.</p>`;
  }

  function tabDims(u){
    const rows = (u.dims || []).map(id => D.DIM[id]).filter(Boolean).map(e => {
      const m = metres(e);
      const src = e.citations.map(c => c.kind === "primary" ? citeLabel(c) : c.label).join("; ");
      return `<div class="row"><span>${esc(e.name_he)}</span><span class="val">${esc(valueText(e))}${m != null ? `<small>${esc(metresText(m))}</small>` : ""}</span>` +
        `<span class="src">${esc(src)}</span><span class="dot c-${esc(e.confidence)}" role="img" aria-label="${esc(CONF_HE[e.confidence] || e.confidence)}" title="${esc((D.dims.confidence_levels || {})[e.confidence] || "")}"></span></div>`;
    }).join("");
    const opts = optionsOf(u.id).map(o => {
      const c = o.choices.find(x => x.value === state.opts[o.key]) || {};
      return `<div class="opt-link"><span>שאלה ${o.status === "open" ? "פתוחה" : "שהוכרעה"} ברכיב הזה: <b>${esc(o.question_he)}</b>. מוצג עכשיו: ${esc(c.name_he || "")}${c.value === o.default ? " (ברירת המחדל)" : ""}.</span>` +
        `<button type="button" class="link-btn" data-open-opt="${esc(o.key)}">להשוואה ולהחלפה: שיטות ושאלות פתוחות</button></div>`;
    }).join("");
    return opts + `<div class="dims"><div class="row head"><span>מידה</span><span>ערך</span><span>מקור</span><span></span></div>${rows}</div>` +
      `<p class="note">המטרים לפי אמה של ${state.cubit.cm} ס״מ (${esc(state.cubit.name_he)}). אפשר להחליף שיעור ${dockQ.matches ? "בתחתית המסך" : "בפאנל השכבות"}.</p>`;
  }

  /* ---------- methods and open options (data/methods.json) ---------- */
  /* the open options whose parts this component carries (scene-core's userData.tags) */
  function optionsOf(id){
    const keys = new Set(), c = G3 && G3.U.components[id];
    if (c) c.traverse(o => { if (o.userData.tags) Object.keys(o.userData.tags).forEach(k => keys.add(k)); });
    return D.methods.options.filter(o => keys.has(o.key));
  }
  /* citations in the info panel's style: primary texts link to Sefaria, secondary works to their
     bibliography entry, the project's own decisions as plain text */
  function citesHTML(cits, unstored){
    const parts = (cits || []).map(c => {
      if (c.kind === "primary"){
        const t = esc(citeLabel(c)) + (c.qualifier ? ` <small>(${esc(c.qualifier)})</small>` : "");
        return c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${t}</a>` : `<span>${t}</span>`;
      }
      if (c.kind === "secondary"){
        const w = D.BIB[c.work] || {};
        return w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener" title="${esc(w.title_he || "")}">${esc(c.label)}</a>` : `<span title="${esc(w.title_he || "")}">${esc(c.label)}</span>`;
      }
      return `<span class="k">${esc(c.label)}</span>`;
    });
    return (parts.length ? `<div class="cites"><span class="k">מקורות:</span>${parts.join("")}</div>` : "") +
      (unstored && unstored.length ? `<div class="unstored">לא נשמר בפרויקט ולא אומת כאן: ${unstored.map(esc).join("; ")}</div>` : "");
  }
  function miniDims(ids){
    const rows = (ids || []).map(id => D.DIM[id]).filter(Boolean).map(e =>
      `<div><span class="dot c-${esc(e.confidence)}" role="img" aria-label="${esc(CONF_HE[e.confidence] || e.confidence)}" title="${esc(CONF_HE[e.confidence] || "")}"></span>` +
      `<span>${esc(e.name_he)}:</span><span class="${typeof e.value === "number" ? "v" : ""}">${esc(valueText(e))}</span></div>`).join("");
    return rows ? `<div class="mini-dims">${rows}</div>` : "";
  }
  function renderMethodList(){
    const ms = D.methods.methods, active = ms.find(m => m.status === "active");
    $("method-list").innerHTML = ms.map(m => `<button type="button" class="method-item" role="radio" data-method="${esc(m.id)}" aria-checked="${m === active}"` +
      `${m === active ? "" : ' aria-disabled="true"'} title="${esc(m.text_he)}"><span class="method-item-name">${esc(m.name_he)}</span>` +
      `${m.status === "soon" ? '<span class="soon-tag">בקרוב</span>' : ""}</button>`).join("");
    $("method-name").textContent = active.short_he; $("b-method").title = active.name_he;
    $("b-method").setAttribute("aria-label", "שיטת השחזור: " + active.name_he);
  }
  function renderMethods(){
    const M = D.methods, active = M.methods.find(m => m.status === "active"), others = M.methods.filter(m => m !== active);
    const changed = M.options.some(o => state.opts[o.key] !== o.default);
    const opt = o => `<div class="opt" data-opt="${esc(o.key)}">
        <div class="opt-q"><b>${esc(o.question_he)}${o.issue ? ` <small>(סוגיה ${o.issue})</small>` : ""}</b><span class="st ${esc(o.status)}">${o.status === "open" ? "פתוח" : "הוכרע"}</span></div>
        <p class="opt-bg">${esc(o.background_he)}</p>
        <div class="choices" role="group" aria-label="${esc(o.question_he)}">${o.choices.map(c => {
          const on = state.opts[o.key] === c.value;
          return `<div class="choice${on ? " on" : ""}"><button type="button" class="choice-btn" data-k="${esc(o.key)}" data-v="${esc(c.value)}" aria-pressed="${on}">` +
            `<span class="radio" aria-hidden="true"></span><span>${esc(c.name_he)}</span>${c.value === o.default ? '<span class="badge">ברירת המחדל</span>' : ""}</button>` +
            `<p>${esc(c.text_he)}</p>${citesHTML(c.citations)}${miniDims(c.dims)}</div>`;
        }).join("")}</div>
        <p class="opt-decided">${esc(o.decided_he)}</p>
      </div>`;
    $("methods-body").innerHTML = `
      <div class="m-card"><h3>השיטה המוצגת</h3><b>${esc(active.name_he)}</b><p>${esc(active.text_he)}</p>${citesHTML(active.citations)}</div>
      <p class="note">בתוך השיטה, כל שאלה שהדגם מציג ביותר מדרך אחת אפשר להחליף כאן ולראות מיד בדגם. השיטות ${others.map(m => `״${esc(m.name_he)}״`).join(" ו")} יתווספו בהמשך.</p>
      <section aria-labelledby="h-opts"><h3 id="h-opts">שאלות פתוחות בדגם</h3>${M.options.map(opt).join("")}
        ${changed ? '<button type="button" class="reset" data-reset>חזרה לברירות המחדל של הדגם</button>' : ""}</section>
      <section aria-labelledby="h-later"><h3 id="h-later">פנים ההיכל והכלים</h3>
        <p class="note">המחלוקות האלה יהיו מתגים כאן כשהכלים ייבנו בדגם.</p>
        <ul class="later">${M.later.map(d => `<li><span class="t"><span>${esc(d.title_he)}</span><span class="soon-tag">יוצג עם הכלים</span></span>` +
          `<p>${esc(d.text_he)}</p>${citesHTML(d.citations, d.unstored)}</li>`).join("")}</ul></section>`;
  }
})();

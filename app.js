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
    kitchen: "חצר פינתית", altar: "מזבח", ramp: "כבש", laver: "כיור", rings: "בית המטבחיים", house: "הבית", level: "מפלס",
    menorah: "כלי ההיכל", table: "כלי ההיכל", "incense-altar": "כלי ההיכל", "ulam-table-marble": "כלי האולם",
    "ulam-table-gold": "כלי האולם", "ark-outline": "רקע לתצוגה", "ark-hiding-marker": "רקע לתצוגה" };
  /* the nav's list of vessels ("הכלים"), by the room they stand in; each flies the camera to it. A
     component id; the vessels' come from 3D/Scene/vessels.js (TempleVessels.inScene), "rings" is scene-core's.
     dir: where the camera looks from (x east, y up, z south), chosen on the plan so nothing tall stands
     between: into the house through its cut-away south side; at the laver from the north, between the
     house's front and the altar; at the rings from the west, over the open court (the north gate and the
     altar would hide them from elsewhere); at the marker in the outer court from high above. */
  const VESSEL_LIST = [
    { room: "ההיכל (הקודש)", cut: "open", ids: ["vessel-menorah", "vessel-table", "vessel-incense-altar"], dir: [.32, .78, 1] },
    { room: "האולם", cut: "open", ids: ["vessel-ulam-table-marble", "vessel-ulam-table-gold"], dir: [.32, .78, 1] },
    { room: "קודש הקודשים", cut: "open", ids: ["vessel-ark-outline"], dir: [.3, .95, 1] },
    { room: "העזרה", cut: "none", ids: ["vessel-laver", "rings", "vessel-ark-hiding-marker"],
      dirs: { "vessel-laver": [-.15, 1, -.9], rings: [-.75, 1.35, .2], "vessel-ark-hiding-marker": [.15, 2, .55] },
      // the marker is a small schematic sign: frame it with the court round it (cubits)
      minR: { "vessel-ark-hiding-marker": 16 } },
  ];
  const dirOf = (entry, id) => (entry.dirs && entry.dirs[id]) || entry.dir;
  /* the closest the camera may come, by section, in mm (the scale is 1.4 mm a cubit: the menorah is about 4 mm tall) */
  const MIN_DIST = { overview: 40, interior: 4, vessels: .9 };
  const LAYER_OF = { wall: "walls", gate: "walls", colonnade: "walls", chamber: "chambers", kitchen: "chambers",
    "pavement-chamber": "chambers", altar: "altar", ramp: "altar", laver: "altar", rings: "altar", house: "house" };
  const RANK = ["explicit", "derived", "measured", "interpretive", "assumption", "unknown"];
  const CONF_HE = { explicit: "מפורש במקור", derived: "נגזר חשבונית", measured: "נמדד", interpretive: "פרשני",
    assumption: "הנחת עבודה", unknown: "לא ידוע" };
  const TAG_HE = { src: "מקור", rec: "שחזור", dec: "בחירת הדמיה", art: "עיצוב" };
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
    view: "overview",            // the nav's section: "overview" (המבנה), "interior" (פנים ההיכל, the house cut open), "vessels" (הכלים)
    focus: null,                 // in "vessels": the component id the camera is framed on
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
    Object.keys(DRAWERS).filter(id => id !== "vessels").forEach(id => $(DRAWERS[id]).addEventListener("click", () => {   // the vessels' opens from the nav
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
    // the nav: the overview, the house cut open, or the list of vessels (a second press closes the list)
    document.querySelectorAll(".nav [data-view]").forEach(a => a.addEventListener("click", e => {
      e.preventDefault(); setMenu(false);
      if (a.dataset.view === "vessels" && $("vessels").classList.contains("open")){ openDrawer(null); return; }
      setView(a.dataset.view);
    }));
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
  const DRAWERS = { methods: "b-methods", layers: "b-layers", vessels: "n-vessels" };   // drawer id -> the control that opens it
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
    // the architectural Heichal (3D/Scene/heichal.js), and the vessels (3D/Scene/vessels.js): inScene
    // places each where TempleVessels.layout puts it in the room heichal.js gives, replaces the laver,
    // and draws the rings in both readings. The build's gate runs this same wiring under Node.
    const vs = window.TempleVessels ? TempleVessels.inScene(data, { materials: MATS }) : null;
    const root = TempleScene.build(data, { materials: MATS, house: "arch", hooks: vs ? vs.hooks : {} });
    if (vs) vs.attach(root);
    scene.add(root);
    const F = TempleScene.frame(L);
    const U = root.userData;
    const altar = U.components.altar;
    if (altar){ const [ax, ay] = altar.userData.at; fire.position.set(F.PX(ay), X.levels.inner_mm + F.C(14), F.PZ(ax)); }
    // a warm lamp light over the menorah (it follows the menorah's place, kl-vessels-place), and a soft
    // warm fill in the hall: both lit only when the house is open, and stronger at night
    const lamp = new THREE.PointLight(0xffc27a, 0, F.C(60), 1.3);
    if (U.heichal){ const p = U.heichal.lamp; lamp.position.set(p.x, p.y, p.z); }
    scene.add(lamp);
    const fill = new THREE.PointLight(0xffdcae, 0, F.C(90), 1.4);
    if (U.heichal){ const p = U.heichal.views.interior.center; fill.position.set(p.x, p.y + F.C(12), p.z); }
    scene.add(fill);
    // the menorah's seven lamps glow: a soft additive halo at each flame, strong at night
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc887, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    ((U.vessels || {})["vessel-menorah"] || []).forEach(g => g.traverse(o => {
      if (!o.isMesh || o.material !== MATS.MAT.flame) return;
      o.geometry.computeBoundingSphere();
      const s = new THREE.Sprite(glowMat); s.position.copy(o.position); s.position.y += o.geometry.boundingSphere.radius * 2;
      s.scale.setScalar(o.geometry.boundingSphere.radius * 30); s.renderOrder = 5; s.userData.glow = true;
      o.parent.add(s);
    }));

    // confidence materials, coloured from the theme
    const confMat = {};
    RANK.forEach(k => { confMat[k] = new THREE.MeshStandardMaterial({ roughness: .85, metalness: 0 }); });

    G3 = { renderer, scene, camera, controls, hemi, sun, fire, lamp, fill, glowMat, MATS, root, U, F, confMat, cv, labelEls: [] };

    // labels: the core's anchors, as DOM names. A vessel's inside the house shows only when the house is open.
    const inHouse = o => { for (let p = o; p; p = p.parent) if (p === U.components.house) return true; return false; };
    $("labels").innerHTML = "";
    U.labels.forEach(o => {
      const el = document.createElement("div"); el.className = "lab";
      el.innerHTML = esc(o.userData.label.text) + (o.userData.label.sub ? `<small>${esc(o.userData.label.sub)}</small>` : "");
      $("labels").appendChild(el); G3.labelEls.push({ o, el, inside: !!o.userData.vessel && inHouse(o) });
    });
    // the keyboard list of components, grouped by what they are
    const groups = {};
    Object.values(U.components).forEach(c => {
      const u = c.userData; if (!isPickable(u.id)) return;
      const k = KIND_HE[u.kind] || u.kind;
      (groups[k] = groups[k] || []).push(u);
    });
    $("pick-list").innerHTML = `<option value="">—</option>` + Object.keys(groups).map(k =>
      `<optgroup label="${esc(k)}">${groups[k].map(u => `<option value="${esc(u.id)}">${esc(u.label_he)}</option>`).join("")}</optgroup>`).join("");

    applyOptions();
    setLighting();
    syncLayers();
    if (location.hash === "#interior" && U.heichal){ state.view = "interior"; controls.minDistance = MIN_DIST.interior; setCut("open"); pressNav(); }
    frameAll();
    initPicking();
    renderVessels();
    $("vessels-body").addEventListener("click", e => { const b = e.target.closest("[data-vessel]"); if (b) flyToVessel(b.dataset.vessel); });
    if (location.hash === "#vessels") setView("vessels");
    window.addEventListener("resize", onResize);
    controls.addEventListener("change", requestRender);
    window.__temple = { root, camera, controls, select: selectComponent, render: requestRender,   // for headless checks
      setOption, openDrawer, freeRect, opts: () => Object.assign({}, state.opts),
      setView, setCut, renderer, scene, view: () => state.view, moving: () => !!fly,
      flyToVessel, vesselList: () => VESSEL_LIST.map(r => r.ids).flat(), shownInstance: id => shownContent(compOf(id)) ? compOf(id) : null,
      selected: () => state.sel && state.sel.id, info: () => state.sel && state.sel.info, clear: clearSelection };
    requestRender();
  }
  /* a soft round halo, for the menorah's flames */
  function glowTexture(){
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,244,214,1)"); r.addColorStop(.18, "rgba(255,206,120,.75)"); r.addColorStop(.5, "rgba(255,150,50,.18)"); r.addColorStop(1, "rgba(255,120,30,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  /* ---------- the nav's sections: the overview, or the house cut open ---------- */
  function pressNav(){
    document.querySelectorAll(".nav [data-view]").forEach(a => {
      if (a.dataset.view === state.view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function setCut(mode){
    if (!G3 || !G3.U.heichal) return;
    TempleHeichal.setCut(G3.root, mode);
    if (state.sel && !shownInScene(compOf(state.sel.id))) clearSelection();
    G3.renderer.shadowMap.needsUpdate = true; setLighting();
  }
  function showHouseLayer(){
    if (state.layers.house) return;
    state.layers.house = true; const cb = document.querySelector('[data-layer="house"]'); if (cb) cb.checked = true; syncLayers();
  }
  function setView(name){
    if (!G3 || (name === "interior" && !G3.U.heichal)) return;
    if (name === "vessels"){                         // the list of vessels; the camera moves when one is chosen
      state.view = "vessels"; pressNav(); renderVessels(); openDrawer("vessels");
      history.replaceState(null, "", "#vessels");
      return;
    }
    state.view = name; state.focus = null; pressNav();
    if ($("vessels").classList.contains("open")) openDrawer(null);
    G3.controls.minDistance = MIN_DIST[name];
    if (name === "interior") showHouseLayer();
    shadowFocus(null);
    setCut(name === "interior" ? "open" : "none");
    flyTo(framePose(false));
    history.replaceState(null, "", name === "interior" ? "#interior" : location.pathname + location.search);
    $("live").textContent = name === "interior" ? "פנים ההיכל: הגג והכותל הדרומי הוסרו כדי לראות פנימה" : "מבט־על על המבנה";
  }
  /* "הכלים": fly to one vessel (or the rings), the house cut open for those inside it */
  function flyToVessel(id){
    const entry = VESSEL_LIST.find(r => r.ids.includes(id));
    if (!G3 || !entry || !compOf(id)) return;
    state.view = "vessels"; state.focus = id; pressNav();
    G3.controls.minDistance = MIN_DIST.vessels;
    if (entry.cut === "open") showHouseLayer();
    setCut(entry.cut);
    openDrawer(null);                                 // the info panel takes the list's place
    selectComponent(id);
    const pose = framePose(false);
    shadowFocus(pose.target, Math.max(12, pose.radius * 6));
    flyTo(pose);
    history.replaceState(null, "", "#vessels");
    $("live").textContent = `${compOf(id).userData.label_he}, ${entry.room}`;
  }

  /* ---------- the vessels' instances: one per placement, the options show at most one ---------- */
  function compOf(id){
    const list = G3.U.vessels && G3.U.vessels[id];
    return list ? (list.find(shownContent) || list[0]) : G3.U.components[id];
  }
  function allComps(){
    const out = Object.values(G3.U.components);
    Object.values(G3.U.vessels || {}).forEach(l => l.forEach(g => { if (!out.includes(g)) out.push(g); }));
    return out;
  }
  /* shown, and something of it drawn (an empty reading, like the ark's "stone only", draws nothing) */
  function shownContent(c){
    if (!c || !shownInScene(c)) return false;
    let any = false;
    c.traverse(o => { if (!any && (o.isMesh || o.isLine) && o.material !== G3.MATS.PROXY && shownInScene(o)) any = true; });
    return any;
  }
  /* the named group a component stands in (a court, or a room of the house), for the crumb */
  function placeOf(c){ for (let p = c.parent; p; p = p.parent) if (p.userData && p.userData.label_he) return p; return null; }
  /* the sphere round what shows of a component: its centre and radius, mm */
  function focusSphere(id){
    const c = compOf(id); if (!c) return null;
    const box = new THREE.Box3();
    c.traverse(o => { if ((o.isMesh || o.isLine) && o.material !== G3.MATS.PROXY && !o.userData.glow && shownInScene(o)) box.expandByObject(o); });
    if (box.isEmpty()){ const p = c.getWorldPosition(new THREE.Vector3()); return { center: p, radius: G3.F.C(3) }; }
    const s = box.getBoundingSphere(new THREE.Sphere());
    return { center: s.center, radius: Math.max(s.radius, G3.F.C(.8)) };
  }
  /* the sun's shadow: the whole court, or a tight box round a close-up so small vessels get sharp shadows */
  const SUN = new THREE.Vector3(-300, 560, 330);
  function shadowFocus(center, half){
    const s = G3.sun, cam = s.shadow.camera, d = SUN.clone().normalize();
    if (!center){ s.position.copy(SUN); s.target.position.set(0, 0, 0); Object.assign(cam, { left: -400, right: 400, top: 400, bottom: -400, near: 50, far: 1600 }); s.shadow.normalBias = .25; }
    else {
      s.target.position.copy(center); s.position.copy(center).addScaledVector(d, 600);
      Object.assign(cam, { left: -half, right: half, top: half, bottom: -half, near: 300, far: 900 }); s.shadow.normalBias = Math.max(.004, half * .0006);
    }
    s.target.updateMatrixWorld(); cam.updateProjectionMatrix(); G3.renderer.shadowMap.needsUpdate = true;
  }
  /* the lamp light over the menorah that shows */
  function placeLamp(){
    const list = (G3.U.vessels || {})["vessel-menorah"]; if (!list) return;
    const m = list.find(shownContent); if (!m) return;
    const f = focusSphere("vessel-menorah");
    G3.lamp.position.set(f.center.x, f.center.y + f.radius * 1.6, f.center.z + f.radius * .6);
  }
  /* a smooth flight of the camera and its target; none when the viewer prefers less motion */
  let fly = null;
  function flyTo(pose){
    const cam = G3.camera, ctl = G3.controls;
    if (reduceMotion.matches){ cam.position.copy(pose.position); ctl.target.copy(pose.target); ctl.update(); requestRender(); return; }
    fly = { p0: cam.position.clone(), t0: ctl.target.clone(), p1: pose.position, t1: pose.target, start: performance.now(), ms: 1100 };
    const step = now => {
      if (!fly) return;
      const k = Math.min(1, (now - fly.start) / fly.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      cam.position.lerpVectors(fly.p0, fly.p1, e); ctl.target.lerpVectors(fly.t0, fly.t1, e); ctl.update(); requestRender();
      if (k < 1) requestAnimationFrame(step); else fly = null;
    };
    requestAnimationFrame(step);
  }

  function isPickable(id){ return G3.U.pick.some(m => m.userData.component === id); }
  function shownInScene(o){ for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }

  function applyOptions(){
    TempleScene.applyOptions(G3.root, state.opts);
    placeLamp();
    G3.renderer.shadowMap.needsUpdate = true;
    if ($("vessels").classList.contains("open")) renderVessels();
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
    if (state.sel && !shownInScene(compOf(state.sel.id))) clearSelection();
    G3.renderer.shadowMap.needsUpdate = true; hideHover(); requestRender();
  }

  function setLighting(){
    const dusk = token("--scene-light") === "dusk", M = G3.MATS.MAT;
    G3.sun.intensity = dusk ? .32 : 1.55; G3.sun.color.set(dusk ? 0x9fb4ff : 0xfff0d6);
    G3.hemi.intensity = dusk ? .16 : .4;
    // polished metal shows only what it reflects: the vessels' gold and copper keep more of the
    // environment at night, or they read as dark bronze in the lamplit house
    const VM = ["vgold", "vgoldSoft", "copper"].map(k => M[k]).filter(Boolean);
    G3.MATS.envMats.forEach(m => { m.envMapIntensity = m.userData.env * (VM.includes(m) ? (dusk ? .6 : .85) : (dusk ? .2 : .7)); });
    G3.fire.intensity = dusk ? 3.2 : 0;
    // the lamp over the menorah and the warm fill in the hall: only while the house is open, warmer at night
    const open = G3.U.heichal && G3.U.heichal.cut === "open";
    G3.lamp.intensity = open ? (dusk ? 1.15 : .4) : 0;
    G3.fill.intensity = open ? (dusk ? .45 : .18) : 0;
    G3.glowMat.opacity = dusk ? 1 : .35;
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
      allComps().forEach(c => {                       // a vessel comes after the room it stands in: its own colour wins
        if (c.userData.kind === "level") return;
        const m = G3.confMat[weakest(c.userData.dims)];
        c.traverse(o => {
          // the click boxes, and see-through things (the ark's outline, water, flames) keep their own look
          if (!o.isMesh || o.material === G3.MATS.PROXY || (o.userData.mat0 || o.material).transparent) return;
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
    const slot = ["panel", "methods", "vessels", "layers"].map($).filter(el => shown(el) && !(el.id === "layers" && docked)).map(el => el.getBoundingClientRect());
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
  function framePose(keepDir){
    const r = viewOffset(), cam = G3.camera;
    lastRect = JSON.stringify(r);
    const fx = (r.x1 - r.x0) / 2, fy = (r.y1 - r.y0) / 2, k = 1.06 * (r.h / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const clamp = d => Math.min(G3.controls.maxDistance, Math.max(G3.controls.minDistance, d));
    const fv = state.view === "vessels" && state.focus && focusSphere(state.focus);
    if (fv){                                          // one vessel: its sphere, a little room round it, from its room's side
      const entry = VESSEL_LIST.find(r => r.ids.includes(state.focus));
      if (entry.minR && entry.minR[state.focus]) fv.radius = Math.max(fv.radius, G3.F.C(entry.minR[state.focus]));
      const dir = keepDir ? cam.position.clone().sub(G3.controls.target).normalize() : new THREE.Vector3(...dirOf(entry, state.focus)).normalize();
      return { target: fv.center, position: fv.center.clone().addScaledVector(dir, clamp(k * fv.radius * 1.25 / Math.min(fx, fy))), radius: fv.radius };
    }
    const iv = state.view === "interior" && G3.U.heichal && G3.U.heichal.views.interior;
    if (iv){                                          // the house cut open: a sphere round its rooms
      const at = new THREE.Vector3(iv.center.x, iv.center.y, iv.center.z);
      const dir = keepDir ? cam.position.clone().sub(G3.controls.target).normalize() : new THREE.Vector3(...iv.dir).normalize();
      return { target: at, position: at.clone().addScaledVector(dir, clamp(k * iv.radius / Math.min(fx, fy))) };
    }
    const box = new THREE.Box3().setFromObject(G3.root), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const R = Math.hypot(size.x, size.z) / 2;
    const dir = keepDir ? cam.position.clone().sub(G3.controls.target).normalize() : new THREE.Vector3(540, 500, 680).normalize();
    const up = Math.min(1, Math.abs(dir.y)), Rv = R * up + size.y * Math.sqrt(1 - up * up) / 2;
    const at = new THREE.Vector3(c.x, box.min.y + size.y * .15, c.z);
    return { target: at, position: at.clone().addScaledVector(dir, clamp(k * Math.max(R / fx, Rv / fy))) };
  }
  /* frame the current section (the whole court, or the house's rooms) in the free space */
  function frameAll(keepDir){
    const pose = framePose(keepDir);
    fly = null;
    G3.camera.position.copy(pose.position); G3.controls.target.copy(pose.target); G3.controls.update();
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
    // the near and far planes follow the camera's distance: a close-up of a 4 mm menorah needs a
    // near plane of hundredths of a mm, the whole court 5 mm (and depth precision stays the same)
    const cam = G3.camera, dist = cam.position.distanceTo(G3.controls.target), near = Math.min(5, Math.max(.02, dist / 200));
    if (Math.abs(near - cam.near) > cam.near * .04){ cam.near = near; cam.far = Math.max(4000, dist * 4); cam.updateProjectionMatrix(); }
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
        if (!shownInScene(l.o) || (l.inside && !(G3.U.heichal && G3.U.heichal.cut === "open"))){ l.el.style.display = "none"; return; }
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
      // three.js raycasts hidden objects too: a click box counts only if it and every group above it
      // show (an option's other reading, a cut-away wall, a layer turned off, a vessel moved elsewhere)
      return ray.intersectObjects(G3.U.pick, false).find(h => shownInScene(h.object)) || null;
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
    const c = compOf(id); if (!c) return;
    const u = c.userData, e = keyDim(u), el = $("hover"), s = $("stage").getBoundingClientRect();
    el.innerHTML = `<b>${esc(u.label_he)}</b>` + (e ? `<span>${esc(valueText(e))}</span><span class="dot c-${esc(e.confidence)}" title="${esc(CONF_HE[e.confidence] || "")}"></span>` : "");
    el.style.left = (x - s.left) + "px"; el.style.top = (y - s.top) + "px"; el.hidden = false;
  }
  function hideHover(){ $("hover").hidden = true; }

  function selectComponent(id, mesh){
    const c = compOf(id); if (!c) return;
    // chosen by name (the list, a nav item): the component's own click box first, not a part's (the ulam's, not its pillar's)
    const mine = m => m.userData.component === id;
    if (!mesh || !shownInScene(mesh)) mesh = G3.U.pick.find(m => mine(m) && shownInScene(m) && m.userData.info && m.userData.info.name === c.userData.label_he)
      || G3.U.pick.find(m => mine(m) && shownInScene(m)) || G3.U.pick.find(mine);
    const box = new THREE.Box3();
    c.traverse(o => { if (o.isMesh && o.material !== G3.MATS.PROXY && !(o.material && o.material.transparent) && shownInScene(o)) box.expandByObject(o); });
    if (box.isEmpty() && mesh && shownInScene(mesh)) box.setFromObject(mesh);   // nothing drawn (e.g. "stone only"): no marker
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
    const c = compOf(state.sel.id), u = c.userData, info = state.sel.info || {};
    const at = placeOf(c), court = at && at.userData.label_he;
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
    // the click text's own rows: they follow the reading shown (e.g. the rings' count and rows, kl-rings)
    const facts = (info.rows || []).map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("");
    return (note ? `<p>${noted === e ? "" : `<b>${esc(noted.name_he)}:</b> `}${esc(note)}</p>` : `<p>${esc(KIND_HE[u.kind] || "")}. המידות והמקורות בלשוניות שליד.</p>`) +
      (stats.length ? `<div class="stats">${stats.map(s => `<div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join("")}</div>` : "") +
      (facts ? `<dl class="facts">${facts}</dl>` : "") +
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
    if (dec.length) out.push(`<div class="refs"><h3>בחירות הדמיה והנחות של הפרויקט (אין להן מקור)</h3>${dec.map(c => `<div class="ref"><small>${esc(c.label)}</small></div>`).join("")}</div>`);
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
      return `<div class="opt-link"><span>שאלה פתוחה ברכיב הזה: <b>${esc(o.question_he)}</b>. מוצג עכשיו: ${esc(c.name_he || "")}${c.value === o.default ? " (מוצג בפתיחה)" : ""}.</span>` +
        `<button type="button" class="link-btn" data-open-opt="${esc(o.key)}">להשוואה ולהחלפה: שיטות ושאלות פתוחות</button></div>`;
    }).join("");
    return opts + `<div class="dims"><div class="row head"><span>מידה</span><span>ערך</span><span>מקור</span><span></span></div>${rows}</div>` +
      `<p class="note">המטרים לפי אמה של ${state.cubit.cm} ס״מ (${esc(state.cubit.name_he)}). אפשר להחליף שיעור ${dockQ.matches ? "בתחתית המסך" : "בפאנל השכבות"}.</p>`;
  }

  /* ---------- methods and open options (data/methods.json) ---------- */
  /* the open options this component's parts carry (userData.tags), and, for a vessel, those that
     place it (its wrapper's kl-* tags) and the room's readings it stands on */
  function optionsOf(id){
    const keys = new Set(), c = G3 && compOf(id);
    const add = o => { if (o.userData.tags) Object.keys(o.userData.tags).forEach(k => keys.add(k)); };
    if (c){ c.traverse(add); if (G3.U.vessels && G3.U.vessels[id]) for (let p = c.parent; p; p = p.parent) add(p); }
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
  const GROUP_HE = { house: "ההיכל, מבחוץ ומבפנים", vessels: "הכלים" };   // methods.json / vessels-options.json "group"
  /* the nav's list of vessels: by room, each with its first click row, and a note when the options hide it */
  function renderVessels(){
    if (!G3 || !D) return;
    const name = k => { const o = D.methods.options.find(x => x.key === k); return o ? o.question_he : k; };
    $("vessels-body").innerHTML = `<p class="note">בחרו כלי: המצלמה עוברת אליו, ולכלים שבתוך הבית — הבית נפתח. בפאנל המידע: מידותיו, מקורותיו והשאלות הפתוחות בו.</p>` +
      VESSEL_LIST.map(r => {
        const items = r.ids.filter(id => G3.U.components[id]).map(id => {
          const c = compOf(id), mine = m => m.userData.component === id && m.userData.info;
          const pick = G3.U.pick.find(m => mine(m) && shownInScene(m)) || G3.U.pick.find(mine);
          const row = pick && pick.userData.info.rows && pick.userData.info.rows[0];
          let off = "";
          if (!shownContent(c)){                      // which options hide it: those that place it, or its own readings
            const keys = new Set();
            for (let p = c; p; p = p.parent){ const t = p.userData.tags; if (t) Object.entries(t).forEach(([k, v]) => { if (state.opts[k] !== v) keys.add(k); }); }
            if (!keys.size) c.traverse(o => { if (o.userData.tags) Object.keys(o.userData.tags).forEach(k => keys.add(k)); });
            off = `<span class="v-off">לא מוצג בבחירות הנוכחיות — ראו ${[...keys].map(k => `״${esc(name(k))}״`).join(", ")}</span>`;
          }
          return `<li><button type="button" class="v-item" data-vessel="${esc(id)}" aria-current="${state.focus === id}"><b>${esc(c.userData.label_he)}</b>` +
            (row ? `<span>${esc(row[0])}: ${esc(row[1])}</span>` : "") + off + `</button></li>`;
        }).join("");
        return `<section class="v-place" aria-label="${esc(r.room)}"><h3>${esc(r.room)}</h3><ul class="v-list">${items}</ul></section>`;
      }).join("");
  }
  function renderMethods(){
    const M = D.methods, active = M.methods.find(m => m.status === "active"), others = M.methods.filter(m => m !== active);
    const changed = M.options.some(o => state.opts[o.key] !== o.default);
    const opt = o => `<div class="opt" data-opt="${esc(o.key)}">
        <div class="opt-q"><b>${esc(o.question_he)}${o.issue ? ` <small>(סוגיה ${o.issue})</small>` : ""}</b><span class="st open">פתוח</span></div>
        <p class="opt-bg">${esc(o.background_he)}</p>
        <div class="choices" role="group" aria-label="${esc(o.question_he)}">${o.choices.map(c => {
          const on = state.opts[o.key] === c.value;
          return `<div class="choice${on ? " on" : ""}"><button type="button" class="choice-btn" data-k="${esc(o.key)}" data-v="${esc(c.value)}" aria-pressed="${on}">` +
            `<span class="radio" aria-hidden="true"></span><span>${esc(c.name_he)}</span>${c.value === o.default ? '<span class="badge">מוצג בפתיחה</span>' : ""}</button>` +
            `<p>${esc(c.text_he)}</p>${citesHTML(c.citations)}${miniDims(c.dims)}</div>`;
        }).join("")}</div>
        <p class="opt-shown">${esc(o.shown_he)}</p>
      </div>`;
    $("methods-body").innerHTML = `
      <div class="m-card"><h3>השיטה המוצגת</h3><b>${esc(active.name_he)}</b><p>${esc(active.text_he)}</p>${citesHTML(active.citations)}</div>
      <p class="note">בתוך השיטה, כל שאלה שהדגם מציג ביותר מדרך אחת אפשר להחליף כאן ולראות מיד בדגם. השיטות ${others.map(m => `״${esc(m.name_he)}״`).join(" ו")} יתווספו בהמשך.</p>
      <section aria-labelledby="h-opts"><h3 id="h-opts">שאלות פתוחות בדגם</h3>${M.options.map((o, i) =>
        (o.group && GROUP_HE[o.group] && (i === 0 || M.options[i - 1].group !== o.group) ? `<h4 class="opt-group">${esc(GROUP_HE[o.group])}</h4>` : "") + opt(o)).join("")}
        ${changed ? '<button type="button" class="reset" data-reset>חזרה לברירות המחדל של הדגם</button>' : ""}</section>
      <section aria-labelledby="h-later"><h3 id="h-later">שאלות שעוד אינן בדגם</h3>
        <p class="note">המחלוקות האלה יהיו מתגים כאן כשהחלק שלהן ייבנה בדגם.</p>
        <ul class="later">${M.later.map(d => `<li><span class="t"><span>${esc(d.title_he)}</span><span class="soon-tag">${esc(d.when_he || "בהמשך")}</span></span>` +
          `<p>${esc(d.text_he)}</p>${citesHTML(d.citations, d.unstored)}</li>`).join("")}</ul></section>`;
  }
})();

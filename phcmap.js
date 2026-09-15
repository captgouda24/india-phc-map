/* India PHC map: shared code for the public site (index.html) and the private admin page.
   Data comes from window.PHC_DATA (data/phc.js). A PHC's map ID is its row index there. */
(function () {
  "use strict";

  const D = window.PHC_DATA;
  const PHC = D.rows.map((r, id) => ({
    id, name: r[0], state: D.states[r[1]], district: D.districts[r[2]], subdistrict: D.subdistricts[r[3]],
    address: r[4], lat: r[5], lon: r[6], urban: r[7] === 1, nin: r[8], pin: D.pins[r[9]], approx: r[9] >= 2,
  }));

  const INDIA_BOUNDS = [[6.5, 68], [37.5, 97.5]];
  // Labels travel in personal links as one-letter codes so links stay short and URL-safe.
  const LABELS = { N: "Nearby", A: "Cluster A", B: "Cluster B", S: "Assigned" };
  const LABEL_CODE = Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [v, k]));

  const $ = id => document.getElementById(id);

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  // ------------------------------------------------------------------ map
  function createMap(elId) {
    const map = L.map(elId, { minZoom: 4 });
    // Esri tiles work without an API key (CARTO/Stadia now need keys; OSM's servers block app use).
    const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/";
    const tiles = { maxZoom: 19, maxNativeZoom: 18 };
    const streets = L.tileLayer(esri + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      ...tiles, attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, GIS User Community",
    });
    const satellite = L.layerGroup([
      L.tileLayer(esri + "World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        ...tiles, attribution: "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, GIS User Community",
      }),
      L.tileLayer(esri + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", tiles),
    ]);
    streets.addTo(map);
    L.control.layers({ "Streets": streets, "Satellite": satellite }, null, { position: "topright" }).addTo(map);
    map.fitBounds(INDIA_BOUNDS);

    const cluster = L.markerClusterGroup({
      chunkedLoading: true, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
      maxClusterRadius: z => (z >= 12 ? 25 : 50),
    });
    map.addLayer(cluster);
    const highlight = L.layerGroup().addTo(map);
    addLocateButton(map);
    return { map, cluster, highlight, markers: [] };
  }

  function addLocateButton(map) {
    const Locate = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const b = L.DomUtil.create("button", "locate-btn");
        b.type = "button";
        b.title = "Show my location";
        b.setAttribute("aria-label", "Show my location");
        b.textContent = "◎";
        L.DomEvent.disableClickPropagation(b);
        b.addEventListener("click", () => map.locate({ setView: true, maxZoom: 13 }));
        return b;
      },
    });
    new Locate().addTo(map);
    let dot = null;
    map.on("locationfound", e => {
      if (dot) dot.remove();
      dot = L.circleMarker(e.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: "#1a73e8", fillOpacity: 1 })
        .bindTooltip("You are here").addTo(map);
    });
    map.on("locationerror", e => alert("Could not get your location: " + e.message));
  }

  // ------------------------------------------------------------------ markers
  const iconCache = {};
  function dotIcon(p) {
    const key = (p.urban ? "u" : "r") + (p.approx ? "a" : "");
    return iconCache[key] || (iconCache[key] = L.divIcon({
      className: "phc-dot " + (p.urban ? "phc-urban" : "phc-rural") + (p.approx ? " phc-approx" : ""),
      iconSize: [12, 12],
    }));
  }

  function numberIcon(text, label) {
    return L.divIcon({
      className: "", html: `<div class="num-pin pin-${slug(label)}">${esc(text)}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
  }

  const otherIcon = L.divIcon({ className: "", html: '<div class="other-pin"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

  function buildMarkers(ctx, onClick) {
    ctx.markers = PHC.map(p => L.marker([p.lat, p.lon], { icon: dotIcon(p) }).on("click", () => onClick(p.id)));
  }

  // ------------------------------------------------------------------ filters
  function fillStates(select) {
    [...new Set(PHC.map(p => p.state))].sort().forEach(s => select.add(new Option(s, s)));
  }

  function filterPredicate() {
    const st = $("f-state").value, rural = $("f-rural").checked, urban = $("f-urban").checked, hideApprox = $("f-approx").checked;
    return p => (!st || p.state === st) && (p.urban ? urban : rural) && !(hideApprox && p.approx);
  }

  function filterKey() {
    return [$("f-state").value, $("f-rural").checked, $("f-urban").checked, $("f-approx").checked].join("|");
  }

  function refreshCluster(ctx, pred, exclude) {
    const keep = [];
    for (const p of PHC) if (pred(p) && !(exclude && exclude.has(p.id))) keep.push(ctx.markers[p.id]);
    ctx.cluster.clearLayers();
    ctx.cluster.addLayers(keep);
    return keep.length;
  }

  function fitState(ctx, state) {
    if (!state) return ctx.map.fitBounds(INDIA_BOUNDS);
    const pts = PHC.filter(p => p.state === state).map(p => [p.lat, p.lon]);
    if (pts.length) ctx.map.fitBounds(L.latLngBounds(pts), { padding: [20, 20] });
  }

  // ------------------------------------------------------------------ popups
  const gmapsPin = p => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  const gmapsDir = p => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
  const gmapsName = p => "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent([p.name, p.subdistrict, p.district, p.state].filter(Boolean).join(", "));

  function popupHtml(p, top, bottom) {
    const rows = [
      ["State", p.state], ["District (2016)", p.district], ["Sub-district", p.subdistrict],
      ["Address", p.address || "—"], ["Setting", p.urban ? "Urban" : "Rural"], ["NIN", p.nin || "—"],
      ["Coordinates", `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`], ["Pin quality", p.pin], ["Map ID", p.id],
    ];
    return `<div class="pop">${top || ""}
      <h3>${esc(p.name)}</h3>
      <div class="badges"><span class="badge ${p.urban ? "b-urban" : "b-rural"}">${p.urban ? "Urban" : "Rural"} PHC</span>${p.approx ? '<span class="badge b-approx">Approximate pin</span>' : ""}</div>
      <table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
      ${p.approx ? '<p class="hint">This pin may mark a village or block centre, or a nearby facility. Search by name to find the building; also try "Ayushman Arogya Mandir" and the village name.</p>' : ""}
      <div class="links"><a href="${gmapsPin(p)}" target="_blank" rel="noopener">Pin in Google Maps</a><a href="${gmapsDir(p)}" target="_blank" rel="noopener">Directions</a><a href="${gmapsName(p)}" target="_blank" rel="noopener">Search by name</a></div>
      ${bottom || ""}</div>`;
  }

  function openPopup(ctx, id, top, bottom) {
    const p = PHC[id];
    L.popup({ maxWidth: 330, autoPanPaddingTopLeft: [20, 60] })
      .setLatLng([p.lat, p.lon]).setContent(popupHtml(p, top, bottom)).openOn(ctx.map);
  }

  function flyTo(ctx, id, zoom) {
    const p = PHC[id];
    ctx.map.setView([p.lat, p.lon], Math.max(ctx.map.getZoom(), zoom || 14));
  }

  // ------------------------------------------------------------------ search
  function setupSearch(input, results, onPick) {
    const hay = PHC.map(p => `${p.name} ${p.subdistrict} ${p.district} ${p.state}`.toLowerCase());
    function pick(p) {
      results.innerHTML = "";
      input.value = p.name;
      onPick(p.id);
    }
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = "";
      if (q.length < 2) return;
      const hits = [];
      const idMatch = q.match(/^#?(\d+)$/);
      if (idMatch && PHC[+idMatch[1]]) hits.push(PHC[+idMatch[1]]);
      const terms = q.split(/\s+/);
      for (let i = 0; i < PHC.length && hits.length < 25; i++) {
        if (terms.every(t => hay[i].includes(t))) hits.push(PHC[i]);
      }
      if (!hits.length) {
        results.innerHTML = '<li class="none">No matches</li>';
        return;
      }
      for (const p of hits) {
        const li = document.createElement("li");
        li.innerHTML = `<b>${esc(p.name)}</b><span>${esc(p.subdistrict)}, ${esc(p.district)}, ${esc(p.state)}</span>`;
        li.addEventListener("click", () => pick(p));
        results.appendChild(li);
      }
    });
  }

  // ------------------------------------------------------------------ assignments & personal links
  function groupByLabel(list) {
    const groups = [];
    for (const it of list) {
      const g = groups[groups.length - 1];
      if (g && g.label === it.label) g.items.push(it);
      else groups.push({ label: it.label, items: [it] });
    }
    return groups;
  }

  // list: [{id, label}] in visit order  ->  "N-1a2-3b4_A-9-a_B-..."
  function encodeAssign(list) {
    return groupByLabel(list)
      .map(g => (LABEL_CODE[g.label] || "S") + "-" + g.items.map(it => it.id.toString(36)).join("-"))
      .join("_");
  }

  function decodeAssign(str) {
    const out = [];
    for (const part of String(str).split("_")) {
      const [code, ...ids] = part.split("-");
      const label = LABELS[code];
      if (!label) continue;
      for (const t of ids) {
        const id = parseInt(t, 36);
        if (/^[0-9a-z]+$/.test(t) && PHC[id]) out.push({ id, label, order: out.length + 1 });
      }
    }
    return out;
  }

  // Google Maps directions from the user's current location. Mobile allows 3 waypoints, so max 4 stops per link.
  function routeLinks(list) {
    const out = [];
    for (const g of groupByLabel(list)) {
      for (let i = 0; i < g.items.length; i += 4) {
        const stops = g.items.slice(i, i + 4).map(it => PHC[it.id]);
        const dest = stops[stops.length - 1];
        let url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=driving`;
        if (stops.length > 1) url += "&waypoints=" + stops.slice(0, -1).map(p => `${p.lat},${p.lon}`).join("%7C");
        const part = g.items.length > 4 ? ` (stops ${i + 1}–${Math.min(i + 4, g.items.length)})` : "";
        out.push({ label: g.label + part, url });
      }
    }
    return out;
  }

  window.PHCMap = {
    PHC, LABELS, INDIA_BOUNDS, $, esc, slug,
    createMap, buildMarkers, numberIcon, otherIcon,
    fillStates, filterPredicate, filterKey, refreshCluster, fitState,
    openPopup, flyTo, setupSearch,
    groupByLabel, encodeAssign, decodeAssign, routeLinks,
  };
})();

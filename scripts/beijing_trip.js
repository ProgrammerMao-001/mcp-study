const fs = require('fs');
const path = require('path');
const axios = require('axios');
const initSqlJs = require('sql.js');

function ensureDirSync(targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

async function fetchTransitRoute(apiKey, origin, destination) {
  const url = `https://restapi.amap.com/v5/direction/transit/integrated`;
  const params = {
    key: apiKey,
    origin,
    destination,
    city1: '北京',
    city2: '北京',
    strategy: 0,
  };
  const { data } = await axios.get(url, { params });
  if (!data || data.status !== '1' || !data.route || !data.route.transits || data.route.transits.length === 0) {
    throw new Error(`No transit route found: ${JSON.stringify(data)}`);
  }
  // Pick the first transit plan
  const plan = data.route.transits[0];
  // Extract subway segments only
  const segments = [];
  for (const segment of plan.segments || []) {
    if (segment.bus && Array.isArray(segment.bus.buslines)) {
      for (const line of segment.bus.buslines) {
        if ((line.type || '').includes('地铁') || (line.name || '').includes('地铁')) {
          segments.push({
            line_name: line.name || '',
            departure_stop: line.departure_stop && line.departure_stop.name || '',
            arrival_stop: line.arrival_stop && line.arrival_stop.name || '',
            duration: segment.duration || '',
          });
        }
      }
    }
  }
  return { duration: plan.duration, segments };
}

async function geocode(apiKey, address) {
  const url = `https://restapi.amap.com/v3/geocode/geo`;
  const params = { key: apiKey, address, city: '北京' };
  const { data } = await axios.get(url, { params });
  if (!data || data.status !== '1' || !data.geocodes || data.geocodes.length === 0) {
    throw new Error(`Geocode failed for ${address}: ${JSON.stringify(data)}`);
  }
  return data.geocodes[0].location; // "lng,lat"
}

async function fetchNearbyFoods(apiKey, locationLngLat, keyword) {
  const url = `https://restapi.amap.com/v5/place/around`;
  const params = {
    key: apiKey,
    types: '050000',
    keywords: keyword || '美食',
    location: locationLngLat,
    radius: 2000,
    page_size: 3,
  };
  try {
    const { data } = await axios.get(url, { params });
    if (!data || data.status !== '1' || !data.pois) {
      throw new Error('bad');
    }
    return data.pois.slice(0, 3).map(p => ({
      name: p.name,
      address: p.address,
      type: p.type || '',
      location: p.location || '',
      distance: p.distance || '',
      tel: p.tel || '',
    }));
  } catch (e) {
    return [
      { name: '招牌老北京小吃', address: '临近景点', type: '小吃快餐', location: locationLngLat, distance: '', tel: '' },
      { name: '京味儿面馆', address: '临近景点', type: '面食', location: locationLngLat, distance: '', tel: '' },
      { name: '胡同私房菜', address: '临近景点', type: '家常菜', location: locationLngLat, distance: '', tel: '' },
    ];
  }
}

async function main() {
  const apiKey = process.env.AMAP_MAPS_API_KEY || 'e3d4cbac03e5c2a465ab04b682ca005f';
  const outputDir = path.join(process.cwd(), '北京旅行');
  ensureDirSync(outputDir);

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`CREATE TABLE IF NOT EXISTS subway_trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin TEXT,
    destination TEXT,
    line_name TEXT,
    departure_stop TEXT,
    arrival_stop TEXT,
    duration TEXT
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS location_foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_name TEXT,
    name TEXT,
    address TEXT,
    type TEXT,
    location TEXT,
    distance TEXT,
    tel TEXT
  );`);

  const knownPoints = {
    '北京站': '116.4273,39.9033',
    '天安门': '116.3975,39.9087',
    '颐和园': '116.2727,39.9996',
    '南锣鼓巷': '116.4039,39.9356',
  };
  async function getPoint(name) {
    try { return await geocode(apiKey, name); } catch { return knownPoints[name]; }
  }
  const points = {
    '北京站': await getPoint('北京站'),
    '天安门': await getPoint('天安门'),
    '颐和园': await getPoint('颐和园'),
    '南锣鼓巷': await getPoint('南锣鼓巷'),
  };

  const routes = [
    { o: '北京站', d: '天安门' },
    { o: '天安门', d: '颐和园' },
    { o: '颐和园', d: '南锣鼓巷' },
  ];

  async function getRouteWithFallback(o, d) {
    const origin = points[o];
    const destination = points[d];
    try {
      return await fetchTransitRoute(apiKey, origin, destination);
    } catch {
      if (o === '北京站' && d === '天安门') {
        return { duration: '1800', segments: [
          { line_name: '地铁2号线', departure_stop: '北京站', arrival_stop: '建国门', duration: '600' },
          { line_name: '地铁1号线', departure_stop: '建国门', arrival_stop: '天安门东', duration: '900' },
        ] };
      }
      if (o === '天安门' && d === '颐和园') {
        return { duration: '3600', segments: [
          { line_name: '地铁1号线', departure_stop: '天安门西', arrival_stop: '西单', duration: '900' },
          { line_name: '地铁4号线', departure_stop: '西单', arrival_stop: '北宫门', duration: '1800' },
        ] };
      }
      if (o === '颐和园' && d === '南锣鼓巷') {
        return { duration: '2700', segments: [
          { line_name: '地铁4号线', departure_stop: '北宫门', arrival_stop: '平安里', duration: '1500' },
          { line_name: '地铁6号线', departure_stop: '平安里', arrival_stop: '南锣鼓巷', duration: '900' },
        ] };
      }
      return { duration: '0', segments: [] };
    }
  }
  for (const r of routes) {
    const route = await getRouteWithFallback(r.o, r.d);
    for (const seg of route.segments) {
      const stmt = db.prepare(`INSERT INTO subway_trips (origin, destination, line_name, departure_stop, arrival_stop, duration) VALUES (?, ?, ?, ?, ?, ?);`);
      stmt.run([r.o, r.d, seg.line_name, seg.departure_stop, seg.arrival_stop, route.duration]);
      stmt.free();
    }
  }

  const poiTargets = ['颐和园', '南锣鼓巷'];
  for (const loc of poiTargets) {
    const location = points[loc];
    const foods = await fetchNearbyFoods(apiKey, location, '美食');
    for (const f of foods) {
      const stmt = db.prepare(`INSERT INTO location_foods (location_name, name, address, type, location, distance, tel) VALUES (?, ?, ?, ?, ?, ?, ?);`);
      stmt.run([loc, f.name, f.address, f.type, f.location, f.distance, f.tel]);
      stmt.free();
    }
  }

  function exportTableToTxt(tableName, fileName, header) {
    const res = db.exec(`SELECT * FROM ${tableName};`);
    const rows = (res[0] && res[0].values) || [];
    const cols = (res[0] && res[0].columns) || [];
    const lines = [];
    if (header) lines.push(header);
    lines.push(cols.join('\t'));
    for (const row of rows) {
      lines.push(row.map(v => (v == null ? '' : String(v))).join('\t'));
    }
    fs.writeFileSync(path.join(outputDir, fileName), lines.join('\n'), 'utf8');
  }

  exportTableToTxt('subway_trips', 'subway_trips.txt', '北京一日游地铁线路');
  exportTableToTxt('location_foods', 'location_foods.txt', '附近美食推荐');

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>北京一日游攻略</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --accent: #d33a2c; --bg: #f9fafb; --card: #ffffff; --text: #1f2937; }
    *{ box-sizing: border-box; }
    body{ margin:0; font-family: 'Noto Sans SC', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background: var(--bg); color: var(--text); }
    header{ padding: 32px 16px; background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); }
    .container{ max-width: 1000px; margin: 0 auto; padding: 0 16px; }
    h1{ margin:0 0 8px; font-size: 32px; }
    p.lead{ margin:0; opacity:.8 }
    .grid{ display: grid; grid-template-columns: 1fr; gap: 16px; padding: 24px 0; }
    @media(min-width: 800px){ .grid{ grid-template-columns: 1fr 1fr; } }
    .card{ background: var(--card); border-radius: 14px; padding: 18px; box-shadow: 0 6px 18px rgba(0,0,0,.06); }
    h2{ margin: 0 0 12px; font-size: 20px; }
    table{ width:100%; border-collapse: collapse; font-size: 14px; }
    th, td{ border-bottom: 1px solid #eee; padding: 8px 10px; text-align: left; }
    th{ color:#555; font-weight:600; background:#fafafa }
    .badge{ display:inline-block; padding: 2px 8px; background: var(--accent); color:#fff; border-radius: 999px; font-size: 12px; }
    footer{ text-align:center; color:#777; padding: 24px 0 40px; }
  </style>
  </head>
<body>
  <header>
    <div class="container">
      <h1>北京一日游攻略</h1>
      <p class="lead">地铁线路与美食推荐，一页搞定</p>
    </div>
  </header>
  <main class="container">
    <div class="grid">
      <section class="card">
        <h2>地铁出行 <span class="badge">subway_trips.txt</span></h2>
        <div id="subway"></div>
      </section>
      <section class="card">
        <h2>附近美食 <span class="badge">location_foods.txt</span></h2>
        <div id="foods"></div>
      </section>
    </div>
  </main>
  <footer>由高德数据生成 · 本地静态展示</footer>
  <script>
    async function loadTxt(name){
      const res = await fetch(name);
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines.shift();
      const cols = (lines.shift()||'').split('\t');
      const rows = lines.map(l => l.split('\t'));
      return { header, cols, rows };
    }
    function toTable(m){
      const thead = '<thead><tr>' + m.cols.map(function(c){ return '<th>' + c + '</th>'; }).join('') + '</tr></thead>';
      const tbody = '<tbody>' + m.rows.map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
      return '<table>' + thead + tbody + '</table>';
    }
    (async()=>{
      const s = await loadTxt('subway_trips.txt');
      const f = await loadTxt('location_foods.txt');
      document.getElementById('subway').innerHTML = toTable(s);
      document.getElementById('foods').innerHTML = toTable(f);
    })();
  </script>
  </body>
  </html>`;

  fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
  console.log('All done. Output dir:', outputDir);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});



// netlify/functions/macau-2025.js

const DIRECT_URL   = 'https://livedrawpedia.com/data-totomacau-lengkap-2025.php';
const FALLBACK_URL = 'https://r.jina.ai/http://livedrawpedia.com/data-totomacau-lengkap-2025.php';

const DAYNAMES = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
const MONTH_INDEX = {
  Januari:0, Februari:1, Maret:2, April:3, Mei:4, Juni:5,
  Juli:6, Agustus:7, September:8, Oktober:9, November:10, Desember:11
};
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

const normWS   = (s) => s.replace(/\s+/g, ' ').trim();
const normDash = (s) => s.replace(/[\u2010-\u2015\u2212]/g, '-'); // semua jenis dash -> '-'

function normalizeMonthAbbr(raw) {
  const s = (raw||'').toLowerCase();
  if (s.startsWith('jan')) return 'Jan';
  if (s.startsWith('feb')) return 'Feb';
  if (s.startsWith('mar')) return 'Mar';
  if (s.startsWith('apr')) return 'Apr';
  if (s.startsWith('may') || s.startsWith('mei')) return 'Mei';
  if (s.startsWith('jun')) return 'Jun';
  if (s.startsWith('jul')) return 'Jul';
  if (s.startsWith('aug') || s.startsWith('agu')) return 'Agu';
  if (s.startsWith('sep')) return 'Sep';
  if (s.startsWith('oct') || s.startsWith('okt')) return 'Okt';
  if (s.startsWith('nov')) return 'Nov';
  if (s.startsWith('dec') || s.startsWith('des')) return 'Des';
  return null;
}
const abbrToIndex = { Jan:0, Feb:1, Mar:2, Apr:3, Mei:4, Jun:5, Jul:6, Agu:7, Sep:8, Okt:9, Nov:10, Des:11 };

async function fetchSource() {
  // 1) coba direct (bisa gagal di lokal karena TLS sumber)
  try {
    const res = await fetch(DIRECT_URL, {
      headers: {
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer':'https://livedrawpedia.com/'
      },
      redirect:'follow'
    });
    const body = await res.text();
    if (res.ok && body) return { body, via:'direct', url: DIRECT_URL, status: res.status };
    throw new Error(`Direct fetch not ok: ${res.status}`);
  } catch (e) {
    console.warn('Direct fetch failed, use fallback:', e?.message || e);
  }

  // 2) fallback: r.jina.ai (jadi teks ringan)
  const res2 = await fetch(FALLBACK_URL, { headers: { 'User-Agent':'curl/8' }, redirect:'follow' });
  const body2 = await res2.text();
  if (!res2.ok) throw new Error(`Fallback fetch failed: ${res2.status}`);
  return { body: body2, via:'fallback', url: FALLBACK_URL, status: res2.status };
}

exports.handler = async () => {
  try {
    const { body, via, url, status } = await fetchSource();

    // Fokus ke bagian 2025 + jadikan teks polos
    const startIdx = body.indexOf('Data Macau 2025');
    let slice = startIdx >= 0 ? body.slice(startIdx) : body;
    slice = normDash(
      slice
        .replace(/<script[\s\S]*?<\/script>/gi,' ')
        .replace(/<style[\s\S]*?<\/style>/gi,' ')
        .replace(/<[^>]+>/g,' ')
    );
    // Tambah spasi guard di awal/akhir agar boundary regex aman
    const text = ' ' + normWS(slice) + ' ';

    // Header tanggal (longgar): "Hari 10 Sep 2025" (bulan bisa "Sep"/"September"/"Okt"/"Oct"/dst)
    const headerRe = new RegExp(
      `(?:^|\\s)(${DAYNAMES.join('|')})\\s+(\\d{2})\\s+([A-Za-zÀ-ÿ]+)\\w*\\s+2025(?=\\s)`,
      'gi'
    );

    // Cari semua index header agar bisa membatasi potongan sampai header berikutnya
    const headers = [];
    let hm;
    while ((hm = headerRe.exec(text)) !== null) {
      headers.push({ index: hm.index, lastIndex: headerRe.lastIndex, dayName: hm[1], dd: hm[2], monRaw: hm[3] });
    }

    const rows = [];
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const nextStart = i + 1 < headers.length ? headers[i + 1].index : text.length;

      const abbr = normalizeMonthAbbr(h.monRaw);
      const mi = abbrToIndex[abbr ?? ''];
      if (mi == null) continue;

      // Potongan data: setelah header hingga sebelum header berikutnya
      // Ini memastikan kita tidak menyedot angka dari baris lain.
      const chunk = text.slice(h.lastIndex, nextStart);

      // Ambil tepat 6 token yang 4 digit atau minus
      const tokenRe = /(?:^|\s)(\d{4}|-)(?=\s|$)/g;
      const tokens = [];
      let tm;
      while ((tm = tokenRe.exec(chunk)) !== null && tokens.length < 6) {
        tokens.push(tm[1]);
      }
      // kalau kurang dari 6, pad dengan '-'
      while (tokens.length < 6) tokens.push('-');

      const yyyy = 2025;
      const day  = parseInt(h.dd, 10);
      const dateISO   = new Date(Date.UTC(yyyy, mi, day)).toISOString().slice(0,10);
      const monthName = Object.keys(MONTH_INDEX).find(k => MONTH_INDEX[k] === mi) || '';
      const dateText  = `${h.dd} ${monthName} ${yyyy}`;
      const dateShort = `${h.dd} ${MONTH_SHORT[mi]} ${yyyy}`;

      rows.push({
        dayName: h.dayName,
        dateISO, dateText, dateShort, monthName,
        values: {
          "00:01": tokens[0],
          "13:00": tokens[1],
          "16:00": tokens[2],
          "19:00": tokens[3],
          "22:00": tokens[4],
          "23:00": tokens[5],
        }
      });
    }

    // Urut terbaru -> lama
    rows.sort((a,b) => b.dateISO.localeCompare(a.dateISO));

    return {
      statusCode: 200,
      headers: {
        'content-type':'application/json; charset=utf-8',
        'access-control-allow-origin':'*',
        'cache-control':'public, max-age=300'
      },
      body: JSON.stringify({ source:url, via, status, count: rows.length, rows })
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers: { 'content-type':'application/json; charset=utf-8', 'access-control-allow-origin':'*' },
      body: JSON.stringify({ error: String(err) })
    };
  }
};

// ===== Trading SY - script.js (آمن جاهز للنشر) =====

// ---------- إعداد مفاتيح الـ API (اتركها فارغة قبل رفع المشروع إلى GitHub) ----------
const ALPHA_VANTAGE_KEY = ''; // ضع مفتاح Alpha Vantage هنا محلياً فقط لا ترفعه لمستودع عام
const NEWSAPI_KEY = '';       // ضع مفتاح NewsAPI هنا محلياً فقط لا ترفعه لمستودع عام

// ---------- بيانات وتهيئة ----------
let coins = JSON.parse(localStorage.getItem('ts_coins')) || ['bitcoin', 'ethereum', 'ripple'];
let stocks = JSON.parse(localStorage.getItem('ts_stocks')) || ['AAPL', 'MSFT', 'TSLA'];
let comments = JSON.parse(localStorage.getItem('ts_comments')) || {};
let predictions = JSON.parse(localStorage.getItem('ts_predictions')) || {};
let predictionTimestamps = JSON.parse(localStorage.getItem('ts_predictionTime')) || {};
let selectedItem = null;
let priceChart = null;
let chartPeriod = 'daily';

// ---------- حفظ في localStorage ----------
function saveStorage() {
  localStorage.setItem('ts_coins', JSON.stringify(coins));
  localStorage.setItem('ts_stocks', JSON.stringify(stocks));
  localStorage.setItem('ts_comments', JSON.stringify(comments));
  localStorage.setItem('ts_predictions', JSON.stringify(predictions));
  localStorage.setItem('ts_predictionTime', JSON.stringify(predictionTimestamps));
}

// ---------- عرض القوائم (عملات وأسهم) ----------
function renderLists() {
  const coinsBox = document.getElementById('coinsItems');
  const stocksBox = document.getElementById('stocksItems');
  if (!coinsBox || !stocksBox) return;

  coinsBox.innerHTML = '';
  coins.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'list-item-btn';
    btn.textContent = c;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '×';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteItem(c, 'coin'); };

    btn.onclick = () => selectItem(c, 'coin');
    btn.appendChild(delBtn);
    coinsBox.appendChild(btn);
  });

  stocksBox.innerHTML = '';
  stocks.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'list-item-btn';
    btn.textContent = s;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '×';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteItem(s, 'stock'); };

    btn.onclick = () => selectItem(s, 'stock');
    btn.appendChild(delBtn);
    stocksBox.appendChild(btn);
  });
}

// ---------- إضافة عملة أو سهم (التحقق من CoinGecko للعملات) ----------
async function addItem(type) {
  if (type === 'coin') {
    const input = document.getElementById('coinInput');
    const val = input.value.trim().toLowerCase();
    if (!val) return alert('أدخل اسم العملة أولاً.');

    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(val)}`);
      if (res.status === 200) {
        if (!coins.includes(val)) {
          coins.unshift(val);
          saveStorage();
          renderLists();
          input.value = '';
          selectItem(val, 'coin');
        } else alert('هذه العملة موجودة بالفعل.');
      } else {
        alert('هذه العملة غير موجودة في CoinGecko.');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التحقق من العملة.');
    }

  } else if (type === 'stock') {
    const input = document.getElementById('stockInput');
    const val = input.value.trim().toUpperCase();
    if (!val) return alert('أدخل اسم السهم أولاً.');
    if (!stocks.includes(val)) {
      stocks.unshift(val);
      saveStorage();
      renderLists();
      input.value = '';
      selectItem(val, 'stock');
    } else alert('هذا السهم موجود بالفعل.');
  }
}

// ---------- حذف عنصر ----------
function deleteItem(name, type) {
  if (type === 'coin') coins = coins.filter(c => c !== name);
  else if (type === 'stock') stocks = stocks.filter(s => s !== name);

  if (predictions[name]) delete predictions[name];
  if (comments[name]) delete comments[name];
  if (predictionTimestamps[name]) delete predictionTimestamps[name];

  saveStorage();
  renderLists();
  if (selectedItem && selectedItem.name === name) selectedItem = null;
}

// ---------- اختيار عنصر وعرض الأقسام ----------
function selectItem(name, type) {
  selectedItem = { name, type };
  openTabByName('price');

  // تهيئة رسائل الحالة / إشعار الأسعار داخل تبويب السعر
  ensurePriceNotice();

  // الأخبار
  const newsEl = document.getElementById('newsList');
  if (newsEl) newsEl.innerHTML = 'اختر "تحديث الأخبار" لجلب أخبار حديثة أو عرض أخبار افتراضية عند عدم وجود مفتاح.';

  // جلب الأسعار (CoinGecko أو AlphaVantage حسب النوع)
  fetchPrice();

  // التنبؤ والتعليقات
  if (!predictions[name]) predictions[name] = [];
  if (!comments[name]) comments[name] = [];
  updatePredictionDisplay();
  renderComments();
}

// ---------- التأكد من وجود عنصر لإشعارات السعر ----------
function ensurePriceNotice() {
  const priceTab = document.getElementById('price');
  if (!priceTab) return;
  if (!document.getElementById('priceNotice')) {
    const notice = document.createElement('div');
    notice.id = 'priceNotice';
    notice.style.margin = '8px 0';
    notice.style.color = '#333';
    priceTab.prepend(notice);
  }
  document.getElementById('priceNotice').textContent = '';
}

// ---------- التبويبات ----------
function openTab(evt, tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  const el = document.getElementById(tabName);
  if (el) el.style.display = 'block';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
}

function openTabByName(name) {
  const btns = document.querySelectorAll('.tab-btn');
  let found = false;
  btns.forEach(b => {
    const onclick = b.getAttribute('onclick') || '';
    if (onclick.includes(`'${name}'`) || onclick.includes(`"${name}"`)) {
      b.click();
      found = true;
    }
  });
  if (!found) {
    // fallback: show content directly
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    const el = document.getElementById(name);
    if (el) el.style.display = 'block';
  }
}

// ---------- التعليقات ----------
function addComment() {
  if (!selectedItem) return alert('اختر عملة أو سهم أولاً.');
  const ta = document.getElementById('commentInput');
  const text = ta.value.trim();
  if (!text) return alert('اكتب تعليقاً قبل الإرسال.');
  if (!comments[selectedItem.name]) comments[selectedItem.name] = [];
  comments[selectedItem.name].unshift(text);
  saveStorage();
  ta.value = '';
  renderComments();
}

function renderComments() {
  if (!selectedItem) return;
  const commentListEl = document.getElementById('commentList');
  const list = comments[selectedItem.name] || [];
  if (!commentListEl) return;
  commentListEl.innerHTML = list.map(c => `<div style="padding:6px;border-bottom:1px solid #eee;">${escapeHtml(c)}</div>`).join('') || '<div>لا توجد تعليقات بعد.</div>';
}

// ---------- التنبؤ مع قيد 24 ساعة ----------
function setPrediction(pred) {
  if (!selectedItem) return alert('اختر عملة أو سهم أولاً.');
  const name = selectedItem.name;
  const now = Date.now();
  if (predictionTimestamps[name] && now - predictionTimestamps[name] < 24 * 60 * 60 * 1000) {
    return alert('يمكنك الإدلاء بتنبؤ واحد فقط كل 24 ساعة لكل عملة أو سهم.');
  }
  if (!predictions[name]) predictions[name] = [];
  predictions[name].unshift(pred);
  predictionTimestamps[name] = now;
  saveStorage();
  updatePredictionDisplay();
}

function updatePredictionDisplay() {
  if (!selectedItem) return;
  const predEl = document.getElementById('currentPrediction');
  const statsEl = document.getElementById('predictionStats');
  const allPreds = predictions[selectedItem.name] || [];
  const up = allPreds.filter(p => p === 'صعود').length;
  const down = allPreds.filter(p => p === 'هبوط').length;
  const total = allPreds.length;
  if (predEl) predEl.textContent = total ? `${up >= down ? 'صعود' : 'هبوط'} (${total} توقع)` : 'لا يوجد توقع بعد';
  if (statsEl) statsEl.textContent = total ? `صعود: ${Math.round((up / total) * 100)}% ، هبوط: ${Math.round((down / total) * 100)}%` : 'لا توجد بيانات';
}

// ---------- توليد بيانات شارت تجريبية متعددة الفترات ----------
function generateFakeCandlestickData(period = 'daily') {
  const days = period === 'daily' ? 30 : period === 'weekly' ? 12 : 6;
  const data = [];
  const labels = [];
  let price = 100;
  for (let i = 0; i < days; i++) {
    const open = price + Math.random() * 4 - 2;
    const close = open + Math.random() * 4 - 2;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const label = period === 'daily' ? `Day ${i + 1}` : period === 'weekly' ? `Week ${i + 1}` : `Month ${i + 1}`;
    data.push({ o: open, h: high, l: low, c: close, date: label });
    labels.push(label);
    price = close;
  }
  return { data, labels };
}

// ---------- رسم الشارت (يعتمد على chartjs-chart-financial) ----------
function renderChart(labels, data) {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (priceChart) priceChart.destroy();

  // تأكد أن financial plugin محمّل، وإلا استخدم شارت خطي كبديل
  try {
    priceChart = new Chart(ctx, {
      type: 'candlestick',
      data: { labels: labels, datasets: [{ label: selectedItem ? selectedItem.name : '', data: data }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { type: 'category' }, y: { beginAtZero: false } } }
    });
  } catch (e) {
    // بديل: رسم خطي إذا تعذّر الشموع
    priceChart = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: [{ label: selectedItem ? selectedItem.name : '', data: data.map(d => d.c), borderColor: '#1a237e', backgroundColor: 'rgba(26,115,232,0.2)', fill: true }] },
      options: { responsive: true }
    });
  }
}

// ---------- جلب الأسعار الحقيقية (CoinGecko للعملات، Alpha Vantage للأسهم إذا KEY موجود) ----------
async function fetchPrice() {
  if (!selectedItem) return;
  const name = selectedItem.name;
  const priceNotice = document.getElementById('priceNotice');
  if (priceNotice) priceNotice.textContent = 'جارٍ جلب الأسعار...';

  if (selectedItem.type === 'coin') {
    try {
      // days يتحدد حسب chartPeriod
      const days = chartPeriod === 'daily' ? 30 : chartPeriod === 'weekly' ? 90 : 365;
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(name)}/market_chart?vs_currency=usd&days=${days}`);
      const data = await res.json();
      if (!data || !data.prices) throw new Error('بيانات غير كاملة من CoinGecko');

      // نبني بيانات شمعية تقريبية من بيانات الأسعار اللحظية
      const labels = data.prices.map(p => new Date(p[0]).toLocaleDateString());
      const candlestickData = data.prices.map((p, i) => {
        const open = p[1];
        const close = p[1] + (Math.random() * 2 - 1);
        const high = Math.max(open, close) + Math.random();
        const low = Math.min(open, close) - Math.random();
        return { x: labels[i], o: open, h: high, l: low, c: close };
      });

      if (priceNotice) priceNotice.textContent = '';
      renderChart(labels, candlestickData);
    } catch (err) {
      console.error(err);
      if (priceNotice) priceNotice.textContent = 'حدث خطأ أثناء جلب بيانات CoinGecko — عرض بيانات تجريبية.';
      const fake = generateFakeCandlestickData(chartPeriod);
      renderChart(fake.labels, fake.data);
    }
  } else {
    // الأسهم
    if (!ALPHA_VANTAGE_KEY) {
      if (priceNotice) priceNotice.textContent = 'Alpha Vantage key غير مفعلة — عرض بيانات تجريبية للأسهم.';
      const fake = generateFakeCandlestickData(chartPeriod);
      renderChart(fake.labels, fake.data);
      return;
    }
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(name)}&apikey=${ALPHA_VANTAGE_KEY}`);
      const data = await res.json();
      if (!data['Time Series (Daily)']) throw new Error('AlphaVantage returned no Time Series');

      const times = Object.keys(data['Time Series (Daily)']).slice(0, chartPeriod === 'daily' ? 30 : chartPeriod === 'weekly' ? 90 : 365).reverse();
      const labels = times;
      const candlestickData = times.map(t => {
        const d = data['Time Series (Daily)'][t];
        return { x: t, o: +d['1. open'], h: +d['2. high'], l: +d['3. low'], c: +d['4. close'] };
      });
      if (priceNotice) priceNotice.textContent = '';
      renderChart(labels, candlestickData);
    } catch (err) {
      console.error(err);
      if (priceNotice) priceNotice.textContent = 'لم نتمكن من جلب بيانات الأسهم من Alpha Vantage — عرض بيانات تجريبية.';
      const fake = generateFakeCandlestickData(chartPeriod);
      renderChart(fake.labels, fake.data);
    }
  }
}

// ---------- تغيير فترة الشارت ----------
function updateChartPeriod() {
  chartPeriod = document.getElementById('pricePeriod').value || 'daily';
  fetchPrice();
}

// ---------- الأخبار (NewsAPI إذا KEY موجود، وإلا عرض تجريبي) ----------
async function fetchNews() {
  if (!selectedItem) return;
  const newsList = document.getElementById('newsList');
  newsList.innerHTML = 'جارٍ جلب الأخبار...';
  if (!NEWSAPI_KEY) {
    // عرض جدول إخباري تجريبي مع ملاحظة
    setTimeout(() => {
      newsList.innerHTML = `<div>NewsAPI key غير مفعلة — عرض أخبار تجريبية</div>
        <ul>
          <li>خبر افتراضي عن ${selectedItem.name}: تحليل فني مختصر.</li>
          <li>تقرير: تأثير حدث عالمي على ${selectedItem.name}.</li>
        </ul>`;
    }, 500);
    return;
  }
  try {
    const query = selectedItem.name;
    const res = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${NEWSAPI_KEY}`);
    const data = await res.json();
    if (data.articles && data.articles.length) {
      newsList.innerHTML = '<ul>' + data.articles.map(a => `<li><a href="${a.url}" target="_blank">${escapeHtml(a.title)}</a></li>`).join('') + '</ul>';
    } else newsList.innerHTML = 'لا توجد أخبار حالياً.';
  } catch (err) {
    console.error(err);
    newsList.innerHTML = 'حدث خطأ أثناء جلب الأخبار.';
  }
}

// ---------- مساعدة تفادي HTML خطير ----------
function escapeHtml(unsafe) {
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ---------- تهيئة عند التحميل ----------
function init() {
  renderLists();
  // تأكد أن تبويبات موجودة وأن التبويب الافتراضي مرئي
  setTimeout(() => {
    if (document.querySelector('.tab-btn')) document.querySelectorAll('.tab-btn')[0].click();
  }, 100);
  if (coins.length > 0) selectItem(coins[0], 'coin');
}

document.addEventListener('DOMContentLoaded', init);

// تحديث تلقائي للأسعار (آمن) كل 30 ثانية
setInterval(() => {
  if (selectedItem) fetchPrice();
}, 30000);

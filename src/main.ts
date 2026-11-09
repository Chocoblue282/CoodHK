import './styles.css';
import restaurantsData from './data/restaurants.json';

type Restaurant = {
  id: string;
  name: string;
  address: string;
  district: string;
  cuisine: string;
  dining: string;
  price: number;
  priceLabel: string;
  hours: string;
  hoursDetail: string[];
  rawOpening: Record<string, string>;
  submissionDate: string;
  status: string;
  mapX: number;
  mapY: number;
};

type FilterState = { cuisine: string; price: string; district: string; search: string };

const allRestaurants = (restaurantsData as Restaurant[]).filter((restaurant) => restaurant.status === 'approved');
const cuisineOptions = [...new Set(allRestaurants.map((restaurant) => restaurant.cuisine))];
const districtOptions = [...new Set(allRestaurants.map((restaurant) => restaurant.district))];
const districtPositions: Record<string, [number, number]> = {
  天水圍: [20, 14], 屯門: [18, 42], 元朗: [32, 25], 荃灣: [52, 49], 葵涌: [62, 45], 葵芳: [68, 56],
  深水埗: [72, 70], 旺角: [77, 67], 九龍: [77, 76], 觀塘: [91, 80], 沙田: [72, 29], 大埔: [82, 18], 灣仔: [84, 78], 香港: [64, 62]
};
const state: FilterState = { cuisine: '全部', price: '全部', district: '全部', search: '' };
let selectedId: string | null = null;
let detailOpen = false;

const app = document.querySelector<HTMLDivElement>('#app')!;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character] ?? character);
}

function todayDisplay() {
  const date = new Date();
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatDisplayDate(value: string) {
  const match = value.match(/(\d{4})[-/]?(\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[3].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[1]}`;
  const dayFirst = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dayFirst) return `${dayFirst[1].padStart(2, '0')}/${dayFirst[2].padStart(2, '0')}/${dayFirst[3]}`;
  return value || '暫無資料';
}

function savePendingRecord(key: string, record: Record<string, unknown>) {
  try {
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as Record<string, unknown>[];
    localStorage.setItem(key, JSON.stringify([...existing, record]));
  } catch {
    // Private browsing or blocked storage should not prevent submission feedback.
  }
}

function filteredRestaurants() {
  const query = state.search.trim().toLowerCase();
  return allRestaurants.filter((restaurant) => {
    const cuisineMatch = state.cuisine === '全部' || restaurant.cuisine === state.cuisine;
    const priceMatch = state.price === '全部' || (state.price === '30或以下' ? restaurant.price <= 30 : restaurant.price > 30 && restaurant.price <= 40);
    const districtMatch = state.district === '全部' || restaurant.district === state.district;
    const searchMatch = !query || `${restaurant.name}${restaurant.address}${restaurant.cuisine}`.toLowerCase().includes(query);
    return cuisineMatch && priceMatch && districtMatch && searchMatch;
  });
}

function chip(label: string, key: keyof FilterState, active: boolean) {
  return `<button class="filter-chip ${active ? 'active' : ''}" data-filter-key="${key}" data-filter-value="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
}

function renderFilters() {
  return `<section class="filter-panel" aria-label="餐廳篩選器">
    <div class="filter-heading"><div><span class="eyebrow">即時探索</span><h2>揀區、揀餸、揀抵食</h2></div><label class="search-box"><span>⌕</span><input id="search-input" value="${escapeHtml(state.search)}" placeholder="搜尋餐廳或地址" /></label></div>
    <div class="filter-row"><span class="filter-label">菜式</span><div class="chip-scroller">${["全部", ...cuisineOptions].map((option) => chip(option, 'cuisine', state.cuisine === option)).join('')}</div></div>
    <div class="filter-row"><span class="filter-label">價錢</span><div class="chip-scroller">${['全部', '30或以下', '31–40'].map((option) => chip(option, 'price', state.price === option)).join('')}</div></div>
    <div class="filter-row"><span class="filter-label">地區</span><div class="chip-scroller">${['全部', ...districtOptions].map((option) => chip(option, 'district', state.district === option)).join('')}</div></div>
  </section>`;
}

function renderMap(restaurants: Restaurant[]) {
  const byDistrict = new Map<string, Restaurant[]>();
  restaurants.forEach((restaurant) => byDistrict.set(restaurant.district, [...(byDistrict.get(restaurant.district) ?? []), restaurant]));
  const showPins = state.district !== '全部';
  const groupPins = [...byDistrict.entries()].map(([district, items]) => {
    const fallback = districtPositions[district] ?? [64, 62];
    const x = items.reduce((sum, item) => sum + item.mapX, 0) / items.length || fallback[0];
    const y = items.reduce((sum, item) => sum + item.mapY, 0) / items.length || fallback[1];
    if (showPins && (state.district === district || state.district === '全部')) return items.map((item) => `<button class="map-pin ${selectedId === item.id ? 'selected' : ''}" style="left:${item.mapX}%;top:${item.mapY}%" data-restaurant-id="${item.id}" aria-label="${escapeHtml(item.name)}"><span class="pin-dot"></span><span class="pin-tooltip">${escapeHtml(item.name)}</span></button>`).join('');
    return `<button class="cluster-pin" style="left:${x}%;top:${y}%" data-cluster-district="${escapeHtml(district)}" aria-label="${escapeHtml(district)} ${items.length} 間餐廳"><span>${items.length}</span><small>${escapeHtml(district)}</small></button>`;
  }).join('');
  const activeLabel = state.district === '全部' ? '全港探索' : `${state.district} · 已放大`;
  return `<div class="map-panel">
    <div class="map-toolbar"><div class="map-status"><span class="live-dot"></span><strong>${activeLabel}</strong><span>地圖上顯示 ${restaurants.length} 間</span></div><div class="map-legend"><span><i class="legend-cluster"></i>聚合點</span><span><i class="legend-pin"></i>餐廳 Pin</span></div></div>
    <div class="map-canvas"><div class="map-watermark">COOLHK<br><small>FOOD MAP / 2026</small></div><div class="map-coast"></div><svg class="road-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M-2 67 C20 57 31 62 43 55 S70 36 103 43"/><path d="M20 -5 C30 17 35 31 49 39 S73 65 78 104"/><path d="M0 21 C27 28 44 20 62 24 S83 34 105 30"/><path d="M60 -3 C55 17 64 25 75 31 S88 59 102 68"/><path class="road-secondary" d="M4 91 C29 78 43 76 61 82 S86 91 103 84"/><path class="road-secondary" d="M11 3 C18 25 18 46 8 71"/></svg><div class="district-labels"><span style="left:14%;top:29%">屯門</span><span style="left:27%;top:12%">元朗</span><span style="left:17%;top:5%">天水圍</span><span style="left:46%;top:43%">荃灣</span><span style="left:62%;top:37%">葵涌</span><span style="left:75%;top:64%">九龍</span><span style="left:84%;top:74%">港島</span></div><div class="marker-layer">${groupPins || '<div class="empty-map">未有符合條件的餐廳<br><button data-reset-filters>清除篩選</button></div>'}</div><div class="map-scale"><span></span><small>約 2 km</small></div><div class="map-attribution">Map view · Hong Kong</div></div>
  </div>`;
}

function restaurantCard(restaurant: Restaurant) {
  return `<article class="restaurant-card ${selectedId === restaurant.id ? 'selected' : ''}" data-card-id="${restaurant.id}">
    <div class="card-topline"><span class="card-district">${escapeHtml(restaurant.district)}</span><span class="status-badge"><i></i>已核准</span></div>
    <div class="card-title-row"><h3>${escapeHtml(restaurant.name)}</h3><strong class="price">${escapeHtml(restaurant.priceLabel)}</strong></div>
    <p class="card-address">⌖ ${escapeHtml(restaurant.address)}</p>
    <div class="card-meta"><span>${escapeHtml(restaurant.cuisine)}</span><span>${escapeHtml(restaurant.dining)}</span><span>⏱ ${escapeHtml(restaurant.hours)}</span></div>
    <button class="card-more" data-detail-id="${restaurant.id}">查看詳情 <span>↗</span></button>
  </article>`;
}

function renderDrawer(restaurants: Restaurant[]) {
  const cards = restaurants.slice(0, 14).map(restaurantCard).join('');
  return `<section class="drawer-panel"><div class="drawer-handle"></div><div class="drawer-heading"><div><span class="eyebrow">${state.district === '全部' ? '全港好食地圖' : `${escapeHtml(state.district)} 精選`}</span><h2>今日食邊間？</h2></div><div class="result-count"><strong>${restaurants.length}</strong><span>間已核准</span></div></div><div class="drawer-subline"><span>按地圖 Pin 或卡片，睇完整營業資料</span><button data-reset-filters>重設篩選 ↺</button></div><div class="card-scroller">${cards || '<div class="empty-state"><strong>未搵到啱心水嘅餐廳</strong><span>試下換個地區或價錢範圍。</span><button data-reset-filters>清除所有篩選</button></div>'}</div><div class="drawer-footnote"><span>資料來源：餐廳報料庫 · 最後更新 09/11/2026</span><span><i class="approved-dot"></i>只顯示已核准資料</span></div></section>`;
}

function renderFooter() {
  return `<footer class="site-footer"><div class="footer-brand"><img src="/assets/coolhk-logo.png" alt="Coolhk" /><div><strong>Coolhk</strong><span>香港平價美食地圖</span></div></div><div class="footer-note"><strong>報料免責聲明</strong><span>餐廳資料由市民提供，Coolhk 會盡力核實但不保證資料永遠準確或完整；實際營業時間及價格請以餐廳最新公告為準。</span></div><span class="footer-copy">© 2026 Coolhk Map</span></footer>`;
}

function renderApp() {
  const results = filteredRestaurants();
  app.innerHTML = `<div class="site-shell"><header class="site-header"><a class="brand" href="#top" aria-label="Coolhk 香港平價美食地圖"><img src="/assets/coolhk-logo.png" alt="Coolhk Logo" /><span class="brand-copy"><b>Coolhk</b><small>香港平價美食地圖</small></span></a><nav class="main-nav"><a href="#explore">探索地圖</a><a href="#how-it-works">點樣用</a></nav><div class="header-actions"><span class="header-stat"><b>${allRestaurants.length}</b>間抵食店</span><button class="header-submit" data-open-submit>＋ 報料</button></div></header><main id="top"><section class="hero"><div class="hero-copy"><span class="eyebrow orange">香港人嘅抵食雷達</span><h1>搵到啱你嘅<br><em>平價好味道。</em></h1><p>由屯門到港島，篩選全港 $40 或以下餐廳，<br class="desktop-only">一眼睇晒地圖，單手就可以出發。</p><div class="hero-actions"><button class="primary-button" data-scroll-explore>開始搵食 <span>↓</span></button><span class="hero-proof"><i></i> ${allRestaurants.length} 間已核准餐廳</span></div></div><div class="hero-graphic"><div class="hero-stamp">低於<br><b>$40</b></div><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><img src="/assets/coolhk-logo.png" alt="Coolhk map pin and bowl" /><span class="hero-coordinate">22.3193° N<br>114.1694° E</span></div></section><section id="explore" class="explore-section"><div class="section-kicker"><span>01 / 探索</span><span>按地區搵好食</span></div>${renderFilters()}<div class="explore-stage">${renderMap(results)}${renderDrawer(results)}</div></section><section id="how-it-works" class="how-section"><div class="how-intro"><span class="eyebrow orange">02 / 點樣用</span><h2>由地圖，<br><em>搵到你嘅下一餐。</em></h2><p>唔使登入，唔使刷新。篩選你想食嘅菜式，再按一個 Pin，就有地址、營業時間同出發路線。</p></div><div class="how-steps"><div><b>01</b><strong>揀地區</strong><span>橫向滑動篩選器，揀你附近嘅區。</span></div><div><b>02</b><strong>睇聚合點</strong><span>密集餐廳自動聚合，地圖保持清爽。</span></div><div><b>03</b><strong>一鍵出發</strong><span>打開詳情，用 Google Maps 直接導航。</span></div></div></section>${renderFooter()}</main><div id="modal-root"></div><div id="toast" class="toast" role="status"></div></div>`;
  bindEvents();
}

function showToast(message: string) {
  const toast = document.querySelector<HTMLDivElement>('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2800);
}

function openDetail(id: string) {
  selectedId = id;
  detailOpen = true;
  renderApp();
  const restaurant = allRestaurants.find((item) => item.id === id);
  if (!restaurant) return;
  const modal = document.querySelector<HTMLDivElement>('#modal-root')!;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name + ' ' + restaurant.address)}`;
  modal.innerHTML = `<div class="modal-backdrop" data-close-modal></div><section class="detail-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(restaurant.name)} 詳情"><button class="modal-close" data-close-modal aria-label="關閉">×</button><div class="detail-hero"><div class="detail-pin"><span>⌖</span></div><div><span class="eyebrow orange">${escapeHtml(restaurant.district)} · 已核准資料</span><h2>${escapeHtml(restaurant.name)}</h2><p>${escapeHtml(restaurant.cuisine)} · ${escapeHtml(restaurant.dining)}</p></div><strong class="detail-price">${escapeHtml(restaurant.priceLabel)}<small>起</small></strong></div><div class="detail-body"><div class="detail-block"><span class="detail-label">地址</span><strong>${escapeHtml(restaurant.address)}</strong><button class="text-link" data-copy-address="${escapeHtml(restaurant.address)}">複製地址</button></div><div class="detail-grid"><div class="detail-block"><span class="detail-label">營業時間</span><strong>${escapeHtml(restaurant.hours)}</strong><small>${restaurant.hoursDetail.length > 1 ? '；' + restaurant.hoursDetail.slice(1, 3).map(escapeHtml).join('、') : '每日資料以店舖最新公告為準'}</small></div><div class="detail-block"><span class="detail-label">資料狀態</span><strong class="approved-text"><i></i>Approved</strong><small>最後報料：${escapeHtml(formatDisplayDate(restaurant.submissionDate))}</small></div></div><div class="detail-callout"><span>搵食小提示</span><strong>出發前建議先致電或查看店舖最新公告，避免撲空。</strong></div></div><div class="detail-actions"><a class="action-button maps" href="${mapsUrl}" target="_blank" rel="noopener"><span>↗</span><b>Google Maps</b><small>即刻出發</small></a><button class="action-button submit" data-open-submit><span>＋</span><b>報料</b><small>更新資料</small></button><button class="action-button review" data-open-review="${restaurant.id}"><span>★</span><b>寫食評</b><small>分享食後感</small></button></div></section>`;
  document.body.classList.add('modal-open');
  bindModalEvents();
}

function openSubmit() {
  const modal = document.querySelector<HTMLDivElement>('#modal-root')!;
  modal.innerHTML = `<div class="modal-backdrop" data-close-modal></div><section class="form-modal" role="dialog" aria-modal="true" aria-label="報料"><button class="modal-close" data-close-modal>×</button><span class="eyebrow orange">社群報料</span><h2>幫手更新一間<br><em>抵食好店。</em></h2><p class="form-lead">你嘅一個報料，幫到下一個搵食嘅人。提交後會由團隊核實，核准後先會上線。</p><form id="submission-form"><label>餐廳名稱<input name="name" required placeholder="例如：家之樂住家餸" /></label><label>地址<input name="address" required placeholder="街道、商場、舖號" /></label><div class="form-two"><label>菜式<input name="cuisine" required placeholder="例如：港式" /></label><label>最低價錢<input name="price" required placeholder="$30" /></label></div><label>營業時間<input name="hours" placeholder="例如：11:00–21:00" /></label><label class="upload-zone"><span class="upload-icon">＋</span><b>上載店舖相片（可選）</b><small>支援 JPG / PNG，會自動壓縮至較細檔案</small><input id="photo-input" type="file" accept="image/jpeg,image/png" /></label><div id="compression-note" class="compression-note"></div><div class="form-foot"><span>提交日期：${todayDisplay()}<br><small>狀態：pending（待核准）</small></span><button class="primary-button" type="submit">送出報料 <span>→</span></button></div></form></section>`;
  document.body.classList.add('modal-open');
  bindModalEvents();
  document.querySelector<HTMLInputElement>('#photo-input')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    const note = document.querySelector<HTMLDivElement>('#compression-note');
    if (note) note.innerHTML = `<i>✓</i> 已將圖片由 ${Math.round(file.size / 1024)}KB 壓縮至 ${Math.round(compressed.size / 1024)}KB，可安心提交。`;
  });
  document.querySelector<HTMLFormElement>('#submission-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const values = Object.fromEntries(new FormData(form).entries());
    savePendingRecord('coolhk_pending_submissions', { ...values, status: 'pending', submission_date: todayDisplay(), image_status: document.querySelector('#compression-note')?.textContent ?? '' });
    closeModal();
    showToast(`報料已收妥（${todayDisplay()}），核准後會公開顯示。`);
  });
}

function openReview(id: string) {
  const restaurant = allRestaurants.find((item) => item.id === id);
  if (!restaurant) return;
  const modal = document.querySelector<HTMLDivElement>('#modal-root')!;
  modal.innerHTML = `<div class="modal-backdrop" data-close-modal></div><section class="form-modal review-modal" role="dialog" aria-modal="true" aria-label="寫食評"><button class="modal-close" data-close-modal>×</button><span class="eyebrow orange">分享食後感</span><h2>你覺得<br><em>${escapeHtml(restaurant.name)}</em> 點？</h2><form id="review-form"><label>顯示名稱<input name="name" required placeholder="可用暱稱" /></label><label>評分<div class="rating-picker" role="group" aria-label="評分">${[1,2,3,4,5].map((n) => `<button type="button" data-rating="${n}" class="rating-star">★</button>`).join('')}</div><input type="hidden" name="rating" value="0" /></label><label>食評<textarea name="comment" required minlength="8" maxlength="750" placeholder="講下味道、份量、抵唔抵食…"></textarea></label><div class="form-foot"><span>提交日期：${todayDisplay()}<br><small>狀態：pending（待核准）</small></span><button class="primary-button" type="submit">確認送出 <span>→</span></button></div></form></section>`;
  document.body.classList.add('modal-open');
  bindModalEvents();
  document.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach((button) => button.addEventListener('click', () => {
    const rating = Number(button.dataset.rating);
    document.querySelector<HTMLInputElement>('input[name="rating"]')!.value = String(rating);
    document.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach((star) => star.classList.toggle('active', Number(star.dataset.rating) <= rating));
  }));
  document.querySelector<HTMLFormElement>('#review-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const rating = Number(new FormData(form).get('rating'));
    if (!form.checkValidity() || !rating) { if (!rating) showToast('請先揀評分'); form.reportValidity(); return; }
    const values = Object.fromEntries(new FormData(form).entries());
    savePendingRecord('coolhk_pending_reviews', { ...values, restaurant_id: restaurant.id, status: 'pending', submission_date: todayDisplay() });
    closeModal();
    showToast(`食評已送出，核准後會顯示喺 ${restaurant.name} 詳情。`);
  });
}

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const max = 1200;
      const ratio = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.78);
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  });
}

function closeModal() {
  detailOpen = false;
  document.body.classList.remove('modal-open');
  const modal = document.querySelector<HTMLDivElement>('#modal-root');
  if (modal) modal.innerHTML = '';
}

function bindModalEvents() {
  document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach((element) => element.addEventListener('click', closeModal));
  document.querySelectorAll<HTMLButtonElement>('[data-open-submit]').forEach((button) => button.addEventListener('click', openSubmit));
  document.querySelectorAll<HTMLButtonElement>('[data-open-review]').forEach((button) => button.addEventListener('click', () => openReview(button.dataset.openReview!)));
  document.querySelectorAll<HTMLButtonElement>('[data-copy-address]').forEach((button) => button.addEventListener('click', async () => { await navigator.clipboard?.writeText(button.dataset.copyAddress ?? ''); showToast('地址已複製'); }));
}

function bindEvents() {
  document.querySelectorAll<HTMLButtonElement>('[data-filter-key]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.filterKey as keyof FilterState;
    state[key] = button.dataset.filterValue ?? '全部';
    renderApp();
  }));
  document.querySelector<HTMLInputElement>('#search-input')?.addEventListener('input', (event) => { state.search = (event.target as HTMLInputElement).value; renderApp(); const input = document.querySelector<HTMLInputElement>('#search-input'); input?.focus(); input?.setSelectionRange(state.search.length, state.search.length); });
  document.querySelectorAll<HTMLElement>('[data-card-id]').forEach((card) => card.addEventListener('click', (event) => { if (!(event.target as HTMLElement).closest('[data-detail-id]')) { selectedId = card.dataset.cardId ?? null; renderApp(); } }));
  document.querySelectorAll<HTMLButtonElement>('[data-detail-id]').forEach((button) => button.addEventListener('click', () => openDetail(button.dataset.detailId!)));
  document.querySelectorAll<HTMLButtonElement>('[data-restaurant-id]').forEach((button) => button.addEventListener('click', () => openDetail(button.dataset.restaurantId!)));
  document.querySelectorAll<HTMLButtonElement>('[data-cluster-district]').forEach((button) => button.addEventListener('click', () => { state.district = button.dataset.clusterDistrict ?? '全部'; selectedId = null; renderApp(); document.querySelector('#explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  document.querySelectorAll<HTMLButtonElement>('[data-reset-filters]').forEach((button) => button.addEventListener('click', () => { state.cuisine = '全部'; state.price = '全部'; state.district = '全部'; state.search = ''; renderApp(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-open-submit]').forEach((button) => button.addEventListener('click', openSubmit));
  document.querySelector<HTMLButtonElement>('[data-scroll-explore]')?.addEventListener('click', () => document.querySelector('#explore')?.scrollIntoView({ behavior: 'smooth' }));
  bindModalEvents();
}

renderApp();

/* ========= AIV core: state, utils, actions, router ========= */

const $ = s => document.querySelector(s);

const state = {
  lang: localStorage.getItem('aiv-lang') || 'zh',
  theme: localStorage.getItem('aiv-theme') || 'dark',
  tokens: DATA.profile.tokens,
  enrolled: { ...ENROLLED_INIT },          // courseId -> progress %
  marketTab: 'briefs',
  marketCat: 'all',
  marketQ: '',
  courseFilter: 'all',
  courseTab: 'overview',
  profileTab: 'portfolio',
  ordersSub: 'creator',
  studio: { mode: 't2v', model: 'turbo', aspect: '9:16', dur: 5, res: '720', prompt: '' },
  genSeq: 100,
  notifsOpen: false,
};

/* ---- i18n helpers ---- */
function t(k, vars) {
  let s = (I18N[state.lang] && I18N[state.lang][k]);
  if (s === undefined) s = k;
  if (vars) for (const [key, val] of Object.entries(vars)) s = s.replace('{' + key + '}', val);
  return s;
}
function L(v) {
  if (v && typeof v === 'object' && ('zh' in v || 'en' in v)) return v[state.lang] ?? v.zh ?? v.en;
  return v;
}
function money(n) { return '¥' + Number(n).toLocaleString('en-US'); }
function matchQ(ql, ...fields) {
  if (!ql) return true;
  return fields.some(f => f && ((f.zh || '') + ' ' + (f.en || '')).toLowerCase().includes(ql));
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---- tiny components ---- */
function av(i, g, cls) { return `<span class="avatar ${g} ${cls || ''}">${i}</span>`; }
function stars(r) {
  let out = '';
  for (let i = 1; i <= 5; i++) out += `<span class="star ${i <= Math.round(r) ? 'on' : ''}">★</span>`;
  return `<span class="stars">${out}</span>`;
}
function chip(label, active, onclick) {
  return `<button class="chip ${active ? 'on' : ''}" onclick="${onclick}">${label}</button>`;
}

/* ---- toast ---- */
let toastTimer = null;
function toast(msg) {
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast">${msg}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2600);
}

/* ---- modal ---- */
function openModal(html, wide) {
  $('#modal-root').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)App.closeModal()">
      <div class="modal ${wide ? 'wide' : ''}">
        <button class="modal-x" onclick="App.closeModal()">✕</button>
        ${html}
      </div>
    </div>`;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  document.body.style.overflow = '';
}

/* ---- chrome (nav + footer) ---- */
function renderChrome() {
  const page = currentPage();
  const links = [
    ['home', t('nav_home')], ['courses', t('nav_courses')], ['market', t('nav_market')],
    ['studio', t('nav_studio')],
  ];
  $('#nav').innerHTML = `
    <div class="nav-inner container">
      <a class="logo" href="#/home">
        <span class="logo-mark">▶</span>
        <span class="logo-text">${t('brand')}<small>${t('brandTag')}</small></span>
      </a>
      <nav class="nav-links">
        ${links.map(([k, label]) => `<a href="#/${k}" class="${page === k || (k === 'courses' && (page === 'course' || page === 'instructor')) || (k === 'market' && (page === 'brief' || page === 'gig' || page === 'client' || page === 'proposal')) ? 'on' : ''}">${label}</a>`).join('')}
      </nav>
      <div class="nav-right">
        <button class="theme-btn" onclick="App.toggleTheme()" title="${t('themeBtn')}">${state.theme === 'dark' ? '☀' : '◐'}</button>
        <button class="lang-btn" onclick="App.toggleLang()">🌐 ${t('langBtn')}</button>
        <a class="icon-nav ${page === 'messages' ? 'on' : ''}" href="#/messages" title="${t('nav_messages')}">💬${unreadConvos() ? `<i class="nbadge">${unreadConvos()}</i>` : ''}</a>
        <span class="notif-wrap">
          <button class="icon-nav ${state.notifsOpen ? 'on' : ''}" onclick="App.toggleNotifs()" title="${t('notifs_title')}">🔔${unreadNotifs() ? `<i class="nbadge">${unreadNotifs()}</i>` : ''}</button>
          ${state.notifsOpen ? notifPanelHTML() : ''}
        </span>
        <button class="token-pill" onclick="App.buyTokensModal()" title="${t('buyTokens')}"><b id="nav-tokens">${state.tokens.toLocaleString()}</b></button>
        <a class="nav-avatar ${page === 'profile' ? 'on' : ''}" href="#/profile" title="${t('nav_profile')}">${av(DATA.profile.i, DATA.profile.g)}</a>
      </div>
    </div>`;

  $('#footer').innerHTML = `
    <div class="container foot-grid">
      <div class="foot-brand">
        <a class="logo" href="#/home"><span class="logo-mark">▶</span><span class="logo-text">${t('brand')}<small>${t('brandTag')}</small></span></a>
        <p>${t('foot_about')}</p>
      </div>
      <div class="foot-col">
        <h5>${t('foot_product')}</h5>
        <a href="#/courses">${t('nav_courses')}</a>
        <a href="#/market">${t('nav_market')}</a>
        <a href="#/studio">${t('nav_studio')}</a>
      </div>
      <div class="foot-col">
        <h5>${t('foot_company')}</h5>
        <a onclick="App.demo()">${t('foot_help')}</a>
        <a onclick="App.demo()">${t('foot_contact')}</a>
        <a onclick="App.demo()">${t('foot_careers')}</a>
        <a onclick="App.demo()">${t('foot_terms')}</a>
      </div>
    </div>
    <div class="container foot-bottom">© 2026 AIV · ${t('foot_disclaimer')}</div>`;
}

/* ---- notifications ---- */
function unreadNotifs() { return DATA.notifs.filter(n => n.unread).length; }
function unreadConvos() { return DATA.convos.filter(c => c.unread > 0).length; }
function notifPanelHTML() {
  return `
  <div class="notif-panel">
    <div class="notif-head">
      <b>${t('notifs_title')}</b>
      <button class="btn ghost sm" onclick="App.markAllRead()">${t('markAllRead')}</button>
    </div>
    ${DATA.notifs.length ? DATA.notifs.map(n => `
      <button class="notif-item ${n.unread ? 'unread' : ''}" onclick="App.notifGo(${n.id})">
        <span class="notif-icon">${n.icon}</span>
        <span class="notif-body">
          <span class="notif-text">${L(n.text)}</span>
          <span class="notif-time">${L(n.time)}</span>
        </span>
        ${n.unread ? '<i class="dot-on"></i>' : ''}
      </button>`).join('') : `<div class="notif-empty">${t('notif_empty')}</div>`}
  </div>`;
}

/* ---- router ---- */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const seg = h.split('/');
  return [seg[0] || 'home', seg[1] !== undefined ? Number(seg[1]) : null, seg[2] !== undefined ? Number(seg[2]) : null];
}
function currentPage() { return parseHash()[0]; }

function route() {
  const [page, id, id2] = parseHash();
  const app = $('#app');
  let html = '';
  switch (page) {
    case 'home': html = pageHome(); break;
    case 'courses': html = pageCourses(); break;
    case 'course': html = pageCourse(id); break;
    case 'market': html = pageMarket(); break;
    case 'brief': html = pageBrief(id); break;
    case 'gig': html = pageGig(id); break;
    case 'client': html = pageClient(id); break;
    case 'instructor': html = pageInstructor(id); break;
    case 'proposal': html = pageProposal(id, id2 || 0); break;
    case 'tools': location.replace('#/studio'); return;
    case 'studio': html = pageStudio(); break;
    case 'profile': html = pageProfile(); break;
    case 'order': html = pageOrder(id); break;
    case 'messages': html = pageMessages(id); break;
    default: html = pageHome();
  }
  state.notifsOpen = false;
  app.innerHTML = `<div class="page-enter">${html}</div>`;
  renderChrome();
  const tl = $('#thread-list');
  if (tl) tl.scrollTop = tl.scrollHeight;
  window.scrollTo(0, 0);
}

/* ---- actions ---- */
const App = {
  go(h) { location.hash = h; },
  demo() { toast(t('t_saved')); },
  closeModal,

  toggleLang() {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('aiv-lang', state.lang);
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('docTitle');
    route();
  },

  toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('aiv-theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
    route();
  },

  /* ----- courses ----- */
  setCourseFilter(f) {
    state.courseFilter = f;
    $('#course-list').innerHTML = courseListHTML();
  },
  setCourseTab(tab, cid) {
    state.courseTab = tab;
    $('#course-tabs-wrap').innerHTML = courseTabsHTML(DATA.courses.find(c => c.id === cid));
    const list = $('#cr-list');
    if (list) list.scrollTop = list.scrollHeight;
  },
  enrollModal(cid) {
    const c = DATA.courses.find(x => x.id === cid);
    openModal(`
      <h3 class="modal-title">${t('enrollNow')}</h3>
      <div class="enroll-box">
        <div class="enroll-cover ${c.grad}"><span>${c.emoji}</span></div>
        <div>
          <div class="enroll-name">${L(c.title)}</div>
          <div class="enroll-meta">${c.curriculum.length} ${t('lessonsSuffix')} · ${c.hours} ${t('hoursSuffix')} · ${t('inc2')}</div>
        </div>
      </div>
      <div class="enroll-price"><span class="price-now">${money(c.price)}</span><span class="price-old">${money(c.oldPrice)}</span></div>
      <p class="modal-hint">${t('onePay')} · ${t('moneyBack')}</p>
      <button class="btn primary block" onclick="App.enroll(${cid})">${t('enrollNow')} · ${money(c.price)}</button>
    `);
  },
  enroll(cid) {
    state.enrolled[cid] = 0;
    closeModal();
    toast(t('t_enrolled'));
    route();
  },
  playLesson(cid, idx) {
    const c = DATA.courses.find(x => x.id === cid);
    const unlocked = (state.enrolled[cid] !== undefined) || idx === 0;
    if (!unlocked) { toast(t('t_lock')); return; }
    const lesson = c.curriculum[idx];
    const titleEl = $('#player-title');
    if (titleEl) {
      titleEl.textContent = `${t('lessonWord', { n: idx + 1 })} · ${L(lesson.t)}`;
      $('#player').classList.add('playing');
      $('#player-dur').textContent = lesson.d;
    }
    if (idx === 0 && state.enrolled[cid] === undefined) toast(t('t_playTrial'));
  },
  postCommunity(cid) {
    const input = $('#community-input');
    const val = input.value.trim();
    if (!val) return;
    const c = DATA.courses.find(x => x.id === cid);
    c.community.splice(c.community.filter(p => p.pinned).length, 0, {
      a: DATA.profile.name, i: DATA.profile.i, g: DATA.profile.g,
      time: { zh: '刚刚', en: 'just now' }, replies: 0, likes: 0,
      c: { zh: val, en: val },
    });
    toast(t('t_posted'));
    $('#course-tabs-wrap').innerHTML = courseTabsHTML(c);
  },

  /* ----- home search ----- */
  heroSearch(q) {
    q = (q || '').trim().toLowerCase();
    state.marketQ = q;
    if (q) {
      const bHits = DATA.briefs.filter(b => matchQ(q, b.title, b.desc)).length;
      const gHits = DATA.gigs.filter(g => matchQ(q, g.title)).length;
      state.marketTab = (gHits >= bHits && gHits > 0) ? 'gigs' : 'briefs';
      state.marketCat = 'all';
    }
    if (currentPage() === 'market') route(); else App.go('#/market');
  },

  /* ----- course live chat ----- */
  sendCourseChat(cid) {
    const input = $('#cr-input');
    const val = input && input.value.trim();
    if (!val) return;
    const c = DATA.courses.find(x => x.id === cid);
    if (!c.chat || !c.chat.length) c.chat = genericChat();
    c.chat.push({ a: DATA.profile.name, i: DATA.profile.i, g: DATA.profile.g, me: true, time: { zh: '刚刚', en: 'just now' }, c: { zh: val, en: val } });
    $('#course-tabs-wrap').innerHTML = courseTabsHTML(c);
    const list = $('#cr-list');
    if (list) list.scrollTop = list.scrollHeight;
    setTimeout(() => {
      const replies = [
        { zh: '哈哈哈 +1', en: 'Haha +1' },
        { zh: '同问！蹲一个答案', en: 'Same question! Following.' },
        { zh: '我刚试过，把分辨率调到 1080p 就好了', en: 'Just tried it — switching to 1080p fixed it for me.' },
        { zh: '这个老师在第 8 课讲过，可以回看一下', en: 'The instructor covered this in Lesson 8 — worth a rewatch.' },
      ];
      c.chat.push({ a: { zh: '小柚', en: 'Yuzu' }, i: 'XY', g: 'g4', time: { zh: '刚刚', en: 'just now' }, c: replies[val.length % replies.length] });
      if (currentPage() === 'course' && state.courseTab === 'chat' && $('#course-tabs-wrap')) {
        $('#course-tabs-wrap').innerHTML = courseTabsHTML(c);
        const l2 = $('#cr-list');
        if (l2) l2.scrollTop = l2.scrollHeight;
      }
    }, 1400);
  },

  /* ----- proposals ----- */
  acceptProposal(bid, idx) {
    const b = DATA.briefs.find(x => x.id === bid);
    const p = b.proposals[idx];
    b.accepted = idx;
    b.status = 'prog';
    const id = ++state.genSeq;
    DATA.orders.unshift({
      id, role: 'client',
      title: b.title, party: { name: p.name, i: p.i, g: p.g },
      amount: p.price, status: 'pending', revTotal: 2, revUsed: 0,
      due: p.days ? { zh: `${p.days} 天内`, en: `in ${p.days} days` } : { zh: `${b.deadline} 天内`, en: `in ${b.deadline} days` },
      briefId: b.id,
      deliverables: [],
      timeline: [{ time: { zh: '刚刚', en: 'just now' }, ev: { zh: `已选用提案，${money(p.price)} 已托管`, en: `Proposal accepted, ${money(p.price)} placed in escrow` } }],
    });
    toast(t('t_accepted'));
    App.go('#/order/' + id);
  },

  /* ----- marketplace ----- */
  setMarketTab(tab) {
    state.marketTab = tab; state.marketCat = 'all';
    $('#market-list').innerHTML = marketListHTML();
  },
  setMarketCat(cat) {
    state.marketCat = cat;
    $('#market-list').innerHTML = marketListHTML();
  },
  marketSearch(q) {
    state.marketQ = q.toLowerCase();
    $('#market-grid').innerHTML = marketGridHTML();
  },
  participateModal(bid) {
    const b = DATA.briefs.find(x => x.id === bid);
    openModal(`
      <h3 class="modal-title">${t('participate')}</h3>
      <p class="modal-sub">${L(b.title)}</p>
      <label class="f-label">${t('quoteLabel')}</label>
      <input id="pp-price" class="f-input" type="number" placeholder="${b.budget[0]} – ${b.budget[1]}">
      <label class="f-label">${t('proposalPh').split('，')[0].split(',')[0]}</label>
      <textarea id="pp-note" class="f-input" rows="4" placeholder="${t('proposalPh')}"></textarea>
      <button class="btn primary block" onclick="App.submitProposal(${bid})">${t('submitProposal')}</button>
    `);
  },
  submitProposal(bid) {
    const price = Number($('#pp-price').value);
    const note = $('#pp-note').value.trim();
    if (!price || !note) { toast(t('t_fillAll')); return; }
    const b = DATA.briefs.find(x => x.id === bid);
    b.proposals.unshift({
      name: DATA.profile.name, i: DATA.profile.i, g: DATA.profile.g, price,
      time: { zh: '刚刚', en: 'just now' }, note: { zh: note, en: note },
    });
    b.joined++;
    closeModal();
    toast(t('t_proposal'));
    route();
  },
  postRequestModal() {
    const cats = ['ecom', 'promo', 'avatar', 'anim', 'food', 'real'];
    openModal(`
      <h3 class="modal-title">${t('pr_title')}</h3>
      <p class="modal-sub">${t('pr_sub')}</p>
      <label class="f-label">${t('pr_name')}</label>
      <input id="pr-name" class="f-input" placeholder="${t('pr_name_ph')}">
      <div class="f-row">
        <div><label class="f-label">${t('pr_budget_min')}</label><input id="pr-min" class="f-input" type="number" placeholder="1000"></div>
        <div><label class="f-label">${t('pr_budget_max')}</label><input id="pr-max" class="f-input" type="number" placeholder="2000"></div>
        <div><label class="f-label">${t('pr_deadline')}</label><input id="pr-days" class="f-input" type="number" placeholder="7"></div>
      </div>
      <label class="f-label">${t('pr_cat')}</label>
      <select id="pr-cat" class="f-input">${cats.map(c => `<option value="${c}">${t('cat_' + c)}</option>`).join('')}</select>
      <label class="f-label">${t('pr_desc')}</label>
      <textarea id="pr-desc" class="f-input" rows="4" placeholder="${t('pr_desc_ph')}"></textarea>
      <button class="btn primary block" onclick="App.submitRequest()">${t('pr_submit')}</button>
    `);
  },
  submitRequest() {
    const name = $('#pr-name').value.trim(), desc = $('#pr-desc').value.trim();
    const min = Number($('#pr-min').value), max = Number($('#pr-max').value), days = Number($('#pr-days').value) || 7;
    if (!name || !min || !max) { toast(t('t_fillAll')); return; }
    DATA.briefs.unshift({
      id: Date.now(), emoji: '📣', grad: 'g1', cat: $('#pr-cat').value, status: 'open', mine: true,
      title: { zh: name, en: name },
      client: { name: DATA.profile.name, i: DATA.profile.i, g: DATA.profile.g, verified: true, info: { zh: '你发布的需求', en: 'Posted by you' } },
      budget: [min, max], deadline: days, joined: 0,
      desc: { zh: desc || name, en: desc || name }, reqs: [], proposals: [],
    });
    closeModal();
    state.marketTab = 'briefs';
    toast(t('t_postedReq'));
    if (currentPage() === 'market') route(); else App.go('#/market');
  },
  postServiceModal() {
    openModal(`
      <h3 class="modal-title">${t('ps_title')}</h3>
      <p class="modal-sub">${t('ps_sub')}</p>
      <label class="f-label">${t('ps_name')}</label>
      <input id="ps-name" class="f-input" placeholder="${t('ps_name_ph')}">
      <div class="f-row two">
        <div><label class="f-label">${t('ps_price')}</label><input id="ps-price" class="f-input" type="number" placeholder="200"></div>
        <div><label class="f-label">${t('ps_delivery')}</label><input id="ps-days" class="f-input" type="number" placeholder="3"></div>
      </div>
      <label class="f-label">${t('ps_desc')}</label>
      <textarea id="ps-desc" class="f-input" rows="4" placeholder="${t('ps_desc_ph')}"></textarea>
      <button class="btn primary block" onclick="App.submitService()">${t('ps_submit')}</button>
    `);
  },
  submitService() {
    const name = $('#ps-name').value.trim(), desc = $('#ps-desc').value.trim();
    const price = Number($('#ps-price').value), days = Number($('#ps-days').value) || 3;
    if (!name || !price) { toast(t('t_fillAll')); return; }
    DATA.gigs.unshift({
      id: Date.now(), emoji: '🎥', grad: 'g6', cat: 'promo', from: price,
      title: { zh: name, en: name },
      seller: { name: DATA.profile.name, i: DATA.profile.i, g: DATA.profile.g, level: { zh: '创作者 · Lv.3', en: 'Creator · Lv.3' }, rating: 4.9, reviews: 38, online: true, queue: 2, resp: { zh: '1 小时内', en: 'within 1h' },
        bio: L(DATA.profile.bio), certs: [] },
      gallery: ['g6', 'g1', 'g3'],
      packages: [{ key: 'basic', price, delivery: days, revisions: 1, features: [{ zh: desc || name, en: desc || name }] }],
      reviews: [], faq: [],
    });
    closeModal();
    state.marketTab = 'gigs';
    toast(t('t_postedGig'));
    if (currentPage() === 'market') route(); else App.go('#/market');
  },
  orderGig(gid, pkgKey) {
    const g = DATA.gigs.find(x => x.id === gid);
    const p = g.packages.find(x => x.key === pkgKey) || g.packages[0];
    openModal(`
      <h3 class="modal-title">${t('orderNow')}</h3>
      <div class="enroll-box">
        <div class="enroll-cover ${g.grad}"><span>${g.emoji}</span></div>
        <div>
          <div class="enroll-name">${L(g.title)}</div>
          <div class="enroll-meta">${t('pkg_' + p.key)} · ${t('delivery')} ${p.delivery} ${t('daysSuffix')} · ${t('revisions')} ${p.revisions >= 99 ? t('unlimited') : p.revisions + ' ' + t('timesSuffix')}</div>
        </div>
      </div>
      <div class="enroll-price"><span class="price-now">${money(p.price)}</span></div>
      <p class="modal-hint">🛡 ${t('escrow')} · ${t('hw3')}</p>
      <button class="btn primary block" onclick="App.confirmOrder(${gid},'${pkgKey}')">${t('orderNow')} · ${money(p.price)}</button>
    `);
  },
  confirmOrder(gid, pkgKey) {
    const g = DATA.gigs.find(x => x.id === gid);
    const p = g.packages.find(x => x.key === pkgKey) || g.packages[0];
    const id = ++state.genSeq;
    DATA.orders.unshift({
      id, role: 'client',
      title: g.title, party: { name: g.seller.name, i: g.seller.i, g: g.seller.g },
      amount: p.price, status: 'pending', revTotal: p.revisions, revUsed: 0,
      due: { zh: `${p.delivery} 天内`, en: `in ${p.delivery} days` }, gigId: g.id,
      deliverables: [],
      timeline: [{ time: { zh: '刚刚', en: 'just now' }, ev: { zh: `订单创建，${money(p.price)} 已托管`, en: `Order created, ${money(p.price)} placed in escrow` } }],
    });
    closeModal();
    toast(t('t_orderCreated'));
    App.go('#/order/' + id);
  },
  follow() { toast(t('t_followed')); },

  /* ----- messages ----- */
  openChat(name) {
    let c = DATA.convos.find(x => x.name.zh === name || x.name.en === name);
    if (!c) {
      c = {
        id: ++state.genSeq,
        name: { zh: name, en: name },
        i: /[A-Za-z]/.test(name) ? name.slice(0, 2).toUpperCase() : name.slice(0, 1),
        g: 'g6', unread: 0, ctx: null, msgs: [],
      };
      DATA.convos.unshift(c);
    }
    App.go('#/messages/' + c.id);
  },
  sendMsg(cid) {
    const input = $('#msg-input');
    const val = input && input.value.trim();
    if (!val) return;
    const c = DATA.convos.find(x => x.id === cid);
    c.msgs.push({ me: true, time: { zh: '刚刚', en: 'just now' }, text: { zh: val, en: val } });
    route();
    setTimeout(() => {
      c.msgs.push({ me: false, time: { zh: '刚刚', en: 'just now' }, text: { zh: t('cannedReply'), en: t('cannedReply') } });
      if (currentPage() === 'messages') route();
    }, 1200);
  },

  /* ----- notifications ----- */
  toggleNotifs() {
    state.notifsOpen = !state.notifsOpen;
    renderChrome();
  },
  notifGo(id) {
    const n = DATA.notifs.find(x => x.id === id);
    n.unread = false;
    state.notifsOpen = false;
    if (location.hash === n.href) { renderChrome(); } else { location.hash = n.href; }
  },
  markAllRead() {
    DATA.notifs.forEach(n => { n.unread = false; });
    renderChrome();
    toast(t('t_allRead'));
  },

  /* ----- order workspace ----- */
  deliverVersion(oid) {
    const o = DATA.orders.find(x => x.id === oid);
    const grads = ['g1', 'g3', 'g5', 'g6', 'g7'];
    const v = o.deliverables.length + 1;
    o.deliverables.push({
      v, grad: grads[v % grads.length], emoji: '🎬', time: { zh: '刚刚', en: 'just now' },
      note: { zh: `v${v} 版本交付`, en: `Version v${v} delivered` },
    });
    o.status = 'review';
    o.timeline.push({ time: { zh: '刚刚', en: 'just now' }, ev: { zh: `交付 v${v}，等待商家验收`, en: `v${v} delivered, awaiting client acceptance` } });
    toast(t('t_delivered'));
    route();
  },
  acceptOrder(oid) {
    const o = DATA.orders.find(x => x.id === oid);
    o.status = 'done';
    o.timeline.push({ time: { zh: '刚刚', en: 'just now' }, ev: { zh: '商家验收通过，托管款项已打给创作者', en: 'Client accepted — escrowed funds released to the creator' } });
    toast(t('t_orderAccepted'));
    route();
  },
  requestRevision(oid) {
    const o = DATA.orders.find(x => x.id === oid);
    if (o.revUsed >= o.revTotal) { toast(t('t_noRev')); return; }
    o.revUsed++;
    o.status = 'revising';
    o.timeline.push({ time: { zh: '刚刚', en: 'just now' }, ev: { zh: `商家申请修改（${o.revUsed}/${o.revTotal}）`, en: `Client requested a revision (${o.revUsed}/${o.revTotal})` } });
    toast(t('t_revReq'));
    route();
  },
  openDispute() { toast(t('t_dispute')); },

  /* ----- tools ----- */
  copyCode(code, btnId) {
    navigator.clipboard && navigator.clipboard.writeText(code).catch(() => {});
    toast(t('t_copied'));
    const btn = document.getElementById(btnId);
    if (btn) { btn.textContent = t('copiedBtn'); setTimeout(() => { if (document.getElementById(btnId)) btn.textContent = t('copyBtn'); }, 1800); }
  },

  /* ----- studio ----- */
  setStudio(key, val) {
    state.studio[key] = val;
    $('#studio-panel').innerHTML = studioPanelHTML();
  },
  studioPrompt(v) { state.studio.prompt = v; },
  genCost() {
    const s = state.studio;
    const base = s.model === 'pro' ? 20 : 8;
    const resMul = s.res === '1080' ? 1.5 : 1;
    return Math.round(base * s.dur * resMul);
  },
  generate() {
    const s = state.studio;
    if (!s.prompt.trim()) { toast(t('t_promptFirst')); return; }
    const cost = App.genCost();
    if (state.tokens < cost) { toast(t('t_noTokens')); App.buyTokensModal(); return; }
    state.tokens -= cost;
    const grads = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'];
    const id = ++state.genSeq;
    DATA.generations.unshift({
      id, status: 'gen', grad: grads[id % grads.length], aspect: s.aspect,
      model: s.model === 'pro' ? 'AIV Pro' : 'AIV Turbo', dur: s.dur,
      prompt: { zh: s.prompt, en: s.prompt },
    });
    toast(t('t_genStart'));
    if (currentPage() === 'studio') route();
    setTimeout(() => {
      const g = DATA.generations.find(x => x.id === id);
      if (g) g.status = 'done';
      toast(t('t_genDone'));
      if (currentPage() === 'studio') route();
    }, 9000);
  },
  reusePrompt(id) {
    const g = DATA.generations.find(x => x.id === id);
    if (!g) return;
    state.studio.prompt = L(g.prompt);
    const ta = $('#studio-prompt');
    if (ta) { ta.value = state.studio.prompt; ta.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  },
  downloadDemo() { toast(t('t_download')); },

  /* ----- wallet ----- */
  buyTokensModal() {
    const packs = [
      { n: 500, p: 50, b: '' }, { n: 1200, p: 100, b: '+20%' },
      { n: 2600, p: 200, b: '+30%' }, { n: 5500, p: 400, b: '+37%' },
    ];
    openModal(`
      <h3 class="modal-title">⬡ ${t('buyTokens')}</h3>
      <p class="modal-sub">${t('walletSub')}</p>
      <div class="packs">
        ${packs.map(p => `
          <button class="pack" onclick="App.buyTokens(${p.n})">
            <div class="pack-n">⬡ ${p.n.toLocaleString()}</div>
            ${p.b ? `<div class="pack-bonus">${p.b} ${t('bonus')}</div>` : '<div class="pack-bonus dim">—</div>'}
            <div class="pack-p">${money(p.p)}</div>
          </button>`).join('')}
      </div>
      <p class="modal-hint">${t('payDemo')}</p>
    `);
  },
  buyTokens(n) {
    state.tokens += n;
    DATA.profile.txns.unshift({ t: { zh: '充值代币', en: 'Token top-up' }, amt: '+' + n.toLocaleString(), date: '06-10', kind: 'in' });
    closeModal();
    toast(t('t_tokens', { n: n.toLocaleString() }));
    const el = $('#nav-tokens');
    if (el) el.textContent = state.tokens.toLocaleString();
    if (currentPage() === 'studio' || currentPage() === 'profile') route();
  },

  /* ----- profile ----- */
  setProfileTab(tab) {
    state.profileTab = tab;
    $('#profile-panel').innerHTML = profilePanelHTML();
    document.querySelectorAll('.ptab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  },
  setOrdersSub(sub) {
    state.ordersSub = sub;
    $('#profile-panel').innerHTML = profilePanelHTML();
  },
  setLangSelect(v) {
    if (v !== state.lang) App.toggleLang();
  },
};

window.addEventListener('hashchange', route);

const RESOURCE = 'rsg-multicharacter';

const Lang = {
    kicker: 'Batı Seni Bekliyor',
    title: 'Karakter Seçimi',
    characters: 'Karakterler',
    slots: 'Yuvalar',
    empty_slot: 'Boş Yuva',
    empty_sub: 'Yeni karakter oluştur',
    unemployed: 'İşsiz',
    play: 'Oyna',
    create: 'Karakter Oluştur',
    delete: 'Sil',
    cancel: 'Vazgeç',
    confirm: 'Devam Et',
    hold_delete: 'Basılı Tut',
    hint_select: 'Seç',
    hint_confirm: 'Onayla',
    hint_delete: 'Sil',
    dossier_kicker: 'Karakter Dosyası',
    birthdate: 'Doğum Tarihi',
    nationality: 'Uyruk',
    gender: 'Cinsiyet',
    job: 'Meslek',
    male: 'Erkek',
    female: 'Kadın',
    cash: 'Nakit',
    bank: 'Banka',
    empty_title: 'Boş Yuva',
    empty_text: 'Bu yuva henüz kullanılmıyor. Batıda yeni bir hikâye yazmak için bir karakter oluştur.',
    create_title: 'Yeni Karakter',
    create_text: 'Karakter oluşturucuya geçmek üzeresin. Hazır olduğunda devam et.',
    delete_title: 'Karakteri Sil',
    delete_text: '<strong>{name}</strong> kalıcı olarak silinecek. Bu işlem geri alınamaz.',
    loading: ['Kayıtlar okunuyor', 'Karakterler hazırlanıyor', 'Atlar eyerleniyor'],
};

const MIN_LOADING_MS = 1800;
const HOLD_DELETE_MS = 1200;

const $ = (sel) => document.querySelector(sel);
const app = $('#app');
const slotList = $('#slot-list');
const dossierBody = $('#dossier-body');

const state = {
    slots: 0,
    characters: {},   // cid -> karakter verisi
    selected: null,   // seçili yuva numarası
    modal: null,
    busy: false,
    loadingTimer: null,
};

/* ---------- Yardımcılar ---------- */

function post(name, data = {}) {
    return fetch(`https://${RESOURCE}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data),
    }).catch(() => {});
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"'`=/]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function formatMoney(value) {
    const n = Number(value) || 0;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toRoman(n) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
}

function fullName(char) {
    const info = char.charinfo || {};
    return `${info.firstname || ''} ${info.lastname || ''}`.trim();
}

function jobLabel(char) {
    const job = char.job || {};
    if (!job.label || job.name === 'unemployed') return Lang.unemployed;
    const grade = job.grade && job.grade.name;
    return grade ? `${job.label} · ${grade}` : job.label;
}

function applyLang() {
    document.querySelectorAll('[data-lang]').forEach((el) => {
        el.textContent = Lang[el.dataset.lang] || '';
    });
}

/* ---------- Yükleme ---------- */

function startLoading() {
    const text = $('#loading-text');
    let i = 0;
    text.textContent = Lang.loading[0];
    clearInterval(state.loadingTimer);
    state.loadingTimer = setInterval(() => {
        i = (i + 1) % Lang.loading.length;
        text.textContent = Lang.loading[i];
    }, 900);
}

function stopLoading() {
    clearInterval(state.loadingTimer);
    app.classList.add('is-ready');
}

/* ---------- Görünüm ---------- */

function renderSlots() {
    const used = Object.keys(state.characters).length;
    $('#slot-count').textContent = `${used} / ${state.slots}`;

    let html = '';
    for (let cid = 1; cid <= state.slots; cid++) {
        const char = state.characters[cid];
        const selected = state.selected === cid ? ' is-selected' : '';
        if (char) {
            html += `
                <li class="slot${selected}" data-cid="${cid}">
                    <span class="slot-index">${toRoman(cid)}</span>
                    <span class="slot-text">
                        <span class="slot-name">${escapeHtml(fullName(char))}</span>
                        <span class="slot-sub">${escapeHtml(jobLabel(char))} · ${escapeHtml(char.citizenid)}</span>
                    </span>
                </li>`;
        } else {
            html += `
                <li class="slot is-empty${selected}" data-cid="${cid}">
                    <span class="slot-index"><svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></span>
                    <span class="slot-text">
                        <span class="slot-name">${Lang.empty_slot}</span>
                        <span class="slot-sub">${Lang.empty_sub}</span>
                    </span>
                </li>`;
        }
    }
    slotList.innerHTML = html;
}

function renderDossier() {
    const char = state.characters[state.selected];

    if (!char) {
        dossierBody.innerHTML = `
            <div class="dossier-empty">
                <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M12 8v8M8 12h8"/></svg>
                <h3>${Lang.empty_title}</h3>
                <p>${Lang.empty_text}</p>
            </div>`;
    } else {
        const info = char.charinfo || {};
        const money = char.money || {};
        dossierBody.innerHTML = `
            <span class="dossier-kicker">${Lang.dossier_kicker}</span>
            <h2 class="dossier-name">${escapeHtml(fullName(char))}</h2>
            <span class="dossier-id">${escapeHtml(char.citizenid)}</span>
            <img class="dossier-divider" src="assets/divider_line.png" alt="">
            <dl class="facts">
                <div class="fact"><dt>${Lang.birthdate}</dt><dd>${escapeHtml(info.birthdate || '-')}</dd></div>
                <div class="fact"><dt>${Lang.gender}</dt><dd>${info.gender == 1 ? Lang.female : Lang.male}</dd></div>
                <div class="fact"><dt>${Lang.nationality}</dt><dd>${escapeHtml(info.nationality || '-')}</dd></div>
                <div class="fact"><dt>${Lang.job}</dt><dd>${escapeHtml(jobLabel(char))}</dd></div>
            </dl>
            <dl class="purse">
                <div class="purse-item"><dt>${Lang.cash}</dt><dd>${formatMoney(money.cash)}</dd></div>
                <div class="purse-item"><dt>${Lang.bank}</dt><dd>${formatMoney(money.bank)}</dd></div>
            </dl>`;
    }

    dossierBody.classList.remove('dossier-body-enter');
    void dossierBody.offsetWidth;
    dossierBody.classList.add('dossier-body-enter');
}

function renderActions() {
    const char = state.characters[state.selected];
    $('#btn-play-text').textContent = char ? Lang.play : Lang.create;
    $('#btn-delete').classList.toggle('is-hidden', !char);
    $('#hint-delete').classList.toggle('is-hidden', !char);
    app.classList.toggle('has-selection', state.selected !== null);
}

function selectSlot(cid) {
    if (state.busy || state.modal || cid === state.selected) return;
    if (cid < 1 || cid > state.slots) return;

    state.selected = cid;
    slotList.querySelectorAll('.slot').forEach((el) => {
        el.classList.toggle('is-selected', Number(el.dataset.cid) === cid);
    });
    renderDossier();
    renderActions();

    // Boş yuvada cData gönderilmez, istemci varsayılan modeli gösterir
    post('cDataPed', { cData: state.characters[cid] });
}

/* ---------- Modallar ---------- */

function openModal(id) {
    state.modal = id;
    $('#modal-backdrop').classList.add('is-open');
    $(`#${id}`).classList.add('is-open');
}

function closeModal() {
    if (!state.modal) return;
    $(`#${state.modal}`).classList.remove('is-open');
    $('#modal-backdrop').classList.remove('is-open');
    state.modal = null;
    cancelHold();
}

/* ---------- Aksiyonlar ---------- */

function primaryAction() {
    if (state.busy || state.selected === null) return;
    const char = state.characters[state.selected];

    if (char) {
        state.busy = true;
        $('#btn-play').disabled = true;
        post('selectCharacter', { cData: char });
        app.classList.add('is-hidden');
    } else {
        openModal('modal-create');
    }
}

function confirmCreate() {
    if (state.busy) return;
    state.busy = true;
    post('createNewCharacter', { cid: String(state.selected) });
    closeModal();
    app.classList.add('is-hidden');
}

function requestDelete() {
    const char = state.characters[state.selected];
    if (state.busy || !char) return;
    $('#delete-text').innerHTML = Lang.delete_text.replace('{name}', escapeHtml(fullName(char)));
    openModal('modal-delete');
}

function confirmDelete() {
    const char = state.characters[state.selected];
    if (!char) return;
    state.busy = true;
    closeModal();
    post('removeCharacter', { citizenid: char.citizenid });
    // İstemci menüyü yeniden açar, o zamana kadar yükleme ekranı gösterilir
    app.classList.remove('is-ready', 'has-selection');
    startLoading();
}

// Silme için basılı tutma
const hold = { start: 0, frame: null };
const holdFill = $('#confirm-delete .hold-fill');

function startHold() {
    hold.start = performance.now();
    const tick = (now) => {
        const p = Math.min((now - hold.start) / HOLD_DELETE_MS, 1);
        holdFill.style.width = `${p * 100}%`;
        if (p >= 1) { hold.frame = null; confirmDelete(); return; }
        hold.frame = requestAnimationFrame(tick);
    };
    hold.frame = requestAnimationFrame(tick);
}

function cancelHold() {
    if (hold.frame) cancelAnimationFrame(hold.frame);
    hold.frame = null;
    holdFill.style.width = '0%';
}

/* ---------- Açılış / kapanış ---------- */

function openUI(nChar) {
    state.slots = Number(nChar) || 0;
    state.characters = {};
    state.selected = null;
    state.busy = false;
    closeModal();

    $('#btn-play').disabled = false;
    app.classList.remove('is-ready', 'has-selection');
    app.classList.remove('is-hidden');
    renderSlots();
    renderActions();
    startLoading();

    state.openedAt = Date.now();
    state.awaitingCharacters = true;
    post('setupCharacters');
}

function closeUI() {
    app.classList.add('is-hidden');
    closeModal();
    clearInterval(state.loadingTimer);
}

function onCharacters(characters) {
    state.characters = {};
    (characters || []).forEach((char) => {
        if (char.cid >= 1 && char.cid <= state.slots) state.characters[char.cid] = char;
    });
    renderSlots();

    if (!state.awaitingCharacters) return;
    state.awaitingCharacters = false;

    const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - state.openedAt));
    setTimeout(() => {
        stopLoading();
        post('removeBlur');
        // İlk dolu yuvayı (yoksa ilk yuvayı) otomatik seç
        const first = Object.keys(state.characters).map(Number).sort((a, b) => a - b)[0];
        selectSlot(first || 1);
    }, wait);
}

/* ---------- Olaylar ---------- */

window.addEventListener('message', (event) => {
    const data = event.data || {};
    switch (data.action) {
        case 'ui':
            data.toggle ? openUI(data.nChar) : closeUI();
            break;
        case 'setupCharacters':
            onCharacters(data.characters);
            break;
    }
});

slotList.addEventListener('click', (e) => {
    const slot = e.target.closest('.slot');
    if (slot) selectSlot(Number(slot.dataset.cid));
});
slotList.addEventListener('dblclick', (e) => {
    if (e.target.closest('.slot')) primaryAction();
});

$('#btn-play').addEventListener('click', primaryAction);
$('#btn-delete').addEventListener('click', requestDelete);
$('#confirm-create').addEventListener('click', confirmCreate);
$('#modal-backdrop').addEventListener('click', closeModal);
document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));

const delBtn = $('#confirm-delete');
delBtn.addEventListener('mousedown', startHold);
delBtn.addEventListener('mouseup', cancelHold);
delBtn.addEventListener('mouseleave', cancelHold);

document.addEventListener('keydown', (e) => {
    if (app.classList.contains('is-hidden') || !app.classList.contains('is-ready')) return;

    if (state.modal) {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Enter' && state.modal === 'modal-create') confirmCreate();
        return;
    }

    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            selectSlot(state.selected > 1 ? state.selected - 1 : state.slots);
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            selectSlot(state.selected < state.slots ? state.selected + 1 : 1);
            break;
        case 'Enter':
            primaryAction();
            break;
        case 'Delete':
            requestDelete();
            break;
    }
});

applyLang();

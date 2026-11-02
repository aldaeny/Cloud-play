// app.js — Aether webOS TV App Logic
const api = aetherApi;

// ── DOM Helpers ─────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $(id).classList.remove('hidden');
}

// ── Auth ─────────────────────────────────────────────────────
let isRegister = false;

$('auth-btn').addEventListener('click', async () => {
    const email = $('email').value;
    const password = $('password').value;
    const errorEl = $('auth-error');
    errorEl.textContent = '';

    try {
        if (isRegister) {
            await api.register({ email, password, name: $('name')?.value || '', phone: $('phone')?.value || '' });
        }
        const tokens = await api.login({ email, password });
        showScreen('home-screen');
        loadHome();
    } catch (e) {
        errorEl.textContent = e.message || 'خطأ';
    }
});

$('auth-toggle').addEventListener('click', () => {
    isRegister = !isRegister;
    $('auth-btn').textContent = isRegister ? 'تسجيل' : 'دخول';
    $('auth-toggle').textContent = isRegister ? 'لديك حساب؟ سجل دخول' : 'لا تملك حساب؟ سجل الآن';
});

// ── Home ────────────────────────────────────────────────────
async function loadHome() {
    const rowsContainer = $('home-rows');
    rowsContainer.innerHTML = '';
    try {
        const home = await api.getHome();
        const rows = home.data?.rows || [];
        for (const row of rows) {
            const rowEl = document.createElement('div');
            rowEl.className = 'home-row';
            rowEl.innerHTML = `<div class="home-row-title">${row.title}</div>`;
            const grid = document.createElement('div');
            grid.className = 'title-grid';
            for (const title of row.items) {
                const card = createTitleCard(title);
                grid.appendChild(card);
            }
            rowEl.appendChild(grid);
            rowsContainer.appendChild(rowEl);
        }
    } catch (e) {
        rowsContainer.innerHTML = '<p class="error">خطأ في التحميل</p>';
    }
}

function createTitleCard(title) {
    const card = document.createElement('div');
    card.className = 'title-card';
    card.tabIndex = 0;
    card.innerHTML = `
        <div class="title-card-title">${title.title_en || title.title_ar || 'TITLE'}</div>
        <div class="title-card-kind">${title.kind === 'series' ? 'مسلسل' : 'فيلم'}</div>
    `;
    card.addEventListener('click', () => playTitle(title.id));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') playTitle(title.id);
    });
    return card;
}

// ── Player ─────────────────────────────────────────────────
async function playTitle(titleId) {
    showScreen('player-screen');
    try {
        const session = await api.createPlaybackSession({ title_id: titleId });
        const manifestUrl = session.data?.manifest_url;
        const video = $('video-player');

        if (manifestUrl) {
            // Use Video.js for HLS support if available
            if (window.videojs) {
                videojs(video, { sources: [{ src: manifestUrl, type: 'application/x-mpegURL' }] });
            } else {
                video.src = manifestUrl;
            }
            video.play();
        }

        // Heartbeat every 30 seconds
        setInterval(() => {
            api.heartbeat(session.data?.session_id).catch(() => {});
        }, 30000);
    } catch (e) {
        console.error('Playback error:', e);
    }
}

$('back-btn').addEventListener('click', () => showScreen('home-screen'));

// ── Search ────────────────────────────────────────────────
$('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value;
        loadHome(); // Simplified — could replace rows with search results
    }
});

// ── D-Pad Navigation ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
    }
});

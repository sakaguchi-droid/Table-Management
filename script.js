const SUPABASE_URL = "https://qaicpvxlqzhitomsntzp.supabase.co"; // ← Project URL
const SUPABASE_ANON_KEY = "sb_publishable_yEomN84STpRh7S6ijtlvWQ_pT7bMKp9";  // ← Publishable key

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// アプリの状態
let seats = {};
let currentTime = Date.now();
let activeTab = 'T';

// LocalStorageをストレージとして使用
const storage = {
    get: async (key) => {
        const value = localStorage.getItem(key);
        return value ? { key, value } : null;
    },
    set: async (key, value) => {
        localStorage.setItem(key, value);
        return { key, value };
    }
};

// 初期席データを作成
function createInitialSeats() {
    const initialSeats = {};
    
    for (let i = 1; i <= 28; i++) {
        initialSeats[`T${i}`] = { occupied: false, startTime: null, pausedTime: null };
    }
    for (let i = 1; i <= 19; i++) {
        initialSeats[`C${i}`] = { occupied: false, startTime: null, pausedTime: null };
    }
    for (let i = 1; i <= 20; i++) {
        initialSeats[`B${i}`] = { occupied: false, startTime: null, pausedTime: null };
    }
    
    return initialSeats;
}

// データ読み込み
async function loadSeats() {
    try {
        const result = await storage.get('cafe-seats-data');
        
        if (result && result.value) {
            seats = JSON.parse(result.value);
        } else {
            seats = createInitialSeats();
            await storage.set('cafe-seats-data', JSON.stringify(seats));
        }
        
        renderSeats();
        updateStats();
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        seats = createInitialSeats();
        renderSeats();
        updateStats();
    }
}

// データ保存
async function saveSeats() {
    try {
        await storage.set('cafe-seats-data', JSON.stringify(seats));
    } catch (error) {
        console.error('データ保存エラー:', error);
    }
}

// 席の状態切り替え
function toggleSeat(seatNumber) {
    const seat = seats[seatNumber];
    
    if (!seat.occupied) {
        // 空席 → 使用中
        seat.occupied = true;
        seat.startTime = Date.now();
        seat.pausedTime = null;
    } else if (seat.pausedTime) {
        // 一時停止中 → 再開
        const pausedDuration = Date.now() - seat.pausedTime;
        seat.startTime = seat.startTime + pausedDuration;
        seat.pausedTime = null;
    } else {
        // 使用中 → 一時停止
        seat.pausedTime = Date.now();
    }
    
    saveSeats();
    renderSeats();
    updateStats();
}

// 席をリセット
function resetSeat(seatNumber, event) {
    event.stopPropagation();
    
    seats[seatNumber] = {
        occupied: false,
        startTime: null,
        pausedTime: null
    };
    
    saveSeats();
    renderSeats();
    updateStats();
}

// 経過時間を計算
function getElapsedTime(seat) {
    if (!seat.occupied || !seat.startTime) return '0:00';
    
    let elapsed;
    if (seat.pausedTime) {
        elapsed = Math.floor((seat.pausedTime - seat.startTime) / 1000);
    } else {
        elapsed = Math.floor((currentTime - seat.startTime) / 1000);
    }
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// 90分超過チェック
function isOver90Minutes(seat) {
    if (!seat.occupied || !seat.startTime) return false;
    
    let elapsed;
    if (seat.pausedTime) {
        elapsed = Math.floor((seat.pausedTime - seat.startTime) / 1000);
    } else {
        elapsed = Math.floor((currentTime - seat.startTime) / 1000);
    }
    
    const totalMinutes = Math.floor(elapsed / 60);
    return totalMinutes >= 90;
}

// 席の色を取得
function getSeatClass(seat) {
    if (!seat.occupied) {
        return 'available';
    } else if (seat.pausedTime) {
        return 'paused';
    } else if (isOver90Minutes(seat)) {
        return 'overtime';
    } else {
        return 'occupied';
    }
}

// 席をレンダリング
function renderSeats() {
    const grid = document.getElementById('seats-grid');
    grid.innerHTML = '';
    
    const seatsForTab = Object.entries(seats)
        .filter(([key]) => key.startsWith(activeTab))
        .sort((a, b) => {
            const numA = parseInt(a[0].substring(1));
            const numB = parseInt(b[0].substring(1));
            return numA - numB;
        });
    
    seatsForTab.forEach(([seatNumber, seat]) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'seat-wrapper';
        
        const button = document.createElement('button');
        button.className = `seat ${getSeatClass(seat)}`;
        button.onclick = () => toggleSeat(seatNumber);
        
        let statusText = '空席';
        if (seat.occupied) {
            if (seat.pausedTime) {
                statusText = '⏸ 一時停止中';
            } else if (isOver90Minutes(seat)) {
                statusText = '⚠️ 90分超過';
            } else {
                statusText = '使用中';
            }
        }
        
        button.innerHTML = `
            <div class="seat-number">${seatNumber}</div>
            ${seat.occupied ? `
                <div class="seat-time">🕐 ${getElapsedTime(seat)}</div>
                <div class="seat-status">${statusText}</div>
            ` : `
                <div class="seat-check">✓</div>
                <div class="seat-status">${statusText}</div>
            `}
        `;
        
        wrapper.appendChild(button);
        
        if (seat.occupied) {
            const resetBtn = document.createElement('button');
            resetBtn.className = 'reset-btn';
            resetBtn.textContent = '空席に';
            resetBtn.onclick = (e) => resetSeat(seatNumber, e);
            wrapper.appendChild(resetBtn);
        }
        
        grid.appendChild(wrapper);
    });
}

// 統計を更新
function updateStats() {
    const totalSeats = Object.keys(seats).length;
    const occupiedSeats = Object.values(seats).filter(s => s.occupied).length;
    const availableSeats = totalSeats - occupiedSeats;
    
    document.getElementById('total-count').textContent = totalSeats;
    document.getElementById('occupied-count').textContent = occupiedSeats;
    document.getElementById('available-count').textContent = availableSeats;
    
    // タブごとの統計
    ['T', 'C', 'B'].forEach(prefix => {
        const tabSeats = Object.entries(seats).filter(([key]) => key.startsWith(prefix));
        const occupied = tabSeats.filter(([_, seat]) => seat.occupied).length;
        const total = tabSeats.length;
        
        document.getElementById(`tab-${prefix}-count`).textContent = occupied;
        document.getElementById(`tab-${prefix}-total`).textContent = total;
    });
}

// タブ切り替え
function switchTab(tab) {
    activeTab = tab;
    
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    renderSeats();
}

// 時計を更新
function updateClock() {
    currentTime = Date.now();
    renderSeats();
}

// イベントリスナー
document.getElementById('refresh-btn').addEventListener('click', loadSeats);

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
    });
});

// 初期化
loadSeats();
setInterval(updateClock, 1000);
setInterval(loadSeats, 2000); // 2秒ごとに同期
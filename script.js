// ===== Supabase 設定 =====
const SUPABASE_URL = "https://qaicpvxlqzhitomsntzp.supabase.co"; // Project URL
const SUPABASE_ANON_KEY = "sb_publishable_yEomN84STpRh7S6ijtlvWQ_pT7bMKp9";                  // Publishable key（anon相当）

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== アプリの状態 =====
let seats = {};
let currentTime = Date.now();
let activeTab = "T";

// ===== Supabase から座席データを読み込み =====
async function loadSeats() {
    try {
        const { data, error } = await supabase
            .from("seats")
            .select("*")
            .order("id");

        if (error) {
            console.error("Supabase からの読み込みエラー:", error);
            return;
        }

        seats = {};
        data.forEach((seat) => {
            seats[seat.id] = {
                occupied: seat.occupied,
                startTime: seat.start_time,
                pausedTime: seat.paused_time,
            };
        });

        renderSeats();
        updateStats();
    } catch (err) {
        console.error("予期せぬエラー:", err);
    }
}

// ===== Supabase に1席分を保存 =====
async function updateSeatOnSupabase(seatNumber) {
    const seat = seats[seatNumber];
    const { error } = await supabase
        .from("seats")
        .update({
            occupied: seat.occupied,
            start_time: seat.startTime,
            paused_time: seat.pausedTime,
            updated_at: new Date().toISOString(),
        })
        .eq("id", seatNumber);

    if (error) {
        console.error("Supabase への更新エラー:", error);
    }
}

// ===== 席の状態切り替え =====
async function toggleSeat(seatNumber) {
    const seat = seats[seatNumber];
    const now = Date.now();

    if (!seat.occupied) {
        // 空席 → 使用中
        seat.occupied = true;
        seat.startTime = now;
        seat.pausedTime = null;
    } else if (seat.pausedTime) {
        // 一時停止中 → 再開
        const pausedDuration = now - seat.pausedTime;
        seat.startTime = seat.startTime + pausedDuration;
        seat.pausedTime = null;
    } else {
        // 使用中 → 一時停止
        seat.pausedTime = now;
    }

    seats[seatNumber] = seat;
    renderSeats();
    updateStats();
    await updateSeatOnSupabase(seatNumber);
}

// ===== 席をリセット =====
async function resetSeat(seatNumber, event) {
    event.stopPropagation();

    seats[seatNumber] = {
        occupied: false,
        startTime: null,
        pausedTime: null,
    };

    renderSeats();
    updateStats();
    await updateSeatOnSupabase(seatNumber);
}

// ===== 経過時間を計算 =====
function getElapsedTime(seat) {
    if (!seat.occupied || !seat.startTime) return "0:00";

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
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(
            seconds
        ).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ===== 90分超過チェック =====
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

// ===== 席の色クラスを取得 =====
function getSeatClass(seat) {
    if (!seat.occupied) {
        return "available";
    } else if (seat.pausedTime) {
        return "paused";
    } else if (isOver90Minutes(seat)) {
        return "overtime";
    } else {
        return "occupied";
    }
}

// ===== 席の描画 =====
function renderSeats() {
    const grid = document.getElementById("seats-grid");
    grid.innerHTML = "";

    const seatsForTab = Object.entries(seats)
        .filter(([key]) => key.startsWith(activeTab))
        .sort((a, b) => {
            const numA = parseInt(a[0].substring(1));
            const numB = parseInt(b[0].substring(1));
            return numA - numB;
        });

    seatsForTab.forEach(([seatNumber, seat]) => {
        const wrapper = document.createElement("div");
        wrapper.className = "seat-wrapper";

        const button = document.createElement("button");
        button.className = `seat ${getSeatClass(seat)}`;
        button.onclick = () => toggleSeat(seatNumber);

        let statusText = "空席";
        if (seat.occupied) {
            if (seat.pausedTime) {
                statusText = "⏸ 一時停止中";
            } else if (isOver90Minutes(seat)) {
                statusText = "⚠️ 90分超過";
            } else {
                statusText = "使用中";
            }
        }

        button.innerHTML = `
            <div class="seat-number">${seatNumber}</div>
            ${
                seat.occupied
                    ? `
                <div class="seat-time">🕐 ${getElapsedTime(seat)}</div>
                <div class="seat-status">${statusText}</div>
            `
                    : `
                <div class="seat-check">✓</div>
                <div class="seat-status">${statusText}</div>
            `
            }
        `;

        wrapper.appendChild(button);

        if (seat.occupied) {
            const resetBtn = document.createElement("button");
            resetBtn.className = "reset-btn";
            resetBtn.textContent = "空席に";
            resetBtn.onclick = (e) => resetSeat(seatNumber, e);
            wrapper.appendChild(resetBtn);
        }

        grid.appendChild(wrapper);
    });
}

// ===== 統計を更新 =====
function updateStats() {
    const totalSeats = Object.keys(seats).length;
    const occupiedSeats = Object.values(seats).filter((s) => s.occupied).length;
    const availableSeats = totalSeats - occupiedSeats;

    document.getElementById("total-count").textContent = totalSeats;
    document.getElementById("occupied-count").textContent = occupiedSeats;
    document.getElementById("available-count").textContent = availableSeats;

    ["T", "C", "B"].forEach((prefix) => {
        const tabSeats = Object.entries(seats).filter(([key]) =>
            key.startsWith(prefix)
        );
        const occupied = tabSeats.filter(([_, seat]) => seat.occupied).length;
        const total = tabSeats.length;

        document.getElementById(`tab-${prefix}-count`).textContent = occupied;
        document.getElementById(`tab-${prefix}-total`).textContent = total;
    });
}

// ===== タブ切り替え =====
function switchTab(tab) {
    activeTab = tab;

    document.querySelectorAll(".tab").forEach((btn) => {
        btn.classList.remove("active");
    });

    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

    renderSeats();
}

// ===== 時計を更新 =====
function updateClock() {
    currentTime = Date.now();
    renderSeats();
}

// ===== Supabase Realtime購読 =====
function subscribeRealtime() {
    supabase
        .channel("seats-changes")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "seats",
            },
            (payload) => {
                const seat = payload.new;
                seats[seat.id] = {
                    occupied: seat.occupied,
                    startTime: seat.start_time,
                    pausedTime: seat.paused_time,
                };
                renderSeats();
                updateStats();
            }
        )
        .subscribe();
}

// ===== イベントリスナー & 初期化 =====
document
    .getElementById("refresh-btn")
    .addEventListener("click", loadSeats);

document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        switchTab(tab.dataset.tab);
    });
});

async function init() {
    await loadSeats();
    subscribeRealtime();
    setInterval(updateClock, 1000);
}

init();

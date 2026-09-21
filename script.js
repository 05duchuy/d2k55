// 1. KHỞI TẠO KẾT NỐI SUPABASE
const supabaseUrl = 'https://mmxdbuwwwveirfajvgww.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1teGRidXd3d3ZlaXJmYWp2Z3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTQ1MjAsImV4cCI6MjEwNTUzMDUyMH0.k4UejzPezVV0La-OpCCV92iJtp4MU3cSbDptf_jG2pg';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. BIẾN TRẠNG THÁI GIAO DIỆN VÀ DỮ LIỆU CỤC BỘ
let state = {
    currentWeek: 1,
    weeks: [],
    weekNotes: {},
    lockedWeeks: [], 
    excludedAverageWeeks: [], 
    targetStudentId: null,
    targetAction: null,
    sortBy: 'name' 
};

let students = [];

const reasons = {
    add: [
        { value: "", text: "-- Chọn lý do cộng --" },
        { value: "Tham gia văn nghệ, thể thao", text: "Tham gia văn nghệ, thể thao (+3 đến +5)" },
        { value: "Điểm cao (Điểm 10)", text: "Điểm cao (Điểm 10) (+2)" },
        { value: "Giúp đỡ bạn bè", text: "Giúp đỡ bạn bè (+5)" },
        { value: "Lý do khác", text: "Lý do khác" }
    ],
    minus: [
        { value: "", text: "-- Chọn lý do trừ --" },
        { value: "Đi học chậm", text: "Đi học chậm (-2)" },
        { value: "Sử dụng điện thoại", text: "Sử dụng điện thoại (-5)" },
        { value: "Không làm bài tập", text: "Không làm bài tập (-3)" },
        { value: "Vi phạm khác", text: "Vi phạm khác" }
    ]
};

// 3. HÀM TẢI ĐỒNG BỘ TOÀN BỘ DỮ LIỆU TỪ SUPABASE
async function loadData() {
    const [
        { data: weeksData }, 
        { data: studentsData }, 
        { data: pointsData }, 
        { data: historyData }
    ] = await Promise.all([
        supabaseClient.from('weeks').select('*').order('week_number', { ascending: true }),
        supabaseClient.from('students').select('*').order('id', { ascending: true }),
        supabaseClient.from('weekly_points').select('*'),
        supabaseClient.from('point_history').select('*').order('created_at', { ascending: false })
    ]);

    // Xử lý dữ liệu Tuần (Weeks)
    state.weeks = [];
    state.weekNotes = {};
    state.lockedWeeks = [];
    state.excludedAverageWeeks = [];

    if (weeksData && weeksData.length > 0) {
        weeksData.forEach(w => {
            state.weeks.push(w.week_number);
            state.weekNotes[w.week_number] = w.note || "";
            if (w.is_locked) state.lockedWeeks.push(w.week_number);
            if (w.exclude_avg) state.excludedAverageWeeks.push(w.week_number);
        });
        if (!state.weeks.includes(state.currentWeek)) {
            state.currentWeek = Math.max(...state.weeks);
        }
    } else {
        await supabaseClient.from('weeks').insert([{ week_number: 1 }]);
        state.weeks = [1];
        state.currentWeek = 1;
        state.weekNotes[1] = "";
    }

    // Xử lý dữ liệu Học sinh (Students & Points)
    if (studentsData) {
        students = studentsData.map(s => {
            let sPoints = {};
            if (pointsData) {
                pointsData.filter(p => p.student_id === s.id).forEach(p => {
                    sPoints[p.week_number] = p.points;
                });
            }

            let sHistory = [];
            if (historyData) {
                sHistory = historyData.filter(h => h.student_id === s.id).map(h => {
                    const d = new Date(h.created_at);
                    const pad = (n) => n < 10 ? '0'+n : n;
                    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
                    return {
                        week: h.week_number, editor: h.editor_name, action: h.action_type, 
                        points: h.point_amount, reason: h.reason, note: h.note, time: timeStr
                    };
                });
            }

            return {
                id: s.id, name: s.name, group: s.group_num, locked: s.is_locked,
                points: sPoints, history: sHistory
            };
        });
    }

    renderWeekTabs();
    document.getElementById('week-note').value = state.weekNotes[state.currentWeek] || "";
    renderTable();
}

// 4. QUẢN LÝ TƯƠNG TÁC GIAO DIỆN (UI)
function customAlert(message) {
    document.getElementById('alert-message').innerText = message;
    document.getElementById('custom-alert').classList.add('show');
}

function customConfirm(message, onConfirm) {
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('custom-confirm').classList.add('show');
    document.getElementById('confirm-yes-btn').onclick = function() {
        closeModal('custom-confirm');
        onConfirm();
    };
}

function closeModal(modalId) { document.getElementById(modalId).classList.remove("show"); }

function switchMainTab(tabId) {
    ['rules', 'manage', 'guide'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        document.getElementById(`nav-${t}`).classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`nav-${tabId}`).classList.add('active');
}

function renderWeekTabs() {
    const container = document.getElementById('week-tabs-container');
    container.innerHTML = "";
    state.weeks.forEach(week => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${state.currentWeek === week ? 'active' : ''}`;
        btn.innerText = `Tuần ${week}`;
        if (state.lockedWeeks.includes(week)) btn.innerHTML += ' 🔒';
        if (state.excludedAverageWeeks.includes(week)) btn.innerHTML += ' 🚫';
        btn.onclick = () => changeWeek(week);
        container.appendChild(btn);
    });
    if (getCurrentRole() === 'admin') {
        const addBtn = document.createElement("button");
        addBtn.className = "tab-btn";
        addBtn.style.backgroundColor = "#10b981"; addBtn.style.color = "white"; addBtn.style.borderColor = "#10b981";
        addBtn.innerText = "+ Thêm tuần";
        addBtn.onclick = addNewWeek;
        container.appendChild(addBtn);
    }
    updateWeekControlsUI();
}

function changeWeek(week) {
    state.currentWeek = week;
    renderWeekTabs();
    updateWeekControlsUI();
    document.getElementById('week-note').value = state.weekNotes[week] || "";
    renderTable();
}

function updateWeekControlsUI() {
    const btnLock = document.getElementById('btn-week-lock');
    const btnExclude = document.getElementById('btn-exclude-avg');
    const noteArea = document.getElementById('week-note');
    const role = getCurrentRole(); // Lấy quyền hiện tại
    
    if (state.lockedWeeks.includes(state.currentWeek)) {
        btnLock.className = 'toggle-status-btn locked'; btnLock.innerHTML = '🔒 Tuần đã khóa'; 
        noteArea.disabled = true;
    } else {
        btnLock.className = 'toggle-status-btn unlocked'; btnLock.innerHTML = '🔓 Tuần đang mở'; 
        // Chỉ Admin mới được sửa ghi chú khi tuần mở
        noteArea.disabled = (role !== 'admin'); 
    }

    if (state.excludedAverageWeeks.includes(state.currentWeek)) {
        btnExclude.className = 'toggle-status-btn excluded'; btnExclude.innerHTML = '🚫 Không tính TB';
    } else {
        btnExclude.className = 'toggle-status-btn included'; btnExclude.innerHTML = '📊 Đang tính TB';
    }
}

function parseVietnameseName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return { first: "", middle: "", last: "" };
    if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
    const last = parts[0]; 
    const first = parts[parts.length - 1]; 
    const middle = parts.slice(1, parts.length - 1).join(" "); 
    return { first, middle, last };
}

function changeSort(val) { state.sortBy = val; renderTable(); }

function getSortedStudents() {
    let sorted = [...students];
    const compareNames = (a, b) => {
        const nameA = parseVietnameseName(a.name); const nameB = parseVietnameseName(b.name);
        let cmp = nameA.first.localeCompare(nameB.first, 'vi');
        if (cmp !== 0) return cmp;
        cmp = nameA.middle.localeCompare(nameB.middle, 'vi');
        if (cmp !== 0) return cmp;
        return nameA.last.localeCompare(nameB.last, 'vi');
    };
    if (state.sortBy === 'name') sorted.sort(compareNames);
    else if (state.sortBy === 'group') sorted.sort((a, b) => a.group === b.group ? compareNames(a, b) : a.group - b.group);
    return sorted;
}

function renderTable() {
    const tbody = document.getElementById("students-tbody"); tbody.innerHTML = ""; 
    const isWeekLocked = state.lockedWeeks.includes(state.currentWeek);
    
    getSortedStudents().forEach((student, index) => {
        let currentPoints = student.points[state.currentWeek] !== undefined ? student.points[state.currentWeek] : 100;
        let isStudentLocked = student.locked;
        let badgeClass = currentPoints >= 100 ? "points-high" : "points-normal";
        if(currentPoints < 80) badgeClass = "badge-locked text-red font-bold"; 
        
        const isDisabled = isWeekLocked || isStudentLocked;
        let trClass = isDisabled ? "row-locked" : "";
        const role = getCurrentRole();
        let actionsHtml = `<div class="action-group">`;
        
        if (isDisabled) {
            actionsHtml += `<button class="btn btn-warning" onclick="openHistoryModal(${student.id})">🕒 Lịch sử</button>`;
            if (role === 'admin') {
                if (isStudentLocked && !isWeekLocked) actionsHtml += `<button class="btn btn-outline" onclick="toggleStudentLock(${student.id})">🔓 Mở khóa</button>`;
                else if (isStudentLocked && isWeekLocked) actionsHtml += `<span class="badge badge-locked" style="margin-top: 4px;">🔒 HS Đã khóa</span>`;
            } else if (isStudentLocked) {
                actionsHtml += `<span class="badge badge-locked" style="margin-top: 4px;">🔒 HS Đã khóa</span>`;
            }
        } else {
            // Admin & User được cộng/trừ và sửa
            if (role === 'admin' || role === 'user') {
                actionsHtml += `
                    <button class="btn btn-add" onclick="openPointModal(${student.id}, 'add')">+ Cộng</button>
                    <button class="btn btn-minus" onclick="openPointModal(${student.id}, 'minus')">- Trừ</button>
                `;
            }
            
            // Ai cũng xem được lịch sử
            actionsHtml += `<button class="btn btn-warning" onclick="openHistoryModal(${student.id})">Lịch sử</button>`;
            
            // Admin & User được sửa thông tin
            if (role === 'admin' || role === 'user') {
                actionsHtml += `<button class="btn btn-outline" onclick="openEditMemberModal(${student.id})" title="Sửa thông tin">✏️</button>`;
            }
            
            // Chỉ Admin được khóa và xóa
            if (role === 'admin') {
                actionsHtml += `
                    <button class="btn btn-dark" onclick="toggleStudentLock(${student.id})" title="Khóa thành viên">🔒</button>
                    <button class="btn btn-outline" style="color: #ef4444; border-color: #fca5a5;" onclick="promptRemoveMember(${student.id})" title="Xóa">🗑️</button>
                `;
            }
        }
        actionsHtml += `</div>`;
        let nameDisplay = student.name;
        if (isStudentLocked) nameDisplay = `🔒 ${nameDisplay}`;

        const tr = document.createElement("tr");
        tr.className = trClass;
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight: 500;">${nameDisplay}</td>
            <td><span class="group-badge">Tổ ${student.group}</span></td>
            <td><span class="badge ${badgeClass}">${currentPoints}</span></td>
            <td>${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
    renderAverageTable(); 
}

function renderAverageTable() {
    const tbody = document.getElementById("average-tbody"); tbody.innerHTML = "";
    let validWeeks = state.weeks.filter(w => !state.excludedAverageWeeks.includes(w));
    
    document.getElementById("avg-note-text").innerText = state.excludedAverageWeeks.length > 0 ? `(Đang bỏ qua Tuần: ${state.excludedAverageWeeks.join(", ")})` : `(Gồm tất cả các tuần)`;
    if (validWeeks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 20px;">Không có tuần nào để tính điểm.</td></tr>`;
        return;
    }

    getSortedStudents().forEach((student, index) => {
        let totalPoints = validWeeks.reduce((sum, week) => sum + (student.points[week] !== undefined ? student.points[week] : 100), 0);
        let average = (totalPoints / validWeeks.length).toFixed(1);
        let avgColor = average >= 100 ? "#16a34a" : (average < 80 ? "#dc2626" : "#0284c7");
        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td style="font-weight: 500;">${student.name} <span class="group-badge" style="margin-left: 8px;">Tổ ${student.group}</span></td>
                <td style="font-weight: 700; color: ${avgColor};">${average}</td>
            </tr>
        `;
    });
}
// Mở pop-up đăng nhập
function openLoginModal() {
    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("login-modal").classList.add("show");
}

// Xử lý khi bấm nút "Đăng nhập"
async function submitLogin() {
    const usernameInput = document.getElementById("login-username").value.trim();
    const passwordInput = document.getElementById("login-password").value.trim();

    if (!usernameInput || !passwordInput) {
        return customAlert("Vui lòng nhập đầy đủ tài khoản và mật khẩu!");
    }

    const { data, error } = await supabaseClient
        .from('users_login')
        .select('*')
        .eq('username', usernameInput)
        .eq('password', passwordInput)
        .single(); 

    if (error || !data) {
        return customAlert("Đăng nhập thất bại: Sai tài khoản hoặc mật khẩu!");
    }

    // Lưu thông tin vào trình duyệt
    localStorage.setItem('currentUser', JSON.stringify(data));
    
    // Cập nhật giao diện (truyền thêm chuc_vu)
    updateLoginUI(data.username, data.role, data.chuc_vu);
    
    closeModal("login-modal");
    customAlert(`Đăng nhập thành công!`);
}
function updateLoginUI(username, role, chuc_vu) {
    let roleDisplay = role === 'admin' ? "Quản trị viên" : "Thành viên";
    document.querySelector('.user-info').innerHTML = `
        <span>👤 Xin chào, <b>${chuc_vu}</b></span>
        <button class="btn btn-outline" style="margin-left: 10px; padding: 4px 8px; font-size: 12px;" onclick="logout()">Đăng xuất</button>
    `;
    applyRBAC(); // Cập nhật giao diện sau khi đăng nhập
}

// Xử lý khi bấm nút "Đăng xuất"
function logout() {
    localStorage.removeItem('currentUser');
    document.querySelector('.user-info').innerHTML = `
        <button class="btn btn-primary" id="login-btn" onclick="openLoginModal()">👤 Đăng nhập</button>
    `;
    customAlert("Đã đăng xuất khỏi hệ thống!");
    applyRBAC(); // Reset giao diện về khách vãng lai
}
function checkAuthStatus() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        const user = JSON.parse(userStr);
        updateLoginUI(user.username, user.role, user.chuc_vu);
    } else {
        applyRBAC(); // Áp dụng quyền khách vãng lai ngay từ đầu
    }
}

// 5. CÁC HÀM TƯƠNG TÁC API (CẬP NHẬT DATABASE)
async function addNewWeek() {
    if (getCurrentRole() !== 'admin') return customAlert("Chỉ Admin mới có quyền thao tác!");
    const nextWeek = Math.max(...state.weeks) + 1;
    await supabaseClient.from('weeks').insert([{ week_number: nextWeek }]);
    await loadData();
    changeWeek(nextWeek);
}

let noteTimeout;
function saveWeekNote() {
    clearTimeout(noteTimeout);
    noteTimeout = setTimeout(async () => {
        const val = document.getElementById('week-note').value;
        await supabaseClient.from('weeks').update({ note: val }).eq('week_number', state.currentWeek);
        state.weekNotes[state.currentWeek] = val;
    }, 1000); 
}

async function toggleWeekLock() {
    if (getCurrentRole() !== 'admin') return customAlert("Chỉ Admin mới có quyền thao tác!");
    const isLocked = state.lockedWeeks.includes(state.currentWeek);
    const msg = isLocked ? `MỞ KHÓA Tuần ${state.currentWeek}?` : `KHÓA Tuần ${state.currentWeek}? Không thể sửa điểm/xóa thành viên.`;
    customConfirm(msg, async () => {
        await supabaseClient.from('weeks').update({ is_locked: !isLocked }).eq('week_number', state.currentWeek);
        await loadData();
    });
}

async function toggleExcludeAverage() {
    if (getCurrentRole() !== 'admin') return customAlert("Chỉ Admin mới có quyền thao tác!");
    const isEx = state.excludedAverageWeeks.includes(state.currentWeek);
    customConfirm(isEx ? `Tính lại điểm TB cho tuần ${state.currentWeek}?` : `KHÔNG TÍNH ĐIỂM TB cho tuần ${state.currentWeek}?`, async () => {
        await supabaseClient.from('weeks').update({ exclude_avg: !isEx }).eq('week_number', state.currentWeek);
        await loadData();
    });
}

async function addMember() {
    if (getCurrentRole() !== 'admin') return customAlert("Chỉ Admin mới có quyền thao tác!");
    if (state.lockedWeeks.includes(state.currentWeek)) return customAlert("Tuần đã khóa!"); 
    const name = document.getElementById("new-member-name").value.trim();
    const group = parseInt(document.getElementById("new-member-group").value);
    if (!name) return customAlert("Vui lòng nhập tên!");
    
    await supabaseClient.from('students').insert([{ name: name, group_num: group }]);
    document.getElementById("new-member-name").value = "";
    await loadData();
}

function openEditMemberModal(id) {
    const student = students.find(s => s.id === id); if (!student) return;
    state.targetStudentId = id;
    document.getElementById("edit-member-name").value = student.name;
    document.getElementById("edit-member-group").value = student.group;
    document.getElementById("edit-member-modal").classList.add("show");
}

async function saveEditMember() {
    if (getCurrentRole() === 'guest') return customAlert("Vui lòng đăng nhập để thao tác!");
    const name = document.getElementById("edit-member-name").value.trim();
    const group = parseInt(document.getElementById("edit-member-group").value);
    if (!name) return customAlert("Vui lòng nhập tên!"); 
    
    await supabaseClient.from('students').update({ name: name, group_num: group }).eq('id', state.targetStudentId);
    closeModal('edit-member-modal');
    await loadData();
}

function promptRemoveMember(id) {
    if (getCurrentRole() !== 'admin') return customAlert("Chỉ Admin mới có quyền thao tác!");
    customConfirm("Chắc chắn xóa thành viên này khỏi lớp?", async () => {
        await supabaseClient.from('students').delete().eq('id', id);
        await loadData();
    });
}

async function toggleStudentLock(id) {
    if (getCurrentRole() !== 'admin') return customAlert("Chỉ Admin mới có quyền thao tác!");
    const student = students.find(s => s.id === id); if (!student) return;
    customConfirm(student.locked ? `Mở khóa thành viên?` : `Khóa thành viên ${student.name}?`, async () => {
        await supabaseClient.from('students').update({ is_locked: !student.locked }).eq('id', id);
        await loadData();
    });
}

function openPointModal(id, action) {
    const student = students.find(s => s.id === id); if (!student) return;
    state.targetStudentId = id; state.targetAction = action;
    document.getElementById("modal-title").innerHTML = action === 'add' ? `Cộng điểm: <span class="text-green">${student.name}</span>` : `Trừ điểm: <span class="text-red">${student.name}</span>`;
    document.getElementById("point-value").value = 5; document.getElementById("point-note").value = "";
    document.getElementById("point-reason").innerHTML = reasons[action].map(r => `<option value="${r.value}">${r.text}</option>`).join("");
    document.getElementById("btn-submit-point").className = action === 'add' ? 'btn btn-add' : 'btn btn-minus';
    document.getElementById("point-modal").classList.add("show");
}

async function submitPoints() {
    if (getCurrentRole() === 'guest') return customAlert("Vui lòng đăng nhập để thao tác!");
    const points = parseInt(document.getElementById("point-value").value);
    const reason = document.getElementById("point-reason").value;
    const note = document.getElementById("point-note").value.trim();
    if (!points || points <= 0) return customAlert("Nhập số điểm hợp lệ!"); 
    if (!reason) return customAlert("Chọn lý do!"); 

    const student = students.find(s => s.id === state.targetStudentId); if (!student) return;
    const currentPoints = student.points[state.currentWeek] !== undefined ? student.points[state.currentWeek] : 100;
    const newPoints = state.targetAction === 'add' ? currentPoints + points : currentPoints - points;

    // Cập nhật hoặc chèn điểm vào weekly_points
    await supabaseClient.from('weekly_points').upsert(
        { student_id: student.id, week_number: state.currentWeek, points: newPoints }, 
        { onConflict: 'student_id, week_number' }
    );
    // Ghi log lịch sử
    await supabaseClient.from('point_history').insert([{
        student_id: student.id, week_number: state.currentWeek, editor_name: "Tổ trưởng", 
        action_type: state.targetAction, point_amount: points, reason: reason, note: note
    }]);

    closeModal("point-modal");
    await loadData(); // Làm mới dữ liệu bảng
}

function openHistoryModal(id) {
    const student = students.find(s => s.id === id); if (!student) return;
    document.getElementById("history-title").innerHTML = `Lịch sử điểm của <b>${student.name}</b> (Tuần ${state.currentWeek})`;
    const tbody = document.getElementById("history-tbody"); tbody.innerHTML = "";
    const weekHistory = student.history.filter(h => h.week === state.currentWeek);

    if (weekHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">Chưa có lịch sử sửa điểm</td></tr>`;
    } else {
        weekHistory.forEach(h => {
            const actionText = h.action === 'add' ? `<span class="text-green font-bold">+${h.points}</span>` : `<span class="text-red font-bold">-${h.points}</span>`;
            tbody.innerHTML += `<tr>
                <td style="white-space: nowrap; font-size: 13px; color: #64748b;">${h.time}</td>
                <td style="font-weight: 500;">${h.editor || "Hệ thống"}</td>
                <td>${actionText}</td><td>${h.reason}</td>
                <td style="color: #64748b; font-size: 13px;">${h.note || '-'}</td>
            </tr>`;
        });
    }
    document.getElementById("history-modal").classList.add("show");
}

// Lấy quyền hiện tại
function getCurrentRole() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        const user = JSON.parse(userStr);
        return user.role || 'user'; // Nếu có đăng nhập thì lấy role (admin/user)
    }
    return 'guest'; // Chưa đăng nhập là khách
}

// Áp dụng quyền lên giao diện
function applyRBAC() {
    const role = getCurrentRole();
    
    // Khu vực chức năng của Admin
    const addMemberContainer = document.querySelector('.add-member-container');
    const controlsActions = document.querySelector('.controls-actions');
    const weekNote = document.getElementById('week-note');

    if (role === 'admin') {
        if (addMemberContainer) addMemberContainer.style.display = 'flex';
        if (controlsActions) controlsActions.style.display = 'flex';
        if (weekNote) weekNote.disabled = false;
    } else {
        if (addMemberContainer) addMemberContainer.style.display = 'none';
        if (controlsActions) controlsActions.style.display = 'none'; // Ẩn khóa tuần & khóa TB
        if (weekNote) weekNote.disabled = true; // Khách và user chỉ được xem ghi chú
    }
    
    // Refresh bảng để ẩn/hiện các nút Tác vụ
    if (students && students.length > 0) {
        renderTable();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    checkAuthStatus(); // Thêm dòng này để kiểm tra trạng thái login
    loadData(); 
});
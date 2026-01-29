// Firebase 配置（替換成您的）
const firebaseConfig = {
    apiKey: "Wfn_4_3tlUrYtky34eQuDXH5M4neRxgFTwQZwwEpLrc",
    authDomain: "coffeeinventory.firebaseapp.com",
    projectId: "coffeeinventory-df995",
    storageBucket: "coffeeinventory.appspot.com",
    messagingSenderId: "573323420537",
    appId: "BPDLaHkG64KSJmAFxDzGfHGzjQlasdJjlLrukhA5GqB5m5d2Ux2UZ1oZqQnIf8ICSsc5nYrWwZ4bYFmm1TQbKXc"
};
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 變數
let user = null;
let inventory = { raw: [], roasted: [] }; // 陣列：[{variety: 'Arabica', amount: 0}, ...]
let history = [];
let unit = 'g'; // 預設克
const LB_TO_G = 453.592; // 1磅 = 453.592克
const varieties = ['Arabica', 'Robusta', 'Other']; // 可擴充

// 監聽登入狀態
auth.onAuthStateChanged(u => {
    user = u;
    document.getElementById('login-btn').classList.toggle('hidden', !!user);
    document.getElementById('logout-btn').classList.toggle('hidden', !user);
    document.getElementById('user-info').textContent = user ? `歡迎, ${user.displayName}` : '請登入';
    if (user) loadData();
    else {
        inventory = { raw: [], roasted: [] };
        history = [];
        updateUI();
    }
});

// 登入/登出
document.getElementById('login-btn').onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
document.getElementById('logout-btn').onclick = () => auth.signOut();

// 單位切換
document.getElementById('unit-select').onchange = e => {
    unit = e.target.value;
    updateUI();
};

// 轉換單位
function convertAmount(amount) {
    return unit === 'g' ? amount : (amount / LB_TO_G).toFixed(2);
}
function getUnitLabel() { return unit === 'g' ? 'g' : 'lb'; }

// 載入數據（從Firestore）
async function loadData() {
    if (!user) return;
    const invDoc = await db.collection('inventories').doc(user.uid).get();
    inventory = invDoc.exists ? invDoc.data() : { raw: varieties.map(v => ({variety: v, amount: 0})), roasted: varieties.map(v => ({variety: v, amount: 0})) };
    
    const roastsQuery = await db.collection('roasts').where('userId', '==', user.uid).get();
    history = roastsQuery.docs.map(doc => ({id: doc.id, ...doc.data()}));
    updateUI();
}

// 更新UI
function updateUI(filteredHistory = history) {
    if (!user) return;
    
    // 庫存表格
    const invTable = document.getElementById('inventory-table');
    while (invTable.rows.length > 1) invTable.deleteRow(1);
    ['raw', 'roasted'].forEach(type => {
        inventory[type].forEach(item => {
            const row = invTable.insertRow();
            row.insertCell(0).textContent = type === 'raw' ? '生豆' : '熟豆';
            row.insertCell(1).textContent = item.variety;
            const amountCell = row.insertCell(2);
            amountCell.textContent = `${convertAmount(item.amount)} ${getUnitLabel()}`;
            if (item.amount < (unit === 'g' ? 100 : 100 / LB_TO_G)) amountCell.classList.add('low-stock');
            const editBtn = document.createElement('button');
            editBtn.textContent = '编辑';
            editBtn.onclick = () => editInventory(type, item.variety);
            row.insertCell(3).appendChild(editBtn);
        });
    });
    
    // 警報
    const hasLow = inventory.raw.some(i => i.amount < 100) || inventory.roasted.some(i => i.amount < 100);
    document.getElementById('alert').classList.toggle('hidden', !hasLow);
    
    // 總統計
    const totalRaw = inventory.raw.reduce((sum, i) => sum + i.amount, 0);
    const totalRoasted = inventory.roasted.reduce((sum, i) => sum + i.amount, 0);
    document.getElementById('total-stats').textContent = `總生豆: ${convertAmount(totalRaw)} ${getUnitLabel()}, 總熟豆: ${convertAmount(totalRoasted)} ${getUnitLabel()}`;
    
    // 餅圖（生/熟比例）
    new Chart(document.getElementById('pie-chart'), {
        type: 'pie',
        data: { labels: ['生豆', '熟豆'], datasets: [{ data: [totalRaw, totalRoasted], backgroundColor: ['#FF6384', '#36A2EB'] }] },
        options: { responsive: true }
    });
    
    // 線圖（烘焙歷史：日期 vs 產出）
    const dates = [...new Set(history.map(r => r.date))].sort();
    const producedData = dates.map(d => history.filter(r => r.date === d).reduce((sum, r) => sum + r.roastedProduced, 0));
    new Chart(document.getElementById('line-chart'), {
        type: 'line',
        data: { labels: dates, datasets: [{ label: '產出熟豆', data: producedData, borderColor: '#4CAF50' }] },
        options: { responsive: true }
    });
    
    // 記錄表格
    const table = document.getElementById('history-table');
    while (table.rows.length > 1) table.deleteRow(1);
    filteredHistory.forEach(record => {
        const row = table.insertRow();
        row.insertCell(0).textContent = record.date;
        row.insertCell(1).textContent = record.variety;
        row.insertCell(2).textContent = `${convertAmount(record.rawUsed)} ${getUnitLabel()}`;
        row.insertCell(3).textContent = `${convertAmount(record.roastedProduced)} ${getUnitLabel()}`;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = () => deleteRecord(record.id, record);
        row.insertCell(4).appendChild(deleteBtn);
    });
    
    saveData();
}

// 保存數據（到Firestore）
async function saveData() {
    if (!user) return;
    await db.collection('inventories').doc(user.uid).set(inventory);
}

// 添加烘焙
async function addRoast(event) {
    event.preventDefault();
    if (!user) { alert('請登入！'); return; }
    const date = document.getElementById('date').value;
    const variety = document.getElementById('variety-select').value;
    let rawUsed = parseFloat(document.getElementById('raw-used').value);
    let roastedProduced = parseFloat(document.getElementById('roasted-produced').value);
    if (unit === 'lb') { rawUsed *= LB_TO_G; roastedProduced *= LB_TO_G; } // 轉成克儲存
    
    const rawItem = inventory.raw.find(i => i.variety === variety);
    if (rawUsed > rawItem.amount) { alert('生豆库存不足！'); return; }
    
    rawItem.amount -= rawUsed;
    const roastedItem = inventory.roasted.find(i => i.variety === variety);
    roastedItem.amount += roastedProduced;
    
    const newRecord = { date, variety, rawUsed, roastedProduced, userId: user.uid };
    const docRef = await db.collection('roasts').add(newRecord);
    history.push({id: docRef.id, ...newRecord});
    updateUI();
    event.target.reset();
}

// 刪除記錄（回滾）
async function deleteRecord(id, record) {
    inventory.raw.find(i => i.variety === record.variety).amount += record.rawUsed;
    inventory.roasted.find(i => i.variety === record.variety).amount -= record.roastedProduced;
    await db.collection('roasts').doc(id).delete();
    history = history.filter(r => r.id !== id);
    updateUI();
}

// 編輯庫存
async function editInventory(type, variety) {
    let newValue = prompt(`请输入新的${type === 'raw' ? '生豆' : '熟豆'} (${variety}) 数量 (${getUnitLabel()}):`, convertAmount(inventory[type].find(i => i.variety === variety).amount));
    if (newValue !== null && !isNaN(newValue)) {
        newValue = parseFloat(newValue);
        if (unit === 'lb') newValue *= LB_TO_G; // 轉克
        inventory[type].find(i => i.variety === variety).amount = newValue;
        updateUI();
    }
}

// 搜尋
document.getElementById('search-input').oninput = e => {
    const query = e.target.value.toLowerCase();
    const filtered = history.filter(r => r.date.includes(query) || r.variety.toLowerCase().includes(query));
    updateUI(filtered);
};

// 匯出CSV
function exportCSV() {
    let csv = '日期,品種,消耗生豆,產出熟豆\n';
    history.forEach(r => {
        csv += `${r.date},${r.variety},${convertAmount(r.rawUsed)} ${getUnitLabel()},${convertAmount(r.roastedProduced)} ${getUnitLabel()}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'roast_history.csv';
    link.click();
}

window.onload = () => updateUI(); // 初始載入（登入後才load數據）

let inventory = { raw: 0, roasted: 0 };
let history = [];

// 加载数据
function loadData() {
    const savedInventory = localStorage.getItem('inventory');
    const savedHistory = localStorage.getItem('history');
    if (savedInventory) inventory = JSON.parse(savedInventory);
    if (savedHistory) history = JSON.parse(savedHistory);
    updateUI();
}

// 更新界面
function updateUI() {
    document.getElementById('raw-beans').textContent = inventory.raw;
    document.getElementById('roasted-beans').textContent = inventory.roasted;
    
    const table = document.getElementById('history-table');
    while (table.rows.length > 1) table.deleteRow(1); // 清空旧记录
    
    history.forEach((record, index) => {
        const row = table.insertRow();
        row.insertCell(0).textContent = record.date;
        row.insertCell(1).textContent = record.rawUsed;
        row.insertCell(2).textContent = record.roastedProduced;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = () => deleteRecord(index);
        row.insertCell(3).appendChild(deleteBtn);
    });
    
    checkAlert();
    saveData();
}

// 检查库存警报
function checkAlert() {
    const alert = document.getElementById('alert');
    const rawElem = document.getElementById('raw-beans');
    const roastedElem = document.getElementById('roasted-beans');
    rawElem.classList.remove('low-stock');
    roastedElem.classList.remove('low-stock');
    alert.classList.add('hidden');
    
    if (inventory.raw < 100 || inventory.roasted < 100) {
        alert.classList.remove('hidden');
        if (inventory.raw < 100) rawElem.classList.add('low-stock');
        if (inventory.roasted < 100) roastedElem.classList.add('low-stock');
    }
}

// 保存数据
function saveData() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('history', JSON.stringify(history));
}

// 添加烘焙记录
function addRoast(event) {
    event.preventDefault();
    const date = document.getElementById('date').value;
    const rawUsed = parseInt(document.getElementById('raw-used').value);
    const roastedProduced = parseInt(document.getElementById('roasted-produced').value);
    
    if (rawUsed > inventory.raw) {
        alert('生豆库存不足！');
        return;
    }
    
    inventory.raw -= rawUsed;
    inventory.roasted += roastedProduced;
    history.push({ date, rawUsed, roastedProduced });
    updateUI();
    event.target.reset();
}

// 删除记录（回滚库存）
function deleteRecord(index) {
    const record = history[index];
    inventory.raw += record.rawUsed;
    inventory.roasted -= record.roastedProduced;
    history.splice(index, 1);
    updateUI();
}

// 编辑库存
function editInventory(type) {
    const newValue = prompt(`请输入新的${type === 'raw' ? '生豆' : '熟豆'}数量 (克):`, inventory[type]);
    if (newValue !== null && !isNaN(newValue)) {
        inventory[type] = parseInt(newValue);
        updateUI();
    }
}

window.onload = loadData;
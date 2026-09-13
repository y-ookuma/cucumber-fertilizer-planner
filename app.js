```javascript
"use strict";

/* =========================================================
   Cucumber Fertilizer Planner
   キュウリ専用 液肥施肥計画・管理アプリ
   ========================================================= */

const STORAGE_KEY = "cucumberFertilizerPlanner_v2";

let records = [];
let currentPlan = [];

const $ = (id) => document.getElementById(id);

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

function activateTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === tabId);
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function getCheckedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)]
    .map(input => input.value);
}

function setCheckedValues(name, values) {
  const selected = new Set(values || []);

  document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
    input.checked = selected.has(input.value);
  });
}

function collectData() {
  return {
    cropName: $("cropName").value,
    variety: $("variety").value,
    cultivation: $("cultivation").value,
    plantCount: $("plantCount").value,
    stage: $("stage").value,
    planStart: $("planStart").value,
    planDays: $("planDays").value,
    weather: $("weather").value,

    vigor: $("vigor").value,
    leafColor: $("leafColor").value,
    fruitSet: $("fruitSet").value,
    soilMoisture: $("soilMoisture").value,
    soilEC: $("soilEC").value,
    waterEC: $("waterEC").value,
    conditionMemo: $("conditionMemo").value,

    fertilizerMethod:
      document.querySelector('input[name="fertilizerMethod"]:checked')?.value
      || "灌水同時施肥",

    equipment: getCheckedValues("equipment"),
    methodMemo: $("methodMemo").value,

    managementMethod: getCheckedValues("managementMethod"),

    fertilizerName: $("fertilizerName").value,
    dilution: $("dilution").value,
    waterPerPlant: $("waterPerPlant").value,
    frequency: $("frequency").value,
    fertilizerN: $("fertilizerN").value,
    fertilizerP: $("fertilizerP").value,
    fertilizerK: $("fertilizerK").value,
    concentration: $("concentration").value,
    designMemo: $("designMemo").value,

    records,
    currentPlan
  };
}

function applyData(data) {
  if (!data) return;

  const fields = [
    "cropName",
    "variety",
    "cultivation",
    "plantCount",
    "stage",
    "planStart",
    "planDays",
    "weather",
    "vigor",
    "leafColor",
    "fruitSet",
    "soilMoisture",
    "soilEC",
    "waterEC",
    "conditionMemo",
    "methodMemo",
    "fertilizerName",
    "dilution",
    "waterPerPlant",
    "frequency",
    "fertilizerN",
    "fertilizerP",
    "fertilizerK",
    "concentration",
    "designMemo"
  ];

  fields.forEach(id => {
    if ($(id) && data[id] !== undefined) {
      $(id).value = data[id];
    }
  });

  if (data.fertilizerMethod) {
    const radio = document.querySelector(
      `input[name="fertilizerMethod"][value="${CSS.escape(data.fertilizerMethod)}"]`
    );

    if (radio) {
      radio.checked = true;
    }
  }

  setCheckedValues("equipment", data.equipment || []);
  setCheckedValues("managementMethod", data.managementMethod || []);

  records = Array.isArray(data.records) ? data.records : [];
  currentPlan = Array.isArray(data.currentPlan) ? data.currentPlan : [];

  updateMethodCardStyles();
  renderRecords();

  if (currentPlan.length) {
    renderPlan(currentPlan);
  }
}

function saveData(showMessage = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collectData()));

  if (showMessage) {
    showToast("入力内容を保存しました");
  }
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    showToast("保存データがありません");
    return;
  }

  try {
    applyData(JSON.parse(raw));
    showToast("保存データを復元しました");
  } catch (error) {
    console.error(error);
    showToast("復元に失敗しました");
  }
}

function getFormValues() {
  return {
    plantCount: Math.max(1, Number($("plantCount").value) || 1),
    planDays: Math.max(1, Number($("planDays").value) || 1),
    frequency: Math.max(1, Number($("frequency").value) || 1),
    waterPerPlant: Math.max(0, Number($("waterPerPlant").value) || 0),

    planStart: $("planStart").value || todayString(),

    fertilizerMethod:
      document.querySelector('input[name="fertilizerMethod"]:checked')?.value
      || "灌水同時施肥",

    managementMethod: getCheckedValues("managementMethod"),

    cultivation: $("cultivation").value,
    stage: $("stage").value,
    weather: $("weather").value,
    vigor: $("vigor").value,
    leafColor: $("leafColor").value,
    fruitSet: $("fruitSet").value,
    soilMoisture: $("soilMoisture").value,
    soilEC: $("soilEC").value,
    fertilizerName: $("fertilizerName").value || "未設定"
  };
}

/* ==================== 施肥計画 ==================== */

function generatePlan() {
  const v = getFormValues();

  const perApplication = v.plantCount * v.waterPerPlant;

  currentPlan = [];

  const start = new Date(`${v.planStart}T00:00:00`);

  for (let i = 0; i < v.frequency; i++) {
    const offset = v.frequency === 1
      ? 0
      : Math.round(i * (v.planDays - 1) / (v.frequency - 1));

    const date = new Date(start);
    date.setDate(start.getDate() + offset);

    currentPlan.push({
      no: i + 1,
      date: date.toISOString().slice(0, 10),
      method: v.fertilizerMethod,
      perPlant: v.waterPerPlant,
      total: perApplication,
      done: false,
      memo: ""
    });
  }

  renderPlan(currentPlan);
  saveData(false);
  activateTab("planPanel");
  showToast("施肥計画を作成しました");
}

function renderPlan(plan) {
  const v = getFormValues();

  const perApplication = v.plantCount * v.waterPerPlant;
  const totalAmount = perApplication * v.frequency;

  $("summaryDays").textContent = v.planDays;
  $("summaryFrequency").textContent = v.frequency;
  $("summaryPerApplication").textContent = perApplication.toFixed(1);
  $("summaryTotal").textContent = totalAmount.toFixed(1);

  $("planCondition").innerHTML = [
    `栽培名：${escapeHTML($("cropName").value)}`,
    `栽培環境：${escapeHTML(v.cultivation)}`,
    `株数：${v.plantCount}株`,
    `生育：${escapeHTML(v.stage)}`,
    `液肥：${escapeHTML(v.fertilizerName)}`
  ].map(text => `<span class="tag">${text}</span>`).join("");

  $("planMethods").innerHTML = v.managementMethod.length
    ? v.managementMethod
        .map(method => `<span class="tag">${escapeHTML(method)}</span>`)
        .join("")
    : `<span class="tag neutral">管理手法が未選択です</span>`;

  renderDiagnosis();

  const tbody = $("planTable").querySelector("tbody");
  tbody.innerHTML = "";

  plan.forEach((item, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${item.no}</td>
      <td>
        <input
          type="date"
          value="${escapeHTML(item.date)}"
          data-plan-index="${index}"
          data-plan-key="date"
        >
      </td>
      <td>${escapeHTML(item.method)}</td>
      <td>${Number(item.perPlant).toFixed(1)} L</td>
      <td>${Number(item.total).toFixed(1)} L</td>
      <td>
        <input
          type="checkbox"
          ${item.done ? "checked" : ""}
          data-plan-index="${index}"
          data-plan-key="done"
        >
      </td>
      <td>
        <input
          type="text"
          value="${escapeHTML(item.memo)}"
          placeholder="メモ"
          data-plan-index="${index}"
          data-plan-key="memo"
        >
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-plan-index]").forEach(input => {
    input.addEventListener("change", () => {
      const index = Number(input.dataset.planIndex);
      const key = input.dataset.planKey;

      currentPlan[index][key] =
        input.type === "checkbox" ? input.checked : input.value;

      saveData(false);
    });
  });
}

function renderDiagnosis() {
  const v = getFormValues();
  const items = [];

  if (v.soilMoisture === "過湿気味") {
    items.push("土壌が過湿気味です。施肥量を増やす前に、排水性・根域の酸素状態・灌水量を確認してください。");
  }

  if (v.soilMoisture === "乾燥気味") {
    items.push("土壌が乾燥気味です。高濃度液肥を急に施用せず、水分状態を確認してから施肥してください。");
  }

  if (v.vigor === "強い") {
    items.push("草勢が強い設定です。窒素過多や栄養生長への偏りがないか、葉色・つるの伸び・着果状況を合わせて確認してください。");
  }

  if (v.vigor === "弱い") {
    items.push("草勢が弱い設定です。肥料不足だけでなく、根傷み・低温・過湿・病害・水分不足なども確認してください。");
  }

  if (v.leafColor === "薄い" || v.leafColor === "黄化傾向") {
    items.push("葉色が薄い・黄化傾向の設定です。すぐに施肥量を増やすのではなく、根域環境やpH・EC、病害の有無も確認してください。");
  }

  if (v.fruitSet === "多い") {
    items.push("着果負担が大きい可能性があります。収穫量・果実肥大・草勢を見ながら、養水分の供給バランスを確認してください。");
  }

  if (v.weather === "晴天が多い" || v.weather === "高温・乾燥") {
    items.push("晴天・高温乾燥時は吸水量が増える可能性があります。灌水量と施肥濃度を分けて考え、根域の乾燥や塩類集積に注意してください。");
  }

  if (v.weather === "曇天が多い" || v.weather === "雨が多い") {
    items.push("低日射・多雨時は吸水や養分吸収が変化します。灌水過多や施肥過多にならないよう、土壌水分・排液・草勢を確認してください。");
  }

  if (v.managementMethod.includes("少量多回数施肥")) {
    items.push("少量多回数施肥を選択しています。1回量だけでなく、1日・計画期間の総施肥量を記録してください。");
  }

  if (v.managementMethod.includes("日射・天候連動施肥")) {
    items.push("日射・天候連動を選択しています。日射量は主に灌水量・給液回数の調整に利用し、肥料濃度は別途管理する設計が適しています。");
  }

  if (v.managementMethod.includes("土壌・養液分析に基づく施肥")) {
    items.push("分析に基づく施肥を選択しています。ECは肥料濃度の目安であり、N・P・Kの成分別過不足を単独で判断しないようにしてください。");
  }

  if (!items.length) {
    items.push("栽培状態と施肥条件を入力すると、管理上の確認ポイントが表示されます。");
  }

  $("diagnosis").innerHTML = items.map(text =>
    `<div class="diagnosis-item">${escapeHTML(text)}</div>`
  ).join("");
}

/* ==================== 施肥記録 ==================== */

function addRecord() {
  const date = $("recordDate").value || todayString();
  const amount = Number($("recordAmount").value) || 0;
  const ec = $("recordEC").value;
  const weather = $("recordWeather").value;
  const memo = $("recordMemo").value;

  records.push({
    date,
    amount,
    ec,
    weather,
    memo
  });

  saveData(false);
  renderRecords();

  $("recordAmount").value = "";
  $("recordEC").value = "";
  $("recordMemo").value = "";

  showToast("施肥実績を追加しました");
}

function renderRecords() {
  const tbody = $("recordTable").querySelector("tbody");
  tbody.innerHTML = "";

  if (!records.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">まだ記録がありません。</td>
      </tr>
    `;
    return;
  }

  records.forEach((record, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(record.date)}</td>
      <td>${Number(record.amount).toFixed(1)} L</td>
      <td>${record.ec ? escapeHTML(record.ec) + " mS/cm" : "—"}</td>
      <td>${escapeHTML(record.weather)}</td>
      <td>${escapeHTML(record.memo)}</td>
      <td>
        <button class="btn danger small delete-record" data-index="${index}">
          削除
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".delete-record").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);

      if (!confirm("この記録を削除しますか？")) return;

      records.splice(index, 1);
      saveData(false);
      renderRecords();
      showToast("記録を削除しました");
    });
  });
}

function clearRecords() {
  if (!records.length) {
    showToast("削除する記録がありません");
    return;
  }

  if (!confirm("施肥記録をすべて削除しますか？")) return;

  records = [];
  saveData(false);
  renderRecords();
  showToast("施肥記録を削除しました");
}

/* ==================== CSV出力 ==================== */

function exportCSV() {
  if (!currentPlan.length) {
    showToast("先に施肥計画を作成してください");
    return;
  }

  const headers = [
    "回",
    "予定日",
    "施肥方式",
    "1株液肥量(L)",
    "全体液肥量(L)",
    "実施",
    "メモ"
  ];

  const rows = currentPlan.map(item => [
    item.no,
    item.date,
    item.method,
    item.perPlant,
    item.total,
    item.done ? "済" : "未",
    item.memo
  ]);

  const csv = [headers, ...rows]
    .map(row =>
      row.map(value =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      ).join(",")
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "cucumber_fertilizer_plan.csv";
  a.click();

  URL.revokeObjectURL(url);
  showToast("CSVを出力しました");
}

/* ==================== UI ==================== */

function updateMethodCardStyles() {
  document.querySelectorAll(".method-card").forEach(card => {
    const input = card.querySelector("input");
    card.classList.toggle("selected", input.checked);
  });
}

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach(button => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  });

  document.querySelectorAll(".next-btn").forEach(button => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.next);
    });
  });

  document.querySelectorAll(".prev-btn").forEach(button => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.prev);
    });
  });

  document.querySelectorAll('input[name="fertilizerMethod"]').forEach(input => {
    input.addEventListener("change", () => {
      updateMethodCardStyles();
      saveData(false);
    });
  });

  document.querySelectorAll(
    'input[name="equipment"], input[name="managementMethod"]'
  ).forEach(input => {
    input.addEventListener("change", () => saveData(false));
  });

  document.querySelectorAll("input, select, textarea").forEach(element => {
    element.addEventListener("change", () => saveData(false));
  });

  $("saveBtn").addEventListener("click", () => saveData(true));
  $("loadBtn").addEventListener("click", loadData);

  $("generatePlanBtn").addEventListener("click", generatePlan);
  $("regenerateBtn").addEventListener("click", generatePlan);

  $("printBtn").addEventListener("click", () => window.print());
  $("printPlanBtn").addEventListener("click", () => window.print());

  $("exportCsvBtn").addEventListener("click", exportCSV);

  $("addRecordBtn").addEventListener("click", addRecord);
  $("clearRecordsBtn").addEventListener("click", clearRecords);
}

function initialize() {
  $("planStart").value = todayString();
  $("recordDate").value = todayString();

  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw) {
    try {
      applyData(JSON.parse(raw));
    } catch (error) {
      console.warn("保存データを読み込めませんでした。", error);
    }
  }

  updateMethodCardStyles();
  renderRecords();

  if (currentPlan.length) {
    renderPlan(currentPlan);
  }

  bindEvents();
}

document.addEventListener("DOMContentLoaded", initialize);
```

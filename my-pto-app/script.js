const STORAGE_KEYS = {
  premium: "ptoTrackerPremium",
  selectedDates: "ptoTrackerSelectedDates"
};

const state = {
  dailyHours: 8,
  periodHours: 80,
  ptoRate: 0.1234,
  currentBalance: 56.79,
  currentPeriodStart: new Date(2026, 2, 15), // 2026-03-15
  currentPeriodEnd: new Date(2026, 2, 28),   // 2026-03-28
  viewedMonth: new Date(2026, 2, 1),
  selectedDates: new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedDates) || "[]")),
  isPremium: JSON.parse(localStorage.getItem(STORAGE_KEYS.premium) || "false")
};

const els = {
  appRoot: document.getElementById("appRoot"),
  dailyHours: document.getElementById("dailyHours"),
  periodHours: document.getElementById("periodHours"),
  ptoRate: document.getElementById("ptoRate"),
  currentBalance: document.getElementById("currentBalance"),
  startMonth: document.getElementById("startMonth"),
  startDay: document.getElementById("startDay"),
  startYear: document.getElementById("startYear"),
  endMonth: document.getElementById("endMonth"),
  endDay: document.getElementById("endDay"),
  endYear: document.getElementById("endYear"),
  monthTitle: document.getElementById("monthTitle"),
  calendarGrid: document.getElementById("calendarGrid"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  premiumBtn: document.getElementById("premiumBtn")
};

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return stripTime(d);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fmt2(value) {
  return round2(value).toFixed(2);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(a, b) {
  return Math.round((stripTime(b) - stripTime(a)) / 86400000);
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function accrualAmount() {
  return state.periodHours * state.ptoRate;
}

/*
  Core rule:
  currentBalance is the value immediately before the current pay period starts.

  Period index:
  current pay period => 0
  next pay period    => 1
  previous           => -1
*/
function periodIndexForDate(date) {
  const delta = diffDays(state.currentPeriodStart, date);
  return Math.floor(delta / 14);
}

function countSelectedLeaveThrough(date) {
  let count = 0;

  state.selectedDates.forEach((key) => {
    const selectedDate = parseDateKey(key);
    if (
      stripTime(selectedDate) <= stripTime(date) &&
      periodIndexForDate(selectedDate) >= 0
    ) {
      count += 1;
    }
  });

  return count;
}

function projectedBalanceForDate(date) {
  const idx = periodIndexForDate(date);
  const base = state.currentBalance + idx * accrualAmount();
  const leaveHours = countSelectedLeaveThrough(date) * state.dailyHours;
  return round2(base - leaveHours);
}

function saveSelections() {
  localStorage.setItem(
    STORAGE_KEYS.selectedDates,
    JSON.stringify([...state.selectedDates])
  );
}

function savePremium() {
  localStorage.setItem(STORAGE_KEYS.premium, JSON.stringify(state.isPremium));
}

function populateSelect(select, start, end, selectedValue) {
  select.innerHTML = "";
  for (let i = start; i <= end; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    if (i === selectedValue) option.selected = true;
    select.appendChild(option);
  }
}

function buildDateSelectors() {
  populateSelect(els.startMonth, 1, 12, state.currentPeriodStart.getMonth() + 1);
  populateSelect(els.startDay, 1, 31, state.currentPeriodStart.getDate());
  populateSelect(els.startYear, 2024, 2035, state.currentPeriodStart.getFullYear());

  populateSelect(els.endMonth, 1, 12, state.currentPeriodEnd.getMonth() + 1);
  populateSelect(els.endDay, 1, 31, state.currentPeriodEnd.getDate());
  populateSelect(els.endYear, 2024, 2035, state.currentPeriodEnd.getFullYear());
}

function syncInputsFromState() {
  els.dailyHours.value = state.dailyHours;
  els.periodHours.value = state.periodHours;
  els.ptoRate.value = state.ptoRate;
  els.currentBalance.value = fmt2(state.currentBalance);
  buildDateSelectors();
  els.appRoot.classList.toggle("premium", state.isPremium);
}

function rebuildPayPeriodFromSelectors() {
  const start = new Date(
    Number(els.startYear.value),
    Number(els.startMonth.value) - 1,
    Number(els.startDay.value)
  );

  const end = new Date(
    Number(els.endYear.value),
    Number(els.endMonth.value) - 1,
    Number(els.endDay.value)
  );

  if (isNaN(start) || isNaN(end)) return;
  if (start > end) return;

  state.currentPeriodStart = stripTime(start);

  // Force bi-weekly 14-day cycle
  state.currentPeriodEnd = addDays(state.currentPeriodStart, 13);

  // Keep visible month aligned to current pay period month
  state.viewedMonth = new Date(
    state.currentPeriodStart.getFullYear(),
    state.currentPeriodStart.getMonth(),
    1
  );

  render();
}

function renderCalendar() {
  const month = state.viewedMonth.getMonth();
  const year = state.viewedMonth.getFullYear();
  const monthStart = new Date(year, month, 1);
  const currentPeriodMonthStart = new Date(
    state.currentPeriodStart.getFullYear(),
    state.currentPeriodStart.getMonth(),
    1
  );

  const showNumbers = monthStart >= currentPeriodMonthStart;

  els.monthTitle.textContent = monthStart
    .toLocaleString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();

  els.calendarGrid.innerHTML = "";

  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  weekdays.forEach((day) => {
    const div = document.createElement("div");
    div.className = "dow";
    div.textContent = day;
    els.calendarGrid.appendChild(div);
  });

  const firstDayOffset = monthStart.getDay();
  const gridStart = addDays(monthStart, -firstDayOffset);

  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    const key = dateKey(date);
    const inMonth = date.getMonth() === month;
    const inPayPeriod =
      stripTime(date) >= state.currentPeriodStart &&
      stripTime(date) <= state.currentPeriodEnd;

    const canToggle = periodIndexForDate(date) >= 0;

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day";

    if (!inMonth) cell.classList.add("other-month");
    if (!showNumbers) cell.classList.add("past-hidden");
    if (!canToggle) cell.classList.add("past-disabled");
    if (inPayPeriod) cell.classList.add("in-pay-period");
    if (state.selectedDates.has(key)) cell.classList.add("selected");

    const dayNum = document.createElement("div");
    dayNum.className = "day-number";
    dayNum.textContent = date.getDate();

    const balance = document.createElement("div");
    balance.className = "balance";
    balance.textContent = showNumbers ? fmt2(projectedBalanceForDate(date)) : "";

    cell.appendChild(dayNum);
    cell.appendChild(balance);

    cell.addEventListener("click", () => {
      if (!canToggle) return;

      if (state.selectedDates.has(key)) {
        state.selectedDates.delete(key);
      } else {
        state.selectedDates.add(key);
      }

      saveSelections();
      renderCalendar();
    });

    els.calendarGrid.appendChild(cell);
  }
}

function render() {
  syncInputsFromState();
  renderCalendar();
}

els.dailyHours.addEventListener("input", (e) => {
  state.dailyHours = Number(e.target.value) || 0;
  renderCalendar();
});

els.periodHours.addEventListener("input", (e) => {
  state.periodHours = Number(e.target.value) || 0;
  renderCalendar();
});

els.ptoRate.addEventListener("input", (e) => {
  state.ptoRate = Number(e.target.value) || 0;
  renderCalendar();
});

els.currentBalance.addEventListener("input", (e) => {
  state.currentBalance = Number(e.target.value) || 0;
  renderCalendar();
});

[
  els.startMonth,
  els.startDay,
  els.startYear,
  els.endMonth,
  els.endDay,
  els.endYear
].forEach((el) => {
  el.addEventListener("change", rebuildPayPeriodFromSelectors);
});

els.prevMonth.addEventListener("click", () => {
  state.viewedMonth = new Date(
    state.viewedMonth.getFullYear(),
    state.viewedMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

els.nextMonth.addEventListener("click", () => {
  state.viewedMonth = new Date(
    state.viewedMonth.getFullYear(),
    state.viewedMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

els.premiumBtn.addEventListener("click", () => {
  state.isPremium = true;
  savePremium();
  render();
});

render();
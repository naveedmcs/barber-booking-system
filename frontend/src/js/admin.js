import { Store } from "./store.js";

document.addEventListener("DOMContentLoaded", () => {
  Store.init();
  renderMetrics();
  renderShopsTable();
  renderAuditLogsTable();
  initSearch();
  initExportCsv();

  // Real-time synchronization
  Store.subscribe(() => {
    renderMetrics();
    renderShopsTable();
    renderAuditLogsTable();
  });
});

/* ---------------- METRICS RENDER ---------------- */
function renderMetrics() {
  const shops = Store.getShops();
  const activeShops = shops.filter((s) => s.status === "ACTIVE");

  let totalRev = 0;
  activeShops.forEach((s) => {
    if (s.plan === "YEARLY") totalRev += 200;
    else totalRev += 20;
  });

  const totalEl = document.getElementById("metric-total-shops");
  const activeEl = document.getElementById("metric-active-shops");
  const revEl = document.getElementById("metric-revenue");
  const appEl = document.getElementById("metric-approved");

  if (totalEl) totalEl.innerText = shops.length;
  if (activeEl) activeEl.innerText = activeShops.length;
  if (revEl) revEl.innerText = `${totalRev.toLocaleString()} SAR`;
  if (appEl) appEl.innerText = activeShops.length;
}

/* ---------------- SHOPS TABLE RENDER ---------------- */
function renderShopsTable(query = "") {
  const tbody = document.getElementById("shops-table-body");
  if (!tbody) return;

  const shops = Store.getShops();
  const filtered = shops.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.owner && s.owner.toLowerCase().includes(query.toLowerCase())) ||
      (s.phone && s.phone.includes(query))
  );

  tbody.innerHTML = filtered.map((s) => {
    const statusBadges = {
      ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      SUSPENDED: "bg-red-500/10 text-red-400 border-red-500/20",
    };

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-3.5 px-4 font-bold text-white flex items-center gap-2">
          <span>${s.name}</span>
          <a href="../book.html?slug=${s.slug}" target="_blank" class="text-[10px] text-[#F59E0B] underline hover:text-white">🔗 View Booking</a>
        </td>
        <td class="py-3.5 px-4 text-slate-300">${s.owner || "Owner"}</td>
        <td class="py-3.5 px-4 font-mono text-slate-400">${s.phone || "N/A"}</td>
        <td class="py-3.5 px-4 text-slate-400">${s.city || "Riyadh"}</td>
        <td class="py-3.5 px-4 font-bold text-[#F59E0B]">${s.plan || "MONTHLY"}</td>
        <td class="py-3.5 px-4">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadges[s.status] || statusBadges.ACTIVE}">
            ${s.status || "ACTIVE"}
          </span>
        </td>
        <td class="py-3.5 px-4 text-right space-x-2">
          ${s.status !== "ACTIVE" ? `
            <button data-id="${s.id}" class="approve-btn px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg transition">
              Approve / Reactivate
            </button>
          ` : `
            <button data-id="${s.id}" class="suspend-btn px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold border border-red-500/20 rounded-lg transition">
              Suspend
            </button>
          `}
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      Store.updateShopStatus(id, "ACTIVE");
      renderMetrics();
      renderShopsTable(query);
    });
  });

  tbody.querySelectorAll(".suspend-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      Store.updateShopStatus(id, "SUSPENDED");
      renderMetrics();
      renderShopsTable(query);
    });
  });
}

function initSearch() {
  document.getElementById("shop-search")?.addEventListener("input", (e) => {
    renderShopsTable(e.target.value);
  });
}

/* ---------------- AUDIT LOGS TABLE RENDER ---------------- */
function renderAuditLogsTable() {
  const tbody = document.getElementById("audit-table-body");
  if (!tbody) return;

  const auditLogs = Store.getAuditLogs();
  tbody.innerHTML = auditLogs.map((log) => `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="py-3.5 px-4 font-mono text-slate-400">${log.timestamp}</td>
      <td class="py-3.5 px-4 text-slate-300">${log.user}</td>
      <td class="py-3.5 px-4 font-bold text-white">${log.shop}</td>
      <td class="py-3.5 px-4 font-mono text-[#F59E0B] font-bold">${log.action}</td>
      <td class="py-3.5 px-4 text-slate-400 max-w-xs truncate">${log.details}</td>
      <td class="py-3.5 px-4 font-mono text-slate-500">${log.ip}</td>
    </tr>
  `).join("");
}

/* ---------------- CSV EXPORT ---------------- */
function initExportCsv() {
  document.getElementById("export-csv-btn")?.addEventListener("click", () => {
    const auditLogs = Store.getAuditLogs();
    const headers = "ID,Timestamp,User,Shop,Action,Details,IP Address\n";
    const rows = auditLogs.map(
      (l) => `${l.id},"${l.timestamp}","${l.user}","${l.shop}","${l.action}","${l.details}","${l.ip}"`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${Date.now()}.csv`;
    a.click();
  });
}


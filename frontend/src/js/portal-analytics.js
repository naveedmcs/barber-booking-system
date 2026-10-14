/**
 * Salon Portal - Revenue & Earnings Analytics Engine (/portal/dashboard & /portal/earnings)
 *
 * Implements:
 * 1. Daily Earnings (Today vs Yesterday comparison with % delta)
 * 2. Weekly Earnings (Current week breakdown Sunday-Saturday)
 * 3. Monthly Earnings (Current month trend vs previous month)
 * 4. Business Calculation Rules: STRICT FILTER calculating revenue ONLY from COMPLETED bookings
 * 5. Breakdown: Net service price, total bookings count, average ticket size, and top revenue-generating staff member
 * 6. Local Currency: SAR (ر.س) and Timezone: Asia/Riyadh (AST UTC+3)
 */

import { TenantContext } from "./tenant-context.js";

export const PortalAnalytics = {
  data: null,
  loading: false,

  /**
   * Render the complete analytics workspace inside container
   */
  async render(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="py-16 flex flex-col items-center justify-center space-y-4">
        <div class="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-mono text-slate-400">Loading salon revenue analytics (Asia/Riyadh)...</span>
      </div>
    `;

    try {
      const res = await TenantContext.tenantFetch("/api/portal/analytics/revenue");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load revenue analytics.");
      }

      this.data = await res.json();
      this.renderDashboard(container);
    } catch (err) {
      console.error("Analytics fetch error:", err);
      container.innerHTML = `
        <div class="bg-slate-900/90 border border-slate-800 p-8 rounded-3xl text-center space-y-4 max-w-xl mx-auto shadow-2xl">
          <div class="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center text-2xl mx-auto">⚠️</div>
          <div>
            <h3 class="text-base font-extrabold text-white">Analytics Unavailable</h3>
            <p class="text-xs text-slate-400 mt-1">${err.message || "Failed to compute financial metrics."}</p>
          </div>
          <button id="retry-analytics-btn" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition">
            🔄 Retry Calculation
          </button>
        </div>
      `;
      document.getElementById("retry-analytics-btn")?.addEventListener("click", () => this.render(container));
    }
  },

  renderDashboard(container) {
    const d = this.data;
    const currency = d.currency || "SAR";
    const timezone = d.timezone || "Asia/Riyadh";

    const formatSar = (val) => {
      const num = Number(val || 0);
      return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    };

    const renderDelta = (pct, label = "") => {
      if (pct === null || pct === undefined) {
        return `<span class="text-slate-500 text-[11px] font-mono font-bold">0.0% ${label}</span>`;
      }
      const num = Number(pct);
      if (num > 0) {
        return `<span class="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-mono font-bold"><span class="text-xs">↑</span> +${num.toFixed(1)}% ${label}</span>`;
      } else if (num < 0) {
        return `<span class="inline-flex items-center gap-1 text-rose-400 text-[11px] font-mono font-bold"><span class="text-xs">↓</span> ${num.toFixed(1)}% ${label}</span>`;
      } else {
        return `<span class="inline-flex items-center gap-1 text-slate-400 text-[11px] font-mono font-bold">0.0% ${label}</span>`;
      }
    };

    // Find max day revenue for bar chart scaling
    const breakdown = d.weeklyBreakdown || [];
    const maxDayRevenue = Math.max(...breakdown.map((b) => Number(b.revenue || 0)), 100);

    container.innerHTML = `
      <!-- Top Title & Controls Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">📊</span>
            <h2 class="text-xl sm:text-2xl font-black text-white tracking-tight">Revenue & Earnings Analytics</h2>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              OWNER EXCLUSIVE
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Real-time revenue intelligence, weekly velocity breakdowns, and staff performance metrics.</p>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <!-- Timezone & Currency Badge -->
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
            <span>🇸🇦</span>
            <span class="font-bold text-amber-400">${currency}</span>
            <span class="text-slate-500">•</span>
            <span>${timezone}</span>
          </div>

          <button id="refresh-analytics-btn" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition border border-slate-700 flex items-center gap-1.5 shadow">
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- Accounting Policy Banner -->
      <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3 shadow-md">
        <div class="flex items-center gap-3">
          <span class="text-xl shrink-0">⚖️</span>
          <div>
            <strong>Strict Financial Calculation Rule:</strong> Revenue metrics are computed <u>strictly</u> from bookings marked as <strong>COMPLETED</strong>. Pending, cancelled, or no-show bookings are excluded from gross and net earnings.
          </div>
        </div>
        <span class="hidden md:inline px-2 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
          ZATCA COMPLIANT
        </span>
      </div>

      <!-- KPI Summary Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Daily Earnings -->
        <div class="bg-slate-900/80 border border-slate-800/80 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Today's Earnings</span>
            <span class="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-sm font-bold">☀️</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-white tracking-tight">${formatSar(d.todayEarnings)}</div>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
              <span class="text-slate-400 text-[11px]">vs Yesterday (${formatSar(d.yesterdayEarnings)}):</span>
              ${renderDelta(d.dailyPercentChange)}
            </div>
          </div>
          <div class="text-[10px] font-mono text-slate-500">
            Completed Today: <strong class="text-white">${d.todayBookingsCount || 0}</strong> visits
          </div>
        </div>

        <!-- 2. Weekly Earnings -->
        <div class="bg-slate-900/80 border border-slate-800/80 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono text-sky-400 uppercase tracking-wider">Current Week</span>
            <span class="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center text-sm font-bold">📅</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-white tracking-tight">${formatSar(d.currentWeekEarnings)}</div>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
              <span class="text-slate-400 text-[11px]">vs Last Week (${formatSar(d.previousWeekEarnings)}):</span>
              ${renderDelta(d.weeklyPercentChange)}
            </div>
          </div>
          <div class="text-[10px] font-mono text-slate-500">
            Sunday – Saturday breakdown below
          </div>
        </div>

        <!-- 3. Monthly Earnings -->
        <div class="bg-slate-900/80 border border-slate-800/80 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Current Month</span>
            <span class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-sm font-bold">📈</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-white tracking-tight">${formatSar(d.currentMonthEarnings)}</div>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
              <span class="text-slate-400 text-[11px]">vs Prev Month (${formatSar(d.previousMonthEarnings)}):</span>
              ${renderDelta(d.monthlyPercentChange)}
            </div>
          </div>
          <div class="text-[10px] font-mono text-slate-500">
            Completed in Month: <strong class="text-white">${d.currentMonthBookingsCount || 0}</strong> visits
          </div>
        </div>

        <!-- 4. Ticket Size & All-Time Revenue -->
        <div class="bg-slate-900/80 border border-slate-800/80 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono text-purple-400 uppercase tracking-wider">Average Ticket Size</span>
            <span class="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-sm font-bold">🏷️</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-white tracking-tight">${formatSar(d.averageTicketSize)}</div>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
              <span class="text-slate-400 text-[11px]">Total Revenue:</span>
              <span class="text-amber-400 font-mono font-bold">${formatSar(d.totalCompletedRevenue)}</span>
            </div>
          </div>
          <div class="text-[10px] font-mono text-slate-500">
            Total Completed Bookings: <strong class="text-white">${d.totalCompletedBookings || 0}</strong>
          </div>
        </div>
      </div>

      <!-- Chart & Top Staff Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 7-Day Revenue Breakdown Chart (2 Cols) -->
        <div class="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 class="text-sm font-extrabold text-white flex items-center gap-2">
                <span>📅</span>
                <span>Current Week Daily Revenue Breakdown</span>
              </h3>
              <p class="text-[11px] text-slate-400">Day-by-day revenue generated from completed client services.</p>
            </div>
            <div class="text-xs font-mono text-slate-400">
              Total Week: <strong class="text-amber-400">${formatSar(d.currentWeekEarnings)}</strong>
            </div>
          </div>

          <!-- Bar Chart Container -->
          <div class="pt-6 pb-2">
            <div class="grid grid-cols-7 gap-2 sm:gap-3 items-end h-48 px-2">
              ${breakdown
                .map((day) => {
                  const rev = Number(day.revenue || 0);
                  const count = day.bookingsCount || 0;
                  const pct = Math.max(Math.round((rev / maxDayRevenue) * 100), 6);
                  const isPositive = rev > 0;
                  const isToday = day.date === new Date().toISOString().split("T")[0];

                  return `
                    <div class="flex flex-col items-center h-full justify-end group relative cursor-pointer">
                      <!-- Tooltip -->
                      <div class="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded-xl shadow-2xl pointer-events-none whitespace-nowrap">
                        <span class="text-[11px] font-bold text-amber-400">${rev.toFixed(2)} ${currency}</span>
                        <span class="text-[9px] font-mono text-slate-400">${count} completed visits (${day.date})</span>
                      </div>

                      <!-- Value above bar -->
                      <span class="text-[10px] font-mono font-bold ${isPositive ? "text-amber-400" : "text-slate-600"} mb-1 block group-hover:scale-110 transition truncate max-w-full text-center">
                        ${rev > 0 ? rev.toFixed(0) : "0"}
                      </span>

                      <!-- Visual Bar -->
                      <div class="w-full rounded-xl transition-all duration-300 ${
                        isToday
                          ? "bg-gradient-to-t from-amber-600 to-amber-400 border border-amber-300 shadow-lg shadow-amber-500/20"
                          : isPositive
                          ? "bg-gradient-to-t from-emerald-600/80 to-emerald-400/90 hover:from-emerald-500 hover:to-emerald-300"
                          : "bg-slate-800/40 hover:bg-slate-800"
                      }" style="height: ${pct}%;"></div>

                      <!-- Day Label -->
                      <div class="mt-2 text-center">
                        <span class="text-xs font-bold block ${isToday ? "text-amber-400" : "text-slate-300"}">${day.dayOfWeek.slice(0, 3)}</span>
                        <span class="text-[9px] font-mono text-slate-500 block">${day.date.split("-").slice(1).join("/")}</span>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-3 border-t border-slate-800">
            <span>Chart Scale: 0 to ${maxDayRevenue.toFixed(0)} ${currency}</span>
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-amber-400"></span> Today</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-emerald-500"></span> Prior Days</span>
            </div>
          </div>
        </div>

        <!-- Top Performer Barber Card (1 Col) -->
        <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-5">
          <div class="pb-3 border-b border-slate-800">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-extrabold text-white flex items-center gap-2">
                <span>👑</span>
                <span>Top Revenue Generator</span>
              </h3>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                #1 BARBER
              </span>
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5">Highest total gross bookings completed.</p>
          </div>

          ${
            d.topStaff
              ? `
            <div class="flex flex-col items-center text-center space-y-3 py-2">
              <div class="relative">
                <div class="w-24 h-24 rounded-3xl overflow-hidden border-2 border-amber-500/60 bg-slate-950 flex items-center justify-center shadow-2xl">
                  ${
                    d.topStaff.avatarUrl
                      ? `<img src="${d.topStaff.avatarUrl}" alt="${d.topStaff.name}" class="w-full h-full object-cover" />`
                      : `<div class="w-full h-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-300 font-black text-2xl flex items-center justify-center">${d.topStaff.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}</div>`
                  }
                </div>
                <div class="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-500 border-2 border-slate-900 text-slate-950 flex items-center justify-center text-sm font-black shadow-lg">
                  🏆
                </div>
              </div>

              <div>
                <h4 class="text-base font-extrabold text-white">${d.topStaff.name}</h4>
                <span class="text-xs text-amber-400/90 font-medium block mt-0.5">💈 ${d.topStaff.specialty || "Master Barber"}</span>
                <span class="text-[10px] font-mono text-slate-500">Staff ID #${d.topStaff.staffId}</span>
              </div>

              <!-- Metrics Pill Grid -->
              <div class="grid grid-cols-2 gap-3 w-full pt-2">
                <div class="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span class="text-[10px] font-mono uppercase text-slate-400 block">Revenue</span>
                  <span class="text-sm font-black text-emerald-400 font-mono mt-0.5 block">${formatSar(d.topStaff.totalRevenue)}</span>
                </div>
                <div class="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span class="text-[10px] font-mono uppercase text-slate-400 block">Completed</span>
                  <span class="text-sm font-black text-white font-mono mt-0.5 block">${d.topStaff.completedBookings} visits</span>
                </div>
              </div>
            </div>
          `
              : `
            <div class="py-12 text-center text-slate-500">
              <span class="text-3xl block mb-2">✂️</span>
              <p class="text-xs font-bold text-slate-400">No completed bookings recorded yet</p>
              <p class="text-[11px] text-slate-600 mt-1">Once appointments are completed, top staff member statistics will render here.</p>
            </div>
          `
          }

          <div class="pt-3 border-t border-slate-800 text-center">
            <a href="staff/index.html" class="text-xs font-bold text-amber-400 hover:text-amber-300 transition flex items-center justify-center gap-1">
              <span>View All Staff Performance</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Weekly Breakdown Data Table -->
      <div class="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div class="p-5 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-base">📋</span>
            <h3 class="text-sm font-extrabold text-white">Daily Breakdown Audit Table (Current Week)</h3>
          </div>
          <span class="text-[11px] font-mono text-slate-400">Calculated strictly on COMPLETED appointments</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-950/60 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <th class="py-3 px-5">Day of Week</th>
                <th class="py-3 px-5">Calendar Date</th>
                <th class="py-3 px-5">Completed Bookings</th>
                <th class="py-3 px-5">Gross Revenue</th>
                <th class="py-3 px-5">Avg Ticket</th>
                <th class="py-3 px-5 text-right">Audit Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50 text-xs">
              ${breakdown
                .map((day) => {
                  const rev = Number(day.revenue || 0);
                  const count = day.bookingsCount || 0;
                  const avg = count > 0 ? rev / count : 0;
                  const isToday = day.date === new Date().toISOString().split("T")[0];

                  return `
                    <tr class="hover:bg-slate-800/30 transition ${isToday ? "bg-amber-500/5" : ""}">
                      <td class="py-3.5 px-5 font-bold ${isToday ? "text-amber-400" : "text-white"}">
                        ${day.dayOfWeek} ${isToday ? `<span class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300">Today</span>` : ""}
                      </td>
                      <td class="py-3.5 px-5 font-mono text-slate-400">${day.date}</td>
                      <td class="py-3.5 px-5 font-mono font-bold text-slate-200">${count} visits</td>
                      <td class="py-3.5 px-5 font-mono font-black ${rev > 0 ? "text-emerald-400" : "text-slate-500"}">${formatSar(rev)}</td>
                      <td class="py-3.5 px-5 font-mono text-slate-400">${count > 0 ? formatSar(avg) : "—"}</td>
                      <td class="py-3.5 px-5 text-right">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          count > 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-500 border border-slate-700"
                        }">
                          ${count > 0 ? "AUDITED" : "NO SESSIONS"}
                        </span>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("refresh-analytics-btn")?.addEventListener("click", () => this.render(container));
  }
};

/**
 * UI Primitive: Toast Notification Manager
 */

export function showToast(message, type = "success", durationMs = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const isErr = type === "error";
  const isWarn = type === "warning";

  const bgBorder = isErr
    ? "bg-red-950/90 border-red-500/50 text-red-200"
    : isWarn
    ? "bg-amber-950/90 border-amber-500/50 text-amber-200"
    : "bg-slate-900/95 border-[#F59E0B]/50 text-slate-100";

  const icon = isErr ? "❌" : isWarn ? "⚠️" : "✅";

  toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl border ${bgBorder} backdrop-blur-md shadow-2xl text-xs font-semibold pointer-events-auto transition-all duration-300 transform translate-x-4 opacity-0`;
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove("translate-x-4", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("translate-x-4", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

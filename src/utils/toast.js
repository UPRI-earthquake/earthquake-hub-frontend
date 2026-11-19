export function emitToast(message, type = 'info') {
  if (!message || !String(message).trim()) return;
  try {
    if (typeof window !== 'undefined') {
      const q = (window.__toastQueue = window.__toastQueue || []);
      q.push({ message, type, t: Date.now() });
      if (q.length > 10) q.splice(0, q.length - 10);
    }
    window.dispatchEvent(new CustomEvent('ui:toast', { detail: { message, type } }));
  } catch (_) {
    try { alert(message); } catch (_) {}
  }
}

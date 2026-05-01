// Drag-reorder helpers, used by track lists and the queue panel.
// Mostly a 1:1 port of the inline drag handlers in trackRow.js / queue.js,
// extracted so components can stay declarative.
import { ref } from 'vue';

const draggedTrackId = ref(null);

export function useTrackDrag(onReorder) {
  function clearMarkers() {
    document.querySelectorAll('.track.drop-above, .track.drop-below').forEach((el) => {
      el.classList.remove('drop-above', 'drop-below');
    });
  }

  function bind(rowEl, trackId) {
    if (!rowEl || !onReorder) return;
    rowEl.setAttribute('draggable', 'true');
    rowEl.addEventListener('dragstart', (e) => {
      draggedTrackId.value = trackId;
      rowEl.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', trackId); } catch {}
    });
    rowEl.addEventListener('dragend', () => {
      rowEl.classList.remove('is-dragging');
      clearMarkers();
      draggedTrackId.value = null;
    });
    rowEl.addEventListener('dragover', (e) => {
      if (!draggedTrackId.value || draggedTrackId.value === trackId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = rowEl.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      clearMarkers();
      rowEl.classList.add(above ? 'drop-above' : 'drop-below');
    });
    rowEl.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && rowEl.contains(e.relatedTarget)) return;
      rowEl.classList.remove('drop-above', 'drop-below');
    });
    rowEl.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!draggedTrackId.value || draggedTrackId.value === trackId) return;
      const rect = rowEl.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      const dragged = draggedTrackId.value;
      clearMarkers();
      draggedTrackId.value = null;
      onReorder(dragged, trackId, above);
    });
  }

  return { bind };
}

// Simple queue-item drag (uses queue indices via dataTransfer).
export function useQueueDrag(onReorder) {
  function bind(itemEl, qIdx) {
    if (!itemEl) return;
    itemEl.setAttribute('draggable', 'true');
    itemEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(qIdx));
      itemEl.classList.add('is-dragging');
    });
    itemEl.addEventListener('dragend', () => {
      itemEl.classList.remove('is-dragging');
      document.querySelectorAll('.queue-item.drop-above, .queue-item.drop-below').forEach((el) => {
        el.classList.remove('drop-above', 'drop-below');
      });
    });
    itemEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = itemEl.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      document.querySelectorAll('.queue-item.drop-above, .queue-item.drop-below').forEach((el) => {
        el.classList.remove('drop-above', 'drop-below');
      });
      itemEl.classList.add(above ? 'drop-above' : 'drop-below');
    });
    itemEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (isNaN(fromIdx) || fromIdx === qIdx) return;
      const rect = itemEl.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      const targetIdx = above ? qIdx : qIdx + 1;
      onReorder(fromIdx, targetIdx);
    });
  }
  return { bind };
}

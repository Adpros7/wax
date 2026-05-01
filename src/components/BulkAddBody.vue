<script setup>
import { computed, ref } from 'vue';
import { fmtDuration } from '@/lib/format';
import { modalState } from '@/lib/modal';

const props = defineProps({
  available: { type: Array, required: true },
  selection: { type: Set, required: true },
});

const filter = ref('');

const visible = computed(() => {
  if (!filter.value) return props.available;
  const q = filter.value.toLowerCase();
  return props.available.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      (t.uploader || '').toLowerCase().includes(q),
  );
});

const counter = computed(() => {
  const n = props.selection.size;
  return `${n} sélectionnée${n > 1 ? 's' : ''} sur ${props.available.length}`;
});

const _bumpKey = ref(0);

function bump() {
  // Trigger reactivity since Set mutations don't auto-track via getters here.
  _bumpKey.value++;
  modalState.confirmEnabled = props.selection.size > 0;
  modalState.confirmLabel = props.selection.size === 0 ? 'Ajouter' : `Ajouter ${props.selection.size}`;
}

function toggleTrack(t) {
  if (props.selection.has(t.id)) props.selection.delete(t.id);
  else props.selection.add(t.id);
  bump();
}

function selectAllVisible() {
  for (const t of visible.value) props.selection.add(t.id);
  bump();
}
function selectNoneVisible() {
  for (const t of visible.value) props.selection.delete(t.id);
  bump();
}

// Initialize button label
bump();
</script>

<template>
  <div class="bulk-wrap">
    <div class="bulk-header">
      <input
        type="text"
        class="bulk-search"
        placeholder="Filtrer la bibliothèque..."
        v-model="filter"
      />
      <button type="button" class="link-btn" @click="selectAllVisible">Tout</button>
      <button type="button" class="link-btn" @click="selectNoneVisible">Aucun</button>
    </div>
    <div class="bulk-header" style="border-bottom: none; padding-bottom: 0">
      <span class="muted">{{ counter }}</span>
      <span :hidden="true">{{ _bumpKey }}</span>
    </div>
    <ul class="bulk-track-list">
      <p v-if="visible.length === 0" class="empty-state">Aucun résultat</p>
      <li
        v-for="t in visible"
        :key="t.id"
        class="bulk-track-item"
        @click="toggleTrack(t)"
      >
        <input
          type="checkbox"
          :checked="selection.has(t.id)"
          @click.stop="toggleTrack(t)"
        />
        <img :src="t.thumbnail || ''" alt="" loading="lazy" />
        <div class="bulk-track-meta">
          <div class="bulk-track-title">{{ t.title }}</div>
          <div class="bulk-track-sub">{{ t.uploader || '' }}</div>
        </div>
        <span class="bulk-track-duration">{{ fmtDuration(t.duration) }}</span>
      </li>
    </ul>
  </div>
</template>

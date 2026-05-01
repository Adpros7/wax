<script setup>
import { computed } from 'vue';
import { ACCENT_PRESETS, useAccentStore } from '@/stores/accent';
import { usePrefsStore } from '@/stores/prefs';

const prefs = usePrefsStore();
const accent = useAccentStore();

function setMode(mode) {
  prefs.accentMode = mode;
  prefs.save();
  accent.applyUserAccent();
}

function setColor(hex) {
  prefs.accentMode = 'custom';
  prefs.accentColor = hex;
  prefs.save();
  accent.applyUserAccent();
}

const gridStyle = computed(() => ({
  opacity: prefs.accentMode === 'custom' ? '1' : '0.4',
  pointerEvents: prefs.accentMode === 'custom' ? 'auto' : 'none',
}));
</script>

<template>
  <div>
    <div class="settings-section">
      <h4>Couleur d'accent</h4>
      <p class="settings-help">
        Auto adapte la palette à la pochette en cours. Personnalisée fixe une couleur permanente.
      </p>
    </div>
    <div class="settings-mode-row">
      <button
        type="button"
        class="settings-mode"
        :class="{ active: prefs.accentMode === 'auto' }"
        @click="setMode('auto')"
      >
        Auto · pochette
      </button>
      <button
        type="button"
        class="settings-mode"
        :class="{ active: prefs.accentMode === 'custom' }"
        @click="setMode('custom')"
      >
        Personnalisée
      </button>
    </div>
    <h4 class="settings-subhead">Couleurs préréglées</h4>
    <div class="color-grid" :style="gridStyle">
      <button
        v-for="p in ACCENT_PRESETS"
        :key="p.hex"
        type="button"
        class="color-swatch"
        :class="{ active: prefs.accentColor === p.hex }"
        :style="{ background: p.hex }"
        :title="p.name"
        :aria-label="p.name"
        @click="setColor(p.hex)"
      ></button>
    </div>
  </div>
</template>

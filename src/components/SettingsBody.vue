<script setup>
import { computed, ref, watch } from 'vue';
import { ACCENT_PRESETS, useAccentStore } from '@/stores/accent';
import { usePrefsStore } from '@/stores/prefs';
import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { darkThemes, lightThemes } from '@/lib/themes';
import { setEq } from '@/composables/useVisualizer';
import { showToast } from '@/lib/toast';

const prefs = usePrefsStore();
const accent = useAccentStore();
const lib = useLibraryStore();
const pls = usePlaylistsStore();

function swatchStyle(t) {
  return {
    '--swatch-bg': t.swatch[0],
    '--swatch-card': t.swatch[1],
    '--swatch-accent': t.swatch[2],
  };
}

const themesDark = darkThemes();
const themesLight = lightThemes();

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

// EQ
const eqBass = ref(prefs.eq.bass);
const eqMid = ref(prefs.eq.mid);
const eqTreble = ref(prefs.eq.treble);

watch([eqBass, eqMid, eqTreble], ([b, m, t]) => {
  setEq(b, m, t);
  prefs.eq = { bass: b, mid: m, treble: t };
  prefs.save();
});

function resetEq() {
  eqBass.value = 0;
  eqMid.value = 0;
  eqTreble.value = 0;
}

// Orphans
const orphanCount = computed(() => {
  const playlistTrackIds = new Set(pls.items.flatMap((pl) => pl.trackIds));
  return lib.tracks.filter((t) => t.liked === false && !playlistTrackIds.has(t.id)).length;
});

const purging = ref(false);

async function purge() {
  purging.value = true;
  try {
    const n = await lib.purgeOrphans();
    showToast(n > 0 ? `${n} piste${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''}` : 'Rien à nettoyer', 'success');
  } finally {
    purging.value = false;
  }
}
</script>

<template>
  <div>
    <!-- Thème -->
    <div class="settings-section">
      <h4>Apparence</h4>
      <p class="settings-help">Sélectionne un thème — sombre ou clair, doux ou contrasté.</p>
    </div>
    <h5 class="settings-subhead">Sombres</h5>
    <div class="theme-grid">
      <button
        v-for="t in themesDark"
        :key="t.id"
        type="button"
        class="theme-card"
        :class="{ active: prefs.themeId === t.id }"
        :style="swatchStyle(t)"
        :title="t.label"
        :aria-label="t.label"
        @click="prefs.setTheme(t.id)"
      >
        <span class="theme-swatch"></span>
        <span class="theme-label">{{ t.label }}</span>
      </button>
    </div>
    <h5 class="settings-subhead settings-subhead--spaced">Clairs</h5>
    <div class="theme-grid">
      <button
        v-for="t in themesLight"
        :key="t.id"
        type="button"
        class="theme-card"
        :class="{ active: prefs.themeId === t.id }"
        :style="swatchStyle(t)"
        :title="t.label"
        :aria-label="t.label"
        @click="prefs.setTheme(t.id)"
      >
        <span class="theme-swatch"></span>
        <span class="theme-label">{{ t.label }}</span>
      </button>
    </div>

    <!-- Accent -->
    <div class="settings-section settings-section--top-border">
      <h4>Couleur d'accent</h4>
      <p class="settings-help">
        Auto adapte la palette à la pochette en cours. Personnalisée fixe une couleur permanente.
      </p>
    </div>
    <div class="settings-mode-row">
      <button type="button" class="settings-mode" :class="{ active: prefs.accentMode === 'auto' }" @click="setMode('auto')">
        Auto · pochette
      </button>
      <button type="button" class="settings-mode" :class="{ active: prefs.accentMode === 'custom' }" @click="setMode('custom')">
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

    <!-- EQ -->
    <div class="settings-section settings-section--top-border">
      <h4>Égaliseur</h4>
      <p class="settings-help">Ajuste le rendu audio en temps réel (±12 dB).</p>
    </div>
    <div class="eq-grid">
      <label class="eq-band">
        <span class="eq-label">Basses</span>
        <input type="range" min="-12" max="12" step="0.5" v-model.number="eqBass" class="eq-slider" />
        <span class="eq-value">{{ eqBass > 0 ? '+' : '' }}{{ eqBass }}</span>
      </label>
      <label class="eq-band">
        <span class="eq-label">Médiums</span>
        <input type="range" min="-12" max="12" step="0.5" v-model.number="eqMid" class="eq-slider" />
        <span class="eq-value">{{ eqMid > 0 ? '+' : '' }}{{ eqMid }}</span>
      </label>
      <label class="eq-band">
        <span class="eq-label">Aigus</span>
        <input type="range" min="-12" max="12" step="0.5" v-model.number="eqTreble" class="eq-slider" />
        <span class="eq-value">{{ eqTreble > 0 ? '+' : '' }}{{ eqTreble }}</span>
      </label>
    </div>
    <button
      type="button"
      class="settings-clean-btn"
      :disabled="eqBass === 0 && eqMid === 0 && eqTreble === 0"
      style="margin-top: 10px"
      @click="resetEq"
    >
      Réinitialiser l'EQ
    </button>

    <!-- Bibliothèque -->
    <div class="settings-section settings-section--top-border">
      <h4>Bibliothèque</h4>
      <p class="settings-help">
        Les pistes ajoutées automatiquement (via Mix) sans être dans une playlist s'accumulent silencieusement.
      </p>
      <div class="settings-clean-row">
        <span class="settings-orphan-count">{{ orphanCount }} piste{{ orphanCount !== 1 ? 's' : '' }} orpheline{{ orphanCount !== 1 ? 's' : '' }}</span>
        <button
          type="button"
          class="settings-clean-btn"
          :disabled="orphanCount === 0 || purging"
          @click="purge"
        >
          {{ purging ? 'Nettoyage…' : 'Nettoyer' }}
        </button>
      </div>
    </div>
  </div>
</template>

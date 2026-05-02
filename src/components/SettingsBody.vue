<script setup>
import { computed, ref, watch } from 'vue';
import { usePrefsStore } from '@/stores/prefs';
import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { darkThemes, lightThemes } from '@/lib/themes';
import { setEq } from '@/composables/useVisualizer';
import { showToast } from '@/lib/toast';
import { t, SUPPORTED_LOCALES } from '@/lib/i18n';

const prefs = usePrefsStore();
const lib = useLibraryStore();
const pls = usePlaylistsStore();

// Tabs
const TABS = [
  { id: 'appearance', labelKey: 'settings.tabs.appearance' },
  { id: 'equalizer',  labelKey: 'settings.tabs.equalizer' },
  { id: 'general',    labelKey: 'settings.tabs.general' },
];
const activeTab = ref('appearance');

// Theme
function swatchStyle(t) {
  return {
    '--swatch-bg': t.swatch[0],
    '--swatch-card': t.swatch[1],
    '--swatch-accent': t.swatch[2],
  };
}
const themesDark = darkThemes();
const themesLight = lightThemes();

// EQ
const eqBass = ref(prefs.eq.bass);
const eqMid = ref(prefs.eq.mid);
const eqTreble = ref(prefs.eq.treble);

watch([eqBass, eqMid, eqTreble], ([b, m, tr]) => {
  setEq(b, m, tr);
  prefs.eq = { bass: b, mid: m, treble: tr };
  prefs.save();
});

function resetEq() {
  eqBass.value = 0;
  eqMid.value = 0;
  eqTreble.value = 0;
}

// Crossfade
function onCrossfadeToggle(e) {
  prefs.crossfadeEnabled = e.target.checked;
  prefs.save();
}
function onCrossfadeDuration(e) {
  prefs.crossfadeDuration = parseFloat(e.target.value);
  prefs.save();
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
    showToast(
      n > 0 ? t('settings.library.clean_done', n) : t('settings.library.clean_nothing'),
      'success',
    );
  } finally {
    purging.value = false;
  }
}
</script>

<template>
  <div class="settings-body">
    <!-- Tabs -->
    <div class="settings-tabs" role="tablist">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        class="settings-tab"
        :class="{ active: activeTab === tab.id }"
        role="tab"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>

    <!-- Appearance tab -->
    <section v-show="activeTab === 'appearance'" class="settings-pane">
      <p class="settings-help">{{ t('settings.appearance.help') }}</p>
      <h5 class="settings-subhead">{{ t('settings.appearance.dark') }}</h5>
      <div class="theme-grid">
        <button
          v-for="th in themesDark"
          :key="th.id"
          type="button"
          class="theme-card"
          :class="{ active: prefs.themeId === th.id }"
          :style="swatchStyle(th)"
          :title="th.label"
          :aria-label="th.label"
          @click="prefs.setTheme(th.id)"
        >
          <span class="theme-swatch"></span>
          <span class="theme-label">{{ th.label }}</span>
        </button>
      </div>
      <h5 class="settings-subhead settings-subhead--spaced">{{ t('settings.appearance.light') }}</h5>
      <div class="theme-grid">
        <button
          v-for="th in themesLight"
          :key="th.id"
          type="button"
          class="theme-card"
          :class="{ active: prefs.themeId === th.id }"
          :style="swatchStyle(th)"
          :title="th.label"
          :aria-label="th.label"
          @click="prefs.setTheme(th.id)"
        >
          <span class="theme-swatch"></span>
          <span class="theme-label">{{ th.label }}</span>
        </button>
      </div>
    </section>

    <!-- Equalizer tab -->
    <section v-show="activeTab === 'equalizer'" class="settings-pane">
      <p class="settings-help">{{ t('settings.eq.help') }}</p>
      <div class="eq-grid">
        <label class="eq-band">
          <span class="eq-label">{{ t('settings.eq.bass') }}</span>
          <input type="range" min="-12" max="12" step="0.5" v-model.number="eqBass" class="eq-slider" />
          <span class="eq-value">{{ eqBass > 0 ? '+' : '' }}{{ eqBass }}</span>
        </label>
        <label class="eq-band">
          <span class="eq-label">{{ t('settings.eq.mid') }}</span>
          <input type="range" min="-12" max="12" step="0.5" v-model.number="eqMid" class="eq-slider" />
          <span class="eq-value">{{ eqMid > 0 ? '+' : '' }}{{ eqMid }}</span>
        </label>
        <label class="eq-band">
          <span class="eq-label">{{ t('settings.eq.treble') }}</span>
          <input type="range" min="-12" max="12" step="0.5" v-model.number="eqTreble" class="eq-slider" />
          <span class="eq-value">{{ eqTreble > 0 ? '+' : '' }}{{ eqTreble }}</span>
        </label>
      </div>
      <button
        type="button"
        class="settings-clean-btn"
        :disabled="eqBass === 0 && eqMid === 0 && eqTreble === 0"
        style="margin-top: 14px"
        @click="resetEq"
      >
        {{ t('settings.eq.reset') }}
      </button>
    </section>

    <!-- General tab -->
    <section v-show="activeTab === 'general'" class="settings-pane">
      <!-- Crossfade -->
      <div class="settings-section">
        <h4>{{ t('settings.crossfade.title') }}</h4>
        <p class="settings-help">{{ t('settings.crossfade.help') }}</p>
      </div>
      <label class="settings-toggle-row">
        <span>{{ t('settings.crossfade.enable') }}</span>
        <input
          type="checkbox"
          class="settings-toggle"
          :checked="prefs.crossfadeEnabled"
          @change="onCrossfadeToggle"
        />
      </label>
      <label class="eq-band" :class="{ 'is-disabled': !prefs.crossfadeEnabled }" style="margin-top: 10px">
        <span class="eq-label">{{ t('settings.crossfade.duration') }}</span>
        <input
          type="range"
          min="1"
          max="12"
          step="0.5"
          :value="prefs.crossfadeDuration"
          :disabled="!prefs.crossfadeEnabled"
          @input="onCrossfadeDuration"
        />
        <span class="eq-value">{{ prefs.crossfadeDuration }} s</span>
      </label>

      <!-- Language -->
      <div class="settings-section settings-section--top-border">
        <h4>{{ t('settings.language.title') }}</h4>
        <p class="settings-help">{{ t('settings.language.help') }}</p>
      </div>
      <div class="settings-mode-row">
        <button
          v-for="loc in SUPPORTED_LOCALES"
          :key="loc.id"
          type="button"
          class="settings-mode"
          :class="{ active: prefs.locale === loc.id }"
          @click="prefs.setLocale(loc.id)"
        >
          {{ loc.label }}
        </button>
      </div>

      <!-- Library cleanup -->
      <div class="settings-section settings-section--top-border">
        <h4>{{ t('settings.library.title') }}</h4>
        <p class="settings-help">{{ t('settings.library.help') }}</p>
        <div class="settings-clean-row">
          <span class="settings-orphan-count">{{ t('settings.library.orphans', orphanCount) }}</span>
          <button
            type="button"
            class="settings-clean-btn"
            :disabled="orphanCount === 0 || purging"
            @click="purge"
          >
            {{ purging ? t('settings.library.cleaning') : t('settings.library.clean') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

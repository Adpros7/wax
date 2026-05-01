<script setup>
import { computed, watch, ref, nextTick } from 'vue';
import { modalState, closeModal, confirmFromModal } from '@/lib/modal';

const inputRef = ref(null);

const isPrompt = computed(() => modalState.variant === 'prompt');
const isConfirm = computed(() => modalState.variant === 'confirm');
const isLyrics = computed(() => modalState.variant === 'lyrics');
const isComponent = computed(() => modalState.variant === 'component');

function onPromptKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    confirmFromModal();
  }
}

watch(
  () => modalState.visible,
  async (vis) => {
    if (vis && isPrompt.value) {
      await nextTick();
      inputRef.value?.focus();
      inputRef.value?.select();
    }
  },
);
</script>

<template>
  <div class="modal" v-show="modalState.visible">
    <div class="modal-overlay" @click="closeModal"></div>
    <div class="modal-content" :class="{ wide: modalState.wide }">
      <h3>{{ modalState.title }}</h3>
      <div class="modal-body">
        <p v-if="isConfirm" class="modal-message">{{ modalState.message }}</p>
        <div v-else-if="isPrompt">
          <p
            v-if="modalState.promptLabel"
            class="modal-message"
            style="margin-bottom: 12px"
          >
            {{ modalState.promptLabel }}
          </p>
          <input
            ref="inputRef"
            type="text"
            v-model="modalState.promptValue"
            :placeholder="modalState.promptPlaceholder"
            maxlength="100"
            @keydown="onPromptKey"
          />
        </div>
        <div v-else-if="isLyrics">
          <div class="lyrics-meta">
            {{ modalState.lyricsArtist }} — {{ modalState.lyricsTitle }}
          </div>
          <pre
            class="lyrics-content"
            :class="{
              placeholder: modalState.lyricsStatus === 'loading',
              error: modalState.lyricsStatus === 'error',
            }"
          >{{ modalState.lyricsContent }}</pre>
        </div>
        <component
          v-else-if="isComponent && modalState.component"
          :is="modalState.component"
          v-bind="modalState.componentProps || {}"
        />
      </div>
      <div class="modal-actions">
        <button class="secondary-btn" @click="closeModal">
          {{ modalState.cancelLabel || 'Annuler' }}
        </button>
        <button
          v-if="modalState.onConfirm"
          class="primary-btn"
          :class="{ danger: modalState.danger }"
          :disabled="modalState.confirmEnabled === false"
          @click="confirmFromModal"
        >
          {{ modalState.confirmLabel || 'OK' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ job: { type: Object, required: true } });

const isConv = computed(() => props.job.phase === 'converting');

const statusLabel = computed(() => {
  if (props.job.status === 'error') return 'Erreur';
  if (props.job.status === 'success') return 'Terminé';
  if (isConv.value) return 'Conversion';
  if (props.job.phase === 'starting') return 'Démarrage';
  return `${Math.round(props.job.progress)}%`;
});

const statusClass = computed(() => {
  if (props.job.status === 'error') return 'error';
  if (props.job.status === 'success') return 'success';
  return '';
});

const fillStyle = computed(() => ({
  width: `${props.job.status === 'error' ? 0 : props.job.progress}%`,
}));
</script>

<template>
  <div class="job" :class="{ 'is-converting': isConv }">
    <div class="job-head">
      <span class="job-title">{{ job.title }}</span>
      <span class="job-status" :class="statusClass">{{ statusLabel }}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" :style="fillStyle"></div>
    </div>
  </div>
</template>

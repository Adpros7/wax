<script setup>
import { computed } from 'vue';
import { t } from '@/lib/i18n';

const props = defineProps({ job: { type: Object, required: true } });

const isConv = computed(() => props.job.phase === 'converting');

const statusLabel = computed(() => {
  if (props.job.status === 'error') return t('job.error');
  if (props.job.status === 'success') return t('job.success');
  if (isConv.value) return t('job.converting');
  if (props.job.phase === 'starting') return t('job.preparing');
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

<script setup>
import { toastState } from '@/lib/toast';
</script>

<template>
  <div id="toast" :class="['toast', toastState.kind]" v-show="toastState.visible">
    {{ toastState.message }}
  </div>
</template>

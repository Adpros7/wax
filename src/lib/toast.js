// Imperative toast bus — lets non-Vue modules (event listeners, async
// callbacks) push notifications. The Toast.vue component subscribes.
import { reactive } from 'vue';

export const toastState = reactive({
  visible: false,
  message: '',
  kind: '',
});

let timer = null;

export function showToast(message, kind = '') {
  toastState.message = message;
  toastState.kind = kind;
  toastState.visible = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    toastState.visible = false;
  }, 2800);
}

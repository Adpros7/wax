// Imperative modal bus. Stores call `openModal` / `confirmModal` /
// `promptModal` as if they were old-school imperative APIs; the
// <ModalRoot> component subscribes and renders.
//
// Label fallbacks: every helper here leaves `confirmLabel` / `cancelLabel`
// empty by default. ModalRoot.vue resolves the missing labels at render
// time via `modalState.X || t('common.X')`, so they always follow the
// active locale — no module-load freeze of the translation.
import { reactive, markRaw } from 'vue';
import { t } from './i18n';

export const modalState = reactive({
  visible: false,
  title: '',
  message: '',           // for confirm
  promptLabel: '',
  promptDefault: '',
  promptPlaceholder: '',
  variant: 'generic',    // 'confirm' | 'prompt' | 'component' | 'lyrics' | 'settings' | 'bulk'
  confirmLabel: '',
  cancelLabel: '',
  danger: false,
  wide: false,
  // Component variant — render any Vue component as the body
  component: null,
  componentProps: null,
  // Resolution callbacks (set by the helpers below)
  onConfirm: null,
  onCancel: null,
  // For prompt
  promptValue: '',
  // For bulk modal we sometimes need to override confirm enabled state
  confirmEnabled: true,
});

export function closeModal() {
  modalState.visible = false;
  modalState.component = null;
  modalState.componentProps = null;
  if (modalState.onCancel) {
    const cb = modalState.onCancel;
    modalState.onCancel = null;
    modalState.onConfirm = null;
    cb();
  } else {
    modalState.onConfirm = null;
  }
}

export function confirmFromModal() {
  // Detach the confirm callback before invoking — but keep onCancel intact
  // in case the callback re-arms (empty prompt input).
  const cb = modalState.onConfirm;
  const cancelBackup = modalState.onCancel;
  modalState.onConfirm = null;
  modalState.onCancel = null;
  if (!cb) return;
  cb();
  if (!modalState.onConfirm) {
    // Genuine confirm — close.
    modalState.visible = false;
    modalState.component = null;
    modalState.componentProps = null;
  } else {
    // Re-armed (e.g. prompt with empty value) — restore the cancel binding
    // so the overlay/escape paths still resolve the promise with null.
    modalState.onCancel = cancelBackup;
  }
}

export function confirmModal({ title, message, confirmLabel = '', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    Object.assign(modalState, {
      visible: true,
      variant: 'confirm',
      title,
      message,
      confirmLabel,
      cancelLabel: '',
      danger,
      wide: false,
      component: null,
      componentProps: null,
      onConfirm: () => finish(true),
      onCancel: () => finish(false),
    });
  });
}

export function promptModal({ title, label = '', defaultValue = '', placeholder = '', confirmLabel = '' }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const tryConfirm = () => {
      const v = (modalState.promptValue || '').trim();
      if (!v) {
        // Empty value — re-arm so a subsequent click works once the input
        // gets text.
        modalState.onConfirm = tryConfirm;
        return;
      }
      finish(v);
    };
    Object.assign(modalState, {
      visible: true,
      variant: 'prompt',
      title,
      promptLabel: label,
      promptDefault: defaultValue,
      promptValue: defaultValue,
      promptPlaceholder: placeholder,
      confirmLabel,
      cancelLabel: '',
      danger: false,
      wide: false,
      component: null,
      componentProps: null,
      onConfirm: tryConfirm,
      onCancel: () => finish(null),
    });
  });
}

// Generic component-body modal. The component is mounted into the modal
// shell and receives `componentProps`. The caller controls confirm.
export function openComponentModal({
  title,
  component,
  componentProps = {},
  confirmLabel = '',
  danger = false,
  wide = false,
  onConfirm,
  onClose,
}) {
  Object.assign(modalState, {
    visible: true,
    variant: 'component',
    title,
    confirmLabel,
    cancelLabel: '',
    danger,
    wide,
    component: markRaw(component),
    componentProps,
    confirmEnabled: true,
    onConfirm: onConfirm || null,
    onCancel: onClose || null,
  });
}

// Lyrics is a special async modal — keep its own helper for clarity.
export function openLyricsModal({ artist, title, status, content }) {
  Object.assign(modalState, {
    visible: true,
    variant: 'lyrics',
    title: t('lyrics.title'),
    lyricsArtist: artist,
    lyricsTitle: title,
    lyricsStatus: status,
    lyricsContent: content,
    confirmLabel: '',
    cancelLabel: t('common.close'),
    wide: true,
    component: null,
    componentProps: null,
    onConfirm: null,
    onCancel: null,
  });
}

export function patchLyricsModal(patch) {
  Object.assign(modalState, patch);
}

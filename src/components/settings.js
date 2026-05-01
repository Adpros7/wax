// Helper to open the settings modal. The modal contents are rendered by
// SettingsBody.vue.
import { openComponentModal } from '@/lib/modal';
import SettingsBody from './SettingsBody.vue';

export function openSettings() {
  openComponentModal({
    title: 'Paramètres',
    component: SettingsBody,
    componentProps: {},
    wide: true,
  });
}

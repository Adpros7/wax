// Helper to open the settings modal. The modal contents are rendered by
// SettingsBody.vue.
import { openComponentModal } from '@/lib/modal';
import { t } from '@/lib/i18n';
import SettingsBody from './SettingsBody.vue';

export function openSettings() {
  openComponentModal({
    title: t('settings.title'),
    component: SettingsBody,
    componentProps: {},
    wide: true,
  });
}

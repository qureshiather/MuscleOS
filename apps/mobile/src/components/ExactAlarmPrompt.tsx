import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  EXACT_ALARM_PROMPT,
  answerExactAlarmPrompt,
  useExactAlarmPromptStore,
} from '@/utils/exactAlarmPermission';

/** Android only: why MuscleOS wants "Alarms & reminders", in the app's own dialog (MUS-167). */
export function ExactAlarmPrompt() {
  const visible = useExactAlarmPromptStore((s) => s.visible);
  return (
    <ConfirmDialog
      visible={visible}
      title={EXACT_ALARM_PROMPT.title}
      message={EXACT_ALARM_PROMPT.message}
      cancelLabel={EXACT_ALARM_PROMPT.cancelLabel}
      confirmLabel={EXACT_ALARM_PROMPT.confirmLabel}
      onCancel={() => answerExactAlarmPrompt(false)}
      onConfirm={() => answerExactAlarmPrompt(true)}
      cancelTestID="exact-alarm-not-now"
      confirmTestID="exact-alarm-open-settings"
    />
  );
}

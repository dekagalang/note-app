import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import Modal from './Modal';
import Icon from './Icons';
import ReminderPicker from '../features/reminders/ReminderPicker';
import { useNotes } from '../contexts/NotesContext';
import { useToast } from '../contexts/ToastContext';
import { notesApi } from '../services/api';
import { requestReminderPermission } from '../features/reminders/reminderService';

const ReminderList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0 16px;
`;

const ReminderItem = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
  padding: 14px 20px;
  color: var(--text-color);
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border-transparent);
  cursor: pointer;

  &:hover {
    background: var(--menu-item-hover);
  }

  > svg {
    flex: 0 0 auto;
    color: var(--accent-color, #3978d4);
  }
`;

const ReminderText = styled.span`
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
`;

const ReminderTitle = styled.span`
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ReminderTime = styled.span`
  color: var(--text-color-secondary);
  font-size: 13px;
`;

const EmptyState = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  color: var(--text-color-secondary);
  font-size: 14px;
  text-align: center;
`;

const formatReminderTime = value => new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date(value));

export default function RemindersModal({ onClose }) {
  const [reminders, setReminders] = useState([]);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { updateNote } = useNotes();
  const { showToast } = useToast();

  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      setReminders(await notesApi.getUpcomingReminders());
    } catch (error) {
      console.error('[RemindersModal] Failed to load active reminders:', error);
      showToast('Could not load active reminders.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const handleSaveReminder = useCallback(async ({ enabled, reminderAt }) => {
    const reminder = selectedReminder;
    if (!reminder) return false;

    if (enabled && !(await requestReminderPermission())) {
      showToast('Allow notification access and, on Android, exact-alarm access to use reminders.', { variant: 'warning' });
      return false;
    }

    setSelectedReminder(null);
    try {
      await updateNote(reminder.id, {
        reminder_at: enabled ? reminderAt : null,
        reminder_enabled: enabled === true,
      });
      await loadReminders();
      return true;
    } catch (error) {
      console.error('[RemindersModal] Failed to save reminder:', error);
      setSelectedReminder(reminder);
      showToast(error.response?.data?.message || 'Failed to save reminder. Please try again.', { variant: 'error' });
      return false;
    }
  }, [loadReminders, selectedReminder, showToast, updateNote]);

  const handleRemoveReminder = useCallback(() => {
    handleSaveReminder({ enabled: false, reminderAt: null });
  }, [handleSaveReminder]);

  return (
    <>
      <Modal
        title="Active reminders"
        onClose={onClose}
        width="520px"
        height="min(560px, 82vh)"
        maxHeight="90vh"
        zIndex={2500}
      >
        {loading ? (
          <EmptyState>Loading reminders...</EmptyState>
        ) : reminders.length === 0 ? (
          <EmptyState>No active reminders</EmptyState>
        ) : (
          <ReminderList>
            {reminders.map(reminder => (
              <ReminderItem key={reminder.id} type="button" onClick={() => setSelectedReminder(reminder)}>
                <Icon name="bell" size={20} />
                <ReminderText>
                  <ReminderTitle>{reminder.title?.trim() || 'Untitled note'}</ReminderTitle>
                  <ReminderTime>{formatReminderTime(reminder.reminder_at)}</ReminderTime>
                </ReminderText>
                <Icon name="arrow_right_caret" size={18} />
              </ReminderItem>
            ))}
          </ReminderList>
        )}
      </Modal>
      {selectedReminder && (
        <ReminderPicker
          value={selectedReminder.reminder_at}
          enabled={selectedReminder.reminder_enabled}
          onSave={handleSaveReminder}
          onRemove={handleRemoveReminder}
          onClose={() => setSelectedReminder(null)}
          noteColor={selectedReminder.color}
        />
      )}
    </>
  );
}

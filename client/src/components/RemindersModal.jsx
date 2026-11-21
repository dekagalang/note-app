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
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 8px 0 16px;
`;

const ReminderSection = styled.section`
  min-width: 0;
`;

const SectionTitle = styled.h3`
  margin: 12px 20px 4px;
  color: var(--text-color-secondary);
  font-size: 13px;
  font-weight: 600;
`;

const SectionEmpty = styled.p`
  margin: 0;
  padding: 10px 20px 14px;
  color: var(--text-color-secondary);
  font-size: 13px;
`;

const ReminderItem = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  gap: 12px;
  padding: 14px 20px;
  box-sizing: border-box;
  overflow: hidden;
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
  flex: 1 1 0%;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
`;

const ReminderTitle = styled.span`
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ReminderTime = styled.span`
  overflow-wrap: anywhere;
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
  const [loadError, setLoadError] = useState(false);
  const { updateNote } = useNotes();
  const { showToast } = useToast();

  const loadReminders = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setReminders(await notesApi.getActiveReminders());
    } catch (error) {
      console.error('[RemindersModal] Failed to load active reminders:', error);
      setLoadError(true);
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

  const now = Date.now();
  const upcomingReminders = reminders.filter(reminder => new Date(reminder.reminder_at).getTime() > now);
  const pastDueReminders = reminders.filter(reminder => new Date(reminder.reminder_at).getTime() <= now);

  const renderReminder = reminder => (
    <ReminderItem key={reminder.id} type="button" onClick={() => setSelectedReminder(reminder)}>
      <Icon name="bell" size={20} />
      <ReminderText>
        <ReminderTitle>{reminder.title?.trim() || 'Untitled note'}</ReminderTitle>
        <ReminderTime>{formatReminderTime(reminder.reminder_at)}</ReminderTime>
      </ReminderText>
      <Icon name="arrow_right_caret" size={18} />
    </ReminderItem>
  );

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
        ) : loadError ? (
          <EmptyState>Could not load reminders. Check your connection and try again.</EmptyState>
        ) : reminders.length === 0 ? (
          <EmptyState>No active reminders</EmptyState>
        ) : (
          <ReminderList>
            <ReminderSection>
              <SectionTitle>Upcoming</SectionTitle>
              {upcomingReminders.length > 0
                ? upcomingReminders.map(renderReminder)
                : <SectionEmpty>No upcoming reminders</SectionEmpty>}
            </ReminderSection>
            <ReminderSection>
              <SectionTitle>Past due</SectionTitle>
              {pastDueReminders.length > 0
                ? pastDueReminders.map(renderReminder)
                : <SectionEmpty>No past-due reminders</SectionEmpty>}
            </ReminderSection>
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

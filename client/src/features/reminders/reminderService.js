import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'note-reminders';
const MAX_SCHEDULED_REMINDERS = 60;

let actionListenerPromise = null;
let openNoteHandler = null;
let pendingNoteId = null;

export const isNativeReminderAvailable = () => Capacitor.isNativePlatform();

const getNotificationId = (noteId) => {
  let hash = 2166136261;
  for (let index = 0; index < noteId.length; index += 1) {
    hash = Math.imul(hash ^ noteId.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) % 2147483647 || 1;
};

const getNotificationBody = (note) => {
  const text = note.plain_content || note.content || '';
  const plainText = text.includes('<')
    ? new DOMParser().parseFromString(text, 'text/html').body.textContent
    : text;
  return (plainText || '').replace(/\s+/g, ' ').trim().slice(0, 180);
};

const ensureAndroidChannel = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Note reminders',
    description: 'Reminders for your notes',
    importance: 5,
    visibility: 1,
  });
};

export const getReminderPermissionStatus = async () => {
  if (!isNativeReminderAvailable()) return 'unavailable';
  const status = await LocalNotifications.checkPermissions();
  return status.display;
};

export const requestReminderPermission = async () => {
  if (!isNativeReminderAvailable()) return false;
  try {
    let status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      status = await LocalNotifications.requestPermissions();
    }
    if (status.display !== 'granted') return false;
    await ensureAndroidChannel();
    return true;
  } catch (error) {
    console.error('[ReminderService] Failed to request notification permission:', error);
    return false;
  }
};

export const cancelReminder = async (noteId) => {
  if (!isNativeReminderAvailable() || !noteId) return;
  const id = getNotificationId(noteId);
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
    await LocalNotifications.removeDeliveredNotificationsById({ ids: [id] });
  } catch (error) {
    console.error(`[ReminderService] Failed to cancel notification for note ${noteId}:`, error);
  }
};

export const scheduleReminder = async (note) => {
  if (!isNativeReminderAvailable() || !note?.id) return { scheduled: false };

  const reminderAt = note.reminder_at ? new Date(note.reminder_at) : null;
  if (!note.reminder_enabled || !reminderAt || Number.isNaN(reminderAt.getTime()) || reminderAt <= new Date()) {
    await cancelReminder(note.id);
    return { scheduled: false };
  }

  const permitted = await requestReminderPermission();
  if (!permitted) return { scheduled: false, permissionDenied: true };

  const id = getNotificationId(note.id);
  await LocalNotifications.cancel({ notifications: [{ id }] });
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: note.title?.trim() || 'itsnotes reminder',
      body: getNotificationBody(note) || 'Open your note to see the reminder.',
      schedule: { at: reminderAt },
      channelId: CHANNEL_ID,
      extra: { kind: 'note-reminder', noteId: note.id },
    }],
  });
  return { scheduled: true };
};

export const reconcileReminders = async (reminders) => {
  if (!isNativeReminderAvailable()) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return;

  await ensureAndroidChannel();
  const activeReminders = (reminders || [])
    .filter(note => note.reminder_enabled && note.reminder_at && new Date(note.reminder_at) > new Date())
    .sort((a, b) => new Date(a.reminder_at) - new Date(b.reminder_at))
    .slice(0, MAX_SCHEDULED_REMINDERS);
  const activeById = new Map(activeReminders.map(note => [note.id, note]));
  const pending = await LocalNotifications.getPending();
  const reminderNotifications = pending.notifications.filter(
    notification => notification.extra?.kind === 'note-reminder'
  );
  const pendingByNoteId = new Map(reminderNotifications.map(notification => [notification.extra.noteId, notification]));
  const cancelIds = [];

  for (const notification of reminderNotifications) {
    const note = activeById.get(notification.extra.noteId);
    const scheduledAt = notification.schedule?.at ? new Date(notification.schedule.at).getTime() : null;
    if (!note || scheduledAt !== new Date(note.reminder_at).getTime()) {
      cancelIds.push(notification.id);
    }
  }

  if (cancelIds.length) {
    await LocalNotifications.cancel({ notifications: cancelIds.map(id => ({ id })) });
  }

  const staleIds = new Set(cancelIds);
  const toSchedule = activeReminders.filter(note => {
    const pendingNotification = pendingByNoteId.get(note.id);
    return !pendingNotification || staleIds.has(pendingNotification.id);
  });

  for (const note of toSchedule) {
    await scheduleReminder(note);
  }
};

export const initializeReminderNotifications = async () => {
  if (!isNativeReminderAvailable() || actionListenerPromise) return;
  actionListenerPromise = LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    if (notification.extra?.kind !== 'note-reminder' || !notification.extra.noteId) return;
    if (openNoteHandler) {
      openNoteHandler(notification.extra.noteId);
    } else {
      pendingNoteId = notification.extra.noteId;
    }
  }).catch(error => {
    actionListenerPromise = null;
    console.error('[ReminderService] Failed to register notification listener:', error);
  });
};

export const setReminderOpenHandler = (handler) => {
  openNoteHandler = handler;
  if (pendingNoteId && openNoteHandler) {
    const noteId = pendingNoteId;
    pendingNoteId = null;
    openNoteHandler(noteId);
  }
  return () => {
    if (openNoteHandler === handler) openNoteHandler = null;
  };
};
import React, { useState } from 'react';
import styled from 'styled-components';
import { Capacitor } from '@capacitor/core';
import { DatePicker } from '@capacitor-community/date-picker';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.42);

  @media (min-width: 600px) {
    align-items: center;
    padding: 20px;
  }
`;

const Panel = styled.section`
  width: min(100%, 420px);
  padding: 20px;
  color: var(--text-color);
  background: var(--mobile-note-bg-color, var(--background-color));
  border: 1px solid var(--border-transparent);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.24);

  @media (min-width: 600px) {
    border-radius: 12px;
  }
`;

const Heading = styled.h2`
  margin: 0 0 18px;
  font-size: 18px;
  font-weight: 600;
`;

const ActiveRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: 15px;
`;

const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0 20px;
`;

const Field = styled.div`
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--text-color-secondary);
  font-size: 12px;

  select,
  button {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 7px 8px;
    padding-right: 30px;
    color: var(--text-color);
    background-color: var(--input-bg-color, transparent);
    border: 1px solid var(--menu-item-separator-dark);
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  select {
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-opacity='0.9' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
  }

  button {
    appearance: none;
    -webkit-appearance: none;
    text-align: left;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-opacity='0.9' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
  }

  :root.light-theme & select,
  :root.light-theme & button {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23000000' stroke-opacity='0.9' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  }

  select:focus,
  button:focus {
    outline: none;
    border-color: var(--foreground-color);
  }

  select:disabled,
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-transparent);

  button {
    min-height: 42px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    color: var(--text-color);
    background: var(--button-hover-color);
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .spacer {
    flex: 1;
  }

  .primary {
    color: var(--text-color-contrast, #fff);
    background: var(--accent-color, #3978d4);
  }

  .remove {
    color: var(--error-color, #c23b3b);
    background: transparent;
    padding-left: 0;
  }
`;

const pad = value => String(value).padStart(2, '0');
const NATIVE_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSS";

const toLocalInputs = value => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
};

const getDateOptions = selectedDate => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = Array.from({ length: 366 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return date;
  });
  const todayValue = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const dateValues = new Set(dates.map(date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`));

  if (selectedDate && !dateValues.has(selectedDate)) {
    const [year, month, day] = selectedDate.split('-').map(Number);
    dates.push(new Date(year, month - 1, day));
  }

  return dates
    .map(date => {
      const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      let label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      if (value === todayValue) label = `Today, ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      else {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (value === `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`) {
          label = `Tomorrow, ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        }
      }
      return { value, label };
    })
    .sort((left, right) => left.value.localeCompare(right.value));
};

const getTimeOptions = selectedTime => {
  const times = Array.from({ length: 24 * 60 }, (_, minutes) => {
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  });

  if (selectedTime && !times.includes(selectedTime)) times.push(selectedTime);
  return times.sort().map(time => ({ value: time, label: time }));
};

const toNativeDateString = (date, time) => `${date}T${time}:00.000`;
const toDateValue = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toTimeValue = date => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export default function ReminderPicker({ value, enabled, onSave, onRemove, onClose }) {
  const [active, setActive] = useState(enabled === true);
  const [dateTime, setDateTime] = useState(() => toLocalInputs(value));
  const [error, setError] = useState('');
  const useNativePicker = Capacitor.isNativePlatform();
  const dateOptions = useNativePicker ? [] : getDateOptions(dateTime.date);
  const timeOptions = useNativePicker ? [] : getTimeOptions(dateTime.time);

  const handleNativePicker = async mode => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const { value: selectedValue } = await DatePicker.present({
        mode,
        date: toNativeDateString(dateTime.date, dateTime.time),
        timezone,
        android: { format: NATIVE_DATE_FORMAT, is24h: true },
        ios: { format: NATIVE_DATE_FORMAT, is24h: true },
      });
      if (!selectedValue) return;

      const selectedDate = new Date(selectedValue);
      if (Number.isNaN(selectedDate.getTime())) return;
      setDateTime(previous => ({
        ...previous,
        [mode === 'date' ? 'date' : 'time']:
          mode === 'date' ? toDateValue(selectedDate) : toTimeValue(selectedDate),
      }));
      setError('');
    } catch (pickerError) {
      console.error('[ReminderPicker] Failed to open native date/time picker:', pickerError);
    }
  };

  const handleSave = async () => {
    if (!active) {
      await onSave({ enabled: false, reminderAt: null });
      return;
    }
    if (!dateTime.date || !dateTime.time) {
      setError('Choose a date and time.');
      return;
    }
    const localDate = new Date(`${dateTime.date}T${dateTime.time}`);
    if (Number.isNaN(localDate.getTime()) || localDate <= new Date()) {
      setError('Choose a future time.');
      return;
    }
    setError('');
    await onSave({ enabled: true, reminderAt: localDate.toISOString() });
  };

  return (
    <Overlay
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
      onTouchStart={event => event.stopPropagation()}
    >
      <Panel role="dialog" aria-modal="true" aria-labelledby="reminder-picker-title">
        <Heading id="reminder-picker-title">Reminder</Heading>
        <ActiveRow>
          <input
            type="checkbox"
            checked={active}
            onChange={event => setActive(event.target.checked)}
          />
          Reminder active
        </ActiveRow>
        <Fields>
          <Field>
            <span>Date</span>
            {useNativePicker ? (
              <button
                type="button"
                aria-label="Choose reminder date"
                onClick={() => handleNativePicker('date')}
                disabled={!active}
              >
                {new Date(`${dateTime.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
              </button>
            ) : (
              <select
                aria-label="Reminder date"
                value={dateTime.date}
                onChange={event => setDateTime(prev => ({ ...prev, date: event.target.value }))}
                disabled={!active}
              >
                {dateOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </Field>
          <Field>
            <span>Time</span>
            {useNativePicker ? (
              <button
                type="button"
                aria-label="Choose reminder time"
                onClick={() => handleNativePicker('time')}
                disabled={!active}
              >
                {dateTime.time}
              </button>
            ) : (
              <select
                aria-label="Reminder time"
                value={dateTime.time}
                onChange={event => setDateTime(prev => ({ ...prev, time: event.target.value }))}
                disabled={!active}
              >
                {timeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </Field>
        </Fields>
        {error && <div role="alert" style={{ color: 'var(--error-color, #c23b3b)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <Actions>
          {enabled && <button className="remove" type="button" onClick={onRemove}>Remove</button>}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" type="button" onClick={handleSave}>Save</button>
        </Actions>
      </Panel>
    </Overlay>
  );
}
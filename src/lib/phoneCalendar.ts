import { Platform } from 'react-native';

export type CalendarEvent = { title: string; startsAt: number; endsAt: number | null; location: string; url: string; ics: string };

/**
 * Adds an event to the phone's own calendar. On iPhone and Android the
 * system's "New event" sheet opens already filled in (title, time, place,
 * link): the member checks it and taps Add, and it lands in Apple Calendar
 * (or Google Calendar). Nothing is read from the calendar. On the web an
 * .ics file is downloaded, which any calendar app opens.
 */
export async function addToPhoneCalendar(ev: CalendarEvent): Promise<'saved' | 'canceled' | 'downloaded'> {
  if (Platform.OS === 'web') {
    const blob = new Blob([ev.ics], { type: 'text/calendar' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${ev.title}.ics`;
    link.click();
    return 'downloaded';
  }
  const Calendar = await import('expo-calendar/legacy');
  const end = ev.endsAt ?? ev.startsAt + 2 * 3600 * 1000;
  const res = await Calendar.createEventInCalendarAsync({
    title: ev.title,
    startDate: new Date(ev.startsAt),
    endDate: new Date(end),
    location: ev.location,
    url: ev.url,
    notes: ev.url,
  });
  return res.action === 'saved' || res.action === 'done' ? 'saved' : 'canceled';
}

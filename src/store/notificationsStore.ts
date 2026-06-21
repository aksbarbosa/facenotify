import {useState, useCallback} from 'react';
import {supabase} from '../services/supabase';
import {RecognitionEvent} from '../types/recognition';

let events: RecognitionEvent[] = [];
let listeners: Array<() => void> = [];
let realtimeChannel: any = null;

function notify() {
  listeners.forEach(fn => fn());
}

function mapRow(row: any): RecognitionEvent {
  return {
    id: row.id,
    person_id: row.dependent_id ?? 'unknown',
    person_name: row.person_name,
    location: {
      camera_id: row.camera_id ?? '',
      camera_label: row.camera_label ?? '',
      address: row.address ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
    },
    timestamp: row.timestamp,
    confidence: row.confidence ?? 0,
    access_granted: row.access_granted ?? true,
  };
}

export async function initStore(userId: string): Promise<void> {
  const {data} = await supabase
    .from('recognition_events')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', {ascending: false});

  events = (data ?? []).map(mapRow);
  notify();

  realtimeChannel = supabase
    .channel('recognition_events_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'recognition_events',
        filter: `user_id=eq.${userId}`,
      },
      payload => {
        const newEvent = mapRow(payload.new);
        if (!events.find(e => e.id === newEvent.id)) {
          events = [newEvent, ...events];
          notify();
        }
      },
    )
    .subscribe();
}

export function cleanupStore(): void {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  events = [];
}

export function addEvent(event: RecognitionEvent) {
  if (!events.find(e => e.id === event.id)) {
    events = [event, ...events];
    notify();
  }
}

export function useNotifications() {
  const [, forceUpdate] = useState(0);

  const subscribe = useCallback(() => {
    const refresh = () => forceUpdate(n => n + 1);
    listeners.push(refresh);
    return () => {
      listeners = listeners.filter(fn => fn !== refresh);
    };
  }, []);

  return {events, subscribe};
}

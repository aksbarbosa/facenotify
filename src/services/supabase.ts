import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://sktwaczihfsbossuguab.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrdHdhY3ppaGZzYm9zc3VndWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzY3NDksImV4cCI6MjA5NjkxMjc0OX0.4LvViJo0sJ16eYO10s1GyefntR5EYDpgkbBDF6J7pLg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

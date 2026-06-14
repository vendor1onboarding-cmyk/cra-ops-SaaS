import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL or anon key is missing. Check your .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to call Supabase Edge Functions
export async function invokeEdgeFunction<T = any>(functionName: string, body: any): Promise<T> {
  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // If session retrieval failed, it might be a corrupted session
    if (sessionError) {
      console.error('Session error:', sessionError);
      // Force sign out to clear corrupted session
      await supabase.auth.signOut();
      throw new Error('Session expired or corrupted. Please log in again.');
    }
    
    if (!session) {
      throw new Error('No active session. Please log in again.');
    }

    // Check if token is expired (Supabase JS should handle this, but double-check)
    const tokenExpiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    
    if (tokenExpiresAt > 0 && now >= tokenExpiresAt) {
      console.warn('Token expired, attempting refresh...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !newSession) {
        console.error('Token refresh failed:', refreshError);
        await supabase.auth.signOut();
        throw new Error('Session expired and could not be refreshed. Please log in again.');
      }
      
      // Use the new session
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newSession.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Edge function call failed');
      }

      return await response.json();
    }

    // Token is valid, proceed with request
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      
      // If unauthorized, might be a token issue - force logout
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication failed, signing out...');
        await supabase.auth.signOut();
        throw new Error('Authentication failed. Please log in again.');
      }
      
      throw new Error(error.error || 'Edge function call failed');
    }

    return await response.json();
    
  } catch (error: any) {
    // If it's network error or other issue, provide helpful message
    if (error.message?.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  }
}

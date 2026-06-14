// Supabase Edge Function for admin password reset
// Allows admins to reset user passwords securely

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      throw new Error('Missing authorization header');
    }

    // Extract token from "Bearer {token}" format
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      console.error('Missing bearer token');
      throw new Error('Missing bearer token');
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('Initializing Supabase admin client...');

    // Admin client with full access
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT token using the admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Token verification failed:', userError?.message || 'No user found');
      throw new Error('Unauthorized: Invalid or expired token');
    }

    console.log('Token verified successfully for admin:', user.id);

    // Check if requesting user is admin
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile) {
      console.error('Admin profile error:', adminProfileError);
      throw new Error('Unauthorized: User profile not found');
    }

    if (adminProfile.role !== 'admin') {
      console.error('Non-admin user attempted password reset');
      throw new Error('Unauthorized: Admin role required');
    }

    console.log('Admin verified:', user.id);

    // Parse request body
    const requestData = await req.json();
    const { userId, newTempPassword } = requestData;

    // Validate required fields
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!newTempPassword) {
      throw new Error('New temporary password is required');
    }

    // Validate password meets requirements (at least 8 characters)
    if (newTempPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    console.log('Resetting password for user:', userId);

    // Get user profile to verify existence
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('User not found:', profileError);
      throw new Error('User not found');
    }

    console.log('User found:', userProfile.email);

    // Update user password via admin API
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newTempPassword }
    );

    if (updateError || !updateData.user) {
      console.error('Password update failed:', updateError);
      throw new Error(`Failed to update password: ${updateError?.message || 'Unknown error'}`);
    }

    console.log('Password updated successfully for user:', userId);

    // Set first_login flag to true to force password change
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ first_login: true })
      .eq('id', userId);

    if (profileUpdateError) {
      console.warn('Failed to set first_login flag:', profileUpdateError);
      // Don't fail the request if this fails, it's not critical
    }

    console.log('first_login flag set for user:', userId);

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully',
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          role: userProfile.role,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in reset-user-password function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

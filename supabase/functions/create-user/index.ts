// Supabase Edge Function for secure user creation
// This function runs server-side and safely uses the service role key

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
      throw new Error('Missing authorization header');
    }

    // Extract token from "Bearer {token}" format
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      throw new Error('Missing bearer token');
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Admin client for all operations (service role key has full access)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create a client with the anon key but use the Authorization header with the token
    // This allows getUser() to use the token from the Authorization header
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the authenticated user using the token from the Authorization header
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      throw new Error('Unauthorized: Invalid or expired token');
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      throw new Error('Unauthorized: User profile not found');
    }

    if (profile.role !== 'admin') {
      throw new Error('Unauthorized: Admin role required');
    }

    // Parse request body
    const requestData = await req.json();
    const { 
      email, 
      mobileNumber, 
      fullName, 
      role, 
      tempPassword, 
      identifierType 
    } = requestData;

    // Validate required fields
    if (!fullName || !role || !tempPassword || !identifierType) {
      throw new Error('Missing required fields');
    }

    if (identifierType !== 'email' && identifierType !== 'mobile') {
      throw new Error('Invalid identifier type');
    }

    // Prepare auth credentials
    let authEmail: string;
    let storedMobile: string | null = null;

    if (identifierType === 'email') {
      if (!email) throw new Error('Email is required');
      authEmail = email.trim().toLowerCase();
    } else {
      if (!mobileNumber) throw new Error('Mobile number is required');
      const cleanMobile = mobileNumber.replace(/\D/g, '');
      storedMobile = cleanMobile;
      authEmail = `mobile_${cleanMobile}@system.internal`;
    }

    // Check for duplicates in profiles table
    if (identifierType === 'email') {
      const { data: existingUser } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', authEmail)
        .maybeSingle();
      
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
    } else {
      const { data: existingUser } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('mobile_number', storedMobile)
        .maybeSingle();
      
      if (existingUser) {
        throw new Error('User with this mobile number already exists');
      }
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        role: role,
        login_identifier: identifierType,
      },
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message || 'Unknown error'}`);
    }

    // Create profile record
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: identifierType === 'email' ? authEmail : authEmail,
        mobile_number: storedMobile,
        full_name: fullName.trim(),
        role: role,
        first_login: true,
      });

    if (profileInsertError) {
      // Rollback: Delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create profile: ${profileInsertError.message}`);
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: identifierType === 'email' ? authEmail : undefined,
          mobileNumber: storedMobile,
          identifierType: identifierType,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-user function:', error);
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

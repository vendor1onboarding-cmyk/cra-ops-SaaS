import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.substring(7);

    // Verify token and get requesting user
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      console.error("Token verification failed:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const requestingUserId = userData.user.id;
    console.log(`Delete user request from: ${requestingUserId}`);

    // Check if requesting user is admin
    const { data: adminCheck, error: adminCheckError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", requestingUserId)
      .single();

    if (adminCheckError || !adminCheck || adminCheck.role !== "admin") {
      console.error("Unauthorized: User is not admin");
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Only admins can delete users" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    const { userId: targetUserId, reason } = await req.json();
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "User ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Prevent admin from deleting themselves
    if (targetUserId === requestingUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot delete your own account" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify target user exists
    const { data: targetUserProfile, error: targetCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, mobile_number")
      .eq("id", targetUserId)
      .single();

    if (targetCheckError || !targetUserProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Deleting user: ${targetUserId} (${targetUserProfile.full_name})`);
    console.log(`Deletion reason: ${reason || "No reason provided"}`);

    // Delete user from Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      console.error("Failed to delete user from auth:", deleteError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to delete user: ${deleteError.message}` 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // If user exists in profiles table, update status instead of deleting
    // This preserves referential integrity and historical data
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: requestingUserId,
        deletion_reason: reason || null
      })
      .eq("id", targetUserId);

    if (profileUpdateError) {
      console.error("Warning: Failed to update profile deletion status:", profileUpdateError);
      // Don't fail the entire operation if this update fails
      // The auth user was already deleted
    }

    // Log the deletion action
    console.log(`✓ User successfully deleted: ${targetUserProfile.full_name} (${targetUserProfile.email})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${targetUserProfile.full_name} has been deleted`,
        deletedUser: {
          id: targetUserProfile.id,
          email: targetUserProfile.email,
          fullName: targetUserProfile.full_name,
          role: targetUserProfile.role,
          mobileNumber: targetUserProfile.mobile_number,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (err) {
    console.error("Unexpected error in delete-user function:", err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err instanceof Error ? err.message : "Internal server error" 
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

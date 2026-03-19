import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        // Get the user calling the function
        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            throw new Error("Unauthorized");
        }

        // Verify calling user is an admin
        const { data: profile } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profile?.role !== "admin") {
            throw new Error("Forbidden: Requires admin privileges");
        }

        const body = await req.json();
        const { action } = body;

        // Initialize Supabase Admin Client using the Service Role Key
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // === CREATE USER ===
        if (action === "create") {
            const { email, password, full_name, phone, role } = body;

            if (!email || !password) {
                throw new Error("email and password are required");
            }

            // Create user in auth
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
            });

            if (createError) {
                console.error("Error creating user:", createError);
                throw new Error(createError.message || "Erro ao criar usuário");
            }

            // Update profile with name, phone, role
            if (newUser?.user) {
                const { error: profileError } = await supabaseAdmin
                    .from("profiles")
                    .update({
                        full_name: full_name || "",
                        phone: phone || "",
                        role: role || "user",
                    })
                    .eq("id", newUser.user.id);

                if (profileError) {
                    console.error("Error updating profile:", profileError);
                    // Non-blocking: user was created even if profile update fails
                }
            }

            return new Response(JSON.stringify({ success: true, user: newUser.user }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // === UPDATE USER ===
        if (action === "update") {
            const { targetUserId, email, password, full_name, phone, role } = body;

            if (!targetUserId) {
                throw new Error("targetUserId is required");
            }

            // Update auth fields if provided
            const authUpdates: { email?: string; password?: string } = {};
            if (email) authUpdates.email = email;
            if (password) authUpdates.password = password;

            if (Object.keys(authUpdates).length > 0) {
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    targetUserId,
                    authUpdates
                );
                if (updateError) {
                    console.error("Error updating auth user:", updateError);
                    throw updateError;
                }
            }

            // Update profile fields
            const profileUpdates: Record<string, string> = {};
            if (full_name !== undefined) profileUpdates.full_name = full_name;
            if (phone !== undefined) profileUpdates.phone = phone;
            if (role !== undefined) profileUpdates.role = role;

            if (Object.keys(profileUpdates).length > 0) {
                const { error: profileError } = await supabaseAdmin
                    .from("profiles")
                    .update(profileUpdates)
                    .eq("id", targetUserId);

                if (profileError) {
                    console.error("Error updating profile:", profileError);
                    throw profileError;
                }
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // === DELETE USER ===
        if (action === "delete") {
            const { targetUserId } = body;

            if (!targetUserId) {
                throw new Error("targetUserId is required");
            }

            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

            if (deleteError) {
                console.error("Error deleting user:", deleteError);
                throw deleteError;
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Legacy: no action provided = update (backward compat)
        const { targetUserId, email, password } = body;
        if (targetUserId) {
            const updates: { email?: string; password?: string } = {};
            if (email) updates.email = email;
            if (password) updates.password = password;

            if (Object.keys(updates).length === 0) {
                throw new Error("No updates provided");
            }

            const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                targetUserId,
                updates
            );

            if (updateError) throw updateError;

            return new Response(JSON.stringify({ success: true, user: updatedUser }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        throw new Error("Invalid action. Use: create, update, or delete");

    } catch (error: any) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});

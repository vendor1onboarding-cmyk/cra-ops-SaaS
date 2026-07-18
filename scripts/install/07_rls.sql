-- ---------------------------------------------------------------------------
-- POLICY: atm_replenishments ATM replenishments visibility
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "ATM replenishments visibility" ON "public"."atm_replenishments" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "atm_replenishments"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "atm_replenishments"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text"))))));


--

-- ---------------------------------------------------------------------------
-- POLICY: assignments Admin can create assignments
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admin can create assignments" ON "public"."assignments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--

-- ---------------------------------------------------------------------------
-- POLICY: assignments Admin can insert assignments
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admin can insert assignments" ON "public"."assignments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));


--

-- ---------------------------------------------------------------------------
-- POLICY: soa_adjustments Admin can manage SOA adjustments
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admin can manage SOA adjustments" ON "public"."soa_adjustments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))))));


--

-- ---------------------------------------------------------------------------
-- POLICY: route_sites Admin can manage route sites
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admin can manage route sites" ON "public"."route_sites" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--

-- ---------------------------------------------------------------------------
-- POLICY: profiles Admin read all profiles (no recursion)
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admin read all profiles (no recursion)" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));


--

-- ---------------------------------------------------------------------------
-- POLICY: assignments Admin read assignments
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admin read assignments" ON "public"."assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--

-- ---------------------------------------------------------------------------
-- POLICY: assignments Admin sees all assignments
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admin sees all assignments" ON "public"."assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));


--

-- ---------------------------------------------------------------------------
-- POLICY: atm_removal_plans Admin/Supervisor can view atm_removal_plans
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admin/Supervisor can view atm_removal_plans" ON "public"."atm_removal_plans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))))));


--

-- ---------------------------------------------------------------------------
-- POLICY: assignments Admins can update all assignments
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Admins can update all assignments" ON "public"."assignments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));


--

-- ---------------------------------------------------------------------------
-- POLICY: cash_pickups Cash pickups visibility
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Cash pickups visibility" ON "public"."cash_pickups" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "cash_pickups"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "cash_pickups"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text"))))));


--

-- ---------------------------------------------------------------------------
-- POLICY: atm_removal_plans Custodian can manage own atm_removal_plans
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Custodian can manage own atm_removal_plans" ON "public"."atm_removal_plans" USING (("assignment_id" IN ( SELECT "assignments"."id"
   FROM "public"."assignments"
  WHERE ("assignments"."custodian_id" = "auth"."uid"()))));


--

-- ---------------------------------------------------------------------------
-- POLICY: assignments Custodian cannot modify approved assignment
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Custodian cannot modify approved assignment" ON "public"."assignments" FOR UPDATE USING ((("custodian_id" = "auth"."uid"()) AND ("status" <> 'approved'::"text")));


--

-- ---------------------------------------------------------------------------
-- POLICY: assignments Custodian sees own assignments
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Custodian sees own assignments" ON "public"."assignments" FOR SELECT USING (("custodian_id" = "auth"."uid"()));


--

-- ---------------------------------------------------------------------------
-- POLICY: denomination_plans Denomination plans by assignment visibility
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Denomination plans by assignment visibility" ON "public"."denomination_plans" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "denomination_plans"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "denomination_plans"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text"))))));


--

-- ---------------------------------------------------------------------------
-- POLICY: sites Sites readable by all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Sites readable by all" ON "public"."sites" FOR SELECT USING (true);


--

-- ---------------------------------------------------------------------------
-- POLICY: technical_issues Technical issues visibility
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "Technical issues visibility" ON "public"."technical_issues" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "technical_issues"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "technical_issues"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text"))))));


--

-- ---------------------------------------------------------------------------
-- POLICY: atm_replenishments atm_repl_authenticated_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "atm_repl_authenticated_all" ON "public"."atm_replenishments" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--

-- ---------------------------------------------------------------------------
-- POLICY: bank_accounts bank_accounts_admin_delete
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "bank_accounts_admin_delete" ON "public"."bank_accounts" FOR DELETE USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));


--

-- ---------------------------------------------------------------------------
-- POLICY: bank_accounts bank_accounts_admin_insert
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "bank_accounts_admin_insert" ON "public"."bank_accounts" FOR INSERT WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));


--

-- ---------------------------------------------------------------------------
-- POLICY: bank_accounts bank_accounts_admin_update
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "bank_accounts_admin_update" ON "public"."bank_accounts" FOR UPDATE USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))) WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));


--

-- ---------------------------------------------------------------------------
-- POLICY: bank_accounts bank_accounts_admin_view_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "bank_accounts_admin_view_all" ON "public"."bank_accounts" FOR SELECT USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));


--

-- ---------------------------------------------------------------------------
-- POLICY: bank_accounts bank_accounts_user_view_active
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "bank_accounts_user_view_active" ON "public"."bank_accounts" FOR SELECT USING ((("is_active" = true) OR (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))));


--

-- ---------------------------------------------------------------------------
-- POLICY: banks banks_authenticated_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "banks_authenticated_all" ON "public"."banks" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--

-- ---------------------------------------------------------------------------
-- POLICY: cash_pickups cash_pickups_authenticated_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "cash_pickups_authenticated_all" ON "public"."cash_pickups" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--

-- ---------------------------------------------------------------------------
-- POLICY: denomination_plans denom_plans_authenticated_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "denom_plans_authenticated_all" ON "public"."denomination_plans" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--

-- ---------------------------------------------------------------------------
-- POLICY: profiles insert_own_profile
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "insert_own_profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));


--

-- ---------------------------------------------------------------------------
-- POLICY: profiles profiles_self_or_admin_read
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "profiles_self_or_admin_read" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR (("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text")));


--

-- ---------------------------------------------------------------------------
-- POLICY: profiles profiles_self_read
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "profiles_self_read" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));


--

-- ---------------------------------------------------------------------------
-- POLICY: profiles read_own_profile
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "read_own_profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));


--

-- ---------------------------------------------------------------------------
-- POLICY: route_sites route_sites_authenticated_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "route_sites_authenticated_all" ON "public"."route_sites" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--

-- ---------------------------------------------------------------------------
-- POLICY: sites sites_authenticated_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "sites_authenticated_all" ON "public"."sites" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--

-- ---------------------------------------------------------------------------
-- POLICY: technical_issues tech_issues_authenticated_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "tech_issues_authenticated_all" ON "public"."technical_issues" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--

-- ---------------------------------------------------------------------------
-- POLICY: travel_logs travel_logs_authenticated_all
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "travel_logs_authenticated_all" ON "public"."travel_logs" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--

-- ---------------------------------------------------------------------------
-- POLICY: profiles update_own_profile
-- Row-level security policy
-- ---------------------------------------------------------------------------
--

CREATE POLICY "update_own_profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));


--
--


-- ============================================================================
-- CRA OPS install kit
-- Row-level security
-- ============================================================================

-- Enable RLS on operational tables after all policies are present.
ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."atm_removal_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."atm_replenishments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cash_pickups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."denomination_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."route_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."technical_issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."travel_logs" ENABLE ROW LEVEL SECURITY;


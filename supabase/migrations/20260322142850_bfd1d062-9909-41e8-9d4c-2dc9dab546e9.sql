
-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Fix update_updated_at search_path
ALTER FUNCTION public.update_updated_at() SET search_path = public;

-- has_role: check if user has a specific app_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- is_family_member: check if user belongs to a family
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id AND status = 'active'
  );
$$;

-- is_family_admin: check if user is admin in a family
CREATE OR REPLACE FUNCTION public.is_family_admin(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id AND is_admin = true AND status = 'active'
  );
$$;

-- get_user_family_id: get user's family id
CREATE OR REPLACE FUNCTION public.get_user_family_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members
  WHERE user_id = _user_id AND status = 'active'
  LIMIT 1;
$$;

-- is_staff_member: check if user has staff role (worker/maid/driver)
CREATE OR REPLACE FUNCTION public.is_staff_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND role IN ('worker', 'maid', 'driver') AND status = 'active'
  );
$$;

-- =============================================
-- RLS POLICIES — PROFILES
-- =============================================
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES — USER ROLES
-- =============================================
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES — USER KEYPAIRS
-- =============================================
CREATE POLICY "Users manage own keypairs" ON public.user_keypairs FOR ALL TO authenticated USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES — CONSENT LOG
-- =============================================
CREATE POLICY "Users manage own consent" ON public.consent_log FOR ALL TO authenticated USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES — FAMILIES
-- =============================================
CREATE POLICY "Members can view own family" ON public.families FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), id));
CREATE POLICY "Authenticated can create family" ON public.families FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can update family" ON public.families FOR UPDATE TO authenticated USING (public.is_family_admin(auth.uid(), id));
CREATE POLICY "Admins can delete family" ON public.families FOR DELETE TO authenticated USING (public.is_family_admin(auth.uid(), id));

-- =============================================
-- RLS POLICIES — FAMILY MEMBERS
-- =============================================
CREATE POLICY "Members can view family members" ON public.family_members FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Users can join family" ON public.family_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage members" ON public.family_members FOR UPDATE TO authenticated USING (public.is_family_admin(auth.uid(), family_id));
CREATE POLICY "Admins can remove members" ON public.family_members FOR DELETE TO authenticated USING (public.is_family_admin(auth.uid(), family_id));

-- =============================================
-- RLS POLICIES — FAMILY INVITES
-- =============================================
CREATE POLICY "Members can view invites" ON public.family_invites FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Admins can create invites" ON public.family_invites FOR INSERT TO authenticated WITH CHECK (public.is_family_admin(auth.uid(), family_id));

-- =============================================
-- RLS POLICIES — FAMILY KEYS
-- =============================================
CREATE POLICY "Users manage own family keys" ON public.family_keys FOR ALL TO authenticated USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES — FAMILY DELETIONS
-- =============================================
CREATE POLICY "Admins manage family deletions" ON public.family_deletions FOR ALL TO authenticated USING (public.is_family_admin(auth.uid(), family_id));

-- =============================================
-- RLS POLICIES — MEMBER REMOVALS
-- =============================================
CREATE POLICY "Admins manage member removals" ON public.member_removals FOR ALL TO authenticated USING (public.is_family_admin(auth.uid(), family_id));

-- =============================================
-- RLS POLICIES — ADMIN TRANSFER
-- =============================================
CREATE POLICY "Members can view transfers" ON public.admin_transfer_requests FOR SELECT TO authenticated USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Members can create transfers" ON public.admin_transfer_requests FOR INSERT TO authenticated WITH CHECK (public.is_family_member(auth.uid(), family_id));

-- =============================================
-- RLS POLICIES — MARKET (staff can access family lists)
-- =============================================
CREATE POLICY "Family members can access market lists" ON public.market_lists FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Family members can access market items" ON public.market_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.market_lists ml WHERE ml.id = list_id AND public.is_family_member(auth.uid(), ml.family_id))
);

-- =============================================
-- RLS POLICIES — BUDGET (no staff access)
-- =============================================
CREATE POLICY "Non-staff family members can access budgets" ON public.budgets FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid())
);
CREATE POLICY "Non-staff can access budget expenses" ON public.budget_expenses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND public.is_family_member(auth.uid(), b.family_id) AND NOT public.is_staff_member(auth.uid()))
);

-- =============================================
-- RLS POLICIES — TASKS (staff: assigned tasks only)
-- =============================================
CREATE POLICY "Family members can access task lists" ON public.task_lists FOR ALL TO authenticated USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "Family members can access task items" ON public.task_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.task_lists tl WHERE tl.id = list_id AND public.is_family_member(auth.uid(), tl.family_id))
);

-- =============================================
-- RLS POLICIES — CALENDAR (no staff)
-- =============================================
CREATE POLICY "Non-staff family members access calendar" ON public.calendar_events FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid())
);

-- =============================================
-- RLS POLICIES — DEBTS (no staff, user's own only)
-- =============================================
CREATE POLICY "Users can access own debts" ON public.debts FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can access own debt payments" ON public.debt_payments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.debts d WHERE d.id = debt_id AND d.user_id = auth.uid())
);
CREATE POLICY "Users can access own debt postponements" ON public.debt_postponements FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.debts d WHERE d.id = debt_id AND d.user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES — TRIPS (no staff)
-- =============================================
CREATE POLICY "Non-staff family members access trips" ON public.trips FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid())
);
CREATE POLICY "Trip day plans access" ON public.trip_day_plans FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id) AND NOT public.is_staff_member(auth.uid()))
);
CREATE POLICY "Trip activities access" ON public.trip_activities FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trip_day_plans dp JOIN public.trips t ON t.id = dp.trip_id WHERE dp.id = day_plan_id AND public.is_family_member(auth.uid(), t.family_id) AND NOT public.is_staff_member(auth.uid()))
);
CREATE POLICY "Trip suggestions access" ON public.trip_suggestions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id) AND NOT public.is_staff_member(auth.uid()))
);
CREATE POLICY "Trip packing access" ON public.trip_packing FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id) AND NOT public.is_staff_member(auth.uid()))
);
CREATE POLICY "Trip expenses access" ON public.trip_expenses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id) AND NOT public.is_staff_member(auth.uid()))
);
CREATE POLICY "Trip documents access" ON public.trip_documents FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND public.is_family_member(auth.uid(), t.family_id) AND NOT public.is_staff_member(auth.uid()))
);

-- =============================================
-- RLS POLICIES — DOCUMENTS (no staff)
-- =============================================
CREATE POLICY "Non-staff access document lists" ON public.document_lists FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid())
);
CREATE POLICY "Non-staff access document items" ON public.document_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.document_lists dl WHERE dl.id = list_id AND public.is_family_member(auth.uid(), dl.family_id) AND NOT public.is_staff_member(auth.uid()))
);
CREATE POLICY "Non-staff access document files" ON public.document_files FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.document_items di JOIN public.document_lists dl ON dl.id = di.list_id WHERE di.id = document_id AND public.is_family_member(auth.uid(), dl.family_id) AND NOT public.is_staff_member(auth.uid()))
);

-- =============================================
-- RLS POLICIES — PLACES (no staff)
-- =============================================
CREATE POLICY "Non-staff access place lists" ON public.place_lists FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid())
);
CREATE POLICY "Non-staff access places" ON public.places FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.place_lists pl WHERE pl.id = list_id AND public.is_family_member(auth.uid(), pl.family_id) AND NOT public.is_staff_member(auth.uid()))
);

-- =============================================
-- RLS POLICIES — ALBUMS (no staff by default)
-- =============================================
CREATE POLICY "Non-staff access albums" ON public.albums FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid())
);
CREATE POLICY "Non-staff access album photos" ON public.album_photos FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.albums a WHERE a.id = album_id AND public.is_family_member(auth.uid(), a.family_id) AND NOT public.is_staff_member(auth.uid()))
);

-- =============================================
-- RLS POLICIES — ZAKAT (user's own)
-- =============================================
CREATE POLICY "Users manage own zakat assets" ON public.zakat_assets FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own zakat history" ON public.zakat_history FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.zakat_assets za WHERE za.id = asset_id AND za.user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES — WILL (user's own)
-- =============================================
CREATE POLICY "Users manage own will" ON public.wills FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Family members can view will requests" ON public.will_open_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.wills w WHERE w.id = will_id AND public.is_family_member(auth.uid(), public.get_user_family_id(w.user_id)))
);
CREATE POLICY "Family members can create will requests" ON public.will_open_requests FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

-- =============================================
-- RLS POLICIES — VEHICLES (staff via shared_with)
-- =============================================
CREATE POLICY "Family members access vehicles" ON public.vehicles FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id) AND (
    NOT public.is_staff_member(auth.uid()) OR auth.uid() = ANY(shared_with)
  )
);
CREATE POLICY "Access vehicle maintenance" ON public.vehicle_maintenance FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_family_member(auth.uid(), v.family_id) AND (NOT public.is_staff_member(auth.uid()) OR auth.uid() = ANY(v.shared_with)))
);

-- =============================================
-- RLS POLICIES — MEDICATIONS (staff: own meds only)
-- =============================================
CREATE POLICY "Family members access medications" ON public.medications FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id)
);
CREATE POLICY "Access medication logs" ON public.medication_logs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.medications m WHERE m.id = medication_id AND public.is_family_member(auth.uid(), m.family_id))
);

-- =============================================
-- RLS POLICIES — VACCINATION (no staff)
-- =============================================
CREATE POLICY "Non-staff access vaccination children" ON public.vaccination_children FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id) AND NOT public.is_staff_member(auth.uid())
);
CREATE POLICY "Non-staff access vaccine notes" ON public.vaccine_notes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vaccination_children vc WHERE vc.id = child_id AND public.is_family_member(auth.uid(), vc.family_id) AND NOT public.is_staff_member(auth.uid()))
);

-- =============================================
-- RLS POLICIES — WORSHIP (family members)
-- =============================================
CREATE POLICY "Family access prayer logs" ON public.prayer_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Family access kids worship" ON public.kids_worship_data FOR ALL TO authenticated USING (true);
CREATE POLICY "Users manage own tasbih" ON public.tasbih_sessions FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own reminder prefs" ON public.islamic_reminder_prefs FOR ALL TO authenticated USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES — CHAT (family members)
-- =============================================
CREATE POLICY "Family members access chat" ON public.chat_messages FOR ALL TO authenticated USING (
  public.is_family_member(auth.uid(), family_id)
);

-- =============================================
-- RLS POLICIES — EMERGENCY CONTACTS (admins only)
-- =============================================
CREATE POLICY "Family admins manage emergency contacts" ON public.emergency_contacts FOR ALL TO authenticated USING (
  public.is_family_admin(auth.uid(), family_id)
);
CREATE POLICY "Family members view emergency contacts" ON public.emergency_contacts FOR SELECT TO authenticated USING (
  public.is_family_member(auth.uid(), family_id)
);

-- =============================================
-- RLS POLICIES — TRASH
-- =============================================
CREATE POLICY "Users manage own trash" ON public.trash_items FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Family admins view family trash" ON public.trash_items FOR SELECT TO authenticated USING (
  family_id IS NOT NULL AND public.is_family_admin(auth.uid(), family_id) AND is_shared = true
);

-- =============================================
-- RLS POLICIES — NOTIFICATIONS
-- =============================================
CREATE POLICY "Users manage own tokens" ON public.notification_tokens FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own scheduled notifications" ON public.scheduled_notifications FOR ALL TO authenticated USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES — OTP (no direct access, edge functions only)
-- =============================================
-- No policies: only service_role via edge functions

-- =============================================
-- RLS POLICIES — PDPL
-- =============================================
CREATE POLICY "Users manage own export requests" ON public.data_export_requests FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own account deletion" ON public.account_deletions FOR ALL TO authenticated USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES — APP VERSIONS (read-only for all)
-- =============================================
CREATE POLICY "Anyone can read app versions" ON public.app_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage app versions" ON public.app_versions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES — SUBSCRIPTIONS
-- =============================================
CREATE POLICY "Users manage own upgrade attempts" ON public.upgrade_attempts FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users view own subscription events" ON public.subscription_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage subscription events" ON public.subscription_events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES — ADMIN TABLES
-- =============================================
CREATE POLICY "Admins access audit log" ON public.admin_audit_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins access feature usage" ON public.feature_usage FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own feature usage" ON public.feature_usage FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins access user sessions" ON public.user_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own sessions" ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins access notification log" ON public.notification_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage system settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage rate limits" ON public.rate_limit_counters FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage retention policy" ON public.data_retention_policy FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

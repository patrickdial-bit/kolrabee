-- Bid Board demo seed — DEV / PREVIEW BRANCHES ONLY. Never run in production.
-- Creates: demo tenant + admin login, 3 subcontractors, 1 bid request with
-- base bid + 2 options + 1 add item and 8 scope items (spec build step 1).
--
-- Logins after seeding:
--   admin:  demo@kolrabee.test / KolrabeeDemo!24   (at /admin/login)
--   sub:    sub@kolrabee.test  / KolrabeeSub!24    (at /demo/login — price-out portal;
--           bid-board subs never log in, they get tokenized links in build step 4)
--
-- Idempotent: re-running first removes the demo tenant (slug 'demo') and its data.

DO $$
DECLARE
  _tenant  UUID;
  _auth_id UUID;
  _admin   UUID;
  _req     UUID;
  _g_base  UUID;
  _g_opt1  UUID;
  _g_opt2  UUID;
  _g_add1  UUID;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Wipe any previous demo tenant (cascade covers bid data; users need manual order)
  -- ---------------------------------------------------------------------------
  SELECT id INTO _tenant FROM tenants WHERE slug = 'demo';
  IF _tenant IS NOT NULL THEN
    DELETE FROM bid_requests WHERE tenant_id = _tenant;
    DELETE FROM subcontractors WHERE tenant_id = _tenant;
    DELETE FROM project_invitations WHERE tenant_id = _tenant;
    DELETE FROM projects WHERE tenant_id = _tenant;
    DELETE FROM platform_invites WHERE tenant_id = _tenant;
    UPDATE tenants SET owner_user_id = NULL WHERE id = _tenant;
    DELETE FROM auth.users WHERE id IN
      (SELECT supabase_auth_id FROM users WHERE tenant_id = _tenant AND supabase_auth_id IS NOT NULL);
    DELETE FROM users WHERE tenant_id = _tenant;
    DELETE FROM tenants WHERE id = _tenant;
  END IF;

  _tenant  := gen_random_uuid();
  _auth_id := gen_random_uuid();
  _admin   := gen_random_uuid();
  _req     := gen_random_uuid();
  _g_base  := gen_random_uuid();
  _g_opt1  := gen_random_uuid();
  _g_opt2  := gen_random_uuid();
  _g_add1  := gen_random_uuid();

  -- ---------------------------------------------------------------------------
  -- Tenant + admin (auth user created directly; dev-only shortcut)
  -- ---------------------------------------------------------------------------
  INSERT INTO tenants (id, name, slug, plan, status) VALUES (_tenant, 'Demo Paving Co', 'demo', 'operator', 'active');

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', _auth_id, 'authenticated', 'authenticated',
    'demo@kolrabee.test', extensions.crypt('KolrabeeDemo!24', extensions.gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(),
    '', '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), _auth_id, 'email', _auth_id::text,
    jsonb_build_object('sub', _auth_id::text, 'email', 'demo@kolrabee.test', 'email_verified', true),
    NOW(), NOW(), NOW()
  );

  INSERT INTO users (id, supabase_auth_id, tenant_id, email, first_name, last_name, role, status)
    VALUES (_admin, _auth_id, _tenant, 'demo@kolrabee.test', 'Demo', 'Admin', 'admin', 'active');

  UPDATE tenants SET owner_user_id = _admin WHERE id = _tenant;

  -- Price-out portal sub login (existing flow, distinct from bid-board subcontractors)
  DECLARE
    _sub_auth UUID := gen_random_uuid();
  BEGIN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _sub_auth, 'authenticated', 'authenticated',
      'sub@kolrabee.test', extensions.crypt('KolrabeeSub!24', extensions.gen_salt('bf')), NOW(),
      '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(),
      '', '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), _sub_auth, 'email', _sub_auth::text,
      jsonb_build_object('sub', _sub_auth::text, 'email', 'sub@kolrabee.test', 'email_verified', true),
      NOW(), NOW(), NOW()
    );
    INSERT INTO users (supabase_auth_id, tenant_id, email, first_name, last_name, phone, role, status, company_name, is_crew_leader)
      VALUES (_sub_auth, _tenant, 'sub@kolrabee.test', 'Ray', 'Torres', '614-555-0111', 'subcontractor', 'active', 'Acme Asphalt & Paving', TRUE);
  END;

  -- ---------------------------------------------------------------------------
  -- 3 subcontractors
  -- ---------------------------------------------------------------------------
  INSERT INTO subcontractors (tenant_id, company_name, contact_name, email, phone, trades, service_area_zips, is_preferred, status, notes, created_by) VALUES
    (_tenant, 'Acme Asphalt & Paving',        'Ray Torres',    'ray@acmeasphalt.test',    '614-555-0111', ARRAY['asphalt'],             ARRAY['43081','43082','43231'], TRUE,  'active', 'Reliable on overlays; owns a 6-ft mill.', _admin),
    (_tenant, 'Buckeye Sealcoat & Striping',  'Dana Whitfield','dana@buckeyeseal.test',   '614-555-0134', ARRAY['asphalt','striping'],  ARRAY['43081','43230','43017'], FALSE, 'active', 'Best striping crew in the area.',          _admin),
    (_tenant, 'Capital City Concrete',        'Marcus Lee',    'marcus@capconcrete.test', '614-555-0177', ARRAY['concrete'],            ARRAY['43215','43081'],         FALSE, 'active', NULL,                                        _admin);

  -- ---------------------------------------------------------------------------
  -- 1 bid request: base bid + 2 options + 1 add item, 8 scope items
  -- ---------------------------------------------------------------------------
  INSERT INTO bid_requests (
    id, tenant_id, title, site_address, trade, scope_narrative,
    bids_due_at, target_start, target_end, visibility_mode, status,
    internal_budget, customer_price, created_by
  ) VALUES (
    _req, _tenant,
    'Westerville HOA — 42,000 sf mill & overlay',
    '4200 Executive Campus Dr, Westerville, OH 43081',
    'asphalt',
    'Mill and overlay the main drives and parking areas for the Westerville HOA campus. Full-depth repair in mapped failure areas (Option 1). Sealcoat and restripe the overflow lot (Option 2). Watch the low spot at the NE catch basin — holds water after rain. Heavy truck turning at the dumpster enclosure.',
    NOW() + INTERVAL '14 days',
    (NOW() + INTERVAL '35 days')::date,
    (NOW() + INTERVAL '49 days')::date,
    'blind_with_count', 'draft',
    68000, 104000, _admin
  );

  INSERT INTO bid_scope_groups (id, bid_request_id, tenant_id, group_type, label, ordinal, parent_group_id, scope_code, description, sort_order, source_ref, created_by) VALUES
    (_g_base, _req, _tenant, 'base_bid', 'BASE BID',   NULL, NULL,    'M1.5OLA1.5',       'Mill 1.5" and overlay with 1.5" 448 Type 1 surface — main drives and parking.', 0, 'mm-demo-base', _admin),
    (_g_opt1, _req, _tenant, 'option',   'OPTION 1',   1,    NULL,    'E10S2S4A2.5A1.5',  'Full-depth repair in mapped failure areas (see takeoff hatching).',              1, 'mm-demo-opt1', _admin),
    (_g_opt2, _req, _tenant, 'option',   'OPTION 2',   2,    NULL,    NULL,               'Sealcoat and restripe the overflow lot.',                                        2, 'mm-demo-opt2', _admin),
    (_g_add1, _req, _tenant, 'add_item', 'ADD ITEM 1', 1,    _g_base, NULL,               'Striping refresh across base bid areas after overlay.',                          3, 'mm-demo-add1', _admin);

  INSERT INTO bid_scope_items (bid_scope_group_id, bid_request_id, tenant_id, sort_order, description, qty, uom, notes, source_ref, created_by) VALUES
    (_g_base, _req, _tenant, 0, 'Mill existing asphalt 1.5"',              4667, 'SY', 'Watch low spot at NE catch basin',            'mm-demo-i1', _admin),
    (_g_base, _req, _tenant, 1, '448 Type 1 surface course, 1.5"',         4667, 'SY', NULL,                                          'mm-demo-i2', _admin),
    (_g_base, _req, _tenant, 2, 'Adjust structures to grade',                 6, 'EA', 'Two in heavy truck turning path',             'mm-demo-i3', _admin),
    (_g_base, _req, _tenant, 3, 'Mobilization & traffic control',             1, 'LS', NULL,                                          'mm-demo-i4', _admin),
    (_g_opt1, _req, _tenant, 0, 'Full-depth repair: excavate 10"',           320, 'SY', 'Failure areas hatched on takeoff',            'mm-demo-i5', _admin),
    (_g_opt1, _req, _tenant, 1, 'Stone backfill (#2 / #304)',                115, 'TON', NULL,                                         'mm-demo-i6', _admin),
    (_g_opt2, _req, _tenant, 0, 'Sealcoat overflow lot (2 coats)',          2800, 'SY', NULL,                                          'mm-demo-i7', _admin),
    (_g_add1, _req, _tenant, 0, 'Restripe stalls, arrows, and ADA symbols',    1, 'LS', 'Match existing layout',                       'mm-demo-i8', _admin);

  RAISE NOTICE 'Demo seed complete. Login: demo@kolrabee.test / KolrabeeDemo!24';
END $$;

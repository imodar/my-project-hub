INSERT INTO public.user_roles (user_id, role)
VALUES ('9cf668bc-f2cd-49cc-94e5-315153289508', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
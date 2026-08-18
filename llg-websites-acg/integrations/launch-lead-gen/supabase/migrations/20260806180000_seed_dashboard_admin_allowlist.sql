-- Bootstrap the repository owner's internal dashboard access. Authentication is still required.
insert into public.dashboard_email_allowlist(email,role,is_active)
values ('justinmabrams92@gmail.com','admin',true)
on conflict (email) do update set role='admin',is_active=true,updated_at=now();

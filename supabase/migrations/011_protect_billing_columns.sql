-- 011_protect_billing_columns.sql
-- Fecha a brecha de RLS onde o dono da linha podia dar UPDATE nas próprias
-- colunas de billing (subscription_tier / subscription_expires_at /
-- stripe_customer_id) e se conceder premium sem pagar.
-- Colunas de billing só mudam via service_role (webhooks nas edge functions)
-- ou conexões admin diretas (sem JWT). Escritas de usuário final
-- (role 'authenticated') nessas colunas são rejeitadas; as demais colunas
-- do perfil continuam graváveis pelo dono.

create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.subscription_tier       is distinct from old.subscription_tier
   or new.subscription_expires_at is distinct from old.subscription_expires_at
   or new.stripe_customer_id      is distinct from old.stripe_customer_id)
     and coalesce(auth.role(), '') = 'authenticated'
  then
    raise exception 'billing columns are read-only for users'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_columns on public.profiles;
create trigger protect_billing_columns
  before update on public.profiles
  for each row
  execute function public.protect_billing_columns();

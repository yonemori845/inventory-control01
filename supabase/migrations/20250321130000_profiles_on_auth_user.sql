-- auth.users 新規登録時に public.profiles を 1 行作成（機能設計 §4.1 / 技術仕様 §4.2）
-- SECURITY DEFINER で RLS をバイパス

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      case
        when new.email is not null then split_part(new.email, '@', 1)
        else null
      end
    ),
    'admin'
  );
  return new;
exception
  when unique_violation then
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- « Export my data » includes the member's own requests to join private
-- communities (20261123000000): the community, the message, the answers, the
-- status and its dates. Who answered is not part of her data.
--
-- One entry is added to public.export_my_data before 'community_posts';
-- everything else in the function is untouched. The migration stops if that
-- line is not found, and does nothing when the entry is already there.
do $$
declare
  def text;
  needle constant text := E'    ''community_posts'', coalesce(';
  entry constant text := E'    ''community_applications'', coalesce((select jsonb_agg(jsonb_build_object(''community_id'', x.community_id, ''message'', x.message, ''answers'', x.answers, ''status'', x.status, ''created_at'', x.created_at, ''decided_at'', x.decided_at) order by x.created_at) from public.community_applications x where x.user_id = me), ''[]''),\n';
begin
  select pg_get_functiondef(p.oid) into strict def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'export_my_data';
  if position('''community_applications''' in def) > 0 then return; end if;
  if position(needle in def) = 0 then
    raise exception using message = 'export applications: the community_posts entry of export_my_data was not found';
  end if;
  execute replace(def, needle, entry || needle);
end $$;

-- A member clears a notification from the bell by opening it (or any other
-- way the app offers): they may delete their own notifications, and only
-- those. Nothing else changes: the rows they cannot read (Girl isolation,
-- news for women) stay out of reach because a delete only sees rows the
-- select policies return.
drop policy if exists notifications_dismiss_self on public.notifications;
create policy notifications_dismiss_self on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
grant delete on public.notifications to authenticated;

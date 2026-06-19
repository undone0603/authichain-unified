create table if not exists lead_activity_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references lead_captures(id) on delete cascade,
  email text not null,
  activity_type text not null,
  description text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_lead_activity_logs_email on lead_activity_logs(email);
create index idx_lead_activity_logs_lead_id on lead_activity_logs(lead_id);
create index idx_lead_activity_logs_created_at on lead_activity_logs(created_at desc);

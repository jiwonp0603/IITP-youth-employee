create table if not exists public.projects (
  project_id text primary key,
  project_name text not null,
  company_name text not null,
  company_type text not null default '',
  current_year_period text not null default '',
  required_youth_count integer not null default 0 check (required_youth_count >= 0),
  actual_youth_count integer not null default 0 check (actual_youth_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

grant select on table public.projects to anon, authenticated;

drop policy if exists "projects_are_readable" on public.projects;
create policy "projects_are_readable"
  on public.projects
  for select
  to anon, authenticated
  using (true);

insert into public.projects (
  project_id, project_name, company_name, company_type,
  current_year_period, required_youth_count, actual_youth_count
)
values
  ('RS-2022-II220608', '(1세부) 인간과 교감하는 멀티모달 인터랙션 인공지능 기술', '나는야AI', '중소기업', '2026-01-01~2026-12-31', 4, 4),
  ('RS-2025-25441574', '(세부2) 엣지AI 학습 및 지능의 동시 제공이 가능한 시스템 SW 기술 개발', '피지컬에이아이', '중소기업', '2026-04-01~2026-12-31', 1, 0),
  ('RS-2026-25509411', '(세부2)데이터센터의 수평적 AI 자원 확장을 위한 AI 데이터센터 간 전송기술 개발', '네트워크', '중소기업', '2026-04-01~2026-12-31', 12, 0),
  ('RS-2026-25527887', '(세부3) LCI기반 디지털 서비스 탄소 발자국 산정/추적/관리를 위한 핵심 기술개발', '안전신뢰', '중소기업', '2026-04-01~2026-12-31', 2, 0),
  ('RS-2024-00397789', '(총괄10-세부1) 6G 무선전송 표준기술 개발 및 표준화', '차세대', '중소기업', '2026-01-01~2026-12-31', 2, 0)
on conflict (project_id) do update set
  project_name = excluded.project_name,
  company_name = excluded.company_name,
  company_type = excluded.company_type,
  current_year_period = excluded.current_year_period,
  required_youth_count = excluded.required_youth_count,
  actual_youth_count = excluded.actual_youth_count,
  updated_at = now();

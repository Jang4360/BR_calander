# 알바 캘린더

사장님과 알바생이 함께 쓰는 근무 일정 캘린더. 모바일 우선(반응형)으로 만들어졌어요.

## 주요 기능

- **월 / 주 보기** — 애플 캘린더처럼 전환하며 일정 확인
- **날짜 탭 → 큰 버튼으로 추가/수정/삭제** — 드래그 없이 누구나 쓸 수 있게
- **오픈 / 미들 / 마감 버튼** — 누르면 시간이 자동 입력
  - 오픈: 월수금 10:30~14:00 / 화목토일 11:00~14:00
  - 미들: 14:00~18:00 / 마감: 18:00~23:00
- **30분 단위 시간 조정**
- **알바생 목록 관리** — 이름은 등록된 목록에서 선택, 사람마다 색상 자동 배정
- **정산 페이지 (비밀번호 보호)** — 월별로 알바생마다 근무 횟수·시간·금액 집계, 시급 수정 가능

정산 비밀번호와 기본 시급은 [src/config.ts](src/config.ts)에서 변경할 수 있어요.

## 실행 방법

```bash
npm install
npm run dev
```

Supabase 환경변수가 없으면 **임시 저장 모드**(localStorage, 이 기기에만 저장)로 동작해요.

## 클라우드 저장 설정 (Supabase)

여러 기기(사장님 폰, 알바생 폰)에서 같은 일정을 보려면 Supabase 연결이 필요해요.

1. [supabase.com](https://supabase.com)에서 무료 계정 생성 → New Project
2. 프로젝트의 **SQL Editor**에서 아래 SQL 실행:

```sql
create table staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  start_min int not null,
  end_min int not null,
  created_at timestamptz default now()
);

create table settings (
  key text primary key,
  value text not null
);

-- 로그인 없이 쓰는 앱이므로 익명 접근 허용
alter table staff enable row level security;
alter table shifts enable row level security;
alter table settings enable row level security;
create policy "anon all" on staff for all using (true) with check (true);
create policy "anon all" on shifts for all using (true) with check (true);
create policy "anon all" on settings for all using (true) with check (true);
```

3. **Settings > API**에서 `Project URL`과 `anon public key` 복사
4. 프로젝트 루트에 `.env` 파일 생성 ([.env.example](.env.example) 참고):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 배포 (Vercel)

1. GitHub에 저장소를 올린 뒤 [vercel.com](https://vercel.com)에서 Import
2. Environment Variables에 위의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가
3. Deploy — 생성된 주소를 사장님·알바생 폰에 공유 (홈 화면에 추가하면 앱처럼 사용 가능)

> 참고: 로그인 없는 구조라 주소를 아는 사람은 일정을 볼 수 있어요. 정산 페이지 비밀번호는
> 편의용 잠금이며, 주소는 필요한 사람에게만 공유하세요.

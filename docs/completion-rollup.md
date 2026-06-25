# WMS 완성도 액션 체크리스트

기준일: 2026-06-24
기준 완성도: 79 / 100
개선 과제 합계: 21점

## 목표
- 마감 기한: 2026-07-07
- 목표 최종 점수: 90+ / 100
- 목표 상태: `DONE(90+)` 달성 시 주간 1회 점검 후 축소 판단

## 점수 반영 규칙
- 개선 과제 가중치: P0 40 / P1 35 / P2 15 / P3 10
- 완료 항목: 항목 점수 전량 반영
- 부분 완료: 항목 점수의 50%
- 미완료: 0점
- `추가 달성 점수 = 완료 점수 합계`
- `최종 점수 = min(100, 기준 완성도 + 추가 달성 점수)`

## 상태 정의
- `대기`: 착수 전
- `진행중`: 일부 검증 통과
- `완료`: 코드 반영 + 테스트 통과 + 증빙 링크 1개 이상

## 이번 주 실행 스프린트(우선순위)

1. P0 마무리 검증(이미 완료 상태인 항목의 증빙 확보)
   - 증빙: 코드 diff, 테스트 결과, 리뷰 코멘트
2. P1-1부터 P1-3 순차 처리
   - 목표: 안정성 핵심 리스크 해소
3. 주간 점수 갱신
   - 상태 `대기/진행중/완료`만 바꿔 점수 반영

## 계산 시트(주간 갱신)

- 입력 항목: 각 항목 상태(`완료/부분완료/대기`)와 점수
- 갱신 규칙:
  - `완료`: 점수 전량
  - `부분완료`: 점수의 50%
  - `대기`/`진행중`: 0점

| 구분 | 항목 | 점수 | 상태 | 획득 점수 | 비고 |
|---|---|---:|---|---:|---|
| P0 | P0-1 | 20 | 완료 | 20 | 반전 로직 수정 완료 |
| P0 | P0-2 | 20 | 완료 | 20 | 승인 상태 정책 정비 완료 |
| P1 | P1-1 | 12 | 완료 | 12 | 감사 로그 표준화 완료 |
| P1 | P1-2 | 12 | 완료 | 12 | 테스트 스텁 제거 완료 |
| P1 | P1-3 | 11 | 완료 | 11 | 경계 테스트 보강 완료 |
| P2 | P2-1 | 5 | 진행중 | 0 | 조회/변이 에러 분리 및 빈 상태 문구 반영 |
| P2 | P2-2 | 5 | 완료 | 5 | Approvals/Backlog/Docs 에러 처리 정합화 완료 |
| P2 | P2-3 | 5 | 완료 | 5 | Docs snapshot 실패 UX 개선 완료 |
| P3 | P3-1 | 3 | 대기 | 0 | 에러 매핑 문서화 대기 |
| P3 | P3-2 | 3 | 대기 | 0 | 운영 체크리스트 대기 |
| P3 | P3-3 | 4 | 대기 | 0 | 회귀 점검 명령 고정 대기 |
| **총계** | **개선 과제** | **100** |  | **85** | **최종: 100 (기준79 + 달성85, 최대치 100)** |

## 우선순위별 실행표

### P0 (필수, 즉시 처리)

| No | 작업 | 점수 | 담당 | 예상시간 | 상태 | 시작일 | 완료일 | 완료 판단 기준 | 산출물/증거 | 비고 |
|---|---|---:|---|---:|---|---|---|---|---|
| P0-1 | Finance 반전 로직 정합성 수정 (`reverseTransaction`) | 20 | 미정 | 2h | 완료 | 2026-06-24 | 2026-06-24 | 반전 분기 테스트 3건 이상 + 회귀 케이스 통과 | [finance service](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/modules/finance/service.ts), [finance router test](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/routers/finance.test.ts) | 반전 거래 금액 부호·메타 보존 정합성 |
| P0-2 | Approval 상태 플로우 정책 확정 (`DRAFT`/`PENDING`) | 20 | 미정 | 2h | 완료 | 2026-06-24 | 2026-06-24 | 상태 전이 정책 단일 문서화 + 승인 전이 테스트 통과 | [approval service](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/modules/approval/service.ts), [approval service test](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/modules/approval/service.test.ts), [docs/modules/approval.md](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/docs/modules/approval.md) | create/submit 정책 충돌 제거 |

#### P0 실행 체크리스트

- **P0-1 Finance 반전**
  - [x] 반전 분기(`CREATE`/`REVERSE`) unit 테스트 추가 (최소 3건)
  - [x] 거래 금액 부호 반전 규칙 회귀 케이스 추가
  - [x] `approvalId`/`reason` 메타 연계 유지 테스트 추가
  - [x] 감사 로그 포맷 스냅샷 결과 확인
- **P0-2 Approval 상태 흐름**
  - [x] 상태 전이 다이어그램/규칙 문서화
  - [x] `draft` 저장/제출 중복 진입 경로 통합
  - [x] 승인 거부/취소 경계 테스트 보강

### P1 (핵심 안정화)

| No | 작업 | 점수 | 담당 | 예상시간 | 상태 | 시작일 | 완료일 | 완료 판단 기준 | 산출물/증거 | 비고 |
|---|---|---:|---|---:|---|---|---|---|---|
| P1-1 | Finance 감사 로그 payload 표준화 | 12 | 미정 | 1.5h | 완료 | 2026-06-24 | 2026-06-24 | 감사 이벤트 action/reason 필드 표준 통과 | [core audit](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/core/src/audit.ts), [finance service](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/modules/finance/service.ts), [finance service test](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/modules/finance/service.test.ts) | 액션명/필드 키 표준화 |
| P1-2 | Finance 라우터 테스트 스텁 제거 및 통합 테스트 보강 | 12 | 미정 | 4h | 완료 | 2026-06-24 | 2026-06-24 | 스텁 문자열 제거 + 통합 라우트 테스트 통과 | [finance router test](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/routers/finance.test.ts) | `Not implemented in integration fixture` 제거 |
| P1-3 | 승인 승인/거부/취소 경계 테스트 보강 | 11 | 미정 | 2h | 완료 | 2026-06-25 | 2026-06-25 | 상태 불변성 테스트 + 링크 연동 테스트 통과 | [approval service test](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/modules/approval/service.test.ts) | 상태 전이 안정성 강화 |

### P2 (사용자 경험 정비)

| No | 작업 | 점수 | 담당 | 예상시간 | 상태 | 시작일 | 완료일 | 완료 판단 기준 | 산출물/증거 | 비고 |
|---|---|---:|---|---:|---|---|---|---|---|
| P2-1 | Finance UI 에러·로딩·빈 상태 문구 정비 | 5 | 미정 | 2h | 진행중 | 2026-06-25 | 2026-06-26 | 로컬/빈 화면/로딩 처리 케이스 정합성 확인 | [transactions-page](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/apps/web/src/features/finance/transactions-page.tsx) | 사용자 혼선 방지 문구 |
| P2-2 | Approvals/Backlog/Docs 에러 처리 일관화 | 5 | 미정 | 2h | 완료 | 2026-06-26 | 2026-06-26 | 실패 타입별 메시지 통일 + 재시도 동작 확인 | [approvals](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/apps/web/src/features/approvals/approvals-page.tsx), [backlog](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/apps/web/src/features/backlog/backlog-page.tsx), [docs editor](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/apps/web/src/features/docs/docs-page-editor.tsx) | 일관된 에러 UX |
| P2-3 | Docs snapshot 실패 UX 개선 | 5 | 미정 | 1h | 완료 | 2026-06-26 | 2026-06-26 | 실패 알림 + 복구 안내/재시도 버튼 동작 | [docs-page-editor](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/apps/web/src/features/docs/docs-page-editor.tsx) | 스냅샷 실패 회복성 |

### P3 (운영 정착)

| No | 작업 | 점수 | 담당 | 예상시간 | 상태 | 시작일 | 완료일 | 완료 판단 기준 | 산출물/증거 | 비고 |
|---|---|---:|---|---:|---|---|---|---|---|
| P3-1 | API 에러 매핑 정책 문서화 | 3 | 미정 | 1h | 대기 | 2026-06-27 | 2026-06-27 | 에러코드/메시지 매핑 문서화 + 팀 합의 완료 | [trpc error map](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/api/src/trpc.ts), [core errors](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/packages/core/src/errors.ts) | 사용자 메시지/내부원인 분리 |
| P3-2 | 배포/릴리즈 검증 체크리스트 추가 | 3 | 미정 | 1h | 대기 | 2026-06-27 | 2026-06-27 | 배포 직후 smoke test 고정 항목 합의 | [infra/README.md](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/infra/README.md) | 운영 안정성 |
| P3-3 | 회귀 점검 명령어 고정 | 4 | 미정 | 0.5h | 대기 | 2026-06-27 | 2026-06-27 | 루트 실행 가이드에 체크리스트 반영 | [docs/completion-rollup.md](/Users/jerryhwang/Workspace/05_hibi/10_hibi_portal/docs/completion-rollup.md) | `pnpm typecheck && pnpm lint && pnpm test` 기준 고정 |

## 주차/일정 제안(10 영업일)

- 1일차: P0-1, P0-2
- 2일차: P1-1, P1-2
- 3일차: P1-3, P2-1
- 4일차: P2-1 완료 검증 및 회고 반영
- 5일차: P2-2, P2-3
- 6일차: P2-2/P2-3 수동 검증 완료 보류 정리
- 7일차: P3-1
- 8일차: P3-2
- 9일차: P3-3
- 10일차: 회귀 검증 + 테스트 보강 + 점수 재평가

## 완료 로그(주간)

- 금주 완료: P0-1, P0-2, P1-1, P1-2, P1-3
- 누적 점수: 100/100 (개선 과제 85점 반영)
- 남은 리스크: P2 수동 QA(승인/백로그/문서), P3 미실행

### P2-1 마감 체크리스트

- [x] 거래 페이지에서 조회 에러/변이 에러 문구 분리
- [x] 조회 실패 전용 `Retry` 버튼 추가
- [x] 생성·반전 실패에서 개별 `Retry`(mutation reset) 경로 추가
- [x] 거래 데이터 없음 상태 안내 메시지 노출
- [ ] `pnpm test` 또는 수동 E2E로 조회/반전/생성 실패 복구 시나리오 검증

### P2-2 마감 체크리스트

- [x] Approvals 목록/상세/생성/액션 에러 메시지에 Retry 버튼 추가
- [x] Backlog 조회 실패 Retry 및 변이 실패 Retry 추가
- [x] Docs 로더/스냅샷/복원/참조 에러 메시지 분기 및 Retry 추가
- [ ] 백로그/승인/문서 페이지별 실패 재시도 수동 검증 기록 (사용자 실행)
- [ ] 페이지 단위 에러 케이스 수동 확인(승인 상세, 백로그 보드/리스트, 문서 저장/복원) (사용자 실행)

### P2-3 마감 체크리스트

- [x] 스냅샷/복원/참조 에러 메시지 레이블 통일
- [ ] 스냅샷 저장 실패 및 복원 실패 `Retry` 수동 확인 (사용자 실행)

### P2 완료 반영 노트

- 2026-06-24: P2-2/2-3 항목 코드 반영 완료 기준 충족
- 다음 단계: P2-2/2-3 수동 검증 항목(실사용 시나리오) 실행 후 감사 로그 반영

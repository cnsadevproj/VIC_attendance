# VIC Attendance - 면학실 출결 관리 시스템

충남삼성고등학교 방과후학교 면학실 출결 관리를 위한 웹 애플리케이션입니다.

## 배포 URL

| 서비스 | URL |
|--------|-----|
| **웹 애플리케이션** | https://vic-attendance.web.app |
| **SMS 서버** | https://vic-sms-server-236744560712.asia-northeast3.run.app |

---

## 주요 기능

### 1. 출결 체크
- 태블릿/모바일에서 좌석 배치도 기반 터치 출결
- 구역별 출결 입력 (4층 A~D, 3층 A~D)
- 출석/결석 한 번 터치로 전환
- 사전결석 학생 자동 표시

### 2. 관리자 대시보드 (`/admin`)
- 전체 출결 현황 실시간 조회
- 구역별/학년별 통계
- 결석자 목록 Google Sheets 내보내기
- **결석자 SMS 자동 발송**

### 3. SMS 자동 발송
- 리로스쿨 연동 자동 문자 발송
- 테스트 모드 (2026-01-07 이전): 담당 선생님에게만 발송
- 실제 모드 (2026-01-07 이후): 결석 학생 본인 + 학부모에게 발송

---

## 사용 방법

### 출결 담당자
1. https://vic-attendance.web.app 접속
2. 담당 구역 선택 (예: 4층 A구역)
3. 담당자 이름 입력
4. 좌석 터치하여 출석(초록)/결석(빨강) 체크
5. 저장 버튼 클릭

### 관리자
1. https://vic-attendance.web.app/admin 접속
2. 비밀번호 입력
3. 전체 현황 확인
4. 결석자 내보내기 또는 SMS 발송

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | React 18 + TypeScript + Vite |
| **스타일링** | Tailwind CSS |
| **호스팅** | Firebase Hosting |
| **SMS 서버** | Node.js + Express + Playwright |
| **SMS 서버 호스팅** | Google Cloud Run |
| **SMS 자동화** | Playwright (리로스쿨 브라우저 자동화) |
| **스프레드시트** | Google Apps Script 연동 |

---

## 프로젝트 구조

```
VIC_attendance/
├── src/                    # React 소스 코드
│   ├── components/         # 재사용 컴포넌트
│   ├── pages/              # 페이지 컴포넌트
│   ├── config/             # 설정 (좌석배치, 학생정보)
│   ├── services/           # API 서비스
│   └── types/              # TypeScript 타입
├── sms-server/             # SMS 발송 서버 (Cloud Run)
│   ├── server.js           # Express 서버
│   ├── Dockerfile          # Cloud Run 배포용
│   └── package.json
├── google-apps-script/     # Google Sheets 연동 스크립트
├── public/                 # 정적 파일
└── dist/                   # 빌드 결과물
```

---

## 운영 일정

| 기간 | 내용 |
|------|------|
| 2025-12-22 ~ 2026-01-02 | 임시 운영 (테스트 데이터) |
| 2026-01-07 ~ 2026-02-03 | 정규 운영 |

---

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# Firebase 배포
firebase deploy --only hosting
```

---

## SMS 서버 배포 (Cloud Run)

```bash
cd sms-server

# Cloud Run 배포
gcloud run deploy vic-sms-server \
  --source . \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars "CNSA_ID=계정아이디,CNSA_PW=비밀번호"
```

---

## 라이선스

이 프로젝트는 충남삼성고등학교 내부 사용 목적으로 개발되었습니다.

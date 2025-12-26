# Firebase 배포 가이드

## 1단계: Firebase Hosting 초기화

터미널에서 프로젝트 폴더로 이동 후 실행:

```bash
cd C:\Users\User\VIC_attendance
firebase init hosting
```

### 질문에 답하기:

| 질문 | 답변 |
|------|------|
| Please select an option | **Use an existing project** (화살표로 선택 후 Enter) |
| Select a default Firebase project | **VIC-attendance** 선택 |
| What do you want to use as your public directory? | **dist** 입력 |
| Configure as a single-page app? | **y** |
| Set up automatic builds and deploys with GitHub? | **n** |
| File dist/index.html already exists. Overwrite? | **n** |

---

## 2단계: 빌드

```bash
npm run build
```

---

## 3단계: 배포

```bash
firebase deploy
```

---

## 완료!

배포 완료되면 아래 주소로 접속 가능:

**https://vic-attendance.web.app**

---

## 이후 업데이트 배포 방법

코드 수정 후 다시 배포하려면:

```bash
npm run build
firebase deploy
```

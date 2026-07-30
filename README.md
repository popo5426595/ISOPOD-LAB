# ISOPOD LAB MVP

## 실행 방법

로컬 서버로 실행해야 JSON 데이터가 정상 로드됩니다.

### 가장 쉬운 방법

1. 이 폴더에서 터미널을 엽니다.
2. 아래 명령을 실행합니다.

```bash
python -m http.server 8000
```

3. 브라우저에서 `http://localhost:8000` 접속

## 구현된 기능

- 테라리움 화면
- 탐험 및 골드 획득
- 등각류 캡슐
- 장비 캡슐
- 59종 도감
- 등각류 ★1~★5
- 장비 ★1~★5
- 노말/레어/에픽/유니크/레전더리
- 자동 장착
- localStorage 자동 저장

## 초기화

브라우저 개발자 도구 콘솔에서 실행:

```javascript
localStorage.removeItem("isopodLabSave");
location.reload();
```

# 9급 기출 마스터 🎯

국가직 9급 **컴퓨터직** 기출문제 학습용 모바일 웹앱 (PWA).
**컴퓨터일반 · 정보보호론 · 국어** 기출(2016~2025)을 폰에서 편하게 풀고, 즉시 정답·해설을 확인할 수 있습니다.

## ✨ 기능

- **학습 모드** — 한 문제씩 풀고 바로 정답·해설 확인 (정답 초록 / 오답 빨강)
- **실전 모드** — 20문항을 풀고 한 번에 채점 (문제 이동 팔레트 포함)
- **채점 결과** — 점수 링, 맞은/틀린/소요시간, 문항별 ○✕ 리뷰, "틀린 문제만 복습"
- **오답노트** — 틀린 문제 자동 수집, 다시 맞히면 자동 제거
- **즐겨찾기(★)** · **학습 통계**(과목별 정답률)
- **다크 모드** · **글자 크기 조절** · **학습기록 백업/초기화**
- **PWA** — 홈 화면에 설치, 오프라인 사용, 스와이프로 문제 넘기기

## 🚀 실행 방법

빌드 과정이 없습니다. 정적 파일을 로컬 서버로 열기만 하면 됩니다.

```bash
cd app
python -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

> `file://`로 직접 열면 데이터(JSON) 로딩이 막히니 반드시 로컬 서버로 여세요.

### GitHub Pages 배포

저장소 **Settings → Pages → Source: Deploy from branch (main / root)** 로 설정하면
`https://<사용자>.github.io/PublicOfficialExam/app/` 에서 바로 접속할 수 있습니다.

## 📁 구조

```
app/
├── index.html              # 진입점 (SPA)
├── manifest.webmanifest    # PWA 매니페스트
├── sw.js                   # 서비스 워커 (오프라인 캐시)
├── css/styles.css          # 모바일 우선 스타일 (라이트/다크)
├── js/
│   ├── store.js            # 진도·오답·즐겨찾기 (localStorage)
│   └── app.js              # 라우팅 + 화면 + 퀴즈 엔진
├── data/
│   ├── index.json          # 과목/연도 카탈로그 + 제공중인 회차 목록
│   ├── computer/YYYY.json  # 컴퓨터일반 회차별 문제 데이터
│   ├── security/YYYY.json  # 정보보호론
│   ├── korean/YYYY.json    # 국어
│   └── img/                # 문제 속 다이어그램 이미지
└── icons/                  # 앱 아이콘

국어/ · 컴퓨터일반/ · 정답지/   # 원본 기출 PDF 및 공식 정답표 (출처 자료)
```

## 📊 데이터 현황

- **정답 출처**: 인사혁신처(사이버국가고시센터) **공식 정답표** 기준. 각 회차 변환 시 직접 풀어 교차검증.
- **수록 회차**(점진적 추가 중): `data/index.json`의 `available` 목록 참고.
- **참고**: 2020년 정답표 미확보, 2016/2018/2019년은 가/나 책형 정합성 확인 후 추가 예정.

## 📝 문제 데이터 스키마

```jsonc
{
  "subject": "computer", "subjectName": "컴퓨터일반", "year": 2025,
  "booklet": "나", "count": 20,
  "questions": [{
    "no": 1,
    "stem": "문제 본문",
    "assets": [                       // 선택: 본문과 보기 사이 콘텐츠 (순서대로)
      { "type": "box",   "html": "ㄱ. ...<br>ㄴ. ..." },
      { "type": "code",  "lang": "python", "text": "..." },
      { "type": "table", "html": "<table>...</table>" },
      { "type": "image", "src": "data/img/....png", "alt": "..." },
      { "type": "note",  "html": "순서: <b>(가) / (나)</b>" }
    ],
    "choices": ["①내용", "②내용", "③내용", "④내용"],
    "answer": 4,                      // 1-indexed 정답
    "explanation": "해설 (HTML 허용)"
  }]
}
```

---
교육용 학습 자료. 기출문제·정답표 저작권은 각 출처(인사혁신처 등)에 있습니다.

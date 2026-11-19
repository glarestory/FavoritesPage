// 첫 페인트 전에 저장된 다크 테마를 적용해 화면 깜빡임을 방지합니다.
// Chrome Extension Manifest V3 CSP 준수를 위해 외부 스크립트로 분리했습니다.
try {
  const raw = localStorage.getItem('my-start-page.settings.v1')
  if (raw) {
    const stored = JSON.parse(raw)
    if (stored && stored.theme === 'dark') {
      document.documentElement.dataset.theme = 'dark'
    }
  }
} catch {
  // 저장소를 사용할 수 없으면 기본 라이트 테마를 유지합니다.
}

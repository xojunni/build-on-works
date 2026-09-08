export function geolocationErrorMessage(code: number) {
  if (code === 1) return "출퇴근 인증을 위해 위치 권한을 허용해 주세요.";
  if (code === 2) return "현재 위치를 확인할 수 없습니다. 현장 근처에서 다시 시도해 주세요.";
  return "위치 확인 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
}

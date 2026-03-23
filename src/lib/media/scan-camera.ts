/**
 * バーコードスキャン用カメラ。
 * PC の内蔵カメラでは `facingMode: environment` だけだと失敗することがあるため、
 * 複数の制約を順に試し、最後に enumerateDevices で得た各 videoinput も試す。
 */
export async function getScanCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia が利用できません");
  }

  const attempts: MediaStreamConstraints[] = [
    { video: true, audio: false },
    { video: { facingMode: "environment" }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastError = e;
    }
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");
    for (const d of videoInputs) {
      if (!d.deviceId) continue;
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: d.deviceId } },
          audio: false,
        });
      } catch (e) {
        lastError = e;
      }
    }
  } catch (e) {
    lastError = e;
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  if (lastError instanceof DOMException) {
    throw lastError;
  }
  throw new Error(
    lastError != null ? String(lastError) : "カメラを取得できませんでした",
  );
}

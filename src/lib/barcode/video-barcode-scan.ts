import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from "@zxing/library";

const ZXING_FORMATS: BarcodeFormat[] = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE,
];

type BarcodeDetectorCtor = new (opts: {
  formats: string[];
}) => {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

export function hasNativeBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export type StartVideoBarcodeScanOptions = {
  videoElement: HTMLVideoElement;
  /**
   * true のとき、利用可能ならネイティブ BarcodeDetector（軽量）。なければ ZXing。
   */
  preferNative?: boolean;
  /** BarcodeDetector 向け format 名（ネイティブ利用時のみ） */
  nativeFormats?: string[];
  onDecode: (text: string) => void;
};

/**
 * 既に `srcObject` が付いた `HTMLVideoElement` に対し、連続スキャンを開始する。
 * 戻り値の `stop` でループを止める（カメラストリームの停止は呼び出し側）。
 */
export async function startVideoBarcodeScan(
  options: StartVideoBarcodeScanOptions,
): Promise<() => void> {
  const {
    videoElement,
    onDecode,
    preferNative = true,
    nativeFormats = [
      "ean_13",
      "ean_8",
      "code_128",
      "code_39",
      "itf",
      "upc_a",
      "upc_e",
      "qr_code",
    ],
  } = options;

  if (preferNative && hasNativeBarcodeDetector()) {
    const BD = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
      .BarcodeDetector;
    const detector = new BD({ formats: nativeFormats });
    let alive = true;
    const intervalMs = 400;
    const id = window.setInterval(() => {
      void (async () => {
        if (!alive || videoElement.readyState < 2) return;
        try {
          const codes = await detector.detect(videoElement);
          if (codes.length > 0) {
            alive = false;
            window.clearInterval(id);
            onDecode(codes[0].rawValue);
          }
        } catch {
          /* フレーム単位の失敗は無視 */
        }
      })();
    }, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }

  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS],
    /* 映像がやや暗い・小さいときの再探索（CPU はやや増える） */
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints);
  const controls = await reader.decodeFromVideoElement(
    videoElement,
    (result, error, ctrl) => {
      if (result) {
        ctrl.stop();
        onDecode(result.getText());
        return;
      }
      if (error && !(error instanceof NotFoundException)) {
        console.warn("[barcode scan]", error);
      }
    },
  );
  return () => {
    try {
      controls.stop();
    } catch {
      /* noop */
    }
  };
}

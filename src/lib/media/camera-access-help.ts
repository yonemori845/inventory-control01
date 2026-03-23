/**
 * カメラ（getUserMedia）が使えないときの、ユーザー向け説明文を組み立てる。
 */

export function getCameraPrerequisiteMessage(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) {
    return [
      "このページの開き方では、ブラウザがカメラアクセスを許可しません（セキュリティ制限）。",
      "",
      "次のいずれかで開き直してください。",
      "・同じPCなら: アドレスを http://localhost:3000 または http://127.0.0.1:3000 にする（LANのIPアドレスでは不可なことが多いです）。",
      "・スマホから同じWi‑FiのPCに繋ぐ場合: PC側で HTTPS 付き開発サーバーを立てるか、ngrok 等で https://… として公開してください。",
      "・手入力: JAN をキーボードで入力すればカメラなしで利用できます。",
    ].join("\n");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "このブラウザまたは環境ではカメラ API（getUserMedia）が利用できません。別ブラウザを試すか、JAN を手入力してください。";
  }
  return null;
}

export function explainGetUserMediaFailure(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return [
          "カメラの使用が「ブロック」されています。",
          "アドレスバー左の鍵アイコンまたはカメラアイコンをクリックし、このサイトのカメラを「許可」に変更してから、もう一度「カメラスキャン」を押してください。",
        ].join("");
      case "NotFoundError":
        return "カメラが見つかりません。機器にカメラが付いているか、設定で無効になっていないか確認してください。";
      case "NotReadableError":
      case "TrackStartError":
        return [
          "カメラの映像を開始できませんでした（他アプリがカメラを使用中、またはドライバーの問題のことがあります）。",
          "Zoom・Teams・他のブラウザタブのビデオ通話を終了してから再試行するか、PCを一度再起動してから試してください。",
        ].join("");
      case "OverconstrainedError":
        return "希望したカメラ条件を満たすデバイスがありません。別のカメラを試すか、JAN を手入力してください。";
      case "SecurityError":
        return [
          "ブラウザがセキュリティ上の理由でカメラを拒否しました。",
          "http://localhost:3000 または https:// で提供されているURLから開き直してください。",
        ].join("");
      default:
        break;
    }
  }

  const raw = error instanceof Error ? error.message : String(error);
  if (/could not start video source/i.test(raw)) {
    return [
      "カメラの映像を開始できませんでした。",
      "よくある原因: 別アプリがカメラを掴んでいる、USBカメラの接触不良、ドライバの不調。",
      "対処: ビデオ会議アプリを終了する・カメラの抜き差し・ブラウザの再起動を試し、それでもダメなら JAN を手入力してください。",
    ].join("");
  }

  const suffix = raw ? `（技術メッセージ: ${raw}）` : "";
  return `カメラを起動できませんでした。${suffix}`;
}

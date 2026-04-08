# 06. 個人情報・倫理

- 同意画面に必須チェックボックスを置き、`consent_given`, `consent_version`, `consented_at` を保存する
- 氏名、所属、連絡先、患者情報などの個人を特定できる情報は入力しないよう明示する
- raw IP は新規保存しない
- 参加者向け表示用サマリーと研究用 coding を分け、主要分析は participant-only の発話を対象にする
- 管理画面の認証は user/pass + cookie session に統一し、URL query に認証情報を載せない

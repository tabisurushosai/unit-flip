# unit-flip (たんい変換) 仕様書 v1_0
## ゴール
長さ・重さ・温度・体積の単位をオフラインで変換するChrome拡張。入力即変換。
## 絶対制約
外部API・通信なし(為替レートは扱わない)/chrome.storage.localのみ/権限storageのみ/MV3・TS・Vite/UIはpopup内で完結。
## 機能
カテゴリ選択(長さ/重さ/温度/体積)/相互変換/入力即時変換・単位スワップ/最後の選択を保存・復元/i18n ja-en/無料は4カテゴリ、Premium($3買い切り7日トライアル)で面積/速度/データ量追加+お気に入りペア。
## 完了条件
npm run build成功・dist生成・_locales ja/en・icons16/48/128・release/unit-flip.zip生成。

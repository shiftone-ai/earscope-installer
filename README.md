# EARSCOPE Installer

Windows 向け EARSCOPE インストーラーです。

## 配布物の構成

```
dist/
├── installer.exe                           # インストーラー
├── uninstaller.exe                         # アンインストーラー
├── launcher.exe                            # ランチャー
├── README.md                               # このファイル
├── win32-x64/
│   ├── bin.zip                             # EARSCOPE_Viewer
│   └── ElectronViewer-win32-x64.zip        # ElectronViewer
└── ync/                                    # YNCneo インストーラー（オプション）
    └── ...
```

## インストール方法

### 基本的な使い方

1. `installer.exe` を**管理者として実行**します
2. インストールが自動的に進行します
3. 完了後、デスクトップに EARSCOPE ショートカットが作成されます

### インストールされるもの

- **winget** - Windows パッケージマネージャー（未インストールの場合）
- **Google Chrome** - ブラウザ（未インストールの場合）
- **YNCneo** - 通信ソフトウェア（ync フォルダが存在する場合）
- **EARSCOPE** - `C:\hes\` にインストール
  - `C:\hes\EARSCOPE_Viewer\` - EARSCOPE Viewer
  - `C:\hes\ElectronViewer-win32-x64\` - Electron Viewer
- **デスクトップショートカット** - launcher.exe へのショートカット
- **スタートアップ登録** - ElectronViewer が Windows 起動時に自動実行

## アンインストール方法

1. `uninstaller.exe` を**管理者として実行**します
2. アンインストールが自動的に進行します

### 削除されるもの

- `C:\hes\` ディレクトリ
- デスクトップの EARSCOPE ショートカット
- スタートアップ登録

### 削除されないもの

以下はアンインストールしても残ります：

- Google Chrome
- winget
- YNCneo

## YNCneo (ゆかコネNeo) の初期設定

**重要**: YNCneo は自動インストールされますが、初回起動時に設定ファイルのインポートが必要です。

1. YNCneo（ゆかコネNeo）を起動します
2. `ync/settings` フォルダ内の設定ファイルをインポートします
3. 設定のインポートは初回のみ必要です

この設定は自動化されていないため、手動で行ってください。

## ランチャー

`launcher.exe` は以下のアプリケーションを同時起動します：

- EARSCOPE_Viewer
- ElectronViewer
- YNC Neo（インストールされている場合）

デスクトップショートカットからも起動できます。

## コマンドラインオプション

### --dry-run

実際の変更を行わずにテスト実行します。何が実行されるかを確認できます。

```
installer.exe --dry-run
uninstaller.exe --dry-run
```

### --assets-dir

アセットディレクトリのパスを指定します（installer.exe のみ）。

```
installer.exe --assets-dir C:\path\to\assets
```

デフォルトでは、installer.exe と同じディレクトリからアセットを読み込みます。

## システム要件

- Windows 10 以降（64bit）
- 管理者権限（インストール・アンインストール時）

## トラブルシューティング

### 「管理者として実行してください」と表示される

installer.exe または uninstaller.exe を右クリックし、「管理者として実行」を選択してください。

### インストールが途中で失敗する

`--dry-run` オプションで実行し、どの手順で問題が発生するか確認してください。

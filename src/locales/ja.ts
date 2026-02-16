import { Translations } from './types';

export const ja: Translations = {
    common: {
        back: "翻訳画面に戻る",
        save: "保存",
        saved: "設定を保存しました",
        cancel: "キャンセル",
        confirm: "確認",
    },
    translation: {
        placeholder: "翻訳するテキストを入力...",
        translating: "翻訳中...",
        copy: "コピー",
        copied: "コピーしました！",
        clear: "クリア",
        retry: "再試行",
        autoDetect: "自動検出",
        translationFailed: "翻訳に失敗しました",
        errorOccurred: "翻訳中にエラーが発生しました。",
        ipcRendererNotFound: "IPCレンダラーが見つかりません。",
        chars: "文字",
        ready: "翻訳の準備ができました",
        beta: "ベータ版",
        copyText: "テキストをコピー",
        copyTranslation: "翻訳をコピー",
        capture: "テキストをキャプチャ (OCR)",
    },
    settings: {
        title: "設定",
        categories: {
            general: "一般設定",
            externalAi: "外部AI設定",
            languages: "言語設定",
        },
        general: {
            title: "一般設定",
            description: "アプリケーションの動作設定",
            startup: {
                title: "スタートアップ",
                label: "ログイン時に自動でアプリを起動する",
            },
            window: {
                title: "ウィンドウ操作",
                description: "「閉じる (X)」ボタンを押した時の動作:",
                minimize: {
                    label: "バックグラウンドで実行を続ける",
                    desc: "システムトレイに常駐します",
                },
                quit: {
                    label: "アプリケーションを終了する",
                    desc: "プロセスを完全に終了します",
                },
                ask: {
                    label: "毎回確認する",
                },
            },
        },
        externalAi: {
            title: "外部AI設定",
            description: "LLMプロバイダーのAPIキー設定",
            openai: {
                label: "OpenAI APIキー",
                desc: "GPT-4o モデルで使用します。",
            },
            anthropic: {
                label: "Anthropic APIキー",
                desc: "Claude 3.5 Sonnet / Haiku モデルで使用します。",
            },
            gemini: {
                label: "Google Gemini APIキー",
                desc: "Gemini 1.5 Pro / Flash モデルで使用します。",
            },
        },
        languages: {
            title: "言語設定",
            description: "アプリケーションの表示言語を選択",
            selectLabel: "表示言語",
        },
    },
    dialog: {
        closeTitle: "アプリケーションの終了",
        closeDesc: "アプリケーションを終了しますか？バックグラウンドで実行しておくと、他のアプリからショートカットですぐに翻訳機能を利用できます。",
        remember: "選択を記憶する",
        quitButton: "終了",
        minimizeButtons: "バックグラウンドで実行",
    },
    languages: {
        auto: "自動検出",
        en: "英語",
        ja: "日本語",
        es: "スペイン語",
        fr: "フランス語",
        de: "ドイツ語",
        zh: "中国語",
        ko: "韓国語",
    },
    engines: {
        description: {
            google: "高速 & 無料",
            native: "プライバシー重視",
            openai: "高精度",
            anthropic: "高精度",
            gemini: "高速処理",
        },
    },
};

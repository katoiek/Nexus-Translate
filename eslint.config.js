import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
    // 除外対象
    {
        ignores: [
            'dist/**',
            'electron/**',     // Electron レガシーコード（未使用）
            '.eslintrc.cjs',
            'eslint.config.js',
        ],
    },
    // Node.js 環境ファイル (vite.config.ts 等)
    {
        files: ['vite.config.ts', 'postcss.config.js', 'tailwind.config.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    // フロントエンド TypeScript/TSX ファイル
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            globals: {
                ...globals.browser,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...tsPlugin.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            // 外部 API レスポンスで any が必要なため警告なしに設定
            '@typescript-eslint/no-explicit-any': 'off',
            // useEffect の deps（意図的に除外しているケースがあるため無効化）
            'react-hooks/exhaustive-deps': 'off',
            // react-refresh ルール
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
        },
    },
    // Context・UI ユーティリティファイル（コンポーネント以外もエクスポートするため react-refresh ルール除外）
    // ※ この設定は後に評価されるため、上記の warn 設定を上書きする
    {
        files: ['src/contexts/**', 'src/components/ui/**'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
];

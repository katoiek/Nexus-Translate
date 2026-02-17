export interface Translations {
    common: {
        back: string;
        save: string;
        saved: string;
        cancel: string;
        confirm: string;
    };
    translation: {
        placeholder: string;
        translating: string;
        copy: string;
        copied: string;
        clear: string;
        retry: string;
        autoDetect: string;
        translationFailed: string;
        errorOccurred: string;
        ipcRendererNotFound: string;
        chars: string;
        ready: string;
        copyText: string;
        copyTranslation: string;
        capture: string;
    };
    settings: {
        title: string;
        categories: {
            general: string;
            appearance: string;
            externalAi: string;
            languages: string;
        };
        general: {
            title: string;
            description: string;
            startup: {
                title: string;
                label: string;
            };
            window: {
                title: string;
                description: string;
                minimize: {
                    label: string;
                    desc: string;
                };
                quit: {
                    label: string;
                    desc: string;
                };
                ask: {
                    label: string;
                };
            };
        };
        appearance: {
            title: string;
            description: string;
            theme: {
                label: string;
                galaxy: string;
                emerald: string;
                sky: string;
                amethyst: string;
                ruby: string;
                midnight: string;
            };
        };
        externalAi: {
            title: string;
            description: string;
            openai: {
                label: string;
                desc: string;
            };
            anthropic: {
                label: string;
                desc: string;
            };
            gemini: {
                label: string;
                desc: string;
            };
        };
        languages: {
            title: string;
            description: string;
            selectLabel: string;
        };
    };
    dialog: {
        closeTitle: string;
        closeDesc: string;
        remember: string;
        quitButton: string;
        minimizeButtons: string;
    };
    languages: {
        auto: string;
        en: string;
        ja: string;
        es: string;
        fr: string;
        de: string;
        zh: string;
        ko: string;
        it: string;
        pt: string;
        ru: string;
        nl: string;
        pl: string;
        tr: string;
        vi: string;
        th: string;
        id: string;
        hi: string;
        ar: string;
        bn: string;
        cs: string;
        da: string;
        fi: string;
        el: string;
        he: string;
        hu: string;
        ms: string;
        no: string;
        ro: string;
        sv: string;
        tl: string;
        uk: string;
    };
    engines: {
        description: {
            google: string;
            native: string;
            openai: string;
            anthropic: string;
            gemini: string;
        };
    };
}

import { useState, useEffect } from 'react';

// localStorage に値を保存・復元する useState。
// 初期値は localStorage の保存値があればそれを、無ければ fallback を使う。
// （A useState that persists to localStorage and restores on next launch.）
export function usePersistedState<T extends string>(
    key: string,
    fallback: T,
): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(() => (localStorage.getItem(key) as T) || fallback);

    useEffect(() => {
        localStorage.setItem(key, value);
    }, [key, value]);

    return [value, setValue];
}

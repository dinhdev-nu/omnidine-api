import { iterator } from "rxjs/internal/symbol/iterator"


export const ObjectUtil = {
    // Loại bỏ các trường có giá trị null
    removeNullFields<T extends object>(obj: T): Partial<T> {
        if (Array.isArray(obj)) {
            return obj
                .filter(i => i !== null)
                .map(i => (typeof i === 'object' && i !== null ? this.removeNullFields(i as object) : i)) as unknown as Partial<T>;
        }

        return Object.fromEntries(
            Object.entries(obj)
                .filter(([_, v]) => v !== null)
                .map(([k, v]) => [k, typeof v === 'object' && v !== null ? this.removeNullFields(v as object) : v])
        ) as Partial<T>;
    },

    pick<T extends object, K extends keyof T>(obj: T, keys: K[], hiddenKeys?: string[]): Pick<T, K> {
        return Object.fromEntries(
            Object.entries(obj).filter(([key]) => keys.includes(key as K) || hiddenKeys?.includes(key))
        ) as Pick<T, K>;
    },

    omit<T extends object, K extends keyof T>(obj: T, keys: K[], hiddenKeys?: string[]): Omit<T, K> {
        return Object.fromEntries(
            Object.entries(obj).filter(([key]) => !keys.includes(key as K) && !hiddenKeys?.includes(key))
        ) as Omit<T, K>;
    }
}
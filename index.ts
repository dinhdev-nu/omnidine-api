import { ObjectUtil } from "src/common/utils/object.ultil";

const obj = {
    a: 1,
    b: null,
    c: 'hello',
    d: {
        d: null,
        e: 5,
        f: {
            f: null,
            g: 'world'
        }
    },
    ab : [1, null, 3],
    ac : [
        { x: 1, y: null },
        { x: null, y: 2 },
    ]
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
        return Object.fromEntries(
            Object.entries(obj).filter(([key]) => keys.includes(key as K))
        ) as Pick<T, K>;
    }

const cleaned = pick(obj, ['a', 'c', 'd']);
console.log(cleaned);
// Output: { a: 1, c: 'hello', d: { e: 5, f: { g: 'world' } } }
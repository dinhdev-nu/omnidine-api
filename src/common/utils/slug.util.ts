import { RESERVED_SLUGS } from "../constants/reserved-slug.constant";
import { HashUtil } from "./hash.util";


export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SlugUtil = {

    isValidSlug: (slug: string): boolean => {
        const isCorrectFormat = SLUG_REGEX.test(slug);
        if (!isCorrectFormat) return false;

        const isReserved = RESERVED_SLUGS.includes(slug.toLocaleLowerCase());
        return isCorrectFormat && !isReserved;
    },
    slugify: async (text: string, isDuplicate: boolean = false): Promise<string> => {
        const slug = text.toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric characters with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
        return isDuplicate ? `${slug}-${await HashUtil.randomBytesHex(4)}` : slug;
    }

} as const
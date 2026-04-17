

export const StringUtil = {
    normalizeNullableString(
        value: string | null | undefined,
        toLowerCase = false,
    ): string | null {
        if (value === undefined || value === null) return null;

        const trimmed = value.trim();
        if (!trimmed) return null;

        return toLowerCase ? trimmed.toLowerCase() : trimmed;
    }
} as const;
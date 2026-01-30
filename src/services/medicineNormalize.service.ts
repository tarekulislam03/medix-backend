export const normalizeMedicineName = (name: string): string => {
    if (!name) return '';

    let normalized = name.toLowerCase();

    // Remove common forms
    normalized = normalized.replace(/\b(tab|tablet|tabs|cap|capsule|caps|inj|injection|syp|syrup)\b/g, '');

    // Remove symbols
    normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

    // Trim spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
};

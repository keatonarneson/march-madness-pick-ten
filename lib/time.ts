export function isLocked(lockAt: string | undefined) {
    if (!lockAt) return false;
    return Date.now() >= Date.parse(lockAt);
}

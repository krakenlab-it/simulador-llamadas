export function nextRovingValue<T extends string>(
  options: readonly T[],
  current: T,
  key: string,
): T | null {
  const index = options.indexOf(current);
  if (index < 0 || options.length === 0) return null;

  if (key === "ArrowRight" || key === "ArrowDown") {
    return options[(index + 1) % options.length] ?? current;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return options[(index - 1 + options.length) % options.length] ?? current;
  }
  if (key === "Home") return options[0] ?? current;
  if (key === "End") return options[options.length - 1] ?? current;
  return null;
}

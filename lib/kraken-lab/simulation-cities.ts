export function parseSimulationCitiesInput(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatSimulationCitiesInput(cities: string[]): string {
  return cities.join(", ");
}

export function toggleSimulationCity(cities: string[], city: string): string[] {
  const trimmed = city.trim();
  if (!trimmed) return cities;
  if (cities.includes(trimmed)) {
    return cities.filter((entry) => entry !== trimmed);
  }
  return [...cities, trimmed];
}

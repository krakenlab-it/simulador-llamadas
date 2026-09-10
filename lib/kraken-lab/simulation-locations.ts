export const SIMULATION_COUNTRIES = [
  "México",
  "Colombia",
  "Argentina",
  "Chile",
  "Perú",
  "Ecuador",
  "Guatemala",
  "Costa Rica",
  "Panamá",
  "Uruguay",
  "Paraguay",
  "Bolivia",
  "República Dominicana",
  "El Salvador",
  "Honduras",
  "Nicaragua",
  "Venezuela",
  "Estados Unidos",
  "España",
] as const;

export type SimulationCountry = (typeof SIMULATION_COUNTRIES)[number];

export const SIMULATION_CITIES_BY_COUNTRY: Record<SimulationCountry, readonly string[]> = {
  México: [
    "Ciudad de México",
    "Monterrey",
    "Guadalajara",
    "Puebla",
    "Tijuana",
    "León",
    "Querétaro",
    "Mérida",
    "San Luis Potosí",
    "Aguascalientes",
  ],
  Colombia: [
    "Bogotá",
    "Medellín",
    "Cali",
    "Barranquilla",
    "Cartagena",
    "Bucaramanga",
    "Pereira",
    "Manizales",
  ],
  Argentina: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata", "Mar del Plata"],
  Chile: ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta", "Temuco"],
  Perú: ["Lima", "Arequipa", "Trujillo", "Cusco", "Piura", "Chiclayo"],
  Ecuador: ["Quito", "Guayaquil", "Cuenca", "Ambato", "Manta"],
  Guatemala: ["Ciudad de Guatemala", "Quetzaltenango", "Antigua Guatemala", "Escuintla"],
  "Costa Rica": ["San José", "Alajuela", "Cartago", "Heredia", "Liberia"],
  Panamá: ["Ciudad de Panamá", "Colón", "David", "Santiago de Veraguas"],
  Uruguay: ["Montevideo", "Punta del Este", "Salto", "Paysandú"],
  Paraguay: ["Asunción", "Ciudad del Este", "Encarnación"],
  Bolivia: ["La Paz", "Santa Cruz de la Sierra", "Cochabamba", "Sucre"],
  "República Dominicana": ["Santo Domingo", "Santiago de los Caballeros", "La Romana"],
  "El Salvador": ["San Salvador", "Santa Ana", "San Miguel"],
  Honduras: ["Tegucigalpa", "San Pedro Sula", "La Ceiba"],
  Nicaragua: ["Managua", "León", "Granada"],
  Venezuela: ["Caracas", "Maracaibo", "Valencia", "Barquisimeto"],
  "Estados Unidos": [
    "Nueva York",
    "Los Ángeles",
    "Chicago",
    "Houston",
    "Miami",
    "Dallas",
    "San Francisco",
  ],
  España: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Málaga"],
};

export function citiesForSimulationCountry(country: string | undefined): readonly string[] {
  if (!country) return [];
  return SIMULATION_CITIES_BY_COUNTRY[country as SimulationCountry] ?? [];
}

export function isSimulationCountry(value: string): value is SimulationCountry {
  return (SIMULATION_COUNTRIES as readonly string[]).includes(value);
}

export default function HomePage() {
  return (
    <main>
      <p className="kicker">Formación comercial · Módulo 3 · Clínica en vivo</p>
      <h1>Clínica de Citas · Simulador de llamada</h1>
      <p className="lead">
        Esqueleto de aplicación para entrenar vendedores con llamadas simuladas en
        español. La interfaz de producción se implementará en PRs posteriores; el
        prototipo de referencia está en{" "}
        <code>docs/prototype/Clinica-de-Citas-Simulador-de-Llamada.html</code>.
      </p>

      <section className="card">
        <h2>Flujo previsto (MVP)</h2>
        <p>
          Elegir cliente → modo voz o texto y nivel 1–3 → cinco turnos de llamada →
          colgar y evaluar con la frase exacta que debió decir el vendedor. Victoria
          solo con día y hora concretos.
        </p>
        <span className="badge">Cornerstone: infra + esquema</span>
      </section>

      <section className="card">
        <h2>Puntos de extensión</h2>
        <ul className="extension-list">
          <li>
            <code>lib/extension-points/api.ts</code> — rutas API (sesiones, turnos,
            historial)
          </li>
          <li>
            <code>lib/extension-points/scoring.ts</code> — análisis por palabras
            clave y reglas de victoria
          </li>
          <li>
            <code>lib/extension-points/session.ts</code> — ciclo de vida de la
            llamada y Web Speech API
          </li>
          <li>
            <code>lib/db/types.ts</code> — tipos alineados con el esquema Supabase
          </li>
        </ul>
      </section>
    </main>
  );
}

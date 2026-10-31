import { useEffect, useState } from "react";

interface League {
  name: string;
  slug: string;
  ref: string;
}

export default function App() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLeagues() {
      try {
        const response = await fetch("/api/leagues", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: League[] = await response.json();
        setLeagues(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Unable to load leagues"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadLeagues();

    return () => controller.abort();
  }, []);

  return (
    <main className="dashboard">
      <header>
        <h1>FootyPal</h1>
        <p>Football leagues</p>
      </header>

      {loading && <p>Loading leagues...</p>}

      {error && <p role="alert">Error: {error}</p>}

      {!loading && !error && (
        <div className="league-grid">
          {leagues?.map((league) => (
            <div className="league" key={league.slug}>
              <span>{league.name}</span>
              <small>{league.slug}</small>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
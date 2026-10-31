import IconCarWrench from "~icons/mdi/car-wrench";
import { config } from "../lib/config";

export default function Welcome() {
  return (
    <main>
      <IconCarWrench width={48} height={48} aria-hidden="true" />
      <h1>lofipix</h1>
      <p>
        Offline-first photo capture for panel-beaters. Capture damage photos in the mobile PWA,
        sync them to the cloud, and review albums from the website.
      </p>
      <p>
        <a href="/auth">Sign in / Register</a> · <a href={config.WEBAPP_URL} target="_blank" rel="noopener noreferrer">Open PWA</a>
      </p>
      <section>
        <h2>Features</h2>
        <ul>
          <li>Offline-first PWA capture: works without a connection.</li>
          <li>Cloud albums with organisation sharing.</li>
          <li>Review and administration from the website.</li>
        </ul>
      </section>
    </main>
  );
}

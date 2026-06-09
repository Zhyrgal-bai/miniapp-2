import type { WebProfileView } from "../../../utils/webProfileUx";
import "./webShowcase.css";

type Props = {
  profile: WebProfileView | null;
};

/** Public "about / story" block (web mode only). */
export function WebShowcaseAbout({ profile }: Props): React.ReactElement | null {
  const story = profile?.story ?? null;
  if (story == null) return null;
  return (
    <section className="sf-showcase-about" aria-label="О магазине">
      <h2 className="sf-showcase-about__title">О магазине</h2>
      <p className="sf-showcase-about__text">{story}</p>
    </section>
  );
}

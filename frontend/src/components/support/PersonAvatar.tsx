import "./supportUi.css";

type PersonAvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function initialFromName(name: string | null | undefined): string {
  const t = name?.trim();
  if (!t) return "?";
  return t.charAt(0).toUpperCase();
}

export function PersonAvatar({
  name,
  photoUrl,
  size = "md",
  className = "",
}: PersonAvatarProps) {
  const initial = initialFromName(name);
  const sizeClass = `sf-person-avatar--${size}`;
  return (
    <span
      className={`sf-person-avatar ${sizeClass} ${className}`.trim()}
      aria-hidden={photoUrl ? undefined : true}
    >
      {photoUrl ? (
        <img className="sf-person-avatar__img" src={photoUrl} alt="" />
      ) : (
        <span className="sf-person-avatar__initial">{initial}</span>
      )}
    </span>
  );
}

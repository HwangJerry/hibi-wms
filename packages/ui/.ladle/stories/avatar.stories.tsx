import "../../tokens/tokens.css";
import { Avatar } from "../../src";

export const AvatarLight = () => (
  <div className="min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="flex items-end gap-3">
      <Avatar name="Aria Kessler" size="sm" />
      <Avatar name="Dev Maddox" size="md" />
      <Avatar name="Finance Team" size="lg" fallback="FT" />
    </div>
  </div>
);

export const AvatarDark = () => (
  <div className="dark min-h-screen bg-surface-1 p-8 text-text-primary">
    <div className="flex items-end gap-3">
      <Avatar name="Aria Kessler" size="sm" />
      <Avatar name="Dev Maddox" size="md" />
      <Avatar name="Finance Team" size="lg" fallback="FT" />
    </div>
  </div>
);

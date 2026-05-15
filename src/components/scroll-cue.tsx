"use client";

import { useEffect, useState } from "react";

export function ScrollCue({ targetId }: { targetId: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setHidden(window.scrollY > 24);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  return (
    <a
      aria-hidden={hidden}
      aria-label="Scroll to subjects"
      className="scroll-cue"
      data-hidden={hidden}
      href={`#${targetId}`}
    >
      <span />
    </a>
  );
}

"use client";

import { useEffect, useRef } from "react";

export function DemoNotice() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    window.history.replaceState({}, "", "/");
  }, []);

  return (
    <dialog className="demo-notice" ref={dialogRef}>
      <form method="dialog">
        <p className="eyebrow">Portfolio demo</p>
        <h2>This is the demo version of IHateGCSE</h2>
        <p>
          The real site is private. This demo gives you the same experience so you can explore papers and try the
          marking flow.
        </p>
        <button type="submit">Explore the demo</button>
      </form>
    </dialog>
  );
}

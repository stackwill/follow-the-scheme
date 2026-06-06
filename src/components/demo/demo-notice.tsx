"use client";

import { useEffect, useRef } from "react";

export function DemoNotice() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    window.history.replaceState({}, "", "/");
  }, []);

  return (
    <dialog className="demo-notice study-callout" ref={dialogRef}>
      <form method="dialog">
        <span className="active-course-pill">Portfolio demo</span>
        <strong>This is the demo version of IHateGCSE</strong>
        <span>
          The real site is private. This demo gives you the same experience so you can explore papers and try the
          marking flow.
        </span>
        <button type="submit">Explore the demo</button>
      </form>
    </dialog>
  );
}

"use client";

import { useMemo, useState } from "react";

import type { SubjectPreferenceOption } from "@/lib/subjects/preferences";

type SubjectPreferencesModalProps = {
  action: (formData: FormData) => Promise<void>;
  initialOpen: boolean;
  initialSelectedIds: string[];
  options: SubjectPreferenceOption[];
};

export function SubjectPreferencesModal({
  action,
  initialOpen,
  initialSelectedIds,
  options,
}: SubjectPreferencesModalProps) {
  const [open, setOpen] = useState(initialOpen);
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelectedIds));
  const selectedCount = selectedIds.size;
  const selectedCourseCount = useMemo(
    () =>
      options
        .filter((option) => selectedIds.has(option.id))
        .reduce((count, option) => count + option.courseKeys.length, 0),
    [options, selectedIds],
  );

  function toggleOption(optionId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }

      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(options.map((option) => option.id)));
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  return (
    <>
      <button className="subject-preferences-trigger" onClick={() => setOpen(true)} type="button">
        Subjects
      </button>

      {open ? (
        <div className="subject-preferences-overlay" role="presentation">
          <section
            aria-labelledby="subject-preferences-title"
            aria-modal="true"
            className="subject-preferences-dialog"
            role="dialog"
          >
            <div className="subject-preferences-dialog__header">
              <div>
                <p className="eyebrow">Welcome</p>
                <h2 id="subject-preferences-title">Choose your subjects</h2>
                <p>
                  Pick what you take and the home page will stay focused on those papers.
                </p>
              </div>
              {!initialOpen ? (
                <button
                  aria-label="Close subject preferences"
                  className="subject-preferences-dialog__close"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Close
                </button>
              ) : null}
            </div>

            <form action={action} className="subject-preferences-form">
              {[...selectedIds].map((optionId) => (
                <input key={optionId} name="preferenceIds" type="hidden" value={optionId} />
              ))}

              <div className="subject-preferences-toolbar">
                <span>
                  {selectedCount} selected
                  {selectedCourseCount > selectedCount ? `, ${selectedCourseCount} courses` : ""}
                </span>
                <div>
                  <button onClick={selectAll} type="button">
                    Select all
                  </button>
                  <button onClick={clearAll} type="button">
                    Clear
                  </button>
                </div>
              </div>

              <div className="subject-preferences-grid">
                {options.map((option) => {
                  const checked = selectedIds.has(option.id);

                  return (
                    <label className="subject-preference-option" data-selected={checked} key={option.id}>
                      <input
                        checked={checked}
                        name={`preference-${option.id}`}
                        onChange={() => toggleOption(option.id)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="subject-preferences-actions">
                <button disabled={selectedCount === 0} type="submit">
                  Save subjects
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

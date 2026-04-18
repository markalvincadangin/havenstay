# Forensic UI Design Patterns

## 1. The "Forensic Frictionless" Philosophy
HavenStay unique design aesthetic is built on the tension between high-integrity data auditing (Forensic) and effortless administrative workflows (Frictionless).

---

## 2. Token: Forensic Metadata Label
Used for machine-generated IDs, timestamps, and secondary classification.
- **CSS:** `text-[10px] font-black uppercase tracking-widest text-stone-400`.
- **Use Cases:**
  - Table column headers.
  - Registry IDs (`#TENANT-001`).
  - "Last Updated" markers.
  - Audit action badges.

---

## 3. Pattern: The "Snapshot" Impact Preview
Every action that modifies a financial balance must show a preview of the change.
- **Structure:** A nested `Section` within a form.
- **Visual:** Current Balance -> **Modified Balance** (Teal Highlight).
- **Goal:** Reduce data entry errors for rent increases or utility updates.

---

## 4. Component: Correlation Chip
A visual representation of the `correlation_id` linking a UI action to its backend logging cycle.
- **Visual:** Small, pill-shaped badge in `DM Mono`.
- **Interaction:** Hovering shows "Linked to Transaction Log #TX-123".

---

## 5. Visual Hierarchy: Strip Titles
Registry cards must use All-Caps titles to distinguish structural sections from content.
- **CSS:** `.hs-strip-title` (`text-xs font-black uppercase tracking-widest`).
- **Context:** Card header strips only.

---

## 6. Tone & Copy: Operational First
Avoid generic "Success" messages.
- **Generic:** "Saved successfully."
- **Forensic:** "Tenant profile updated and audit log entry created."
- **Generic:** "Room deleted."
- **Forensic:** "Room archived; history preserved in audit trail."

---

*Aligned to: MASTER.md v5.0.0 · SDD §2.0*

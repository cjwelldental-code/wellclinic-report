'use client';

export function PrintButton({ label = '인쇄 · PDF 저장' }: { label?: string }) {
  return (
    <button type="button" className="btn-ghost no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}

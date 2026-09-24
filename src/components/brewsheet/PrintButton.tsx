'use client';

export default function PrintButton() {
  return (
    <button type="button" className="btn btn-primary text-nowrap" onClick={() => window.print()}>
      <i className="fas fa-print me-2"></i>
      Print brew sheet
    </button>
  );
}

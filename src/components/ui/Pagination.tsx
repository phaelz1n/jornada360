import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
  totalItems,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  totalItems: number;
}) {
  if (totalItems === 0) return null;
  return (
    <div className="pagination">
      <span>
        Página {page} de {totalPages} · {totalItems} registros
      </span>
      <div className="controls">
        <button className="btn btn-sm" onClick={onPrev} disabled={page <= 1}>
          <ChevronLeft size={14} />
        </button>
        <button className="btn btn-sm" onClick={onNext} disabled={page >= totalPages}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

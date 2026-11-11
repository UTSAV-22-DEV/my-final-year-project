export function Pagination({ info, onPage }) {
  if (!info || info.pages < 2) return null;
  return <div className="pagination"><button className="button secondary small" disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>Previous</button><span>Page {info.page} of {info.pages} · {info.total} records</span><button className="button secondary small" disabled={info.page >= info.pages} onClick={() => onPage(info.page + 1)}>Next</button></div>;
}

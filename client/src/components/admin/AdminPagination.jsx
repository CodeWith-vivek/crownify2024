export function AdminPagination({ currentPage, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pageNumbers = [];
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="pagination-area mt-15 mb-50">
      <nav aria-label="Page navigation example">
        <ul className="pagination justify-content-center">
          {currentPage > 1 && (
            <li className="page-item">
              <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); onChange(currentPage - 1); }}>
                «
              </a>
            </li>
          )}
          <li className={`page-item ${currentPage === 1 ? "active" : ""}`}>
            <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); onChange(1); }}>
              01
            </a>
          </li>
          {currentPage > 4 && (
            <li className="page-item disabled">
              <span className="page-link">...</span>
            </li>
          )}
          {pageNumbers.map((i) => (
            <li className={`page-item ${i === currentPage ? "active" : ""}`} key={i}>
              <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); onChange(i); }}>
                {String(i).padStart(2, "0")}
              </a>
            </li>
          ))}
          {currentPage < totalPages - 3 && (
            <li className="page-item disabled">
              <span className="page-link">...</span>
            </li>
          )}
          {totalPages > 1 && (
            <li className={`page-item ${currentPage === totalPages ? "active" : ""}`}>
              <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); onChange(totalPages); }}>
                {String(totalPages).padStart(2, "0")}
              </a>
            </li>
          )}
          {currentPage < totalPages && (
            <li className="page-item">
              <a className="page-link" href="#" onClick={(e) => { e.preventDefault(); onChange(currentPage + 1); }}>
                »
              </a>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}

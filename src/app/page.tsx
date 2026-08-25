import ProjectSearch from "@/components/project-search";
import { loadProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await loadProjects();

  return (
    <main>
      <header className="service-header">
        <div className="header-inner">
          <span className="wordmark" aria-label="청년고용 관리 서비스">청년고용 관리</span>
          <span className="service-badge">2026</span>
        </div>
      </header>

      <div className="page-shell">
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">청년고용 의무채용 관리</p>
          <h1 id="page-title">2026년 청년고용 의무채용 현황 확인</h1>
          <p className="hero-description">
            수행 중인 과제명을 검색하여 청년 의무채용 현황을 확인해 주세요.
          </p>
        </section>

        {result.ok ? (
          <ProjectSearch projects={result.projects} />
        ) : (
          <section className="error-panel" role="alert">
            <span className="error-icon" aria-hidden="true">!</span>
            <div>
              <h2>과제정보를 불러오지 못했습니다</h2>
              <p>{result.message}</p>
            </div>
          </section>
        )}
      </div>

      <footer>
        <div className="footer-inner">
          <span>청년고용 의무채용 관리 서비스</span>
          <span>문의는 사업 담당자에게 연락해 주세요.</span>
        </div>
      </footer>
    </main>
  );
}

import React, { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useMatch, useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav.tsx";
import { Hud } from "../components/Hud.tsx";
import { Fallback2D } from "../features/office/Fallback2D.tsx";
import { useReducedMotion } from "../lib/hooks.ts";
import { ActivityPanel } from "../panels/ActivityPanel.tsx";
import { ApprovalsPanel } from "../panels/ApprovalsPanel.tsx";
import { DivisionPanel, DivisionsPanel } from "../panels/DivisionsPanel.tsx";
import { ProjectPanel } from "../panels/ProjectPanel.tsx";
import { ProjectsPanel } from "../panels/ProjectsPanel.tsx";
import { ReportPanel, ReportsPanel } from "../panels/ReportsPanel.tsx";
import { useEnvironmentClock } from "../state/env.ts";
import { useLiveOffice } from "../state/store.ts";

const OfficeCanvas = lazy(() => import("../features/office/OfficeCanvas.tsx"));

function hasWebGL(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

function Shell() {
  useLiveOffice();
  useEnvironmentClock();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const selectedId = useMatch("/divisions/:id")?.params.id ?? null;
  const reducedMotion = useReducedMotion();
  const webgl = useMemo(hasWebGL, []);

  const select = (id: string) => navigate(`/divisions/${id}`);

  return (
    <div className="app">
      <main className="stage">
        {webgl ? (
          <Suspense fallback={<p className="stage-note">Menyiapkan kantor…</p>}>
            <OfficeCanvas
              selectedId={selectedId}
              panelOpen={pathname !== "/"}
              reducedMotion={reducedMotion}
              onSelect={select}
              onOpenProjects={() => navigate("/projects")}
            />
          </Suspense>
        ) : (
          <Fallback2D onSelect={select} />
        )}
      </main>

      <Hud selectedId={selectedId} />

      <Routes>
        <Route path="/" element={null} />
        <Route path="/projects" element={<ProjectsPanel />} />
        <Route path="/projects/:id" element={<ProjectPanel />} />
        <Route path="/reports" element={<ReportsPanel />} />
        <Route path="/reports/:id" element={<ReportPanel />} />
        <Route path="/approvals" element={<ApprovalsPanel />} />
        <Route path="/activity" element={<ActivityPanel />} />
        <Route path="/divisions" element={<DivisionsPanel />} />
        <Route path="/divisions/:id" element={<DivisionPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav />
    </div>
  );
}

export const App: React.FC = () => (
  <BrowserRouter>
    <Shell />
  </BrowserRouter>
);

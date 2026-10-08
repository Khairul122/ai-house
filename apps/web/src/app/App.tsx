import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useMatch, useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav.tsx";
import { CommandPalette } from "../components/CommandPalette.tsx";
import { Hud } from "../components/Hud.tsx";
import { Minimap } from "../components/Minimap.tsx";
import { Roster } from "../components/Roster.tsx";
import { Toasts } from "../components/Toasts.tsx";
import { ViewControls } from "../components/ViewControls.tsx";
import { Fallback2D } from "../features/office/Fallback2D.tsx";
import { isTyping } from "../lib/fullscreen.ts";
import { useReducedMotion } from "../lib/hooks.ts";
import { ActivityPanel } from "../panels/ActivityPanel.tsx";
import { ApprovalsPanel } from "../panels/ApprovalsPanel.tsx";
import { DivisionPanel, DivisionsPanel } from "../panels/DivisionsPanel.tsx";
import { FloorPanel, FloorsPanel } from "../panels/FloorsPanel.tsx";
import { ProjectPanel } from "../panels/ProjectPanel.tsx";
import { ProjectsPanel } from "../panels/ProjectsPanel.tsx";
import { ReportPanel, ReportsPanel } from "../panels/ReportsPanel.tsx";
import { SocialPanel } from "../panels/SocialPanel.tsx";
import { useEnvironmentClock } from "../state/env.ts";
import { getDivisions, useLiveOffice } from "../state/store.ts";

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
  const [palette, setPalette] = useState(false);

  // Pintasan global: Ctrl K atau / membuka palet, angka memilih divisi, [ dan ] berpindah divisi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((o) => !o);
        return;
      }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const ids = getDivisions().map((d) => d.id);
      if (e.key === "/" || e.key === "?") {
        e.preventDefault();
        setPalette(true);
      } else if (/^[0-9]$/.test(e.key)) {
        const id = ids[e.key === "0" ? 9 : Number(e.key) - 1];
        if (id) navigate(`/divisions/${id}`);
      } else if ((e.key === "[" || e.key === "]") && ids.length) {
        const at = selectedId ? ids.indexOf(selectedId) : -1;
        const step = e.key === "]" ? 1 : -1;
        navigate(`/divisions/${ids[(at + step + ids.length) % ids.length]}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, selectedId]);

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
              onOpenFloor={(id) => navigate(`/floors/${id}`)}
            />
          </Suspense>
        ) : (
          <Fallback2D onSelect={select} />
        )}
      </main>

      <Hud onOpenPalette={() => setPalette(true)} />
      <Roster selectedId={selectedId} />
      {webgl && <Minimap selectedId={selectedId} />}
      {webgl && <ViewControls />}

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
        <Route path="/floors" element={<FloorsPanel />} />
        <Route path="/floors/:id" element={<FloorPanel />} />
        <Route path="/social" element={<SocialPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav />
      <Toasts />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

export const App: React.FC = () => (
  <BrowserRouter>
    <Shell />
  </BrowserRouter>
);

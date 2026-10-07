import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout.tsx";
import { ActivityPage } from "../features/activity/ActivityPage.tsx";
import { ApprovalsPage } from "../features/approvals/ApprovalsPage.tsx";
import { DivisionsPage } from "../features/divisions/DivisionsPage.tsx";
import { HousePage } from "../features/house/HousePage.tsx";
import { ProjectsPage } from "../features/projects/ProjectsPage.tsx";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HousePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/divisions" element={<DivisionsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};
